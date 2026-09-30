import { NavLink } from "react-router-dom";
import { MessageSquare, Shield, Settings, Home, Video } from "lucide-react";
export function Navigation() {
  const items = [
    { to: "/", label: "Home", Icon: Home },
    { to: "/conversation", label: "Start a Conversation", Icon: MessageSquare },
    { to: "/record-gesture", label: "Record Gestures", Icon: Video },
    { to: "/security", label: "Security", Icon: Shield },
    { to: "/settings", label: "Settings", Icon: Settings },
  ];
  return (
    <header className="site-header">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="nav-inner">
        <NavLink to="/" className="brand" aria-label="Signify home">
          <span className="brand-icon">S</span>
          <span>Signify</span>
        </NavLink>
        <nav aria-label="Main navigation">
          {items.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              aria-label={label}
              title={label}
            >
              <Icon size={17} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
