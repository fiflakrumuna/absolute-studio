export interface AgentStepLog {
    tool: string;
    target: string;
    output: string;
    isError?: boolean;
}
export interface Message {
    role: "user" | "assistant" | "system";
    content: string;
    hiddenFromUi?: boolean;
    agentLogs?: AgentStepLog[];
    thoughtProcess?: string;
}
export interface ProviderConfig {
    base_url: string;
    api_key: string | null;
    model: string;
    think: boolean | null;
}
export interface ThemeConfig {
    bgMain: string;
    bgPanel: string;
    border: string;
    text: string;
    muted: string;
    accent: string;
    accent2: string;
}
//# sourceMappingURL=chat.d.ts.map