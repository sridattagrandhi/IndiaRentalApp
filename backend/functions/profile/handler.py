# functions/profile/handler.py
import json
import os
from datetime import date

from common.db import SessionLocal  # from layers/common/python/common/db.py
from common.models import (  # add these models in your shared models.py
    Profile, User)


def _json_response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
        },
        "body": json.dumps(body, default=str),
    }

def _get_sub_and_email(event):
    claims = (event.get("requestContext", {})
                   .get("authorizer", {})
                   .get("jwt", {})
                   .get("claims", {}))
    return claims.get("sub"), claims.get("email")

def _get_or_create_user(db, sub, email):
    user = db.query(User).filter(User.cognito_sub == sub).one_or_none()
    if not user:
        user = User(cognito_sub=sub, email=email)
        db.add(user); db.flush()
    return user

def get_profile(event, context):
    sub, email = _get_sub_and_email(event)
    if not sub:
        return _json_response(401, {"message": "Unauthorized"})

    db = SessionLocal()
    try:
        user = _get_or_create_user(db, sub, email)
        prof = db.query(Profile).filter(Profile.user_id == user.id).one_or_none()

        payload = {
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
            "email": user.email,
        }
        db.commit()
        return _json_response(200, payload)
    finally:
        db.close()

def upsert_profile(event, context):
    sub, email = _get_sub_and_email(event)
    if not sub:
        return _json_response(401, {"message": "Unauthorized"})

    body = json.loads(event.get("body") or "{}")
    db = SessionLocal()
    try:
        user = _get_or_create_user(db, sub, email)

        prof = db.query(Profile).filter(Profile.user_id == user.id).one_or_none()
        if not prof:
            prof = Profile(user_id=user.id)
            db.add(prof)

        # assign allowed fields
        prof.full_name = body.get("name") or prof.full_name
        b = body.get("birthdate")
        prof.birthdate = date.fromisoformat(b) if b else prof.birthdate
        prof.gender = body.get("gender") or prof.gender
        prof.phone = body.get("phone") or prof.phone
        prof.address = body.get("address") or prof.address
        prof.city = body.get("city") or prof.city
        prof.state = body.get("state") or prof.state
        prof.pincode = body.get("pincode") or prof.pincode
        prof.country = body.get("country") or prof.country
        prof.avatar_url = body.get("avatar_url") or prof.avatar_url

        db.commit()
        return _json_response(200, {"ok": True})
    finally:
        db.close()
