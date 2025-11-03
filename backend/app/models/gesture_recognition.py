

import os, base64, cv2, numpy as np, tempfile, threading
import mediapipe as mp

try:
    import torch
    import torch.nn as nn
except Exception:
    torch = None
    nn = None

mp_holistic = mp.solutions.holistic

class GestureModel(nn.Module):
    def __init__(self, input_size, hidden_size=128, num_layers=1, num_classes=10):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, num_classes)

    def forward(self, x):
        out, _ = self.lstm(x)
        out = out[:, -1, :]
        out = self.fc(out)
        return out

DEFAULT_LABELS = ["HELLO", "THANK_YOU", "YES", "NO", "PLEASE", "SORRY", "I_LOVE_YOU", "GOOD", "BAD", "UNKNOWN"]

class GestureRecognizer:
    def __init__(self, weights_path="backend/models/gesture_weights.pt", window_size=16, device="cpu"):
        self.weights_path = weights_path
        self.window_size = window_size
        self.device = device
        self.buffer = []  
        self.lock = threading.Lock()
        self.model = None
        self.labels = DEFAULT_LABELS
        self.input_size = None
        self._load_model_if_available()

    def _load_model_if_available(self):
        if torch is None or nn is None:
            print("Torch not available; gesture model disabled.")
            return
        if os.path.exists(self.weights_path):
            try:
      
                state = torch.load(self.weights_path, map_location=self.device)
              
                input_size = state.get("_input_size") if isinstance(state, dict) and "_input_size" in state else None
                num_classes = state.get("_num_classes", len(DEFAULT_LABELS)) if isinstance(state, dict) else len(DEFAULT_LABELS)
                if input_size is None:
                   
                    input_size = 258
                self.input_size = input_size
                self.model = GestureModel(input_size=input_size, hidden_size=128, num_layers=1, num_classes=num_classes)
              
                if "model_state_dict" in state:
                    self.model.load_state_dict(state["model_state_dict"])
                else:
                    try:
                        self.model.load_state_dict(state)
                    except Exception:
                        print("Could not load entire state dict; model init only.")
                self.model.to(self.device)
                self.model.eval()
                print("Gesture model loaded from", self.weights_path)
            except Exception as e:
                print("Error loading gesture weights:", e)
                self.model = None
        else:
            print("Gesture weights not found at", self.weights_path)

    def _extract_feature_vector(self, frame_bgr):
      
        img_h, img_w = frame_bgr.shape[:2]
        img_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        with mp_holistic.Holistic(static_image_mode=True) as hol:
            res = hol.process(img_rgb)

        feat = []

        if res.pose_landmarks:
            for lm in res.pose_landmarks.landmark:
                feat.extend([lm.x, lm.y, lm.z, lm.visibility])
        else:
            feat.extend([0.0]*33*4)

        if res.left_hand_landmarks:
            for lm in res.left_hand_landmarks.landmark:
                feat.extend([lm.x, lm.y, lm.z])
        else:
            feat.extend([0.0]*21*3)

        if res.right_hand_landmarks:
            for lm in res.right_hand_landmarks.landmark:
                feat.extend([lm.x, lm.y, lm.z])
        else:
            feat.extend([0.0]*21*3)

        if res.face_landmarks:
            for i, lm in enumerate(res.face_landmarks.landmark):
                if i >= 10:
                    break
                feat.extend([lm.x, lm.y, lm.z])
            if len(res.face_landmarks.landmark) < 10:
            
                feat.extend([0.0]*3*(10 - len(res.face_landmarks.landmark)))
        else:
            feat.extend([0.0]*10*3)

        vec = np.array(feat, dtype=np.float32)
       
        if self.input_size is None:
            self.input_size = vec.shape[0]
        return vec

    def predict_from_frame_b64(self, b64_image: str) -> str:
       
        try:
            raw = base64.b64decode(b64_image)
            arr = np.frombuffer(raw, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                return "INVALID_FRAME"
        except Exception as e:
            print("frame decode error", e)
            return "INVALID_FRAME"

        vec = self._extract_feature_vector(img)
      
        with self.lock:
            self.buffer.append(vec)
         
            if len(self.buffer) > self.window_size:
                self.buffer = self.buffer[-self.window_size:]
            if self.model is not None and len(self.buffer) >= self.window_size:
                try:
                    seq = np.stack(self.buffer[-self.window_size:], axis=0)  
                  
                    import torch
                    x = torch.from_numpy(seq).unsqueeze(0).to(self.device) 
                    with torch.no_grad():
                        logits = self.model(x)
                        probs = torch.softmax(logits, dim=-1).cpu().numpy()[0]
                        idx = int(probs.argmax())
                        label = self.labels[idx] if idx < len(self.labels) else "UNKNOWN"
                        return label
                except Exception as e:
                    print("gesture prediction fail", e)
                   
            if len(self.buffer) > 0:
              
                last = self.buffer[-1]
              
                start_right = 33*4 + 21*3
                right_hand = last[start_right:start_right+21*3]
                if np.any(np.abs(right_hand) > 1e-6):
                    return "HELLO"
                left_hand = last[33*4:33*4+21*3]
                if np.any(np.abs(left_hand) > 1e-6):
                    return "HELLO_L"
            return "NO_HANDS"
