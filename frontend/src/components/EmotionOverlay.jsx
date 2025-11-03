import React, { useEffect, useState, useRef } from "react";

export default function EmotionOverlay({ onEmotionDetected }) {
  const [emotion, setEmotion] = useState("Neutral");
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
    };
    init();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const frame = captureFrame();
      const res = await fetch("/api/emotion/detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame_b64: frame }),
      });
      const data = await res.json();
      setEmotion(data.emotion || "Neutral");
      onEmotionDetected(data.emotion || "Neutral");
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const captureFrame = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg").split(",")[1];
  };

  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        width={320}
        height={240}
        className="rounded-xl shadow-md"
      />
      <canvas ref={canvasRef} width={320} height={240} hidden />
      <div className="absolute top-2 right-2 bg-black/60 text-white text-sm px-2 py-1 rounded-md">
        {emotion}
      </div>
    </div>
  );
}
