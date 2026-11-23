import { useState } from "react";
import { Message } from "../types/chat";

interface MessageBubbleProps {
  message: Message;
  isLocal: boolean;
  model: string;
}

export function MessageBubble({ message, isLocal, model }: MessageBubbleProps) {
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  const [showThought, setShowThought] = useState(false);

  const toggleLog = (idx: number) => {
    setExpandedLogs((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const headerLabel =
    message.role === "user"
      ? "USER@LOCAL:~$"
      : `${isLocal ? "LOCAL" : "CLOUD"}@${model.toUpperCase()}:~#`;

  return (
    <div className={`message-card ${message.role}`}>
      <div className="message-header">{headerLabel}</div>

      {/* Collapsible Thought Process (Claude-style) */}
      {message.thoughtProcess && (
        <div
          style={{
            marginBottom: "8px",
            border: "1px solid var(--border-color)",
            borderRadius: "4px",
            backgroundColor: "var(--bg-main)",
            fontSize: "12px",
          }}
        >
          <div
            onClick={() => setShowThought(!showThought)}
            style={{
              padding: "5px 10px",
              cursor: "pointer",
              color: "var(--text-muted)",
              userSelect: "none",
            }}
          >
            {showThought ? "▼" : "▶"} [THOUGHT PROCESS]
          </div>
          {showThought && (
            <div
              style={{
                padding: "8px 10px",
                borderTop: "1px solid var(--border-color)",
                color: "var(--text-muted)",
                whiteSpace: "pre-wrap",
              }}
            >
              {message.thoughtProcess}
            </div>
          )}
        </div>
      )}

      {/* Collapsible Agent Tool Executions */}
      {message.agentLogs && message.agentLogs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "8px" }}>
          {message.agentLogs.map((log, idx) => {
            const isOpen = !!expandedLogs[idx];
            return (
              <div
                key={idx}
                style={{
                  border: "1px solid var(--border-color)",
                  borderRadius: "4px",
                  backgroundColor: "var(--bg-main)",
                  fontSize: "12px",
                }}
              >
                <div
                  onClick={() => toggleLog(idx)}
                  style={{
                    padding: "5px 10px",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    color: log.isError ? "#ff5555" : "var(--accent)",
                    userSelect: "none",
                  }}
                >
                  <span>
                    {isOpen ? "▼" : "▶"} [{log.tool.toUpperCase()}] {log.target}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>
                    {isOpen ? "HIDE OUTPUT" : "VIEW OUTPUT"}
                  </span>
                </div>

                {isOpen && (
                  <pre
                    style={{
                      margin: 0,
                      padding: "8px 10px",
                      borderTop: "1px solid var(--border-color)",
                      color: "var(--text-main)",
                      whiteSpace: "pre-wrap",
                      fontSize: "11px",
                      maxHeight: "220px",
                      overflowY: "auto",
                    }}
                  >
                    {log.output}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Main Message Text */}
      {message.content && <div className="message-body">{message.content}</div>}
    </div>
  );
}