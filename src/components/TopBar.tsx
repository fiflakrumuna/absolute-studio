import React from "react";

interface TopBarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  isLocal: boolean;
  model: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  isSidebarOpen,
  onToggleSidebar,
  isLocal,
  model,
}) => {
  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <button
          className={`studio-btn ${isSidebarOpen ? "active" : ""}`}
          onClick={onToggleSidebar}
          title="Pokaż/ukryj ustawienia"
        >
          {isSidebarOpen ? "◀ HIDE CONFIG" : "☰ CONFIG"}
        </button>
        <span className="brand-title">&gt;_ ABSOLUTE_STUDIO</span>
      </div>

      <div className="top-bar-right">
        <span className="node-badge">
          <span className="status-dot" />
          {isLocal ? "LOCAL" : "CLOUD"} :: {model}
        </span>
      </div>
    </header>
  );
};