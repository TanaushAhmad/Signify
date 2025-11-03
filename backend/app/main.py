
from fastapi import FastAPI
from backend.app.api.routes import router as api_router
from backend.app.api.ws import websocket_app

app = FastAPI(title="SignBridge - lightweight")

app.include_router(api_router, prefix="/api")

app.mount("/ws", websocket_app)

@app.get("/health")
async def health():

    import os
    has_gesture = os.path.exists("backend/models/gesture_weights.pt")
    vosk_installed = os.path.exists("backend/models/vosk-model")
    return {"status": "ok", "gesture_weights": bool(has_gesture), "vosk_model": bool(vosk_installed)}
