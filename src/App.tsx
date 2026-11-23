import { useState, useEffect } from "react";
import { invoke, Channel } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { AgentStepLog, Message, ProviderConfig, ThemeConfig } from "./types/chat";
import { TopBar } from "./components/TopBar";
import { SettingsSidebar } from "./components/SettingsSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { ChatInput } from "./components/ChatInput";
import "./App.css";

const THEMES: Record<string, ThemeConfig> = {
  matrix: {
    bgMain: "#0a0e0a",
    bgPanel: "#111811",
    border: "#1f3a1f",
    text: "#d4f7d4",
    muted: "#5c8a5c",
    accent: "#00ff41",
    accent2: "#1b691b",
  },
  amber: {
    bgMain: "#0f0b05",
    bgPanel: "#1a1308",
    border: "#3d2c11",
    text: "#ffe8c2",
    muted: "#8c6930",
    accent: "#ffb000",
    accent2: "#493a18",
  },
  cyber: {
    bgMain: "#090a14",
    bgPanel: "#111326",
    border: "#25294a",
    text: "#e0e6ff",
    muted: "#646e9e",
    accent: "#00f0ff",
    accent2: "#1e5053",
  },
  minimal: {
    bgMain: "#18181b",
    bgPanel: "#27272a",
    border: "#3f3f46",
    text: "#f4f4f5",
    muted: "#a1a1aa",
    accent: "#3b82f6",
    accent2: "#1f3d6e",
  },
  clean: {
    bgMain: "#ffffff",
    bgPanel: "#f7f7f7",
    border: "#c9c9c9",
    text: "#5a5a5a",
    muted: "#222222",
    accent: "#4688bd",
    accent2: "#0c4a7c",
  },
};

function buildSystemPrompt(workspacePath: string): Message {
  if (!workspacePath) {
    return {
      role: "system",
      content:
        "You are an expert software architect and coding assistant inside Absolute Studio. " +
        "No local workspace directory is currently mounted, so provide clean code blocks in chat and remind the user they can click WORKSPACE: NONE at the bottom if they want you to write and test files directly on disk.",
    };
  }

  return {
    role: "system",
    content: `You are an autonomous coding agent operating inside Absolute Studio on Windows.
A workspace directory IS CURRENTLY MOUNTED (${workspacePath}). You have full read, search, write, patch, and terminal execution tools.
Never claim you lack access to files or the system.

To use a tool, output ONLY ONE tool block per turn and wait for TOOL_RESULT:

1. List all files in workspace:
\`\`\`tool
{"tool": "list_files"}
\`\`\`

2. Search for text/symbols across workspace files:
\`\`\`tool
{"tool": "search_files", "query": "search_term", "case_sensitive": false}
\`\`\`

3. Read any file:
\`\`\`tool
{"tool": "read_file", "path": "README.md"}
\`\`\`

4. Create or completely overwrite a file directly on disk (ALWAYS use this exact code-fence format, NEVER JSON):
\`\`\`write_file: main.cpp
#include <iostream>

int main() {
    std::cout << "Hello\\n";
    return 0;
}
\`\`\`

5. Patch/edit an existing file by replacing an exact unique snippet (ALWAYS use this exact code-fence format, NEVER JSON):
\`\`\`edit_file: main.cpp
<<<SEARCH
    std::cout << "Hello\\n";
===
    std::cout << "Hello, Absolute Studio!\\n";
>>>REPLACE
\`\`\`

6. Run a terminal command (compile, test, run script):
\`\`\`tool
{"tool": "run_command", "command": "g++ main.cpp -o main.exe && main.exe"}
\`\`\`

STRICT RULES:
- Because a workspace is mounted, ALWAYS write or patch code directly on disk using \`\`\`write_file: filename\`\`\` or \`\`\`edit_file: filename\`\`\` BEFORE running any command.
- When modifying an existing file, prefer \`\`\`edit_file: filename\`\`\` with an exact unique \`<<<SEARCH\` block instead of rewriting the whole file.
- Keep code concise, clean, and under 80 lines (prefer console/ASCII output unless GUI/file export is explicitly requested) so responses never truncate.
- Output ONLY ONE tool block per response, wait for TOOL_RESULT, and only then run \`run_command\`.
- On Windows cmd.exe, run executables directly (e.g., \`main.exe\`, NEVER \`./main.exe\`).
- Only after all files are written/edited and verified, respond in plain text summarizing what you created/modified and the execution output.`,
  };
}

const MAX_AGENT_STEPS = 64;

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [workspacePath, setWorkspacePath] = useState("");
  const [workspaceStatus, setWorkspaceStatus] = useState<string | null>(null);

  const [isLocal, setIsLocal] = useState(true);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("abs_api_key") || "");
  const [customBaseUrl, setCustomBaseUrl] = useState(
    () => localStorage.getItem("abs_base_url") || "https://openrouter.ai/api/v1/chat/completions"
  );
  const [model, setModel] = useState("qwen3.5:9b");

  const [themeKey, setThemeKey] = useState("clean");
  const [customAccent, setCustomAccent] = useState("#4688bd");
  const [customAccent2, setCustomAccent2] = useState("#0c4a7c");
  const [fontFamily, setFontFamily] = useState("'Consolas', 'Courier New', monospace");

  useEffect(() => {
    localStorage.setItem("abs_api_key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem("abs_base_url", customBaseUrl);
  }, [customBaseUrl]);

  useEffect(() => {
    const theme = THEMES[themeKey];
    const root = document.documentElement;
    root.style.setProperty("--bg-main", theme.bgMain);
    root.style.setProperty("--bg-panel", theme.bgPanel);
    root.style.setProperty("--border-color", theme.border);
    root.style.setProperty("--text-main", theme.text);
    root.style.setProperty("--text-muted", theme.muted);
    root.style.setProperty("--accent", customAccent);
    root.style.setProperty("--accent2", customAccent2);
    root.style.setProperty("--accent-glow", `${customAccent}33`);
  }, [themeKey, customAccent, customAccent2]);

  useEffect(() => {
    document.documentElement.style.setProperty("--font-current", fontFamily);
  }, [fontFamily]);

  const showTempStatus = (msg: string) => {
    setWorkspaceStatus(msg);
    setTimeout(() => setWorkspaceStatus(null), 4000);
  };

  const handleSelectWorkspace = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Project Workspace Directory",
    });

    if (typeof selected === "string") {
      setWorkspacePath(selected);
      showTempStatus("[WORKSPACE MOUNTED]");
    }
  };

  const handleClearWorkspace = () => {
    setWorkspacePath("");
    showTempStatus("[WORKSPACE UNMOUNTED]");
  };

  const executeAgentTool = async (
    rawToolJson: string
  ): Promise<{ resultText: string; log: AgentStepLog }> => {
    if (!workspacePath) {
      const err =
        "ERROR: No workspace directory is mounted. Ask the user to click WORKSPACE: NONE at the bottom first.";
      return {
        resultText: err,
        log: { tool: "error", target: "workspace", output: err, isError: true },
      };
    }

    try {
      const parsed = JSON.parse(rawToolJson);

      switch (parsed.tool) {
        case "list_files": {
          setWorkspaceStatus("[AGENT: LISTING FILES...]");
          const out = await invoke<string>("list_workspace_files", {
            workspace: workspacePath,
          });
          return {
            resultText: out,
            log: {
              tool: "list_files",
              target: "workspace",
              output: out || "(empty)",
              isError: false,
            },
          };
        }

        case "search_files": {
          setWorkspaceStatus(`[AGENT: SEARCHING '${parsed.query}'...]`);
          const out = await invoke<string>("search_workspace_files", {
            workspace: workspacePath,
            query: parsed.query,
            caseSensitive: parsed.case_sensitive ?? false,
          });
          return {
            resultText: out,
            log: {
              tool: "search_files",
              target: parsed.query,
              output: out,
              isError: false,
            },
          };
        }

        case "read_file": {
          setWorkspaceStatus(`[AGENT: READING ${parsed.path}...]`);
          const out = await invoke<string>("read_workspace_file", {
            workspace: workspacePath,
            relativePath: parsed.path,
          });
          return {
            resultText: out,
            log: {
              tool: "read_file",
              target: parsed.path,
              output: out,
              isError: false,
            },
          };
        }

        case "write_file": {
          setWorkspaceStatus(`[AGENT: WRITING ${parsed.path}...]`);
          const out = await invoke<string>("write_workspace_file", {
            workspace: workspacePath,
            relativePath: parsed.path,
            content: parsed.content,
          });
          return {
            resultText: out,
            log: {
              tool: "write_file",
              target: parsed.path,
              output: out,
              isError: false,
            },
          };
        }

        case "edit_file": {
          const oldText =
            parsed.old_text ?? parsed.oldText ?? parsed.search ?? parsed.old;
          const newText =
            parsed.new_text ?? parsed.newText ?? parsed.replace ?? parsed.new;

          if (typeof oldText !== "string" || typeof newText !== "string") {
            const err =
              "ERROR: Missing search/replace text. Use the ```edit_file: filename``` block with <<<SEARCH ... === ... >>>REPLACE.";
            return {
              resultText: err,
              log: {
                tool: "edit_file",
                target: parsed.path || "unknown",
                output: err,
                isError: true,
              },
            };
          }

          setWorkspaceStatus(`[AGENT: PATCHING ${parsed.path}...]`);
          const out = await invoke<string>("edit_workspace_file", {
            workspace: workspacePath,
            relativePath: parsed.path,
            oldText,
            newText,
          });
          return {
            resultText: out,
            log: {
              tool: "edit_file",
              target: parsed.path,
              output: out,
              isError: false,
            },
          };
        }

        case "run_command": {
          setWorkspaceStatus(`[AGENT: RUNNING '${parsed.command}'...]`);
          const out = await invoke<string>("run_workspace_command", {
            workspace: workspacePath,
            command: parsed.command,
          });
          const failed = !out.startsWith("EXIT_CODE: 0");
          return {
            resultText: out,
            log: {
              tool: "run_command",
              target: parsed.command,
              output: out,
              isError: failed,
            },
          };
        }

        default: {
          const err = `ERROR: Unknown tool '${parsed.tool}'.`;
          return {
            resultText: err,
            log: {
              tool: "unknown",
              target: String(parsed.tool),
              output: err,
              isError: true,
            },
          };
        }
      }
    } catch (err) {
      const msg = `TOOL EXECUTION ERROR: ${String(err)}`;
      return {
        resultText: msg,
        log: { tool: "parse_error", target: "json", output: msg, isError: true },
      };
    }
  };

  const handleThemeChange = (newTheme: string) => {
    setThemeKey(newTheme);
    setCustomAccent(THEMES[newTheme].accent);
    setCustomAccent2(THEMES[newTheme].accent2);
  };

  const handleModeChange = (local: boolean) => {
    setIsLocal(local);
    setModel(local ? "qwen3.5:9b" : "anthropic/claude-3.7-sonnet");
  };

  async function handleSend() {
    if (!prompt.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: prompt };
    let conversation = [...messages, userMessage];

    setMessages(conversation);
    setPrompt("");
    setIsLoading(true);

    const systemPrompt = buildSystemPrompt(workspacePath);

    const config: ProviderConfig = isLocal
      ? {
          base_url: "http://localhost:11434/api/chat",
          api_key: null,
          model,
          think: false,
        }
      : {
          base_url: customBaseUrl.trim() || "https://openrouter.ai/api/v1/chat/completions",
          api_key: apiKey,
          model,
          think: false,
        };

    try {
      let steps = 0;
      const accumulatedLogs: AgentStepLog[] = [];
      const accumulatedThoughts: string[] = [];
      const executedSignatures = new Set<string>();

      while (steps < MAX_AGENT_STEPS) {
        steps++;

        const apiMessages = [systemPrompt, ...conversation].map(
          ({ role, content }, index, arr) => {
            if (
              index === arr.length - 1 &&
              role === "user" &&
              !content.startsWith("TOOL_RESULT:")
            ) {
              if (workspacePath) {
                return {
                  role,
                  content: `[SYSTEM CONTEXT: Workspace "${workspacePath}" is mounted. Use \`\`\`write_file: path\`\`\` or \`\`\`edit_file: path\`\`\` before running commands.]\n\n${content}`,
                };
              } else {
                return {
                  role,
                  content: `[SYSTEM CONTEXT: No workspace is currently mounted. Do NOT output write_file, edit_file, or tool blocks; provide normal code blocks in chat.]\n\n${content}`,
                };
              }
            }
            return { role, content };
          }
        );

        let streamedSoFar = "";
        const onChunk = new Channel<string>();

        onChunk.onmessage = (chunk) => {
          streamedSoFar += chunk;

          let displayStream = streamedSoFar
            .replace(/<think>[\s\S]*?<\/think>/g, "")
            .replace(/<think>[\s\S]*$/g, "");

          // Ukryj na żywo bloki narzędzi (write_file / edit_file / tool), żeby nie zaśmiecały czatu przed wykonaniem
          const toolFenceIndex = displayStream.search(/```(?:write_file:|edit_file:|tool\b)/);
          if (toolFenceIndex !== -1) {
            displayStream = displayStream.slice(0, toolFenceIndex);
          }

          displayStream = displayStream.trim();

          setMessages([
            ...conversation,
            {
              role: "assistant",
              content: displayStream || "Agent working...",
              agentLogs: accumulatedLogs.length > 0 ? [...accumulatedLogs] : undefined,
              thoughtProcess: accumulatedThoughts.join("\n\n---\n\n") || undefined,
            },
          ]);
        };

        const rawResponse = await invoke<string>("send_message", {
          messages: apiMessages,
          config,
          onChunk,
        });

        let cleanResponse = rawResponse;
        const thinkMatch = cleanResponse.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch) {
          accumulatedThoughts.push(thinkMatch[1].trim());
          cleanResponse = cleanResponse.replace(/<think>[\s\S]*?<\/think>/, "").trim();
        }

        let normalizedResponse = cleanResponse;
        const fenceCount = (normalizedResponse.match(/```/g) || []).length;
        if (fenceCount % 2 === 1) {
          normalizedResponse += "\n```";
        }

        const codeBlockRegex = /```([^\r\n`]*)\r?\n([\s\S]*?)```/g;
        const toolPayloads: string[] = [];
        let blockMatch: RegExpExecArray | null;

        while ((blockMatch = codeBlockRegex.exec(normalizedResponse)) !== null) {
          const header = blockMatch[1].trim();
          const body = blockMatch[2];

          if (header.startsWith("write_file:")) {
            const path = header.replace("write_file:", "").trim();
            toolPayloads.push(JSON.stringify({ tool: "write_file", path, content: body }));
            continue;
          }

          if (header.startsWith("edit_file:")) {
            const path = header.replace("edit_file:", "").trim();
            const patchMatch = body.match(
              /<<<SEARCH\r?\n([\s\S]*?)\r?\n===\r?\n([\s\S]*?)\r?\n>>>REPLACE/
            );
            if (patchMatch) {
              toolPayloads.push(
                JSON.stringify({
                  tool: "edit_file",
                  path,
                  old_text: patchMatch[1],
                  new_text: patchMatch[2],
                })
              );
            } else {
              toolPayloads.push(
                JSON.stringify({
                  tool: "edit_file",
                  path,
                  old_text: null,
                  new_text: null,
                })
              );
            }
            continue;
          }

          if (header === "tool") {
            const jsonLines = body
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter((line) => line.startsWith("{") && line.endsWith("}"));

            if (jsonLines.length > 0) {
              toolPayloads.push(...jsonLines);
            } else {
              toolPayloads.push(body.trim());
            }
            continue;
          }

          const lines = body.split(/\r?\n/);
          const firstLine = lines[0]?.trim() || "";

          if (firstLine.startsWith("write_file:")) {
            const path = firstLine.replace("write_file:", "").trim();
            const content = lines.slice(1).join("\n");
            toolPayloads.push(JSON.stringify({ tool: "write_file", path, content }));
          } else if (firstLine.startsWith("edit_file:")) {
            const path = firstLine.replace("edit_file:", "").trim();
            const rest = lines.slice(1).join("\n");
            const patchMatch = rest.match(
              /<<<SEARCH\r?\n([\s\S]*?)\r?\n===\r?\n([\s\S]*?)\r?\n>>>REPLACE/
            );
            if (patchMatch) {
              toolPayloads.push(
                JSON.stringify({
                  tool: "edit_file",
                  path,
                  old_text: patchMatch[1],
                  new_text: patchMatch[2],
                })
              );
            }
          } else if (firstLine.startsWith("run_command:")) {
            const command = firstLine.replace("run_command:", "").trim();
            toolPayloads.push(JSON.stringify({ tool: "run_command", command }));
          } else if (firstLine.startsWith("read_file:")) {
            const path = firstLine.replace("read_file:", "").trim();
            toolPayloads.push(JSON.stringify({ tool: "read_file", path }));
          } else if (firstLine.startsWith("search_files:")) {
            const query = firstLine.replace("search_files:", "").trim();
            toolPayloads.push(JSON.stringify({ tool: "search_files", query }));
          } else if (firstLine === "list_files") {
            toolPayloads.push(JSON.stringify({ tool: "list_files" }));
          }
        }

        if (toolPayloads.length > 0) {
          const stepResults: string[] = [];

          for (const payload of toolPayloads) {
            if (executedSignatures.has(payload)) {
              stepResults.push(
                "SYSTEM NOTICE: You ALREADY executed this exact tool call and got the result above. Do NOT call any more tools. Respond to the user in plain text right now."
              );
              continue;
            }

            executedSignatures.add(payload);
            const { resultText, log } = await executeAgentTool(payload);
            accumulatedLogs.push(log);
            stepResults.push(resultText);
          }

          conversation = [
            ...conversation,
            { role: "assistant", content: rawResponse, hiddenFromUi: true },
            {
              role: "user",
              content: `TOOL_RESULT:\n${stepResults.join("\n---\n")}`,
              hiddenFromUi: true,
            },
          ];

          setMessages([
            ...conversation,
            {
              role: "assistant",
              content: "Agent working...",
              agentLogs: [...accumulatedLogs],
              thoughtProcess: accumulatedThoughts.join("\n\n---\n\n") || undefined,
            },
          ]);
        } else {
          const finalAssistantMsg: Message = {
            role: "assistant",
            content: cleanResponse,
            agentLogs: accumulatedLogs.length > 0 ? accumulatedLogs : undefined,
            thoughtProcess: accumulatedThoughts.join("\n\n---\n\n") || undefined,
          };

          conversation = [...conversation, finalAssistantMsg];
          setMessages(conversation);
          break;
        }
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `[SYSTEM ERROR]: ${String(error)}` },
      ]);
    } finally {
      setIsLoading(false);
      setWorkspaceStatus(null);
    }
  }

  return (
    <div className="app-container">
      <TopBar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isLocal={isLocal}
        model={model}
      />

      <div className="main-layout">
        <SettingsSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          isLocal={isLocal}
          onModeChange={handleModeChange}
          apiKey={apiKey}
          setApiKey={setApiKey}
          customBaseUrl={customBaseUrl}
          setCustomBaseUrl={setCustomBaseUrl}
          model={model}
          setModel={setModel}
          themeKey={themeKey}
          onThemeChange={handleThemeChange}
          customAccent={customAccent}
          setCustomAccent={setCustomAccent}
          fontFamily={fontFamily}
          setFontFamily={setFontFamily}
          onClearChat={() => setMessages([])}
        />

        <div className="workspace-main">
          <ChatWindow
            messages={messages}
            isLoading={isLoading}
            isLocal={isLocal}
            model={model}
          />

          <ChatInput
            prompt={prompt}
            setPrompt={setPrompt}
            onSend={handleSend}
            isLoading={isLoading}
            workspacePath={workspacePath}
            onSelectWorkspace={handleSelectWorkspace}
            onClearWorkspace={handleClearWorkspace}
            workspaceStatus={workspaceStatus}
          />
        </div>
      </div>
    </div>
  );
}

export default App;