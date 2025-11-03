import hashlib, base64

def hash_audio_bytes(data: bytes) -> str:
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()

def hash_audio_base64(b64: str) -> str:
    raw = base64.b64decode(b64)
    return hash_audio_bytes(raw)
