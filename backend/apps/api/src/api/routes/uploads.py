# src/api/routes/uploads.py
import os
import uuid

import boto3
from api.deps.auth import cognito_user
from fastapi import APIRouter, Depends, HTTPException, Query

router = APIRouter(prefix="/uploads", tags=["uploads"])
s3 = boto3.client("s3", region_name=os.getenv("AWS_REGION"))
BUCKET = os.getenv("LISTING_PHOTOS_BUCKET", "")

@router.post("/photo-url")
def create_photo_upload_url(
    content_type: str = Query(..., regex=r"^image/(jpeg|jpg|png|webp)$"),
    user=Depends(cognito_user),
):
    if not BUCKET:
        raise HTTPException(500, "LISTING_PHOTOS_BUCKET not configured")
    key = f"{user['sub']}/{uuid.uuid4()}"
    if content_type.endswith("png"):   key += ".png"
    elif content_type.endswith("webp"): key += ".webp"
    else:                               key += ".jpg"

    try:
        url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={"Bucket": BUCKET, "Key": key, "ContentType": content_type},
            ExpiresIn=600,
        )
        # public URL is via CloudFront later; for now S3 object URL works if you set ACL or serve via API
        return {"upload_url": url, "s3_key": key}
    except Exception as e:
        raise HTTPException(500, f"Failed to sign upload: {e}")
