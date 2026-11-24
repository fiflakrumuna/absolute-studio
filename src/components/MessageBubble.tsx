import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "../types/chat";

interface MessageBubbleProps {
  message: Message;
  isLocal: boolean;
  model: string;
}

export function MessageBubble({ message, isLocal, model }: MessageBubbleProps) {
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  const [showThought, setShowThought] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const toggleLog = (idx: number) => {
    setExpandedLogs((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleCopyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCode(codeText);
    setTimeout(() => setCopiedCode(null), 2000);
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
      {message.content && (
        <div className="message-body markdown-body">
          {message.role === "user" ? (
            <div style={{ whiteSpace: "pre-wrap" }}>{message.content}</div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 style={{ fontSize: "1.25em", color: "var(--accent)", margin: "12px 0 6px" }}>
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 style={{ fontSize: "1.15em", color: "var(--accent)", margin: "10px 0 6px" }}>
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 style={{ fontSize: "1.05em", color: "var(--accent)", margin: "8px 0 4px" }}>
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p style={{ margin: "0 0 8px 0", lineHeight: 1.55 }}>{children}</p>
                ),
                ul: ({ children }) => (
                  <ul style={{ margin: "4px 0 10px 20px", padding: 0 }}>{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol style={{ margin: "4px 0 10px 22px", padding: 0 }}>{children}</ol>
                ),
                li: ({ children }) => (
                  <li style={{ marginBottom: "4px", lineHeight: 1.5 }}>{children}</li>
                ),
                strong: ({ children }) => (
                  <strong style={{ color: "var(--accent)", fontWeight: 700 }}>{children}</strong>
                ),
                blockquote: ({ children }) => (
                  <blockquote
                    style={{
                      margin: "8px 0",
                      padding: "4px 12px",
                      borderLeft: "3px solid var(--accent)",
                      color: "var(--text-muted)",
                      backgroundColor: "var(--bg-main)",
                    }}
                  >
                    {children}
                  </blockquote>
                ),
                table: ({ children }) => (
                  <div style={{ overflowX: "auto", margin: "8px 0" }}>
                    <table
                      style={{
                        borderCollapse: "collapse",
                        width: "100%",
                        fontSize: "12px",
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th
                    style={{
                      border: "1px solid var(--border-color)",
                      padding: "6px 8px",
                      backgroundColor: "var(--bg-main)",
                      color: "var(--accent)",
                      textAlign: "left",
                    }}
                  >
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td
                    style={{
                      border: "1px solid var(--border-color)",
                      padding: "6px 8px",
                    }}
                  >
                    {children}
                  </td>
                ),
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const codeText = String(children).replace(/\n$/, "");
                  const isBlock = Boolean(match) || codeText.includes("\n");

                  if (!isBlock) {
                    return (
                      <code
                        style={{
                          backgroundColor: "var(--bg-main)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "3px",
                          padding: "1px 5px",
                          fontSize: "0.9em",
                          color: "var(--accent)",
                        }}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  }

                  return (
                    <div
                      style={{
                        margin: "8px 0",
                        border: "1px solid var(--border-color)",
                        borderRadius: "4px",
                        backgroundColor: "var(--bg-main)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderBottom: "1px solid var(--border-color)",
                          fontSize: "11px",
                          color: "var(--text-muted)",
                        }}
                      >
                        <span>{match ? match[1].toUpperCase() : "CODE"}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(codeText)}
                          style={{
                            background: "transparent",
                            border: "1px solid var(--border-color)",
                            color: "var(--text-main)",
                            borderRadius: "3px",
                            padding: "1px 6px",
                            fontSize: "10px",
                            cursor: "pointer",
                          }}
                        >
                          {copiedCode === codeText ? "COPIED" : "COPY"}
                        </button>
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: "10px",
                          overflowX: "auto",
                          fontSize: "12px",
                          lineHeight: 1.45,
                        }}
                      >
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    </div>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      )}
    </div>
  );
}