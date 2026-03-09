# functions/chats/handler.py
import base64
import json
import os
import traceback
import uuid
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError
from common.db import SessionLocal
from common.i18n import get_requested_lang
from common.models import BookingORM, ProfileORM, UserORM
from common.translate import (  # ✅ only used on READ path (safe)
    translate_text, translate_text_auto)

dynamodb = boto3.resource("dynamodb")
CHAT_CONVERSATIONS_TABLE = os.environ["CHAT_CONVERSATIONS_TABLE"]
CHAT_MESSAGES_TABLE = os.environ["CHAT_MESSAGES_TABLE"]
conversations_table = dynamodb.Table(CHAT_CONVERSATIONS_TABLE)
messages_table = dynamodb.Table(CHAT_MESSAGES_TABLE)

CHAT_CONNECTIONS_TABLE = os.environ.get("CHAT_CONNECTIONS_TABLE", "")
WS_API_ID = os.environ.get("WS_API_ID", "")
WS_STAGE = os.environ.get("WS_STAGE", os.environ.get("STAGE", "dev"))
AWS_REGION = os.environ.get("AWS_REGION", os.environ.get("AWS_DEFAULT_REGION", "ap-south-1"))
connections_table = dynamodb.Table(CHAT_CONNECTIONS_TABLE) if CHAT_CONNECTIONS_TABLE else None

# If your lambda is in private subnets without NAT, execute-api/translate calls can fail.
# We keep WS notify best-effort (never throws), and we do translation ONLY on read.
CORS = {
    "content-type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,Accept-Language,x-language,X-User-Id",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
}


def _resp(status: int, body: Any = None):
    return {
        "statusCode": status,
        "headers": CORS,
        "body": "" if body is None else json.dumps(body),
    }


def _now_iso_micro() -> str:
    return datetime.utcnow().isoformat(timespec="microseconds") + "Z"


def _make_sk(created_at: str, mid: str) -> str:
    # legacy sk format (your old table used booking_id + sk)
    return f"{created_at}#{mid}"


def _extract_created_at(item: dict) -> str:
    ca = item.get("created_at")
    if ca:
        return str(ca)
    sk = str(item.get("sk") or "")
    return sk.split("#", 1)[0] if "#" in sk else sk


def _json_body(event) -> Dict[str, Any]:
    raw = event.get("body") or ""
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        raise ValueError("Invalid JSON body")


def _get_booking_id_from_path(event) -> Optional[str]:
    pp = event.get("pathParameters") or {}
    return (
        pp.get("booking_id")
        or pp.get("bookingId")
        or pp.get("id")
        or pp.get("chat_id")
        or pp.get("chatId")
    )


def _get_me(event) -> Tuple[str, Dict[str, Any]]:
    headers = event.get("headers") or {}
    auth_header = headers.get("authorization") or headers.get("Authorization")

    sub = None
    payload: Dict[str, Any] = {}

    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header[7:]
        parts = token.split(".")
        if len(parts) != 3:
            raise PermissionError("Invalid token format")

        payload_b64 = parts[1]
        padding = 4 - (len(payload_b64) % 4)
        if padding != 4:
            payload_b64 += "=" * padding

        payload_json = base64.urlsafe_b64decode(payload_b64).decode("utf-8")
        payload = json.loads(payload_json)

        sub = (
            payload.get("sub")
            or payload.get("cognito:username")
            or payload.get("username")
            or payload.get("email")
        )
        if not sub:
            raise PermissionError("No user identifier in token")

    if not sub:
        sub = (headers.get("x-user-id") or headers.get("X-User-Id") or "").strip()
        if not sub:
            raise PermissionError("Unauthorized: missing user identity")

    session = SessionLocal()
    try:
        user = session.query(UserORM).filter(UserORM.cognito_sub == str(sub)).first()
        if not user:
            raise PermissionError("User not found for token (cognito_sub not registered)")
        return str(user.id), payload
    finally:
        session.close()


def _get_booking_or_404(session, booking_id) -> BookingORM:
    try:
        bid = int(booking_id)
    except (TypeError, ValueError):
        raise ValueError("Invalid booking_id")

    booking = session.query(BookingORM).filter(BookingORM.id == bid).first()
    if not booking:
        raise KeyError("Booking not found")
    return booking


def _ensure_participant(booking: BookingORM, me_user_id: str) -> None:
    host_id = str(getattr(booking, "host_user_id", ""))
    guest_id = str(getattr(booking, "guest_user_id", ""))
    if me_user_id not in (host_id, guest_id):
        raise PermissionError("Forbidden: not a participant of this booking")


def _get_other_participant(booking: BookingORM, me_user_id: str) -> Tuple[str, str]:
    host_id = str(getattr(booking, "host_user_id"))
    guest_id = str(getattr(booking, "guest_user_id"))
    if me_user_id == host_id:
        return guest_id, "guest"
    return host_id, "host"


def _safe_user_profile(session, user_id: str) -> Tuple[str, Optional[str]]:
    u = session.query(UserORM).filter(UserORM.id == user_id).first()
    if not u:
        return "User", None

    prof = session.query(ProfileORM).filter(ProfileORM.user_id == user_id).first()
    name = None
    avatar = None
    if prof:
        name = getattr(prof, "full_name", None) or getattr(prof, "name", None)
        avatar = getattr(prof, "avatar_url", None) or getattr(prof, "photo_url", None)
    if not name:
        name = getattr(u, "name", None) or getattr(u, "full_name", None) or getattr(u, "first_name", None)
    if not name:
        name = getattr(u, "email", None) or "User"
    return str(name), (str(avatar) if avatar else None)


def _get_user_preferred_lang(user_id: str) -> str:
    db = SessionLocal()
    try:
        p = db.query(ProfileORM).filter(ProfileORM.user_id == user_id).one_or_none()
        return (p.preferred_language if p and p.preferred_language else "en")
    finally:
        db.close()


def _viewer_lang_from_event(event: dict) -> str:
    lang = get_requested_lang(event)
    return (lang or "en").strip().lower()


def _ensure_translation_cached(booking_id: str, item: dict, target_lang: str) -> str:
    """
    Translate on READ and cache into the message's i18n map (best-effort).
    """
    target_lang = (target_lang or "en").strip().lower()

    original = (item.get("text_original") or item.get("text") or "").strip()
    if not original:
        return ""

    src = (item.get("source_language") or "").strip().lower()
    
    # ✅ FIXED: Only skip translation if we have a confirmed source language
    # AND it matches the target. Never skip if source is "auto" or empty.
    if src and src != "auto" and src == target_lang:
        return original

    i18n = item.get("i18n") or {}
    cached = i18n.get(target_lang)
    if cached:
        return cached

    # Translate (best-effort) - now uses translate_text which always translates
    try:
        translated, detected_src = translate_text(original, target_lang)
        
        # ✅ OPTIONAL: Update the source_language if it was "auto"
        if not src or src == "auto":
            try:
                if item.get("created_at"):
                    messages_table.update_item(
                        Key={"booking_id": str(booking_id), "created_at": str(item["created_at"])},
                        UpdateExpression="SET source_language = :src",
                        ExpressionAttributeValues={":src": detected_src or "auto"},
                    )
                elif item.get("sk"):
                    messages_table.update_item(
                        Key={"booking_id": str(booking_id), "sk": str(item["sk"])},
                        UpdateExpression="SET source_language = :src",
                        ExpressionAttributeValues={":src": detected_src or "auto"},
                    )
            except Exception:
                pass
    except Exception:
        translated = original  # fail-open

    # Cache back (best-effort)
    try:
        if item.get("created_at"):
            try:
                messages_table.update_item(
                    Key={"booking_id": str(booking_id), "created_at": str(item["created_at"])},
                    UpdateExpression="SET #i.#lang = :t",
                    ExpressionAttributeNames={"#i": "i18n", "#lang": target_lang},
                    ExpressionAttributeValues={":t": translated},
                )
                return translated
            except ClientError as e:
                if e.response.get("Error", {}).get("Code") != "ValidationException":
                    raise

        if item.get("sk"):
            try:
                messages_table.update_item(
                    Key={"booking_id": str(booking_id), "sk": str(item["sk"])},
                    UpdateExpression="SET #i.#lang = :t",
                    ExpressionAttributeNames={"#i": "i18n", "#lang": target_lang},
                    ExpressionAttributeValues={":t": translated},
                )
            except ClientError as e:
                if e.response.get("Error", {}).get("Code") != "ValidationException":
                    raise
    except Exception:
        pass

    return translated

def ensure_message_i18n(db, msg_orm, payload: dict, target_lang: str) -> dict:
    target_lang = (target_lang or "en").strip().lower()

    original = (payload.get("text_original") or payload.get("text") or "").strip()
    if not original:
        return payload

    src_lang = (payload.get("source_language") or getattr(msg_orm, "source_language", None) or "").strip().lower()
    if not src_lang:
        # if you already store source_language on write, you won't hit this
        src_lang = "und"

    # If same language, no translation needed (THIS is the only safe skip)
    if src_lang == target_lang:
        payload["text"] = original
        return payload

    i18n = getattr(msg_orm, "i18n", None) or {}
    lang_map = i18n.get(target_lang) or {}

    if not lang_map.get("text"):
        try:
            translated, _ = translate_text(original, target_lang)
            lang_map["text"] = translated
        except Exception:
            lang_map["text"] = original  # fail soft

        i18n[target_lang] = lang_map
        msg_orm.i18n = i18n
        db.add(msg_orm)

    payload["text"] = lang_map.get("text", original)
    return payload

def _translate_listing_name(session, listing_id: int, target_lang: str) -> str:
    """
    Fetch listing and return translated title based on target language.
    """
    from common.models import ListingORM
    
    target_lang = (target_lang or "en").strip().lower()
    if not listing_id:
        return "Listing"
    
    try:
        listing = session.query(ListingORM).filter(ListingORM.id == listing_id).first()
        if not listing:
            return "Listing"
        
        # If target is English or no i18n cache, return original or title_en
        if target_lang == "en":
            return getattr(listing, "title_en", None) or getattr(listing, "title", "Listing")
        
        # Check i18n cache first
        i18n = getattr(listing, "i18n", None) or {}
        cached = i18n.get(target_lang) or {}
        
        if cached.get("title"):
            return cached["title"]
        
        # Fallback: translate on-the-fly (best effort)
        original_title = getattr(listing, "title", "Listing")
        try:
            translated, _ = translate_text(original_title, target_lang)
            return translated
        except Exception:
            return original_title
            
    except Exception:
        return "Listing"


def _translate_user_name(session, user_id: str, target_lang: str) -> str:
    """
    Fetch user profile and return translated name based on target language.
    """
    target_lang = (target_lang or "en").strip().lower()
    if not user_id:
        return "User"
    
    try:
        prof = session.query(ProfileORM).filter(ProfileORM.user_id == user_id).first()
        if not prof:
            return "User"
        
        name = getattr(prof, "full_name", None) or "User"
        
        # If English or no translation needed
        if target_lang == "en":
            return name
        
        # Check i18n cache
        i18n = getattr(prof, "i18n", None) or {}
        cached = i18n.get(target_lang) or {}
        
        if cached.get("name"):
            return cached["name"]
        
        # Fallback: translate on-the-fly
        try:
            translated, _ = translate_text(name, target_lang)
            return translated
        except Exception:
            return name
            
    except Exception:
        return "User"
    
def _latest_message_preview(booking_id: str, viewer_lang: str, unread_count: int) -> Optional[Dict[str, Any]]:
    """
    Return the latest message for this booking, translated to viewer_lang.
    Falls back to None if no messages.
    """
    try:
        res = messages_table.query(
            KeyConditionExpression=Key("booking_id").eq(str(booking_id)),
            ScanIndexForward=False,  # newest first
            Limit=1,
        )
        items = res.get("Items") or []
        if not items:
            return None

        it = items[0]
        text_view = _ensure_translation_cached(str(booking_id), it, viewer_lang)

        return {
            "id": it.get("id"),
            "sender_id": it.get("sender_id"),
            "sender_name": it.get("sender_name"),
            "text": text_view,  # ✅ localized (even to English)
            "original_text": it.get("text_original") or it.get("text") or "",
            "created_at": _extract_created_at(it),
            "read": unread_count == 0,
            "type": it.get("type", "text"),
            "source_language": it.get("source_language") or "auto",
        }
    except Exception as e:
        print(f"⚠️ Failed to load latest message preview for booking_id={booking_id}: {e}")
        return None


def _notify_user_ws(user_id: str, payload: Dict[str, Any]) -> None:
    # Never break HTTP send if WS fails
    if not connections_table or not WS_API_ID:
        return

    try:
        api = boto3.client(
            "apigatewaymanagementapi",
            endpoint_url=f"https://{WS_API_ID}.execute-api.{AWS_REGION}.amazonaws.com/{WS_STAGE}",
        )

        res = connections_table.query(KeyConditionExpression=Key("user_id").eq(user_id))
        items = res.get("Items") or []

        for it in items:
            cid = it.get("connection_id")
            if not cid:
                continue
            try:
                api.post_to_connection(ConnectionId=cid, Data=json.dumps(payload).encode("utf-8"))
            except Exception as e:
                print(f"⚠️ Failed to send to connection {cid}: {e}")
    except Exception as e:
        print(f"⚠️ WS notification failed: {e}")


# ---------------- endpoints ----------------

def open_chat(event, context):
    try:
        me, _ = _get_me(event)
        booking_id = _get_booking_id_from_path(event)
        if not booking_id:
            return _resp(400, {"detail": "Missing booking_id in path"})

        session = SessionLocal()
        try:
            booking = _get_booking_or_404(session, booking_id)
            _ensure_participant(booking, me)

            host_id = str(getattr(booking, "host_user_id"))
            guest_id = str(getattr(booking, "guest_user_id"))
            created_at = _now_iso_micro()

            listing_name = getattr(booking, "listing_name", None) or getattr(booking, "title", None) or "Listing"

            existing = None
            try:
                existing = conversations_table.get_item(Key={"booking_id": str(booking_id)}).get("Item")
            except Exception:
                existing = None

            conversations_table.put_item(
                Item={
                    "booking_id": str(booking_id),
                    "host_user_id": host_id,
                    "guest_user_id": guest_id,
                    "updated_at": created_at,
                    "listing_name": listing_name,
                    "last_message": (existing or {}).get("last_message"),
                    "unread_host": int((existing or {}).get("unread_host") or 0),
                    "unread_guest": int((existing or {}).get("unread_guest") or 0),
                }
            )
            return _resp(200, {"ok": True, "booking_id": str(booking_id)})
        finally:
            session.close()

    except KeyError:
        return _resp(404, {"detail": "Booking not found"})
    except PermissionError as e:
        return _resp(403, {"detail": str(e)})
    except ValueError as e:
        return _resp(400, {"detail": str(e)})
    except Exception:
        traceback.print_exc()
        return _resp(500, {"detail": "Internal Server Error"})


def list_my_chats(event, context):
    try:
        me, _ = _get_me(event)
        viewer_lang = _viewer_lang_from_event(event)

        session = SessionLocal()
        try:
            host_res = conversations_table.query(
                IndexName="host-updated-index",
                KeyConditionExpression=Key("host_user_id").eq(me),
                ScanIndexForward=False,
                Limit=50,
            )

            guest_res = conversations_table.query(
                IndexName="guest-updated-index",
                KeyConditionExpression=Key("guest_user_id").eq(me),
                ScanIndexForward=False,
                Limit=50,
            )

            items = (host_res.get("Items") or []) + (guest_res.get("Items") or [])

            dedup: Dict[str, Dict[str, Any]] = {}
            for it in items:
                bid = str(it.get("booking_id") or "")
                if not bid:
                    continue
                if bid not in dedup or (it.get("updated_at") or "") > (dedup[bid].get("updated_at") or ""):
                    dedup[bid] = it

            unique_items = list(dedup.values())
            unique_items.sort(key=lambda x: x.get("updated_at", ""), reverse=True)

            results = []
            for it in unique_items:
                booking_id = str(it.get("booking_id"))
                host_id = str(it.get("host_user_id") or "")
                guest_id = str(it.get("guest_user_id") or "")

                other_id = guest_id if me == host_id else host_id
                
                # ✅ Translate participant name
                other_name = _translate_user_name(session, other_id, viewer_lang)
                _, other_avatar = _safe_user_profile(session, other_id)

                unread = int(it.get("unread_host", 0) or 0) if me == host_id else int(it.get("unread_guest", 0) or 0)
                
                # ✅ Translate listing name
                try:
                    booking = session.query(BookingORM).filter(BookingORM.id == int(booking_id)).first()
                    listing_id = getattr(booking, "listing_id", None) if booking else None
                    listing_name = _translate_listing_name(session, listing_id, viewer_lang) if listing_id else it.get("listing_name", "Listing")
                except Exception:
                    listing_name = it.get("listing_name", "Listing")
                
                # ✅ Translate last message
                # ✅ Always use the true latest message + localize it (including English)
                last_msg = _latest_message_preview(booking_id, viewer_lang, unread)
                if last_msg is None:
                    # fallback to conversation table if there are no messages yet
                    last_msg = it.get("last_message")

                results.append(
                    {
                        "chat_id": booking_id,
                        "participant_name": other_name,  # ✅ Translated
                        "participant_avatar": other_avatar,
                        "participant_role": "host" if me != host_id else "guest",
                        "listing_name": listing_name,  # ✅ Translated
                        "unread_count": unread,
                        "last_message": last_msg,
                        "updated_at": it.get("updated_at"),
                    }
                )

            return _resp(200, results)
        finally:
            session.close()

    except PermissionError as e:
        return _resp(403, {"detail": str(e)})
    except Exception:
        traceback.print_exc()
        return _resp(500, {"detail": "Internal Server Error"})


def list_chat_messages(event, context):
    try:
        me, _ = _get_me(event)
        booking_id = _get_booking_id_from_path(event)
        if not booking_id:
            return _resp(400, {"detail": "Missing booking_id"})

        viewer_lang = _viewer_lang_from_event(event)

        session = SessionLocal()
        try:
            booking = _get_booking_or_404(session, booking_id)
            _ensure_participant(booking, me)

            host_id = str(getattr(booking, "host_user_id"))
            guest_id = str(getattr(booking, "guest_user_id"))

            # mark as read
            existing = None
            try:
                existing = conversations_table.get_item(Key={"booking_id": str(booking_id)}).get("Item")
            except Exception:
                existing = None

            if existing:
                unread_host = int(existing.get("unread_host", 0) or 0)
                unread_guest = int(existing.get("unread_guest", 0) or 0)
                if me == host_id:
                    unread_host = 0
                else:
                    unread_guest = 0

                conversations_table.put_item(
                    Item={
                        "booking_id": str(booking_id),
                        "host_user_id": host_id,
                        "guest_user_id": guest_id,
                        "updated_at": existing.get("updated_at", _now_iso_micro()),
                        "listing_name": existing.get("listing_name", "Listing"),
                        "last_message": existing.get("last_message"),
                        "unread_host": unread_host,
                        "unread_guest": unread_guest,
                    }
                )

            other_id, _ = _get_other_participant(booking, me)
            
            # ✅ Translate participant name
            other_name = _translate_user_name(session, other_id, viewer_lang)
            _, other_avatar = _safe_user_profile(session, other_id)

            # ✅ Translate listing name
            listing_id = getattr(booking, "listing_id", None)
            listing_name = _translate_listing_name(session, listing_id, viewer_lang) if listing_id else "Listing"
            
            booking_status = getattr(booking, "status", None) or None

            res = messages_table.query(
                KeyConditionExpression=Key("booking_id").eq(str(booking_id)),
                ScanIndexForward=True,
                Limit=200,
            )
            items = res.get("Items") or []

            results = []
            for it in items:
                text_view = _ensure_translation_cached(str(booking_id), it, viewer_lang)
                results.append(
                    {
                        "id": it.get("id"),
                        "sender_id": it.get("sender_id"),
                        "text": text_view,  # ✅ Translated to viewer language
                        "original_text": it.get("text_original") or it.get("text") or "",
                        "created_at": _extract_created_at(it),
                        "type": it.get("type", "text"),
                        "sender_name": it.get("sender_name"),
                        "source_language": it.get("source_language") or "auto",
                    }
                )

            return _resp(
                200,
                {
                    "header": {
                        "participant_name": other_name,  # ✅ Translated
                        "participant_avatar": other_avatar,
                        "listing_name": listing_name,  # ✅ Translated
                        "booking_status": booking_status,
                    },
                    "results": results,
                    "next_cursor": None,
                },
            )
        finally:
            session.close()

    except KeyError:
        return _resp(404, {"detail": "Booking not found"})
    except PermissionError as e:
        return _resp(403, {"detail": str(e)})
    except ValueError as e:
        return _resp(400, {"detail": str(e)})
    except Exception:
        traceback.print_exc()
        return _resp(500, {"detail": "Internal Server Error"})


def send_chat_message(event, context):
    """
    Optional improvement: Detect source language at send time
    """
    try:
        me, _ = _get_me(event)
        booking_id = _get_booking_id_from_path(event)
        if not booking_id:
            return _resp(400, {"detail": "Missing booking_id"})

        body = _json_body(event)
        text_original = (body.get("text") or "").strip()
        if not text_original:
            return _resp(400, {"detail": "Message text is required"})

        session = SessionLocal()
        try:
            booking = _get_booking_or_404(session, booking_id)
            _ensure_participant(booking, me)

            host_id = str(getattr(booking, "host_user_id"))
            guest_id = str(getattr(booking, "guest_user_id"))
            recipient_id = guest_id if me == host_id else host_id

            sender_name, _ = _safe_user_profile(session, me)

            created_at = _now_iso_micro()
            mid = str(uuid.uuid4())
            sk = _make_sk(created_at, mid)

            # ✅ OPTIONAL: Detect source language without translating
            # (Just call translate to "en" to detect language, then discard result)
            source_language = "auto"
            try:
                _, detected = translate_text(text_original, "en")
                if detected:
                    source_language = detected
            except Exception:
                pass

            # Store both keys for backward compatibility
            messages_table.put_item(
                Item={
                    "booking_id": str(booking_id),
                    "created_at": created_at,
                    "sk": sk,
                    "id": mid,
                    "sender_id": me,
                    "recipient_id": recipient_id,
                    "sender_name": sender_name,
                    "type": "text",
                    "text_original": text_original,
                    "source_language": source_language,  # ✅ Now stores detected language
                    "i18n": {},
                }
            )

            # Update conversation unread + last_message (store original in preview)
            existing = None
            try:
                existing = conversations_table.get_item(Key={"booking_id": str(booking_id)}).get("Item")
            except Exception:
                existing = None

            unread_host = int((existing or {}).get("unread_host") or 0)
            unread_guest = int((existing or {}).get("unread_guest") or 0)

            if recipient_id == host_id:
                unread_host += 1
            else:
                unread_guest += 1

            listing_name = getattr(booking, "listing_name", None) or "Listing"

            last_message = {
                "id": mid,
                "sender_id": me,
                "sender_name": sender_name,
                "text": text_original,          # ✅ don’t translate here
                "original_text": text_original,
                "created_at": created_at,
                "read": False,
            }

            conversations_table.put_item(
                Item={
                    "booking_id": str(booking_id),
                    "host_user_id": host_id,
                    "guest_user_id": guest_id,
                    "updated_at": created_at,
                    "listing_name": listing_name,
                    "last_message": last_message,
                    "unread_host": unread_host,
                    "unread_guest": unread_guest,
                }
            )

            # Best-effort WS notify (never blocks send)
            _notify_user_ws(
                recipient_id,
                {"type": "chat_message", "booking_id": str(booking_id), "message": last_message},
            )

            return _resp(200, {"ok": True, "message_id": mid})
        finally:
            session.close()

    except KeyError:
        return _resp(404, {"detail": "Booking not found"})
    except PermissionError as e:
        return _resp(403, {"detail": str(e)})
    except ValueError as e:
        return _resp(400, {"detail": str(e)})
    except Exception:
        traceback.print_exc()
        return _resp(500, {"detail": "Internal Server Error"})


def delete_chat(event, context):
    """
    Hard delete: delete conversation and all messages.
    Handles both schemas:
      - (booking_id, created_at)
      - (booking_id, sk)
    """
    try:
        me, _ = _get_me(event)
        booking_id = _get_booking_id_from_path(event)
        if not booking_id:
            return _resp(400, {"detail": "Missing booking_id"})

        session = SessionLocal()
        try:
            booking = _get_booking_or_404(session, booking_id)
            _ensure_participant(booking, me)

            host_id = str(getattr(booking, "host_user_id"))
            guest_id = str(getattr(booking, "guest_user_id"))

            # delete conversation
            try:
                conversations_table.delete_item(Key={"booking_id": str(booking_id)})
            except Exception as e:
                print(f"⚠️ Failed to delete conversation: {e}")

            # delete all messages
            try:
                messages_res = messages_table.query(
                    KeyConditionExpression=Key("booking_id").eq(str(booking_id))
                )
                msgs = messages_res.get("Items", [])

                for msg in msgs:
                    # try new key first
                    try:
                        ca = msg.get("created_at") or _extract_created_at(msg)
                        messages_table.delete_item(
                            Key={"booking_id": msg["booking_id"], "created_at": str(ca)}
                        )
                    except ClientError as e:
                        if e.response.get("Error", {}).get("Code") == "ValidationException":
                            sk_val = msg.get("sk")
                            if sk_val:
                                try:
                                    messages_table.delete_item(
                                        Key={"booking_id": msg["booking_id"], "sk": str(sk_val)}
                                    )
                                except Exception:
                                    pass
                        else:
                            raise
                    except Exception:
                        pass
            except Exception as e:
                print(f"⚠️ Failed to delete messages: {e}")

            other_id = guest_id if me == host_id else host_id
            _notify_user_ws(other_id, {"type": "chat_deleted", "booking_id": str(booking_id)})

            return _resp(200, {"ok": True, "message": "Chat deleted successfully"})
        finally:
            session.close()

    except KeyError:
        return _resp(404, {"detail": "Booking not found"})
    except PermissionError as e:
        return _resp(403, {"detail": str(e)})
    except ValueError as e:
        return _resp(400, {"detail": str(e)})
    except Exception:
        traceback.print_exc()
        return _resp(500, {"detail": "Internal Server Error"})
