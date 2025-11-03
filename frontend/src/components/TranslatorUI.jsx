import React, { useState } from "react";
import AudioRecorder from "./AudioRecorder";
import GestureVisualizer from "./GestureVisualizer";
import EmotionOverlay from "./EmotionOverlay";

export default function TranslatorUI() {
  const [gesture, setGesture] = useState("");
  const [emotion, setEmotion] = useState("");
  const [speech, setSpeech] = useState("");
  const [translation, setTranslation] = useState("");

  const fuseContext = async (g, e, s) => {
    const res = await fetch("/api/fusion/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gesture: g, emotion: e, speech: s }),
    });
    const data = await res.json();
    setTranslation(data.translation || "");
  };

  const handleUpdate = (type, value) => {
    if (type === "gesture") setGesture(value);
    if (type === "emotion") setEmotion(value);
    if (type === "speech") setSpeech(value);
    fuseContext(
      type === "gesture" ? value : gesture,
      type === "emotion" ? value : emotion,
      type === "speech" ? value : speech
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6 text-center">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Gesture & Emotion Recognition</h2>
        <div className="flex justify-center gap-3">
          <GestureVisualizer onRecognized={(v) => handleUpdate("gesture", v)} />
          <EmotionOverlay onEmotionDetected={(v) => handleUpdate("emotion", v)} />
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Speech & Translation</h2>
        <AudioRecorder onTranscribed={(v) => handleUpdate("speech", v)} />
        <div className="p-4 border rounded-md bg-gray-100">
          <p className="text-gray-700">
            <strong>Gesture:</strong> {gesture || "—"}
          </p>
          <p className="text-gray-700">
            <strong>Emotion:</strong> {emotion || "—"}
          </p>
          <p className="text-gray-700">
            <strong>Speech:</strong> {speech || "—"}
          </p>
          <hr className="my-2" />
          <p className="text-lg font-bold text-green-700">
            {translation || "Waiting for context..."}
          </p>
        </div>
      </div>
    </div>
  );
}
