use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Message{
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct OllamaChatRequest{
    pub model: String,
    pub messages: Vec<Message>,
    pub stream: bool,
    pub think: bool,
}

#[derive(Deserialize, Debug)]
pub struct OllamaChatResponse{
    pub message: Message,
}