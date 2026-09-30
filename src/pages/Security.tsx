import { useState } from "react";
import { Shield, Lock, AlertTriangle } from "lucide-react";
export function Security() {
  const [digest, setDigest] = useState("");
  const [error, setError] = useState("");
  const sample = "Hello, this is a sample message.";
  async function hash() {
    try {
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(sample),
      );
      setDigest(
        Array.from(new Uint8Array(bytes), (byte) =>
          byte.toString(16).padStart(2, "0"),
        ).join(""),
      );
    } catch {
      setError(
        "Hashing requires a secure browser context, such as localhost or HTTPS.",
      );
    }
  }
  return (
    <main id="main" className="workspace security-page">
      <div className="page-title">
        <h1>Audio Hashing Security</h1>
        <p>Explore privacy, security, and the hashing demonstration</p>
      </div>
      <div className="security-cards">
        <section className="panel utility-panel">
          <span className="section-icon green">
            <Shield />
          </span>
          <h2>End-to-End Encryption</h2>
          <p>
            Not configured in this prototype. Browser speech services may
            process audio externally.
          </p>
        </section>
        <section className="panel utility-panel">
          <span className="section-icon blue">
            <Lock />
          </span>
          <h2>Audio Hashing</h2>
          <p>
            Explore a text hashing demonstration below. It does not encrypt or
            erase audio.
          </p>
        </section>
        <section className="panel utility-panel">
          <span className="section-icon purple">
            <AlertTriangle />
          </span>
          <h2>Access Control</h2>
          <p>
            Camera and microphone permissions are controlled by your browser.
            Account authentication is not connected.
          </p>
        </section>
      </div>
      <section className="panel utility-panel">
        <h2>What this prototype does</h2>
        <p>
          Signify provides speech/text input, a 3D signing viewer, a camera
          preview, and optional browser text-to-speech. No sign recognition,
          emotion detection, full-sentence translation, or fingerspelling model
          is connected.
        </p>
        <p>
          Typed workspace messages are held in memory and cleared on refresh.
          Camera access is requested only when you turn it on and is released
          when you turn it off or leave the camera view. There is no camera
          recording or upload code.
        </p>
        <p>
          Browser speech recognition may send microphone audio to a
          browser-provided service. Speech voices may also depend on a device or
          browser-provided service. Future signing clips may make requests to
          their configured media source.
        </p>
      </section>
      <section className="panel utility-panel">
        <h2>Hashing demonstration</h2>
        <p>
          The original security page was a simulation. This demonstration
          computes a SHA-256 digest of the sample text below. Hashing is not
          encryption and does not protect or erase audio.
        </p>
        <p>{sample}</p>
        <button className="primary-button" onClick={() => void hash()}>
          Compute sample digest
        </button>
        {digest && (
          <>
            <p
              style={{ overflowWrap: "anywhere", marginTop: 20 }}
              role="status"
            >
              {digest}
            </p>
            <button className="text-button" onClick={() => setDigest("")}>
              Reset demo
            </button>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}
