use std::time::Duration;

fn strip_html_tags(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut in_tag = false;
    for ch in input.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                out.push(' ');
            }
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn remove_html_block(mut html: String, tag: &str) -> String {
    let open_pat = format!("<{}", tag);
    let close_pat = format!("</{}>", tag);
    loop {
        let lower = html.to_lowercase();
        let Some(start) = lower.find(&open_pat) else {
            break;
        };
        if let Some(rel_end) = lower.get(start..).and_then(|s| s.find(&close_pat)) {
            html.replace_range(start..start + rel_end + close_pat.len(), " ");
        } else {
            html.truncate(start);
            break;
        }
    }
    html
}

fn decode_url_component(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hex) = std::str::from_utf8(&bytes[i + 1..i + 3]) {
                if let Ok(val) = u8::from_str_radix(hex, 16) {
                    out.push(val);
                    i += 3;
                    continue;
                }
            }
        } else if bytes[i] == b'+' {
            out.push(b' ');
            i += 1;
            continue;
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn floor_char(s: &str, mut idx: usize) -> usize {
    idx = idx.min(s.len());
    while idx > 0 && !s.is_char_boundary(idx) {
        idx -= 1;
    }
    idx
}

#[tauri::command]
pub async fn fetch_url(url: String) -> Result<String, String> {
    let trimmed = url.trim().to_string();
    if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        return Err("URL must start with http:// or https://".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AbsoluteStudio/1.0")
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let resp = client
        .get(&trimmed)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch '{}': {}", trimmed, e))?;

    let status = resp.status();
    let body = resp
        .text()
        .await
        .map_err(|e| format!("Failed to read response body: {}", e))?;

    if !status.is_success() {
        return Err(format!("HTTP {} while fetching '{}'", status, trimmed));
    }

    let no_script = remove_html_block(body, "script");
    let no_style = remove_html_block(no_script, "style");
    let clean_text = strip_html_tags(&no_style);

    if clean_text.chars().count() > 8000 {
        let truncated: String = clean_text.chars().take(8000).collect();
        Ok(format!(
            "URL: {}\nCONTENT:\n{}...\n[CONTENT TRUNCATED AT 8000 CHARS]",
            trimmed, truncated
        ))
    } else {
        Ok(format!("URL: {}\nCONTENT:\n{}", trimmed, clean_text))
    }
}

#[tauri::command]
pub async fn web_search(query: String) -> Result<String, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Err("Search query cannot be empty.".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    // 1. DuckDuckGo Lite z pełnymi nagłówkami przeglądarki
    if let Ok(resp) = client
        .post("https://lite.duckduckgo.com/lite/")
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
        .header("Accept-Language", "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7")
        .header("Referer", "https://lite.duckduckgo.com/")
        .form(&[("q", trimmed)])
        .send()
        .await
    {
        if let Ok(html) = resp.text().await {
            let mut results = Vec::new();
            let mut cursor = 0;

            while let Some(slice) = html.get(cursor..) {
                let Some(rel_idx) = slice.find("result-link") else {
                    break;
                };
                let class_pos = cursor + rel_idx;
                let tag_start = html
                    .get(..class_pos)
                    .and_then(|s| s.rfind("<a "))
                    .unwrap_or(class_pos);

                let tag_end = floor_char(&html, class_pos + 30);
                let raw_href = html
                    .get(tag_start..tag_end)
                    .and_then(|s| s.find("href=\"").map(|h| tag_start + h + 6))
                    .and_then(|abs_h| {
                        html.get(abs_h..)
                            .and_then(|s| s.find('"').map(|end_q| &s[..end_q]))
                    })
                    .unwrap_or("");

                let clean_url = if let Some(uddg_pos) = raw_href.find("uddg=") {
                    let encoded = &raw_href[uddg_pos + 5..];
                    let end = encoded.find('&').unwrap_or(encoded.len());
                    decode_url_component(&encoded[..end])
                } else if raw_href.starts_with("//") {
                    format!("https:{}", raw_href)
                } else {
                    raw_href.to_string()
                };

                let title = html
                    .get(class_pos..)
                    .and_then(|s| s.find('>').map(|gt| class_pos + gt + 1))
                    .and_then(|t_start| {
                        html.get(t_start..)
                            .and_then(|s| s.find("</a>").map(|end_a| strip_html_tags(&s[..end_a])))
                    })
                    .unwrap_or_default();

                let next_limit = floor_char(&html, class_pos + 2000);
                let snippet = html
                    .get(class_pos..next_limit)
                    .and_then(|s| s.find("result-snippet").map(|idx| class_pos + idx))
                    .and_then(|s_pos| {
                        html.get(s_pos..)
                            .and_then(|s| s.find('>').map(|gt| s_pos + gt + 1))
                    })
                    .and_then(|text_start| {
                        html.get(text_start..).and_then(|s| {
                            s.find("</td>")
                                .map(|end_td| strip_html_tags(&s[..end_td]))
                        })
                    })
                    .unwrap_or_default();

                if !title.is_empty() && clean_url.starts_with("http") {
                    results.push(format!(
                        "{}. {}\n   URL: {}\n   {}",
                        results.len() + 1,
                        title,
                        clean_url,
                        snippet
                    ));
                }

                cursor = class_pos + "result-link".len();
                if results.len() >= 8 {
                    break;
                }
            }

            if !results.is_empty() {
                return Ok(results.join("\n\n"));
            }
        }
    }

    // 2. Fallback: API Wikipedii (PL + EN), jeśli DDG zablokował zapytanie
    let mut wiki_results = Vec::new();
    for (lang, base_url) in [
        ("PL", "https://pl.wikipedia.org/w/api.php"),
        ("EN", "https://en.wikipedia.org/w/api.php"),
    ] {
        if let Ok(resp) = client
            .get(base_url)
            .query(&[
                ("action", "query"),
                ("list", "search"),
                ("srsearch", trimmed),
                ("format", "json"),
                ("srlimit", "4"),
            ])
            .send()
            .await
        {
            if let Ok(json) = resp.json::<serde_json::Value>().await {
                if let Some(arr) = json["query"]["search"].as_array() {
                    for item in arr {
                        let title = item["title"].as_str().unwrap_or("");
                        let snippet = strip_html_tags(item["snippet"].as_str().unwrap_or(""));
                        if !title.is_empty() {
                            let slug = title.replace(' ', "_");
                            let domain = if lang == "PL" {
                                "pl.wikipedia.org"
                            } else {
                                "en.wikipedia.org"
                            };
                            wiki_results.push(format!(
                                "{}. [Wiki {}] {}\n   URL: https://{}/wiki/{}\n   {}",
                                wiki_results.len() + 1,
                                lang,
                                title,
                                domain,
                                slug,
                                snippet
                            ));
                        }
                    }
                }
            }
        }
    }

    if !wiki_results.is_empty() {
        Ok(wiki_results.join("\n\n"))
    } else {
        Ok(format!("No web search results found for '{}'.", trimmed))
    }
}