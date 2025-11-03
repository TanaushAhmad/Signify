
import base64, cv2, numpy as np
from fer import FER

class EmotionDetector:
    def __init__(self):
        
        self.detector = FER(mtcnn=True) 

    def _read_frame_b64(self, b64_image: str):
        raw = base64.b64decode(b64_image)
        arr = np.frombuffer(raw, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img

    def predict_from_frame_b64(self, b64_image: str) -> dict:
        img = self._read_frame_b64(b64_image)
        if img is None:
            return {"error": "invalid_frame"}
        # FER expects RGB
        img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        results = self.detector.detect_emotions(img_rgb)
        if not results:
            return {"neutral": 1.0}
        # return top face's emotions dict
        emotions = results[0]["emotions"]
        # normalize ensure sum 1
        s = sum(emotions.values()) or 1.0
        return {k: v / s for k, v in emotions.items()}
