"""
Extract per-frame hand + body landmarks from a video with MediaPipe (Python) → JSON.
Used to turn reference videos into avatar animations and recognition examples offline:
  python3 scripts/extract-landmarks.py input.mp4 out.json [--fps 30]
Only landmark numbers are written; no video frames or imagery are stored.
Requires: pip install mediapipe==0.10.14 opencv-python-headless
"""
import json, sys, cv2
import mediapipe as mp

src, out = sys.argv[1], sys.argv[2]
fps_out = float(sys.argv[sys.argv.index("--fps") + 1]) if "--fps" in sys.argv else 30.0
cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
hands = mp.solutions.hands.Hands(static_image_mode=False, max_num_hands=2, model_complexity=1,
                                 min_detection_confidence=0.5, min_tracking_confidence=0.5)
pose = mp.solutions.pose.Pose(static_image_mode=False, model_complexity=1,
                              min_detection_confidence=0.5, min_tracking_confidence=0.5)
frames, i, next_t = [], 0, 0.0
while True:
    ok, bgr = cap.read()
    if not ok: break
    t = i / fps; i += 1
    if t + 1e-6 < next_t: continue
    next_t += 1.0 / fps_out
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    hr, pr = hands.process(rgb), pose.process(rgb)
    f = {"t": round(t, 4), "hands": [], "pose": None}
    if pr.pose_world_landmarks:
        f["pose"] = {"world": [[p.x, p.y, p.z] for p in pr.pose_world_landmarks.landmark],
                     "img": [[p.x, p.y, p.visibility] for p in pr.pose_landmarks.landmark]}
    if hr.multi_hand_landmarks:
        for lm, wl, hd in zip(hr.multi_hand_landmarks, hr.multi_hand_world_landmarks, hr.multi_handedness):
            f["hands"].append({"img": [[p.x, p.y] for p in lm.landmark],
                               "world": [[p.x, p.y, p.z] for p in wl.landmark],
                               "score": hd.classification[0].score})
    frames.append(f)
json.dump({"source": src.split("/")[-1], "fps": fps_out, "frames": frames}, open(out, "w"), separators=(",", ":"))
print(f"{src}: {len(frames)} frames, hands seen in {sum(1 for f in frames if f['hands'])}, pose in {sum(1 for f in frames if f['pose'])}")
