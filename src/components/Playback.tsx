import { lazy, Suspense, useState } from "react";
import { Pause, Play, RotateCcw, ScanFace } from "lucide-react";
import type { Frame } from "./Avatar";
import type { Catalog, Plan } from "../signing/pipeline";
const Avatar = lazy(() =>
  import("./Avatar").then((module) => ({ default: module.Avatar })),
);
export function Playback({
  catalog,
  plan,
}: {
  catalog: Catalog | null;
  plan: Plan | null;
}) {
  const [state, setState] = useState<
    "loading" | "ready" | "playing" | "paused" | "ended" | "error"
  >("loading");
  const [error, setError] = useState(""),
    [speed, setSpeed] = useState(1),
    [replay, setReplay] = useState(0),
    [retry, setRetry] = useState(0);
  const [frame, setFrame] = useState<Frame | null>(null);
  const sign = plan?.signs[frame?.index || 0];
  const cues =
    sign?.cues.filter((cue) => cue.start <= (frame?.local || 0)) || [];
  const caption = cues[cues.length - 1]?.caption || sign?.label;
  const playable = Boolean(plan) && state !== "loading" && state !== "error";
  function start(fromBeginning = false) {
    if (fromBeginning || state === "ended") {
      setReplay((v) => v + 1);
      setFrame(null);
    }
    setState("playing");
  }
  return (
    <section className="panel viewer" aria-label="Signing avatar viewer">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">YOUR MESSAGE, IN MOTION</span>
          <h2>
            <ScanFace size={23} />
            Signing avatar
          </h2>
        </div>
        <span className="pill">
          {plan ? plan.language : catalog?.language || "Neutral preview"}
        </span>
      </div>
      <div className="stage" aria-busy={state === "loading"}>
        <span className="stage-tag">
          3D AVATAR · {plan ? "ASSET PLAYBACK" : "NOT SIGNING"}
        </span>
        <Suspense
          fallback={<p className="viewer-loading">Loading 3D viewer…</p>}
        >
          <Avatar
            key={retry}
            catalog={catalog}
            plan={plan}
            playing={state === "playing"}
            speed={speed}
            replay={replay}
            onLoading={() => setState("loading")}
            onReady={() => setState("ready")}
            onError={(message) => {
              setError(message);
              setState("error");
            }}
            onFrame={(value) => {
              setFrame(value);
              if (value.ended) setState("ended");
            }}
          />
        </Suspense>
        <div className="stage-status" role="status">
          {state === "error"
            ? error
            : state === "loading"
              ? "Loading avatar and animations…"
              : !plan
                ? "Choose a phrase to prepare signing"
                : state === "playing"
                  ? "Playing sign sequence"
                  : state === "ended"
                    ? "Sequence complete"
                    : state === "paused"
                      ? "Paused"
                      : "Ready to sign"}
        </div>
      </div>
      <div className="caption">
        <span className="eyebrow">
          {sign
            ? `${sign.kind === "fingerspelling" ? "FINGERSPELLING" : "CURRENT SIGN"} · ${(frame?.index || 0) + 1} / ${plan?.signs.length}`
            : "CURRENT SIGN · —"}
        </span>
        <p>
          {frame?.inTransition
            ? "Transition between signs"
            : caption || "Waiting for supported signing input"}
        </p>
        {plan && (
          <p className="original-caption">Original input: {plan.text}</p>
        )}
      </div>
      <div className="player-controls">
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Signing progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={
            frame?.duration
              ? Math.round((frame.time / frame.duration) * 100)
              : 0
          }
        >
          <span
            style={{
              width: `${frame?.duration ? (frame.time / frame.duration) * 100 : 0}%`,
            }}
          />
        </div>
        <div className="control-row">
          <button
            className="play-button"
            disabled={!playable}
            onClick={() => (state === "playing" ? setState("paused") : start())}
          >
            {state === "playing" ? <Pause size={18} /> : <Play size={18} />}{" "}
            {state === "playing" ? "Pause" : "Play"}
          </button>
          <button
            className="icon-button"
            disabled={!playable}
            aria-label="Replay sign sequence"
            onClick={() => start(true)}
          >
            <RotateCcw size={19} />
          </button>
          <label className="speed-label">
            Speed
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              <option value={0.5}>0.5×</option>
              <option value={0.75}>0.75×</option>
              <option value={1}>1×</option>
              <option value={1.25}>1.25×</option>
              <option value={1.5}>1.5×</option>
            </select>
          </label>
        </div>
      </div>
      {state === "error" && (
        <button
          className="text-button"
          onClick={() => {
            setError("");
            setState("loading");
            setRetry((v) => v + 1);
          }}
        >
          Retry avatar assets
        </button>
      )}
      <div className="viewer-note">
        {sign ? (
          <p>
            {sign.validation === "reference-demo" ? (
              <>
                ASL reference-based demo — not independently validated.{" "}
                <a href={sign.source} target="_blank" rel="noreferrer">
                  View sign reference
                </a>
              </>
            ) : (
              <>
                Source: {sign.source} · {sign.license} · Reviewed by{" "}
                {sign.reviewedBy} ({sign.reviewedOn}).{" "}
                {plan?.mode === "vocabulary"
                  ? "Vocabulary practice only — not sentence translation."
                  : "Reviewed phrase sequence."}
              </>
            )}
          </p>
        ) : (
          <p>
            Choose a demo phrase, prepare it, then press Play. The five ASL
            motions are reference-based approximations, not independently
            validated signing instruction.
          </p>
        )}
      </div>
    </section>
  );
}
