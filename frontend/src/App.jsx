import React, { useEffect, useRef, useState } from "react";
import GestureCapture from "./components/GestureCapture";

export default function App() {
  const wsRef = useRef(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8000/ws/");
    ws.onopen = () => console.log("ws open");
    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      setMessages((m) => [d, ...m].slice(0, 30));
    };
    wsRef.current = ws;
    return () => ws.close();
  }, []);

  const sendDemoAudio = () => {

    const base64Wav = "UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA=";
    wsRef.current.send(JSON.stringify({ type: "audio", payload: base64Wav }));
  };

  const requestTTS = () => {
    wsRef.current.send(JSON.stringify({ type: "tts", payload: "Hello, this is SignBridge demo TTS." }));
  };

  return (
    <div>
      <h1>SignBridge — Lightweight</h1>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={sendDemoAudio}>Send demo audio (ASR)</button>
        <button onClick={requestTTS}>Request TTS</button>
      </div>

      <div style={{ marginTop: 12 }}>
        <GestureCapture wsRef={wsRef} />
      </div>

      <div className="card">
        <h3>Realtime Messages</h3>
        {messages.map((m, i) => (
          <pre key={i} style={{ background: "#010417", padding: 8, borderRadius: 6 }}>{JSON.stringify(m, null, 2)}</pre>
        ))}
      </div>
    </div>
  );
}
