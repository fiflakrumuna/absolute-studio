import React from "react";

interface ChatInputProps {
  prompt: string;
  setPrompt: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  workspacePath: string;
  onSelectWorkspace: () => void;
  onClearWorkspace: () => void;
  workspaceStatus: string | null;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  prompt,
  setPrompt,
  onSend,
  isLoading,
  workspacePath,
  onSelectWorkspace,
  onClearWorkspace,
  workspaceStatus,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="chat-input-wrapper">
      <div className="composer-box">
        {/* Górna sekcja załącznika (jak chip pliku w Gemini) */}
        {workspacePath && (
          <div className="composer-attachments">
            <div
              className="workspace-chip"
              title={`Podpięty projekt:\n${workspacePath}\n\n(Kliknij, aby zmienić folder)`}
              onClick={onSelectWorkspace}
            >
              <span className="chip-dot" />
              <span className="chip-text">WORKSPACE: MOUNTED</span>
              <button
                type="button"
                className="chip-close"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearWorkspace();
                }}
                title="Odepnij projekt"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Pole tekstowe bez wewnętrznej ramki */}
        <textarea
          className="composer-textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command (Enter = execute, Shift+Enter = new line)..."
          rows={2}
          disabled={isLoading}
        />

        {/* Dolny pasek akcji wewnątrz boksu (jak w Gemini) */}
        <div className="composer-footer">
          <div className="composer-footer-left">
            <button
              type="button"
              className="attach-btn"
              onClick={onSelectWorkspace}
              title={
                workspacePath
                  ? `Zmień folder projektu:\n${workspacePath}`
                  : "Podepnij folder projektu (Mount Workspace)"
              }
            >
              <span className="attach-plus">+</span>
              <span>{workspacePath ? "CHANGE DIR" : "MOUNT DIR"}</span>
            </button>

            {workspaceStatus && (
              <span className="workspace-status">{workspaceStatus}</span>
            )}
          </div>

          <button
            type="button"
            className="exec-btn"
            onClick={onSend}
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? "BUSY..." : "EXEC ↵"}
          </button>
        </div>
      </div>
    </div>
  );
};