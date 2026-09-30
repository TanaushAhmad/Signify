import { Link } from "react-router-dom";
import { MessageSquare, Shield, Globe, Brain, Heart, Zap } from "lucide-react";
export function Home() {
  const features = [
    {
      Icon: MessageSquare,
      title: "Bidirectional Communication",
      description:
        "Speak or type into one shared signing pipeline. Review your message before playback.",
      color: "purple",
      link: "/conversation",
    },
    {
      Icon: Shield,
      title: "Audio Hashing Security",
      description:
        "Explore the audio security concept and text hashing demonstration, with clear privacy information.",
      color: "green",
      link: "/security",
    },
    {
      Icon: Globe,
      title: "Multiple Sign Languages",
      description:
        "This demo uses American Sign Language (ASL) for five phrases. Other languages are not connected.",
      color: "orange",
      link: "/settings",
    },
    {
      Icon: Brain,
      title: "AI-Powered Recognition",
      description:
        "Preview camera input and the current 3D signing avatar. General sign recognition is not connected yet.",
      color: "blue",
      link: "/conversation",
    },
    {
      Icon: Heart,
      title: "Emotion Detection",
      description:
        "Facial expression is part of signing. Automated emotion detection remains a planned feature.",
      color: "pink",
      link: "/conversation",
    },
    {
      Icon: Zap,
      title: "Real-Time Processing",
      description:
        "Pause, replay, and adjust speed with captions synchronized to the animation timeline.",
      color: "yellow",
      link: "/conversation",
    },
  ];
  return (
    <main id="main" className="workspace home-page">
      <div className="home-hero">
        <h1>Signify - Bridging Silence and Sound</h1>
        <p>
          A sign language communication prototype for hospitals, banks, public
          transport, and personal use. Bridging the gap between hearing and deaf
          communities through speech, text, and visual expression.
        </p>
        <span className="home-status">
          ASL demo · five reference-based phrase animations
        </span>
      </div>
      <div className="feature-grid">
        {features.map(({ Icon, title, description, color, link }) => (
          <Link key={title} to={link} className={`feature-card ${color}`}>
            <div className="feature-stripe" />
            <div className="feature-content">
              <div className="feature-icon">
                <Icon size={26} />
              </div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
          </Link>
        ))}
      </div>
      <aside className="home-banner">
        <h2>Designed for Accessible Communication</h2>
        <p>
          Exploring more accessible conversations in healthcare, financial
          services, transportation, and everyday life.
        </p>
        <div>
          <span>🏥 Hospitals</span>
          <span>🏦 Banks</span>
          <span>🚇 Public Transport</span>
          <span>👤 Personal Use</span>
        </div>
      </aside>
    </main>
  );
}
