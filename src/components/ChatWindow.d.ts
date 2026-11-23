import { Message } from "../types/chat";
interface ChatWindowProps {
    messages: Message[];
    isLoading: boolean;
    isLocal: boolean;
    model: string;
}
export declare function ChatWindow({ messages, isLoading, isLocal, model }: ChatWindowProps): import("react").JSX.Element;
export {};
//# sourceMappingURL=ChatWindow.d.ts.map