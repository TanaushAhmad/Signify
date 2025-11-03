import React, { useRef, useState, useEffect } from "react";

export default function GestureVisualizer({ onRecognized }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [gesture, setGesture] = useState("");

  useEffect(() => {
    const initCamera = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    };
    initCamera();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (!videoRef.current) return;
      const frame = await captureFrame(videoRef.current);
      const res = await fetch("/api/gesture/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame_b64: frame }),
      });
      const data = await res.json();
      setGesture(data.label || "UNKNOWN");
      onRecognized(data.label || "");
    }, 1500);

    return () => clearInterval(interval);
  }, [onRecognized]);

  const captureFrame = (video) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg").split(",")[1];
  };

  return (
    <div className="relative">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width={320}
        height={240}
        className="rounded-xl border border-gray-300 shadow-md"
      />
      <canvas ref={canvasRef} width={320} height={240} hidden />
      <div className="absolute bottom-2 left-2 bg-black/60 text-white text-sm px-2 py-1 rounded-md">
        {gesture}
      </div>
    </div>
  );
}
