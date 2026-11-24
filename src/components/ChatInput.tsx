import React from "react";

interface ChatInputProps {
  prompt: string;
  setPrompt: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
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
  onStop,
  isLoading,
  workspacePath,
  onSelectWorkspace,
  onClearWorkspace,
  workspaceStatus,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && isLoading) {
      e.preventDefault();
      onStop();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) {
        onSend();
      }
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
          placeholder={
            isLoading
              ? "Agent is working... (Click STOP or press Esc to abort)"
              : "Enter command (Enter = execute, Shift+Enter = new line)..."
          }
          rows={2}
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

          {isLoading ? (
            <button
              type="button"
              className="exec-btn stop-btn"
              onClick={onStop}
              style={{
                borderColor: "#ef4444",
                color: "#ef4444",
              }}
              title="Zatrzymaj generowanie (Esc)"
            >
              ■ STOP
            </button>
          ) : (
            <button
              type="button"
              className="exec-btn"
              onClick={onSend}
              disabled={!prompt.trim()}
            >
              EXEC ↵
            </button>
          )}
        </div>
      </div>
    </div>
  );
};