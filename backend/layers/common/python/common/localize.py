# common/localize.py
from typing import Any, Dict, Optional

from common.i18n import get_requested_lang
from common.translate import translate_text


def normalize_lang(code: Optional[str]) -> str:
    code = (code or "").strip().lower()
    if not code:
        return "en"
    return code.split("-")[0]


def apply_cached_listing_i18n(payload: Dict[str, Any], listing_i18n: Dict[str, Any], lang: str) -> Dict[str, Any]:
    """
    payload: the outgoing listing json (to_out(listing))
    listing_i18n: listing.i18n dict
    """
    lang = normalize_lang(lang)
    if lang == "en":
        payload["lang"] = "en"
        payload["translated"] = False
        return payload

    cache = (listing_i18n or {}).get(lang) or {}
    translated_any = False

    # string fields
    for f in ["title", "description", "location", "street", "city", "state", "pincode", "building_label", "unit_name"]:
        if f in payload and isinstance(payload.get(f), str):
            t = cache.get(f)
            if isinstance(t, str) and t.strip():
                payload[f] = t
                translated_any = True

    # list fields
    for f in ["rules", "offers", "amenities"]:
        if f in payload and isinstance(payload.get(f), list):
            t = cache.get(f)
            if isinstance(t, list) and t:
                payload[f] = t
                translated_any = True

    payload["lang"] = lang
    payload["translated"] = translated_any
    return payload


def translate_small_text(text: Optional[str], lang: str) -> Optional[str]:
    """
    For tiny objects (wishlist/trip list names/descriptions) where caching isn’t worth it.
    """
    lang = normalize_lang(lang)
    if not text or lang == "en":
        return text
    try:
        t, _src = translate_text(text, lang)
        return t
    except Exception:
        return text
