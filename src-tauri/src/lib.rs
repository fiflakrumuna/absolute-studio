mod commands;
mod models;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::llm::send_message,
            commands::files::list_workspace_files,
            commands::files::read_workspace_file,
            commands::files::write_workspace_file,
            commands::files::run_workspace_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
