import requests

OLLAMA_URL = "http://localhost:11434/api/generate"  

def query_ollama(prompt: str, model="mistral"):
    payload = {"model": model, "prompt": prompt, "stream": False}
    try:
        resp = requests.post(OLLAMA_URL, json=payload, timeout=30)
        resp.raise_for_status()
        return resp.json().get("response", "")
    except Exception as e:
        return f"Ollama request failed: {e}"