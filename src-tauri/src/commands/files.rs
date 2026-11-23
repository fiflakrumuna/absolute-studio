use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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

                if name == "node_modules" || name == "target" || name == ".git" {
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
        fs::read_to_string(&target)
            .map_err(|e| format!("Failed to read '{}': {}", relative_path, e))
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
pub async fn run_workspace_command(workspace: String, command: String) -> Result<String, String> {
    let future = tauri::async_runtime::spawn_blocking(move || {
        let base = Path::new(&workspace);
        if !base.exists() || !base.is_dir() {
            return Err("Workspace directory not found.".to_string());
        }

        let mut cmd = Command::new("cmd");
        cmd.args(["/C", &command])
            .current_dir(base)
            .stdin(Stdio::null());

        #[cfg(target_os = "windows")]
        cmd.creation_flags(CREATE_NO_WINDOW);

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