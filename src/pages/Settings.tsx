import { useState } from "react";
import { Globe, Bell, Shield, User } from "lucide-react";
export function Settings() {
  const [contrast, setContrast] = useState(
    document.documentElement.classList.contains("high-contrast"),
  );
  return (
    <main id="main" className="workspace simple-page">
      <div className="page-title">
        <h1>Settings</h1>
        <p>Customize your Signify experience</p>
      </div>
      <section className="panel utility-panel">
        <h2 className="setting-heading">
          <span className="section-icon blue">
            <Globe />
          </span>
          Sign Language Preferences
        </h2>
        <p>
          The five-phrase demo uses American Sign Language (ASL). Its
          reference-based animations have not been independently validated.
          Other languages are not connected.
        </p>
        <div className="language-options" aria-label="Planned language options">
          {[
            ["American Sign Language", "United States"],
            ["Indian Sign Language", "India"],
            ["British Sign Language", "United Kingdom"],
            ["Australian Sign Language", "Australia"],
            ["Emirati Sign Language", "United Arab Emirates"],
            ["French Sign Language", "France"],
            ["German Sign Language", "Germany"],
          ].map(([name, region]) => (
            <div className="language-option" key={name}>
              <strong>{name}</strong>
              <span>{region}</span>
              <small>
                {name === "American Sign Language"
                  ? "Active · five-phrase demo"
                  : "Not connected"}
              </small>
            </div>
          ))}
        </div>
      </section>
      <section className="panel utility-panel">
        <h2 className="setting-heading">
          <span className="section-icon purple">
            <Bell />
          </span>
          Notifications
        </h2>
        <div className="status-row">
          <strong>Translation updates</strong>
          <p>
            Notification delivery is not connected. Playback and input status
            appear in the conversation view.
          </p>
        </div>
      </section>
      <section className="panel utility-panel">
        <h2 className="setting-heading">
          <span className="section-icon green">
            <Shield />
          </span>
          Privacy &amp; Security
        </h2>
        <div className="status-row">
          <strong>Data collection</strong>
          <p>
            Usage analytics are not enabled. Typed messages stay in this browser
            session.
          </p>
        </div>
        <h3>Microphone input</h3>
        <p>
          Speech transcription uses browser speech recognition where available.
          Your browser may use an online recognition service. Recognized speech
          and typed input use the same signing pipeline.
        </p>
      </section>
      <section className="panel utility-panel">
        <h2 className="setting-heading">
          <span className="section-icon orange">
            <User />
          </span>
          Accessibility
        </h2>
        <label className="setting-row">
          <span>Increase visual contrast</span>
          <input
            type="checkbox"
            checked={contrast}
            onChange={(e) => {
              setContrast(e.target.checked);
              document.documentElement.classList.toggle(
                "high-contrast",
                e.target.checked,
              );
            }}
          />
        </label>
        <p>
          This preference applies for this page session. Reduced-motion
          preferences follow your device settings. Playback speed can be changed
          in the viewer.
        </p>
      </section>
    </main>
  );
}
