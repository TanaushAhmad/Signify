import os, tempfile, wave, json, base64
try:
    from vosk import Model, KaldiRecognizer
except Exception:
    Model = None
    KaldiRecognizer = None

class VoskASR:
    def __init__(self, model_path="backend/models/vosk-model"):
        self.model_path = model_path
        self.model = None
        if os.path.exists(model_path) and Model is not None:
            try:
                self.model = Model(model_path)
            except Exception as e:
                print("Failed to load VOSK model:", e)

    def transcribe_b64(self, b64_audio: str) -> str:
        if self.model is None:
            return "[vosk-model-missing]"
        raw = base64.b64decode(b64_audio)
        # try to write tmp WAV
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
                f.write(raw)
                tmp = f.name
            wf = wave.open(tmp, "rb")
            rec = KaldiRecognizer(self.model, wf.getframerate())
            results = []
            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                if rec.AcceptWaveform(data):
                    r = json.loads(rec.Result())
                    results.append(r.get("text", ""))
            final = json.loads(rec.FinalResult()).get("text", "")
            results.append(final)
            # cleanup
            try:
                os.remove(tmp)
            except:
                pass
            return " ".join([r for r in results if r]).strip() or "[untranscribed]"
        except Exception as e:
            print("ASR error:", e)
            return "[asr-error]"
