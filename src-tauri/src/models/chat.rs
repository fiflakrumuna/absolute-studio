use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProviderConfig {
    pub base_url: String, // np. "http://localhost:11434/v1/chat/completions" lub "https://api.openrouter.ai/api/v1/chat/completions"
    pub api_key: Option<String>, // None dla lokalnej Ollamy, Some("sk-...") dla zewnętrznych API
    pub model: String,
    pub think: Option<bool>, // np. "qwen3.5:9b" lub "claude-3-7-sonnet"
}

#[derive(Serialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub think: Option<bool>,
}

#[derive(Deserialize, Debug)]
pub struct ChatResponse {
    pub message: Message,
}
