import { Message } from "../types/chat";
import { MessageBubble } from "./MessageBubble";

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  isLocal: boolean;
  model: string;
}

export function ChatWindow({ messages, isLoading, isLocal, model }: ChatWindowProps) {
  const visibleMessages = messages.filter(
    (msg) => msg.role !== "system" && !msg.hiddenFromUi
  );

  return (
    <main className="chat-window">
      {visibleMessages.length === 0 && (
        <div className="empty-state">
          <p>
            [SYSTEM READY] Connected to {isLocal ? "local Ollama node" : "Cloud API"} ({model})
          </p>
          <p style={{ marginTop: "6px", fontSize: "12px" }}>
            Mount a workspace directory or enter a prompt below...
          </p>
        </div>
      )}

      {visibleMessages.map((msg, idx) => (
        <MessageBubble key={idx} message={msg} isLocal={isLocal} model={model} />
      ))}

      {isLoading && (
        <div className="message-card assistant">
          <div className="message-body">Agent working...</div>
        </div>
      )}
    </main>
  );
}