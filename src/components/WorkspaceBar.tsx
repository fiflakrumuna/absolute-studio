import React from "react";

interface WorkspaceBarProps {
  workspacePath: string;
  onSelectWorkspace: () => void;
  onClearWorkspace: () => void;
  statusMsg: string | null;
}

export const WorkspaceBar: React.FC<WorkspaceBarProps> = ({
  workspacePath,
  onSelectWorkspace,
  onClearWorkspace,
  statusMsg,
}) => {
  return (
    <div className="workspace-bar">
      <div className="workspace-controls">
        <button className="studio-btn primary" onClick={onSelectWorkspace}>
          {workspacePath ? "CHANGE DIR" : "MOUNT WORKSPACE"}
        </button>

        {workspacePath && (
          <button
            className="studio-btn danger"
            onClick={onClearWorkspace}
            title="Odepnij aktualny katalog projektu"
          >
            EJECT
          </button>
        )}

        <span
          className="workspace-path"
          title={workspacePath || "No workspace mounted"}
        >
          <span className="path-label">DIR:</span>{" "}
          {workspacePath ? workspacePath : "[NONE — CHAT ONLY MODE]"}
        </span>
      </div>

      {statusMsg && <span className="workspace-status">{statusMsg}</span>}
    </div>
  );
};