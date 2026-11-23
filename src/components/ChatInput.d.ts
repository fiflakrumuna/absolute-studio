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
export declare const ChatInput: React.FC<ChatInputProps>;
export {};
//# sourceMappingURL=ChatInput.d.ts.map