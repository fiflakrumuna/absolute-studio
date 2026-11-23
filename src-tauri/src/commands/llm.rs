use crate::models::chat::{Message, ProviderConfig};
use serde_json::{json, Value};
use tauri::ipc::Channel;

#[tauri::command]
pub async fn send_message(
    messages: Vec<Message>,
    config: ProviderConfig,
    on_chunk: Channel<String>,
) -> Result<String, String> {
    let api_url = if config.base_url.trim().is_empty() {
        "http://localhost:11434/api/chat".to_string()
    } else {
        config.base_url.trim().to_string()
    };

    let is_openai_compat = api_url.contains("/v1/chat/completions");

    let mut request_body = if is_openai_compat {
        json!({
            "model": config.model,
            "messages": messages,
            "stream": true,
            "temperature": 0.2,
            "max_tokens": 4096
        })
    } else {
        json!({
            "model": config.model,
            "messages": messages,
            "stream": true,
            "think": config.think,
            "options": {
                "num_ctx": 16384,
                "num_predict": 4096,
                "temperature": 0.2
            }
        })
    };

    if is_openai_compat {
        if let Some(think_val) = config.think {
            request_body["think"] = json!(think_val);
        }
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| e.to_string())?;

    let mut req = client.post(&api_url).json(&request_body);

    if let Some(ref key) = config.api_key {
        if !key.trim().is_empty() {
            req = req.bearer_auth(key.trim());
        }
    }

    let mut response = req
        .send()
        .await
        .map_err(|e| format!("Failed to connect to API LLM: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let raw_text = response
            .text()
            .await
            .unwrap_or_else(|e| format!("Error reading error body: {}", e));
        return Err(format!("API returned error ({}): {}", status, raw_text));
    }

    let mut full_content = String::new();
    let mut line_buffer = String::new();

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("Stream read error: {}", e))?
    {
        let text = String::from_utf8_lossy(&chunk);
        line_buffer.push_str(&text);

        while let Some(newline_pos) = line_buffer.find('\n') {
            let line = line_buffer[..newline_pos].trim().to_string();
            line_buffer.drain(..=newline_pos);

            if line.is_empty() {
                continue;
            }

            let json_str = if let Some(stripped) = line.strip_prefix("data:") {
                let s = stripped.trim();
                if s == "[DONE]" {
                    break;
                }
                s
            } else {
                line.as_str()
            };

            if let Ok(parsed) = serde_json::from_str::<Value>(json_str) {
                if let Some(delta) = parsed["choices"][0]["delta"]["content"].as_str() {
                    if !delta.is_empty() {
                        full_content.push_str(delta);
                        let _ = on_chunk.send(delta.to_string());
                    }
                } else if let Some(msg_content) = parsed["message"]["content"].as_str() {
                    if !msg_content.is_empty() {
                        full_content.push_str(msg_content);
                        let _ = on_chunk.send(msg_content.to_string());
                    }
                }
            }
        }
    }

    if full_content.trim().is_empty() {
        return Err("Model returned an empty response (0 tokens).".to_string());
    }

    Ok(full_content)
}