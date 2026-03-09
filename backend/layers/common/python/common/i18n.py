# layers/common/python/common/i18n.py
SUPPORTED_LANGS = {
    "en", "bn", "gu", "hi", "kn", "ml", "mr", "pa", "ta", "te", "ur"
}

def get_requested_lang(event) -> str:
    headers = event.get("headers") or {}
    
    # 🔍 DEBUG: Print all headers
    print(f"[get_requested_lang] All headers: {list(headers.keys())}")
    
    # ✅ Try custom header first (always works), then accept-language (may be stripped)
    raw = (
        headers.get("x-language") or           # Custom header (preferred)
        headers.get("accept-language") or      # Standard header (may not work)
        headers.get("Accept-Language") or
        ""
    )
    
    # 🔍 DEBUG
    print(f"[get_requested_lang] Language header raw value: '{raw}'")
    
    # Parse language code (e.g., "ml,en;q=0.9" -> "ml")
    first = raw.split(",")[0].strip()
    code = first.split("-")[0].lower() if first else "en"
    
    result = code if code in SUPPORTED_LANGS else "en"
    
    # 🔍 DEBUG
    print(f"[get_requested_lang] Parsed code: '{code}', returning: '{result}'")
    
    return result