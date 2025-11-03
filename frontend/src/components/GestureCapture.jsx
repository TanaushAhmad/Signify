import React, { useEffect, useRef, useState } from "react";


export default function GestureCapture({ wsRef }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [capturing, setCapturing] = useState(false);
  const [streamActive, setStreamActive] = useState(false);

  useEffect(() => {
    const start = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoRef.current.srcObject = s;
        videoRef.current.play();
        setStreamActive(true);
      } catch (e) {
        console.error("Camera error", e);
      }
    };
    start();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    let raf;
    let lastSend = 0;
    const sendFrame = () => {
      if (!videoRef.current) {
        raf = requestAnimationFrame(sendFrame);
        return;
      }
      const now = performance.now();
      if (now - lastSend > 200) { 
        const w = 320, h = 240;
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        const ctx = canvasRef.current.getContext("2d");
        ctx.drawImage(videoRef.current, 0, 0, w, h);
        const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.6);
        // dataUrl like "data:image/jpeg;base64,...."
        const b64 = dataUrl.split(",")[1];
        if (wsRef && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "video_frame", payload: b64 }));
        }
        lastSend = now;
      }
      raf = requestAnimationFrame(sendFrame);
    };
    if (streamActive && !capturing) {
      raf = requestAnimationFrame(sendFrame);
    }
    return () => cancelAnimationFrame(raf);
  }, [streamActive, capturing, wsRef]);

  const startCaptureSequence = () => {
    setCapturing(true);
   
    const frames = [];
    let count = 0;
    const capInterval = setInterval(() => {
      const w = 320, h = 240;
      canvasRef.current.width = w;
      canvasRef.current.height = h;
      const ctx = canvasRef.current.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, w, h);
      const dataUrl = canvasRef.current.toDataURL("image/jpeg", 0.6);
      frames.push(dataUrl.split(",")[1]);
      count += 1;
      if (count >= 16) {
        clearInterval(capInterval);
       
        console.log("Captured sequence of length", frames.length);
        setCapturing(false);
      }
    }, 200);
  };

  return (
    <div style={{ marginTop: 12 }}>
      <h4>Gesture capture</h4>
      <video ref={videoRef} style={{ width: 320, height: 240, borderRadius: 8, background: "#000" }} />
      <canvas ref={canvasRef} style={{ display: "none" }} />
      <div style={{ marginTop: 8 }}>
        <button onClick={startCaptureSequence} disabled={capturing}>Capture sequence (16 frames)</button>
      </div>
    </div>
  );
}
