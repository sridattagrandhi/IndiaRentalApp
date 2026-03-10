#!/usr/bin/env python3
"""
Generate translation files for all Indian languages using AWS Translate.

Usage:
  python scripts/generate_i18n_translations.py
  python scripts/generate_i18n_translations.py --full
  python scripts/generate_i18n_translations.py --langs te,hi

Default behavior (recommended):
  - Incremental mode: only translates keys that are missing in target language files.
  - Existing translations are preserved.

--full:
  - Full regenerate: retranslates everything from en.json and overwrites existing values.

--langs te,hi:
  - Only process selected language codes.
"""

import json
import os
import re
import sys
from pathlib import Path

# Add layers to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "layers", "common", "python"))

from common.translate import translate_text  # noqa: E402

LANGUAGES = {
    "hi": "Hindi",
    "te": "Telugu",
    "ta": "Tamil",
    "kn": "Kannada",
    "ml": "Malayalam",
    "mr": "Marathi",
    "gu": "Gujarati",
    "bn": "Bengali",
    "pa": "Punjabi",
    "ur": "Urdu",
}

# Skip placeholders like {{name}} or {count}
PLACEHOLDER_RE = re.compile(r"(\{\{.*?\}\}|\{[^{}]+\})")


def translate_value(text: str, target_lang: str) -> str:
    """Translate a single string unless it's empty or contains placeholders."""
    if not isinstance(text, str):
        return text

    raw = text.strip()
    if not raw:
        return text

    # Skip if it contains placeholders: {{var}} or {var}
    if PLACEHOLDER_RE.search(text):
        return text

    translated, _ = translate_text(text, target_lang)
    return translated


def merge_translate(source, existing, target_lang: str, path: str = "", full: bool = False):
    """
    Merge source into existing while translating only missing keys/values (incremental),
    or translating everything (full=True).

    Rules:
      - Dict: recurse
      - String: translate if missing OR full=True; otherwise keep existing string
      - Other types: copy from source
      - Lists: copied as-is from source (we don't auto-translate lists)
    """
    if isinstance(source, dict):
        result = {}
        existing = existing if isinstance(existing, dict) else {}

        # Preserve the exact keyset/order of en.json by iterating source keys
        for key, src_val in source.items():
            current_path = f"{path}.{key}" if path else key
            ex_val = existing.get(key, None)

            if isinstance(src_val, dict):
                print(f"  📁 Section: {current_path}")
                result[key] = merge_translate(src_val, ex_val, target_lang, current_path, full=full)

            elif isinstance(src_val, str):
                if full or key not in existing:
                    try:
                        if PLACEHOLDER_RE.search(src_val):
                            result[key] = src_val
                            print(f"    ⭐️ Skip placeholder: {current_path}")
                        else:
                            translated = translate_value(src_val, target_lang)
                            result[key] = translated
                            print(f"    ✅ NEW: {current_path}: '{src_val}' → '{translated}'")
                    except Exception as e:
                        print(f"    ❌ Failed: {current_path}: {e}")
                        result[key] = src_val
                else:
                    # Keep existing translation
                    result[key] = ex_val

            elif isinstance(src_val, list):
                # Lists can be tricky (arrays of labels etc). Safer to keep as-is.
                # If you ever store strings inside lists, consider migrating them to dicts.
                result[key] = src_val
                if full:
                    print(f"    📦 Copied list (full mode): {current_path}")
                else:
                    print(f"    📦 Copied list: {current_path}")

            else:
                # numbers, booleans, null -> copy directly
                result[key] = src_val

        return result

    # Non-dict root case (rare for your JSON)
    if isinstance(source, str):
        if full or existing is None:
            try:
                if PLACEHOLDER_RE.search(source):
                    return source
                return translate_value(source, target_lang)
            except Exception:
                return source
        return existing

    if isinstance(source, list):
        return source

    return source


def parse_args(argv):
    """Very small argv parser (no extra dependencies)."""
    full = False
    langs = None

    i = 0
    while i < len(argv):
        arg = argv[i]
        if arg == "--full":
            full = True
        elif arg == "--langs":
            if i + 1 >= len(argv):
                raise ValueError("--langs expects a comma-separated list, e.g. --langs te,hi")
            langs = [x.strip() for x in argv[i + 1].split(",") if x.strip()]
            i += 1
        i += 1

    return full, langs


def find_locales_dir(script_dir: Path) -> Path | None:
    """Find locales dir across possible project structures."""
    possible_paths = [
        script_dir.parent / "locales",                  # backend/locales
        script_dir.parent.parent / "locales",           # repo/locales
        script_dir.parent.parent / "app" / "locales",   # app/locales
    ]

    for path in possible_paths:
        if path.exists():
            print(f"✅ Found locales directory at: {path}")
            return path

    print("❌ Could not find locales directory. Tried:")
    for path in possible_paths:
        print(f"   - {path}")

    print("\n💡 Solution: Create the locales directory first:")
    print("   mkdir -p locales")
    print("   # Then create locales/en.json with the English translations")
    return None


def main():
    full, only_langs = parse_args(sys.argv[1:])

    script_dir = Path(__file__).parent
    locales_dir = find_locales_dir(script_dir)
    if not locales_dir:
        return

    en_file = locales_dir / "en.json"
    if not en_file.exists():
        print(f"❌ English source file not found: {en_file}")
        return

    with open(en_file, "r", encoding="utf-8") as f:
        en_data = json.load(f)

    # Choose language subset if requested
    languages_to_run = LANGUAGES
    if only_langs is not None:
        unknown = [c for c in only_langs if c not in LANGUAGES]
        if unknown:
            print(f"❌ Unknown language codes in --langs: {unknown}")
            print(f"✅ Available codes: {sorted(LANGUAGES.keys())}")
            return
        languages_to_run = {c: LANGUAGES[c] for c in only_langs}

    mode = "FULL REGENERATE" if full else "INCREMENTAL (translate missing keys only)"
    print(f"📖 Loaded English translations from {en_file}")
    print(f"🌐 Mode: {mode}")
    print(f"🌐 Will process {len(languages_to_run)} language files\n")

    for lang_code, lang_name in languages_to_run.items():
        print(f"{'='*60}")
        print(f"🔄 Generating {lang_name} ({lang_code})")
        print(f"{'='*60}")

        output_file = locales_dir / f"{lang_code}.json"

        existing = {}
        if output_file.exists():
            if full:
                # In full mode, ask before overwriting
                response = input(f"  ⚠️  {lang_code}.json already exists. Overwrite fully? (y/n): ")
                if response.lower() != "y":
                    print(f"  ⭐️ Skipping {lang_name}\n")
                    continue
            else:
                # In incremental mode, load existing file and keep translations
                try:
                    with open(output_file, "r", encoding="utf-8") as f:
                        existing = json.load(f)
                    print(f"  📥 Loaded existing {lang_code}.json (incremental merge)")
                except Exception as e:
                    print(f"  ⚠️  Could not read existing {lang_code}.json ({e}). Will regenerate incrementally from scratch.")
                    existing = {}

        try:
            translated = merge_translate(en_data, existing, lang_code, full=full)

            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(translated, f, ensure_ascii=False, indent=2)

            print(f"\n✅ Saved {lang_name} translations to {output_file}\n")

        except Exception as e:
            print(f"\n❌ Failed to generate {lang_name}: {e}\n")

    print(f"\n{'='*60}")
    print("🎉 Translation generation complete!")
    print(f"{'='*60}")
    print(f"Generated files in: {locales_dir}")
    print("\nNext steps:")
    print("1. Review the generated files for quality")
    print("2. Test the app in different languages")


if __name__ == "__main__":
    main()
