import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Mic,
  StopCircle,
  Video,
  Info,
} from "lucide-react";
import { Playback } from "../components/Playback";
import { loadCatalog, type Catalog, type Plan } from "../signing/pipeline";
import { demoPhrases, resolveDemoInput } from "../signing/demo";
import { useSpeechInput } from "../hooks/useSpeechInput";
import { SignToSpeech } from "./SignToSpeech";
export function Conversation() {
  const [text, setText] = useState(""),
    [plan, setPlan] = useState<Plan | null>(null),
    [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState(""),
    [catalogError, setCatalogError] = useState(""),
    [unsupported, setUnsupported] = useState<string[]>([]);
  const [revision, setRevision] = useState(0),
    [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<"sign" | "camera">("sign");
  useEffect(() => {
    const controller = new AbortController();
    setCatalogError("");
    setCatalog(null);
    const timeout = setTimeout(() => {
      controller.abort();
      setCatalogError("Signing catalog loading timed out. Retry to reconnect.");
    }, 15000);
    void loadCatalog(controller.signal)
      .then(setCatalog)
      .catch((e) => {
        if (!controller.signal.aborted)
          setCatalogError(
            e instanceof Error ? e.message : "Catalog failed to load.",
          );
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  function clearPlan(force = false) {
    if (plan || force) setRevision((v) => v + 1);
    setPlan(null);
    setError("");
    setUnsupported([]);
  }
  function submit(input: string) {
    setText(input);
    clearPlan(true);
    if (!catalog) {
      setError(
        "Signing catalog is not ready. Retry loading it before preparing input.",
      );
      return;
    }
    const result = resolveDemoInput(input, catalog);
    if (result.ok) setPlan(result.plan);
    else {
      setError(result.error);
      setUnsupported(result.unsupported);
    }
  }
  const speech = useSpeechInput(submit);
  return (
    <main id="main" className="workspace">
      <div className="conversation-title">
        <h1>Start a Conversation</h1>
        <p>
          Speak or type your message. Play it back through a signing avatar.
        </p>
      </div>
      <div className="workspace-toolbar">
        <div className="mode-tabs">
          <button
            aria-pressed={tab === "sign"}
            disabled={speech.listening}
            onClick={() => setTab("sign")}
          >
            <Mic size={18} />
            Speech to Sign <ArrowRight size={16} />
          </button>
          <button
            aria-pressed={tab === "camera"}
            disabled={speech.listening}
            onClick={() => {
              clearPlan();
              setTab("camera");
            }}
          >
            <ArrowLeft size={16} />
            Video to Speech <Video size={18} />
            <span className="tiny-tag">Simulated demo</span>
          </button>
        </div>
      </div>
      {tab === "sign" ? (
        <>
          <div className="workspace-grid">
            <section className="panel composer">
              <label className="field-label" htmlFor="sign-language">
                Select Sign Language
              </label>
              <select
                id="sign-language"
                disabled
                value={catalog?.language || ""}
              >
                <option value={catalog?.language || ""}>
                  {catalog?.language || "Awaiting target-language confirmation"}
                </option>
              </select>
              <div className="microphone-section">
                <button
                  className={`microphone-button ${speech.listening ? "recording" : ""}`}
                  disabled={!catalog || Boolean(catalogError)}
                  onClick={() => {
                    if (speech.listening) speech.stop();
                    else {
                      clearPlan();
                      speech.start();
                    }
                  }}
                  aria-label={
                    speech.listening ? "Stop listening" : "Start microphone"
                  }
                >
                  {speech.listening ? (
                    <StopCircle size={35} />
                  ) : (
                    <Mic size={35} />
                  )}
                </button>
                <div>
                  <h3>
                    {speech.listening ? "Listening…" : "Tap to Start Speaking"}
                  </h3>
                  <p>
                    {speech.listening
                      ? "Press stop when you are finished."
                      : "Or type below — both use the same signing pipeline."}
                  </p>
                </div>
              </div>
              <p className="mic-disclosure">
                English speech input. Your browser may send audio to its
                recognition service. Microphone access starts only when you
                press the button.
              </p>
              {speech.interim && (
                <p className="interim" role="status">
                  Hearing: {speech.interim}
                </p>
              )}
              {speech.error && (
                <p role="alert" className="inline-error">
                  {speech.error}
                </p>
              )}
              <div className="label-row">
                <label htmlFor="message" className="field-label">
                  Your message / transcript
                </label>
                <button
                  className="text-button"
                  disabled={speech.listening || !text}
                  onClick={() => {
                    setText("");
                    clearPlan();
                  }}
                >
                  Clear
                </button>
              </div>
              <textarea
                id="message"
                disabled={speech.listening}
                maxLength={500}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  clearPlan();
                }}
                placeholder="Try: Hi, Hello, Good morning, Thank you, I love you, Bye, Yes, or No"
                aria-describedby="message-help"
              />
              <div className="input-meta" id="message-help">
                <span>You can edit the transcript before playback.</span>
                <span>{text.length}/500</span>
              </div>
              <div
                className="phrase-suggestions"
                role="group"
                aria-label="Demo phrases"
              >
                {demoPhrases.map((phrase) => (
                  <button
                    type="button"
                    key={phrase}
                    disabled={speech.listening}
                    onClick={() => {
                      setText(phrase);
                      clearPlan();
                    }}
                  >
                    {phrase}
                  </button>
                ))}
              </div>
              {catalogError && (
                <div className="inline-error" role="alert">
                  {catalogError}
                  <button
                    className="text-button"
                    onClick={() => setAttempt((v) => v + 1)}
                  >
                    Retry catalog
                  </button>
                </div>
              )}
              {error && (
                <div className="inline-error" role="alert">
                  <Info size={18} />
                  <div>
                    {error}
                    {unsupported.length > 0 && (
                      <p>Unsupported: {unsupported.join(", ")}</p>
                    )}
                  </div>
                </div>
              )}
              <button
                className="primary-button"
                disabled={!catalog || speech.listening}
                onClick={() => submit(text)}
              >
                Prepare signing <ArrowRight size={18} />
              </button>
              <p className="local-note">
                {catalog
                  ? `8 demo phrase choices · ${catalog.signs.length} ASL demo animations installed`
                  : "Loading signing catalog…"}
              </p>
            </section>
            <Playback key={revision} catalog={catalog} plan={plan} />
          </div>
          <section className="panel supported">
            <h2>Eight-phrase ASL demo</h2>
            <p>
              Choose Hi, Hello, Good morning, Thank you, I love you, Bye, Yes,
              or No. Typed messages and microphone transcripts use the same
              phrase matching. These reference-based animations demonstrate
              eight isolated ASL signs; they are not sentence translation or
              independently validated instruction.
            </p>
          </section>
        </>
      ) : (
        <SignToSpeech />
      )}
    </main>
  );
}
