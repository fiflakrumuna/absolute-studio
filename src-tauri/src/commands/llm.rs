use reqwest::Client;
use crate::models::chat::{Message, OllamaChatRequest, OllamaChatResponse};

#[tauri::command]
pub async fn send_message(messages: Vec<Message>, model: String) -> Result<String, String> {
    let api_url = "http://localhost:11434/api/chat";

    let request_body = OllamaChatRequest {
        model,
        messages,
        stream: false,
        think: false,
    };

    let client = Client::new();

    let response = client
        .post(api_url)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Nie udało się połączyć z Ollamą: {}", e))?;

    let status = response.status();
    let raw_text = response
        .text()
        .await
        .map_err(|e| format!("Błąd odczytu odpowiedzi: {}", e))?;

    if !status.is_success() {
        return Err(format!("Ollama zwróciła błąd ({}): {}", status, raw_text));
    }

    let chat_response: OllamaChatResponse = serde_json::from_str(&raw_text)
        .map_err(|e| format!("Błąd parsowania JSON ({}): {}", e, raw_text))?;

    Ok(chat_response.message.content)
}