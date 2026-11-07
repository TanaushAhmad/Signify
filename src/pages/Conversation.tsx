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
import { LANGUAGES, loadCatalog, type Catalog, type Plan } from "../signing/pipeline";
import { resolveDemoInput } from "../signing/demo";
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
  const [search, setSearch] = useState("");
  const [languageCode, setLanguageCode] = useState<"ASL" | "ESL">("ASL");
  const language = LANGUAGES.find((l) => l.code === languageCode) ?? LANGUAGES[0];
  const vocabulary = catalog?.signs.filter(sign =>
    [sign.label, ...(sign.aliases || []), sign.description || ""].join(" ").toLowerCase().includes(search.toLowerCase().trim())) || [];
  useEffect(() => {
    const controller = new AbortController();
    setCatalogError("");
    setCatalog(null);
    const timeout = setTimeout(() => {
      controller.abort();
      setCatalogError("Signing catalog loading timed out. Retry to reconnect.");
    }, 15000);
    void loadCatalog(controller.signal, languageCode)
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
  }, [attempt, languageCode]);
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
  const speech = useSpeechInput(submit, language.speechLang);
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
            <span className="tiny-tag">Camera + upload</span>
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
                disabled={speech.listening}
                value={languageCode}
                onChange={(e) => {
                  setLanguageCode(e.target.value as "ASL" | "ESL");
                  setText("");
                  clearPlan(true);
                }}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name}{l.code !== "ASL" ? " " : ""}
                  </option>
                ))}
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
                {language.rtl ? "Arabic (UAE) speech input." : "English speech input."} Your browser may send audio to its
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
                dir="auto"
                lang={language.rtl ? "ar" : "en"}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  clearPlan();
                }}
                placeholder={language.placeholder}
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
                {(languageCode === "ASL"
                  ? catalog?.signs.filter(s => ["hi", "hello", "good-morning", "thank-you", "please", "help", "water", "no"].includes(s.id)).map(s => s.label)
                  : catalog?.signs.slice(0, 8).map(s => s.label) || []
                )?.map((phrase) => (
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
                  ? languageCode === "ASL"
                    ? `${catalog.signs.length} ASL reference-based animations installed`
                    : `${catalog.signs.length} ${catalog.language} draft animations installed · ${catalog.pending?.length ?? 0} planned words awaiting capture`
                  : "Loading signing catalog…"}
              </p>
            </section>
            <Playback key={revision} catalog={catalog} plan={plan} />
          </div>
          <section className="panel supported" id="vocabulary" aria-label="Supported vocabulary">
            <h2>Supported {languageCode} vocabulary</h2>
            <p>
              Play individual signs, supported phrases, or a sequence such as “Hello, please, help”.
              Phrases match before individual words. This is vocabulary playback, not full sentence translation.
              All motions are reference-based demos awaiting independent ASL review.
              Unknown words block playback; no words are skipped and no fingerspelling fallback is installed.
            </p>
            <label className="field-label" htmlFor="vocabulary-search">Search supported vocabulary</label>
            <input id="vocabulary-search" type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search signs or aliases" />
            <p className="local-note">{vocabulary.length} of {catalog?.signs.length || 0} signs</p>
            <div className="vocabulary-grid">
              {vocabulary.map(sign => <article key={sign.id} className="vocabulary-entry">
                <button className="text-button" disabled={speech.listening} onClick={() => { setText(sign.label); clearPlan(); document.getElementById("message")?.focus(); }}>{sign.label}</button>
                <p>{sign.description}</p>
                {sign.aliases?.length ? <small>Also accepts: {sign.aliases.join(", ")}</small> : null}
                {sign.labelAr ? <small dir="rtl" lang="ar">{sign.labelAr}</small> : null}
                <small>{sign.hands === "both" ? "Two hands" : "One hand"} · {sign.validation === "draft" ? "Draft · Not reviewed by a Deaf signer" : "Reference demo · Not independently validated"}</small>
                <a href={sign.source} target="_blank" rel="noreferrer">{languageCode} source reference</a>
              </article>)}
            </div>
            {!vocabulary.length && <p>No matching supported signs.</p>}
            {languageCode === "ESL" && catalog?.pending?.length ? (
              <div className="pending-vocabulary">
                <h3>Planned — recognised, but no sign captured yet</h3>
                <p className="local-note">These words are accepted as input and reported as “not signed yet”. The avatar never performs a sign it doesn't have.</p>
                <ul>
                  {catalog.pending.map((e) => (
                    <li key={e.label}>{e.label}{e.labelAr ? <> · <span dir="rtl" lang="ar">{e.labelAr}</span></> : null}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </>
      ) : (
        <SignToSpeech languageCode={languageCode} onLanguageChange={setLanguageCode} />
      )}
    </main>
  );
}
