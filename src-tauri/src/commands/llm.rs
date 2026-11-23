use crate::models::chat::{ChatResponse, Message, ProviderConfig};
use serde_json::json;

#[tauri::command]
pub async fn send_message(
    messages: Vec<Message>,
    config: ProviderConfig,
) -> Result<String, String> {
    let api_url = "http://localhost:11434/api/chat";

    let request_body = json!({
        "model": config.model,
        "messages": messages,
        "stream": false,
        "think": config.think,
        "options": {
            "num_ctx": 16384,
            "num_predict": 4096,
            "temperature": 0.2
        }
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post(api_url)
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to API LLM: {}", e))?;

    let status = response.status();
    let raw_text = response
        .text()
        .await
        .map_err(|e| format!("Error reading response: {}", e))?;

    if !status.is_success() {
        return Err(format!("API returned error ({}): {}", status, raw_text));
    }

    let chat_response: ChatResponse = serde_json::from_str(&raw_text)
        .map_err(|e| format!("Failed to parse JSON ({}): {}", e, raw_text))?;

    Ok(chat_response.message.content)
}