
import pyttsx3, tempfile, os

class TTS:
    def __init__(self):
        try:
            self.engine = pyttsx3.init()
        except Exception as e:
            print("pyttsx3 init fail:", e)
            self.engine = None

    def synthesize_to_wav_bytes(self, text: str) -> bytes:
        if self.engine is None:
            return b""
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
            tmp = f.name
        try:
            self.engine.save_to_file(text, tmp)
            self.engine.runAndWait()
            with open(tmp, "rb") as fh:
                data = fh.read()
            return data
        finally:
            try:
                os.remove(tmp)
            except:
                pass
