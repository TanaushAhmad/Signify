import os, base64, cv2, numpy as np, threading
import mediapipe as mp
import tensorflow as tf

mp_holistic = mp.solutions.holistic

DEFAULT_LABELS = [
    "HELLO", "THANK_YOU", "YES", "NO", "PLEASE",
    "SORRY", "I_LOVE_YOU", "GOOD", "BAD", "UNKNOWN"
]

class GestureRecognizer:
 
    def __init__(self, model_path="backend/models/gesture_weights.tflite", window_size=8):
        self.model_path = model_path
        self.window_size = window_size
        self.labels = DEFAULT_LABELS
        self.buffer = []
        self.lock = threading.Lock()
        self.interpreter = None
        self.input_details = None
        self.output_details = None
        self.input_size = None
        self._load_tflite_model()

    def _load_tflite_model(self):
        if not os.path.exists(self.model_path):
            print(f"[GestureRecognizer] Weights not found at {self.model_path}. Gesture model disabled.")
            return
        try:
            self.interpreter = tf.lite.Interpreter(model_path=self.model_path)
            self.interpreter.allocate_tensors()
            self.input_details = self.interpreter.get_input_details()
            self.output_details = self.interpreter.get_output_details()
            print(f"[GestureRecognizer] Loaded TFLite model from {self.model_path}")
        except Exception as e:
            print(f"[GestureRecognizer] Error loading TFLite model: {e}")
            self.interpreter = None

    def _extract_feature_vector(self, frame_bgr):
        img_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        with mp_holistic.Holistic(static_image_mode=True) as hol:
            res = hol.process(img_rgb)

        feat = []
       
        if res.pose_landmarks:
            for lm in res.pose_landmarks.landmark:
                feat.extend([lm.x, lm.y, lm.z, lm.visibility])
        else:
            feat.extend([0.0] * 33 * 4)

   
        if res.left_hand_landmarks:
            for lm in res.left_hand_landmarks.landmark:
                feat.extend([lm.x, lm.y, lm.z])
        else:
            feat.extend([0.0] * 21 * 3)

        if res.right_hand_landmarks:
            for lm in res.right_hand_landmarks.landmark:
                feat.extend([lm.x, lm.y, lm.z])
        else:
            feat.extend([0.0] * 21 * 3)

        if res.face_landmarks:
            for i, lm in enumerate(res.face_landmarks.landmark[:10]):
                feat.extend([lm.x, lm.y, lm.z])
        else:
            feat.extend([0.0] * 10 * 3)

        vec = np.array(feat, dtype=np.float32)
        if self.input_size is None:
            self.input_size = vec.shape[0]
        return vec

    def _predict_vector(self, vector: np.ndarray):
        if self.interpreter is None:
            return "MODEL_NOT_LOADED"

        input_data = np.expand_dims(vector, axis=0).astype(np.float32)
        try:
            self.interpreter.set_tensor(self.input_details[0]['index'], input_data)
            self.interpreter.invoke()
            output_data = self.interpreter.get_tensor(self.output_details[0]['index'])
            pred_idx = int(np.argmax(output_data))
            if pred_idx < len(self.labels):
                return self.labels[pred_idx]
            return "UNKNOWN"
        except Exception as e:
            print("[GestureRecognizer] Prediction failed:", e)
            return "ERROR"

    def predict_from_frame_b64(self, b64_image: str) -> str:
        """Accepts base64-encoded image, returns gesture label."""
        try:
            raw = base64.b64decode(b64_image)
            arr = np.frombuffer(raw, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                return "INVALID_FRAME"
        except Exception as e:
            print("[GestureRecognizer] frame decode error", e)
            return "INVALID_FRAME"

        vec = self._extract_feature_vector(img)

        with self.lock:
            self.buffer.append(vec)
            if len(self.buffer) > self.window_size:
                self.buffer = self.buffer[-self.window_size:]
            seq_mean = np.mean(np.stack(self.buffer, axis=0), axis=0)

            if self.interpreter:
                label = self._predict_vector(seq_mean)
                return label

            right_start = 33*4 + 21*3
            right_hand = vec[right_start:right_start + 21*3]
            if np.any(np.abs(right_hand) > 1e-6):
                return "HELLO"
            left_hand = vec[33*4:33*4 + 21*3]
            if np.any(np.abs(left_hand) > 1e-6):
                return "HELLO_L"
            return "NO_HANDS"
