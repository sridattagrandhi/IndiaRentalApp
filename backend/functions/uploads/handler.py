import json
import os
import time
import uuid

import boto3

S3 = boto3.client("s3")
BUCKET = os.environ["PHOTOS_BUCKET"]
REGION = os.environ.get("AWS_REGION", "ap-south-1")

def _key(listing_id: str, filename: str) -> str:
    # keep it simple for MVP; you can sanitize/guess extensions later
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "jpg").lower()
    return f"photos/{listing_id}/{uuid.uuid4().hex}.{ext}"

def presign_upload(event, _ctx):
    try:
        body = json.loads(event.get("body") or "{}")
        listing_id = str(body.get("listing_id") or "").strip()
        filename = str(body.get("filename") or "photo.jpg")
        content_type = str(body.get("contentType") or "image/jpeg")

        if not listing_id:
            return _res(400, {"error": "listing_id required"})

        key = _key(listing_id, filename)

        url = S3.generate_presigned_url(
            ClientMethod="put_object",
            Params={"Bucket": BUCKET, "Key": key, "ContentType": content_type, "ACL": "public-read"},
            ExpiresIn=300,  # 5 minutes
        )

        public_url = f"https://{BUCKET}.s3.{REGION}.amazonaws.com/{key}"

        return _res(200, {
            "put_url": url,
            "key": key,
            "public_url": public_url,
            "expires": int(time.time()) + 300
        })
    except Exception as e:
        return _res(500, {"error": str(e)})

def _res(status, obj):
    return {"statusCode": status, "headers": {"content-type": "application/json"}, "body": json.dumps(obj)}
