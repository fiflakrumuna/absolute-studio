use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Polecenia absolutnie zabronione (nigdy nie mogą zostać wykonane, nawet za zgodą użytkownika)
const HARD_BLOCKED_PATTERNS: &[(&str, &str)] = &[
    ("format ", "Disk formatting is strictly prohibited."),
    ("diskpart", "Disk partitioning utility is prohibited."),
    ("mkfs", "Filesystem creation is prohibited."),
    ("dd if=", "Raw block-device write is prohibited."),
    (":(){ :|:& };:", "Fork bomb pattern detected."),
    ("shutdown", "System shutdown/reboot is prohibited."),
    ("restart-computer", "System reboot is prohibited."),
    ("stop-computer", "System shutdown is prohibited."),
    ("reg delete", "Windows Registry deletion is prohibited."),
    ("bcdedit", "Boot configuration modification is prohibited."),
    ("cipher /w", "Free-space wiping is prohibited."),
    ("sudo ", "Privilege escalation (sudo) is prohibited."),
    ("runas", "Privilege escalation (runas) is prohibited."),
    ("chmod 777", "Insecure global permission change (777) is prohibited."),
    ("chown ", "Ownership modification is prohibited."),
    ("-encodedcommand", "Obfuscated PowerShell encoded command is prohibited."),
    (" -enc ", "Obfuscated PowerShell encoded command is prohibited."),
    ("iex(", "Remote script evaluation (Invoke-Expression) is prohibited."),
    ("invoke-expression", "Dynamic script evaluation is prohibited."),
];

/// Polecenia podwyższonego ryzyka (wymagają wyraźnej zgody użytkownika przed każdym uruchomieniem)
const HIGH_RISK_PATTERNS: &[(&str, &str)] = &[
    ("rm -rf", "Recursive forced deletion (rm -rf)"),
    ("rm -r", "Recursive file deletion (rm -r)"),
    ("rm -f", "Forced file deletion (rm -f)"),
    ("rmdir /s", "Recursive directory deletion (rmdir /s)"),
    ("del /f", "Forced file deletion (del /f)"),
    ("del /q", "Quiet mass file deletion (del /q)"),
    ("remove-item", "PowerShell file/directory deletion (Remove-Item)"),
    ("curl ", "External network request / data transfer (curl)"),
    ("wget ", "External file download (wget)"),
    ("invoke-webrequest", "External network request (Invoke-WebRequest)"),
    ("iwr ", "External network request (iwr)"),
    ("nc ", "Raw network socket connection (netcat)"),
    ("ncat ", "Raw network socket connection (ncat)"),
    ("ssh ", "Remote SSH connection"),
    ("scp ", "Remote file transfer (scp)"),
    ("git push", "Pushing changes to remote Git repository"),
    ("git reset --hard", "Destructive Git history/working-tree reset"),
    ("git clean -f", "Deleting untracked files via Git"),
    ("npm publish", "Publishing package to public registry"),
    ("cargo publish", "Publishing crate to public registry"),
    ("pip install", "Installing global/environment Python packages"),
    ("npm install -g", "Installing global Node packages"),
    ("taskkill", "Terminating running system processes"),
    ("kill -9", "Force-killing running processes"),
];

fn evaluate_command_security(command: &str) -> Result<Option<String>, String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return Err("BLOCKED: Empty command.".to_string());
    }

    let lower = trimmed.to_lowercase();

    // 1. Blokada ucieczki poza katalog workspace
    if lower.contains("..")
        || lower.starts_with("cd /")
        || lower.starts_with("cd \\")
        || lower.contains(" cd /")
        || lower.contains(" cd \\")
        || lower.contains("cd ~")
    {
        return Err(
            "BLOCKED: Directory traversal outside the mounted workspace is prohibited by security policy."
                .to_string(),
        );
    }

    // 2. Twarda blokada poleceń destrukcyjnych / systemowych
    for (pattern, reason) in HARD_BLOCKED_PATTERNS {
        if lower.contains(pattern) {
            return Err(format!("BLOCKED BY SANDBOX POLICY: {}", reason));
        }
    }

    // 3. Wykrywanie poleceń wysokiego ryzyka (ostrzeżenie w oknie zgody)
    let mut warnings = Vec::new();
    for (pattern, desc) in HIGH_RISK_PATTERNS {
        if lower.contains(pattern) {
            warnings.push(*desc);
        }
    }

    if warnings.is_empty() {
        Ok(None)
    } else {
        Ok(Some(warnings.join("; ")))
    }
}

#[tauri::command]
pub fn check_command_policy(command: String) -> Result<String, String> {
    match evaluate_command_security(&command)? {
        Some(warning) => Ok(format!("HIGH_RISK: {}", warning)),
        None => Ok("STANDARD".to_string()),
    }
}

fn resolve_workspace_path(workspace: &str, relative_path: &str) -> Result<PathBuf, String> {
    let base = Path::new(workspace);
    if !base.exists() || !base.is_dir() {
        return Err("Selected workspace directory does not exist.".to_string());
    }

    let clean_rel = relative_path.trim().trim_start_matches(['/', '\\']);
    if clean_rel.contains("..") {
        return Err("Path traversal ('..') is not allowed.".to_string());
    }

    Ok(base.join(clean_rel))
}

#[tauri::command]
pub async fn list_workspace_files(workspace: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let base = Path::new(&workspace);
        if !base.exists() || !base.is_dir() {
            return Err("Workspace directory not found.".to_string());
        }

        let mut files = Vec::new();
        fn visit_dirs(dir: &Path, base: &Path, files: &mut Vec<String>) -> std::io::Result<()> {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();

                if name == "node_modules" || name == "target" || name == ".git" || name == "gen" {
                    continue;
                }

                if path.is_dir() {
                    visit_dirs(&path, base, files)?;
                } else if let Ok(rel) = path.strip_prefix(base) {
                    files.push(rel.to_string_lossy().replace('\\', "/"));
                }
            }
            Ok(())
        }

        visit_dirs(base, base, &mut files).map_err(|e| e.to_string())?;
        files.sort();
        Ok(files.join("\n"))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn read_workspace_file(workspace: String, relative_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let target = resolve_workspace_path(&workspace, &relative_path)?;
        let content = fs::read_to_string(&target)
            .map_err(|e| format!("Failed to read '{}': {}", relative_path, e))?;

        const MAX_FILE_CHARS: usize = 12_000;
        if content.chars().count() > MAX_FILE_CHARS {
            let truncated: String = content.chars().take(MAX_FILE_CHARS).collect();
            Ok(format!(
                "{}\n\n... [TRUNCATED AT 12000 CHARS: File too large. Use search_files instead of reading the entire file.]",
                truncated
            ))
        } else {
            Ok(content)
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn write_workspace_file(
    workspace: String,
    relative_path: String,
    content: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let target = resolve_workspace_path(&workspace, &relative_path)?;

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                format!("Failed to create directories for '{}': {}", relative_path, e)
            })?;
        }

        fs::write(&target, content)
            .map_err(|e| format!("Failed to write '{}': {}", relative_path, e))?;

        Ok(format!("Successfully wrote: {}", relative_path))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn edit_workspace_file(
    workspace: String,
    relative_path: String,
    old_text: String,
    new_text: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let target = resolve_workspace_path(&workspace, &relative_path)?;
        let content = fs::read_to_string(&target)
            .map_err(|e| format!("Failed to read '{}': {}", relative_path, e))?;

        let matches = content.matches(&old_text).count();
        if matches == 0 {
            return Err(format!(
                "Could not find exact 'old_text' match in '{}'. Make sure whitespace and indentation match.",
                relative_path
            ));
        }
        if matches > 1 {
            return Err(format!(
                "Found {} occurrences of 'old_text' in '{}'. Include more surrounding lines to make the match unique.",
                matches, relative_path
            ));
        }

        let updated = content.replacen(&old_text, &new_text, 1);
        fs::write(&target, updated)
            .map_err(|e| format!("Failed to write updated '{}': {}", relative_path, e))?;

        Ok(format!("Successfully patched: {}", relative_path))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn search_workspace_files(
    workspace: String,
    query: String,
    case_sensitive: Option<bool>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let base = Path::new(&workspace);
        if !base.exists() || !base.is_dir() {
            return Err("Workspace directory not found.".to_string());
        }
        if query.trim().is_empty() {
            return Err("Search query cannot be empty.".to_string());
        }

        let sensitive = case_sensitive.unwrap_or(false);
        let needle = if sensitive {
            query.clone()
        } else {
            query.to_lowercase()
        };

        let mut results = Vec::new();
        let max_results = 100;

        fn search_dir(
            dir: &Path,
            base: &Path,
            needle: &str,
            sensitive: bool,
            results: &mut Vec<String>,
            max_results: usize,
        ) -> std::io::Result<()> {
            if results.len() >= max_results {
                return Ok(());
            }

            for entry in fs::read_dir(dir)? {
                if results.len() >= max_results {
                    break;
                }

                let entry = entry?;
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().to_string();

                if name == "node_modules" || name == "target" || name == ".git" || name == "gen" {
                    continue;
                }

                if path.is_dir() {
                    search_dir(&path, base, needle, sensitive, results, max_results)?;
                } else if let Ok(content) = fs::read_to_string(&path) {
                    let rel = path
                        .strip_prefix(base)
                        .unwrap_or(&path)
                        .to_string_lossy()
                        .replace('\\', "/");

                    for (idx, line) in content.lines().enumerate() {
                        let matched = if sensitive {
                            line.contains(needle)
                        } else {
                            line.to_lowercase().contains(needle)
                        };

                        if matched {
                            results.push(format!("{}:{}: {}", rel, idx + 1, line.trim()));
                            if results.len() >= max_results {
                                break;
                            }
                        }
                    }
                }
            }
            Ok(())
        }

        search_dir(base, base, &needle, sensitive, &mut results, max_results)
            .map_err(|e| e.to_string())?;

        if results.is_empty() {
            Ok(format!("No matches found for '{}'.", query))
        } else {
            let mut output = results.join("\n");
            if results.len() >= max_results {
                output.push_str("\n... [RESULTS TRUNCATED AT 100 MATCHES]");
            }
            Ok(output)
        }
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
pub async fn run_workspace_command(
    workspace: String,
    command: String,
    approved_by_user: bool,
) -> Result<String, String> {
    if !approved_by_user {
        return Err(
            "BLOCKED: Execution requires explicit user approval before running.".to_string(),
        );
    }

    // Ponowna weryfikacja polityki po stronie Rust (niezależnie od UI)
    let _risk_note = evaluate_command_security(&command)?;

    let future = tauri::async_runtime::spawn_blocking(move || {
        let base = Path::new(&workspace);
        if !base.exists() || !base.is_dir() {
            return Err("Workspace directory not found.".to_string());
        }

        #[cfg(target_os = "windows")]
        let mut cmd = {
            let mut c = Command::new("cmd");
            c.args(["/C", &command])
                .current_dir(base)
                .stdin(Stdio::null())
                .creation_flags(CREATE_NO_WINDOW);
            c
        };

        #[cfg(not(target_os = "windows"))]
        let mut cmd = {
            let mut c = Command::new("sh");
            c.args(["-c", &command])
                .current_dir(base)
                .stdin(Stdio::null());
            c
        };

        let output = cmd
            .output()
            .map_err(|e| format!("Failed to execute command: {}", e))?;

        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        let full_result = format!(
            "EXIT_CODE: {}\nSTDOUT:\n{}\nSTDERR:\n{}",
            output.status.code().unwrap_or(-1),
            stdout,
            stderr
        );

        if full_result.chars().count() > 8000 {
            let truncated: String = full_result.chars().take(8000).collect();
            Ok(format!(
                "{}...\n[OUTPUT TRUNCATED AT 8000 CHARS]",
                truncated
            ))
        } else {
            Ok(full_result)
        }
    });

    match tokio::time::timeout(Duration::from_secs(25), future).await {
        Ok(join_res) => join_res.map_err(|e| format!("Task join error: {}", e))?,
        Err(_) => Ok(
            "EXIT_CODE: 124\nSTDOUT:\n\nSTDERR:\nCommand timed out after 25 seconds (process may have been waiting for user input or running an infinite loop)."
                .to_string(),
        ),
    }
}