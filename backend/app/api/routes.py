from fastapi import APIRouter, UploadFile, File, HTTPException
import base64
from backend.app.models.audio_hash import hash_audio_bytes

router = APIRouter()

@router.get("/sign-mapping")
async def sign_mapping(lang: str = "ASL"):
    from backend.app.utils.preprocessing import SIGN_MAPPINGS
    k = lang.upper()
    if k not in SIGN_MAPPINGS:
        raise HTTPException(status_code=404, detail="Sign mapping not found")
    return {"mapping": SIGN_MAPPINGS[k]}

@router.post("/hash-audio")
async def hash_audio_file(file: UploadFile = File(...)):
    data = await file.read()
    return {"sha256": hash_audio_bytes(data)}

@router.post("/hash-audio-b64")
async def hash_audio_b64(payload: dict):
    b64 = payload.get("b64")
    if not b64:
        raise HTTPException(status_code=400, detail="b64 missing")
    data = base64.b64decode(b64)
    return {"sha256": hash_audio_bytes(data)}
