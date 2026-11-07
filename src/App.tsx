import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Navigation } from "./components/Navigation";
import { Home } from "./pages/Home";
import { Conversation } from "./pages/Conversation";
import { Settings } from "./pages/Settings";
import { GestureRecorder } from "./pages/GestureRecorder";
export function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/conversation" element={<Conversation />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/record-gesture" element={<GestureRecorder />} />
        <Route
          path="*"
          element={
            <main id="main" className="workspace">
              <h1>Page not found</h1>
              <a href="/">Return to workspace</a>
            </main>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
