# layers/common/python/common/translate.py
import os
from typing import Optional, Tuple

import boto3
from botocore.config import Config

# Create the client lazily (inside handler path), so cold start + envs are stable.
_translate = None

def _client():
    global _translate
    if _translate is None:
        region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "ap-south-1"
        _translate = boto3.client(
            "translate",
            region_name=region,
            config=Config(
                retries={"max_attempts": 3, "mode": "standard"},
                connect_timeout=3,
                read_timeout=10,
            ),
        )
    return _translate


def translate_text(text: str, target_lang: str) -> Tuple[str, Optional[str]]:
    
    text = (text or "").strip()
    target_lang = (target_lang or "en").strip().lower()

    if not text:
        return text, None
    
    print(f"[translate] calling AWS Translate target={target_lang} chars={len(text)}")

    resp = _client().translate_text(
        Text=text,
        SourceLanguageCode="auto",
        TargetLanguageCode=target_lang,
    )

    return resp.get("TranslatedText", text), resp.get("SourceLanguageCode")

def translate_text_auto(text: str, target_lang: str) -> Tuple[str, Optional[str]]:
    """
    Returns (translated_text, detected_source_lang).

    Unlike translate_text(), this WILL translate even when target_lang == 'en'.
    Use this for canonicalization (e.g., store *_en fields for search).
    """
    text = (text or "").strip()
    target_lang = (target_lang or "en").strip().lower()
    if not text:
        return text, None

    print(f"[translate_auto] calling AWS Translate target={target_lang} chars={len(text)}")
    resp = _client().translate_text(
        Text=text,
        SourceLanguageCode="auto",
        TargetLanguageCode=target_lang,
    )
    return resp.get("TranslatedText", text), resp.get("SourceLanguageCode")

