# functions/uploads/handler.py
import json
import os
import re
import uuid

import boto3

s3 = boto3.client("s3")
BUCKET = os.environ["PHOTOS_BUCKET"]

_slug_re = re.compile(r"[^A-Za-z0-9._-]+")

def _safe_name(name: str) -> str:
    name = name.rsplit("/", 1)[-1]
    return _slug_re.sub("-", name)

def presign_upload(event, _ctx):
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    filename = body.get("filename") or "photo.jpg"
    content_type = body.get("content_type") or "image/jpeg"

    # allow caller to choose prefix: "photos/" or "avatars/"
    prefix = body.get("prefix") or "photos/"
    if not prefix.endswith("/"):
        prefix += "/"

    key = f"{prefix}{uuid.uuid4().hex}-{_safe_name(filename)}"

    # ✅ NO ACL
    fields = {"Content-Type": content_type}
    conditions = [
        {"Content-Type": content_type},
        ["content-length-range", 0, 15 * 1024 * 1024]
    ]

    presigned = s3.generate_presigned_post(
        Bucket=BUCKET,
        Key=key,
        Fields=fields,
        Conditions=conditions,
        ExpiresIn=300,
    )

    public_url = f"https://{BUCKET}.s3.amazonaws.com/{key}"

    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps({
            "url": presigned["url"],
            "fields": presigned["fields"],
            "public_url": public_url,
            "key": key
        })
    }

