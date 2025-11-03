import base64, json
from starlette.endpoints import WebSocketEndpoint
from starlette.applications import Starlette
from starlette.routing import WebSocketRoute
from backend.app.models.asr import VoskASR
from backend.app.models.gesture_recognition import GestureRecognizer
from backend.app.models.emotion_detection import EmotionDetector
from backend.app.models.tts import TTS
from backend.app.models.audio_hash import hash_audio_base64

_asr = VoskASR(model_path="backend/models/vosk-model")
_gesture = GestureRecognizer(weights_path="backend/models/gesture_weights.pt")
_emotion = EmotionDetector()
_tts = TTS()

class SignBridgeWS(WebSocketEndpoint):
    encoding = "json"

    async def on_connect(self, websocket):
        await websocket.accept()
        print("Client connected")

    async def on_receive(self, websocket, data):
        t = data.get("type")
        if t == "audio":
            b64 = data.get("payload")
            if not b64:
                await websocket.send_json({"error": "no payload"}); return
            digest = hash_audio_base64(b64)
            transcript = _asr.transcribe_b64(b64)
            await websocket.send_json({"type": "transcript", "text": transcript, "sha256": digest})
        elif t == "video_frame":
            b64 = data.get("payload")
            gesture_label = _gesture.predict_from_frame_b64(b64)
            emotion_scores = _emotion.predict_from_frame_b64(b64)
            await websocket.send_json({"type": "video_analysis", "gesture": gesture_label, "emotion": emotion_scores})
        elif t == "tts":
            text = data.get("payload", "")
            wav = _tts.synthesize_to_wav_bytes(text)
            await websocket.send_json({"type": "tts", "wav_b64": base64.b64encode(wav).decode("ascii")})
        else:
            await websocket.send_json({"error": "unknown type"})

    async def on_disconnect(self, websocket, close_code):
        print("Client disconnected", close_code)

websocket_app = Starlette(routes=[WebSocketRoute("/", SignBridgeWS)])
