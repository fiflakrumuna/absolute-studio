import React from "react";

interface SettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isLocal: boolean;
  onModeChange: (local: boolean) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  customBaseUrl: string;
  setCustomBaseUrl: (url: string) => void;
  model: string;
  setModel: (model: string) => void;
  themeKey: string;
  onThemeChange: (theme: string) => void;
  customAccent: string;
  setCustomAccent: (color: string) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  onClearChat: () => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  isOpen,
  onClose,
  isLocal,
  onModeChange,
  apiKey,
  setApiKey,
  customBaseUrl,
  setCustomBaseUrl,
  model,
  setModel,
  themeKey,
  onThemeChange,
  customAccent,
  setCustomAccent,
  fontFamily,
  setFontFamily,
  onClearChat,
}) => {
  return (
    <aside className={`settings-sidebar ${isOpen ? "open" : "collapsed"}`}>
      <div className="sidebar-header">
        <span>// SYSTEM_CONFIG</span>
        <button className="icon-btn" onClick={onClose} title="Zwiń panel">
          ✕
        </button>
      </div>

      <div className="sidebar-content">
        <div className="sidebar-section">
          <label className="sidebar-label">EXECUTION NODE</label>
          <select
            className="sidebar-control"
            value={isLocal ? "local" : "cloud"}
            onChange={(e) => onModeChange(e.target.value === "local")}
          >
            <option value="local">Local (Ollama)</option>
            <option value="cloud">Cloud / Remote API</option>
          </select>

          <label className="sidebar-label" style={{ marginTop: "10px" }}>
            MODEL ID
          </label>
          <input
            type="text"
            className="sidebar-control"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="e.g. qwen3.5:9b"
          />

          {!isLocal && (
            <>
              <label className="sidebar-label" style={{ marginTop: "10px" }}>
                API ENDPOINT URL
              </label>
              <input
                type="text"
                className="sidebar-control"
                value={customBaseUrl}
                onChange={(e) => setCustomBaseUrl(e.target.value)}
                placeholder="https://ollama.twojadomena.pl/v1/chat/completions"
              />

              <label className="sidebar-label" style={{ marginTop: "10px" }}>
                API KEY
              </label>
              <input
                type="password"
                className="sidebar-control"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-... / token"
              />
            </>
          )}
        </div>

        <div className="sidebar-section">
          <label className="sidebar-label">VISUAL THEME</label>
          <select
            className="sidebar-control"
            value={themeKey}
            onChange={(e) => onThemeChange(e.target.value)}
          >
            <option value="matrix">Matrix Green</option>
            <option value="amber">Amber Terminal</option>
            <option value="cyber">Cyber Neon</option>
            <option value="minimal">Minimal Dark</option>
            <option value="clean">Clean Light</option>
          </select>

          <label className="sidebar-label" style={{ marginTop: "10px" }}>
            TYPOGRAPHY
          </label>
          <select
            className="sidebar-control"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
          >
            <option value="'Consolas', 'Courier New', monospace">Consolas</option>
            <option value="'Fira Code', 'JetBrains Mono', monospace">Fira / JetBrains</option>
            <option value="'Courier New', monospace">Courier New</option>
            <option value="system-ui, -apple-system, sans-serif">System Sans</option>
          </select>
        </div>

        <div className="sidebar-section">
          <label className="sidebar-label">SESSION</label>
          <button className="studio-btn danger full-width" onClick={onClearChat}>
            PURGE TERMINAL LOGS
          </button>
        </div>
      </div>
    </aside>
  );
};