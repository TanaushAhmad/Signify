import { useEffect, useRef, useState } from "react";
interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<RecognitionResult>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
export function useSpeechInput(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false),
    [interim, setInterim] = useState(""),
    [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null),
    callback = useRef(onTranscript);
  callback.current = onTranscript;
  const browser = window as SpeechWindow;
  const Constructor =
    browser.SpeechRecognition || browser.webkitSpeechRecognition;
  useEffect(
    () => () => {
      if (recognition.current) {
        recognition.current.onresult = null;
        recognition.current.onerror = null;
        recognition.current.onend = null;
        recognition.current.abort();
      }
    },
    [],
  );
  function start() {
    if (!Constructor) {
      setError(
        "Speech recognition is unavailable in this browser. Try Chrome or Edge, or type your message.",
      );
      return;
    }
    recognition.current?.abort();
    const instance = new Constructor();
    recognition.current = instance;
    instance.lang = "en-US";
    instance.continuous = false;
    instance.interimResults = true;
    let finalText = "";
    setError("");
    setInterim("");
    instance.onresult = (event) => {
      if (recognition.current !== instance) return;
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal)
          finalText += `${event.results[i][0].transcript} `;
        else pending += event.results[i][0].transcript;
      }
      setInterim(pending);
    };
    instance.onerror = (event) => {
      if (recognition.current === instance) {
        setError(
          event.error === "not-allowed"
            ? "Microphone permission was denied. Allow microphone access, then try again."
            : `Speech recognition failed (${event.error}). Try again or type your message.`,
        );
        setListening(false);
      }
    };
    instance.onend = () => {
      if (recognition.current !== instance) return;
      setListening(false);
      setInterim("");
      if (finalText.trim()) callback.current(finalText.trim());
      else
        setError(
          (previous) =>
            previous ||
            "No speech was recognized. Try again or type your message.",
        );
      recognition.current = null;
    };
    try {
      instance.start();
      setListening(true);
    } catch {
      setListening(false);
      setError("Microphone could not start. Check browser permissions.");
    }
  }
  function stop() {
    recognition.current?.stop();
  }
  return {
    listening,
    interim,
    error,
    supported: Boolean(Constructor),
    start,
    stop,
  };
}
