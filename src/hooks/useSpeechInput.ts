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
export function useSpeechInput(onTranscript: (text: string) => void, lang = "en-US") {
  const [listening, setListening] = useState(false),
    [interim, setInterim] = useState(""),
    [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null),
    callback = useRef(onTranscript);
  callback.current = onTranscript;
  const language = useRef(lang);
  language.current = lang;
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
    if (recognition.current) {
      recognition.current.onend = null;
      recognition.current.onerror = null;
      recognition.current.onresult = null;
      recognition.current.abort();
    }
    const instance = new Constructor();
    recognition.current = instance;
    instance.lang = language.current;
    instance.continuous = false;
    instance.interimResults = true;
    let finalText = "";
    let failed = false;
    setError("");
    setInterim("");
    instance.onresult = (event) => {
      if (recognition.current !== instance) return;
      let pending = "";
      finalText = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal)
          finalText += `${event.results[i][0].transcript} `;
        else pending += event.results[i][0].transcript;
      }
      setInterim(`${finalText}${pending}`.trim());
    };
    instance.onerror = (event) => {
      if (recognition.current === instance) {
        failed = true;
        setError(
          event.error === "not-allowed" || event.error === "service-not-allowed"
            ? "Microphone permission was denied. Allow microphone access, then try again or type your message."
            : event.error === "no-speech"
              ? "No speech was detected. Try again or type your message."
              : event.error === "audio-capture"
                ? "No microphone is available. Connect a microphone or type your message."
            : `Speech recognition failed (${event.error}). Try again or type your message.`,
        );
        setListening(false);
        setInterim("");
      }
    };
    instance.onend = () => {
      if (recognition.current !== instance) return;
      setListening(false);
      setInterim("");
      if (!failed && finalText.trim()) callback.current(finalText.trim());
      else if (!failed)
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
      recognition.current = null;
      instance.onend = null;
      instance.onerror = null;
      instance.onresult = null;
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
