import { Message } from "../types/chat";
import { MessageBubble } from "./MessageBubble";
import { useEffect, useRef } from "react";

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  isLocal: boolean;
  model: string;
}

export function ChatWindow({ messages, isLocal, model }: ChatWindowProps) {
  const containerRef = useRef<HTMLElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  const visibleMessages = messages.filter(
    (msg) => msg.role !== "system" && !msg.hiddenFromUi
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isNewMessage = visibleMessages.length > prevCountRef.current;
    prevCountRef.current = visibleMessages.length;

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 55;

    if (isNewMessage || isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages]);

  return (
    <main className="chat-window" ref={containerRef}>
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

      <div ref={messagesEndRef} />
    </main>
  );
}