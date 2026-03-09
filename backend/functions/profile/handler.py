# functions/profile/handler.py
import json
from datetime import date
from typing import Optional, Tuple

from common.db import SessionLocal
from common.i18n import SUPPORTED_LANGS, get_requested_lang
from common.models import ProfileORM, UserORM
from common.translate import translate_text


def _response(status: int, body=None):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization,Accept-Language,x-language",
            "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
        },
        "body": "" if body is None else json.dumps(body, default=str),
    }


def _parse_json_body(event):
    raw = event.get("body") or ""
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return None


def _get_sub_and_email(event) -> Tuple[Optional[str], Optional[str]]:
    claims = (
        (event.get("requestContext") or {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )
    return claims.get("sub"), claims.get("email")


def _get_or_create_user(db, sub: str, email: str | None):
    user = db.query(UserORM).filter(UserORM.cognito_sub == sub).one_or_none()
    if not user:
        user = UserORM(cognito_sub=sub, email=email)
        db.add(user)
        db.flush()  # assigns user.id
    else:
        if email and user.email != email:
            user.email = email
    return user


def _normalize_lang(code: str | None) -> str:
    code = (code or "").strip().lower()
    code = code.split("-")[0] if code else "en"
    return code if code in SUPPORTED_LANGS else "en"


# ✅ Fields to translate for profile (non-numeric “human text”)
PROFILE_TRANSLATABLE_FIELDS = [
    "name",
    "gender",
    "address",
    "city",
    "state",
    "country",
]


def _get_profile_text_fields(prof: ProfileORM) -> dict:
    """
    Return payload_key -> string for every translatable field that is present.
    Keys match your API payload keys.
    """
    out = {}

    name = getattr(prof, "full_name", None)
    if isinstance(name, str) and name.strip():
        out["name"] = name.strip()

    gender = getattr(prof, "gender", None)
    if isinstance(gender, str) and gender.strip():
        out["gender"] = gender.strip()

    address = getattr(prof, "address", None)
    if isinstance(address, str) and address.strip():
        out["address"] = address.strip()

    city = getattr(prof, "city", None)
    if isinstance(city, str) and city.strip():
        out["city"] = city.strip()

    state = getattr(prof, "state", None)
    if isinstance(state, str) and state.strip():
        out["state"] = state.strip()

    country = getattr(prof, "country", None)
    if isinstance(country, str) and country.strip():
        out["country"] = country.strip()

    return out


def _ensure_profile_i18n(db, prof: ProfileORM, target_lang: str):
    """
    Ensure prof.i18n[target_lang] has translations for profile fields.
    Uses translate_text (AWS Translate) best-effort; caches results.
    """
    target_lang = _normalize_lang(target_lang)
    if not target_lang or target_lang == "en" or not prof:
        return

    i18n = prof.i18n or {}
    lang_cache = i18n.get(target_lang) or {}

    source_texts = _get_profile_text_fields(prof)

    # translate missing fields
    for k, v in source_texts.items():
        cached_v = lang_cache.get(k)
        if isinstance(cached_v, str) and cached_v.strip():
            continue
        try:
            t, src = translate_text(v, target_lang)
            lang_cache[k] = t
            if src and not getattr(prof, "source_language", None):
                prof.source_language = src
        except Exception:
            # do not break profile endpoint
            pass

    i18n[target_lang] = lang_cache
    prof.i18n = i18n
    db.add(prof)


def _apply_profile_i18n_to_payload(payload: dict, prof: ProfileORM, target_lang: str) -> dict:
    target_lang = _normalize_lang(target_lang)
    if not target_lang or target_lang == "en" or not prof:
        payload["lang"] = "en"
        payload["translated"] = False
        return payload

    cache = (prof.i18n or {}).get(target_lang) or {}
    translated_any = False

    for k in PROFILE_TRANSLATABLE_FIELDS:
        if k in payload and isinstance(payload.get(k), str):
            t = cache.get(k)
            if isinstance(t, str) and t.strip():
                payload[k] = t
                translated_any = True

    payload["lang"] = target_lang
    payload["translated"] = translated_any
    return payload


def get_profile(event, context):
    if (event.get("requestContext") or {}).get("http", {}).get("method") == "OPTIONS":
        return _response(200, {})

    sub, email = _get_sub_and_email(event)
    if not sub:
        return _response(401, {"message": "Unauthorized"})

    db = SessionLocal()
    try:
        user = _get_or_create_user(db, sub, email)

        prof = db.query(ProfileORM).filter(ProfileORM.user_id == user.id).one_or_none()

        # preferred language stored on profile (for user preference)
        prof_lang = "en"
        if prof:
            prof_lang = getattr(prof, "preferred_language", None) or "en"

        # language for response: header > profile preference > en
        requested = get_requested_lang(event)
        response_lang = _normalize_lang(requested or prof_lang or "en")

        payload = {
            "user_id": str(user.id),
            "email": user.email,

            "name": prof.full_name if prof else None,
            "birthdate": prof.birthdate.isoformat() if prof and prof.birthdate else None,
            "gender": prof.gender if prof else None,
            "phone": prof.phone if prof else None,
            "address": prof.address if prof else None,
            "city": prof.city if prof else None,
            "state": prof.state if prof else None,
            "pincode": prof.pincode if prof else None,
            "country": prof.country if prof else None,
            "avatar_url": prof.avatar_url if prof else None,

            "preferred_language": prof_lang,
            "supported_languages": sorted(list(SUPPORTED_LANGS)),
        }

        # ✅ cache + apply profile translations for future-proofing
        if prof and response_lang != "en":
            _ensure_profile_i18n(db, prof, response_lang)
            payload = _apply_profile_i18n_to_payload(payload, prof, response_lang)
        else:
            payload["lang"] = "en"
            payload["translated"] = False

        db.commit()
        return _response(200, payload)

    except Exception as e:
        db.rollback()
        return _response(500, {"message": "Failed to load profile", "error": str(e)})
    finally:
        db.close()


def upsert_profile(event, context):
    if (event.get("requestContext") or {}).get("http", {}).get("method") == "OPTIONS":
        return _response(200, {})

    sub, email = _get_sub_and_email(event)
    if not sub:
        return _response(401, {"message": "Unauthorized"})

    body = _parse_json_body(event)
    if body is None:
        return _response(400, {"message": "Invalid JSON body"})

    db = SessionLocal()
    try:
        user = _get_or_create_user(db, sub, email)

        prof = db.query(ProfileORM).filter(ProfileORM.user_id == user.id).one_or_none()
        if not prof:
            prof = ProfileORM(user_id=user.id)
            db.add(prof)

        # track whether translatable fields changed -> invalidate i18n cache
        invalidate_i18n = False

        # preferred language (user can change anytime)
        if "preferred_language" in body:
            lang = _normalize_lang(body.get("preferred_language"))
            prof.preferred_language = lang

        if "name" in body:
            new_val = body.get("name") or None
            if getattr(prof, "full_name", None) != new_val:
                invalidate_i18n = True
            prof.full_name = new_val

        if "birthdate" in body:
            b = body.get("birthdate")
            if not b:
                prof.birthdate = None
            else:
                try:
                    prof.birthdate = date.fromisoformat(b)
                except Exception:
                    return _response(400, {"message": "birthdate must be ISO format YYYY-MM-DD"})

        if "gender" in body:
            new_val = body.get("gender") or None
            if getattr(prof, "gender", None) != new_val:
                invalidate_i18n = True
            prof.gender = new_val

        if "phone" in body:
            prof.phone = body.get("phone") or None

        if "address" in body:
            new_val = body.get("address") or None
            if getattr(prof, "address", None) != new_val:
                invalidate_i18n = True
            prof.address = new_val

        if "city" in body:
            new_val = body.get("city") or None
            if getattr(prof, "city", None) != new_val:
                invalidate_i18n = True
            prof.city = new_val

        if "state" in body:
            new_val = body.get("state") or None
            if getattr(prof, "state", None) != new_val:
                invalidate_i18n = True
            prof.state = new_val

        if "pincode" in body:
            prof.pincode = body.get("pincode") or None

        if "country" in body:
            new_val = body.get("country") or None
            if getattr(prof, "country", None) != new_val:
                invalidate_i18n = True
            prof.country = new_val

        if "avatar_url" in body:
            prof.avatar_url = body.get("avatar_url") or None

        # ✅ future-proof: if key fields changed, clear translations cache
        if invalidate_i18n:
            try:
                prof.i18n = {}
            except Exception:
                # if migration not applied yet, ignore
                pass

        db.commit()
        return _response(
            200,
            {
                "ok": True,
                "preferred_language": getattr(prof, "preferred_language", "en"),
                "supported_languages": sorted(list(SUPPORTED_LANGS)),
            },
        )

    except Exception as e:
        db.rollback()
        return _response(500, {"message": "Failed to save profile", "error": str(e)})
    finally:
        db.close()
