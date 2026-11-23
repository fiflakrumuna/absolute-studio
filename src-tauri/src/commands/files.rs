use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

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
pub fn list_workspace_files(workspace: String) -> Result<String, String> {
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
}

#[tauri::command]
pub fn read_workspace_file(workspace: String, relative_path: String) -> Result<String, String> {
    let target = resolve_workspace_path(&workspace, &relative_path)?;
    fs::read_to_string(&target)
        .map_err(|e| format!("Failed to read '{}': {}", relative_path, e))
}

#[tauri::command]
pub fn write_workspace_file(
    workspace: String,
    relative_path: String,
    content: String,
) -> Result<String, String> {
    let target = resolve_workspace_path(&workspace, &relative_path)?;

    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories for '{}': {}", relative_path, e))?;
    }

    fs::write(&target, content)
        .map_err(|e| format!("Failed to write '{}': {}", relative_path, e))?;

    Ok(format!("Successfully wrote: {}", relative_path))
}

#[tauri::command]
pub fn run_workspace_command(workspace: String, command: String) -> Result<String, String> {
    let base = Path::new(&workspace);
    if !base.exists() || !base.is_dir() {
        return Err("Workspace directory not found.".to_string());
    }

    let output = Command::new("cmd")
        .args(["/C", &command])
        .current_dir(base)
        .output()
        .map_err(|e| format!("Failed to execute command: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    Ok(format!(
        "EXIT_CODE: {}\nSTDOUT:\n{}\nSTDERR:\n{}",
        output.status.code().unwrap_or(-1),
        stdout,
        stderr
    ))
}