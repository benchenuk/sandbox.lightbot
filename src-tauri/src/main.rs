use std::path::Path;
use std::process::Child;
use std::sync::Mutex;

/// Initialize flexi_logger with rotation
fn setup_logger() -> Result<(), Box<dyn std::error::Error>> {
    use flexi_logger::{Cleanup, Criterion, FileSpec, Naming, Logger};

    // Get log directory from env or default to ~/.lightbot/logs
    let log_dir = std::env::var("LOG_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::home_dir()
                .map(|h| h.join(".lightbot").join("logs"))
                .unwrap_or_else(|| std::path::PathBuf::from("logs"))
        });

    // Get log level from env or default to info
    let log_level = std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string());

    Logger::try_with_str(&log_level)?
        .log_to_file(FileSpec::default().directory(log_dir))
        .rotate(
            Criterion::Size(5 * 1024 * 1024), // 5MB per file
            Naming::Numbers,                  // Use numbers (lightbot.log, lightbot.log.1, etc.)
            Cleanup::KeepLogFiles(3),         // Keep 3 files max
        )
        .write_mode(flexi_logger::WriteMode::Async)
        .start()?;

    log::info!("Logger initialized with level: {}", log_level);
    Ok(())
}

/// Log a message (shim for flexi_logger)
fn log_to_file(msg: &str) {
    log::info!("{}", msg);
}
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, Runtime};

struct SidecarState {
    port: Mutex<u16>,
    error: Mutex<Option<String>>,
}

/// Decode PNG bytes to RGBA image data
fn load_png_icon(bytes: &[u8]) -> tauri::image::Image<'static> {
    let img = image::load_from_memory_with_format(bytes, image::ImageFormat::Png)
        .expect("Icon should be valid PNG");
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    tauri::image::Image::new_owned(rgba.into_raw(), width, height)
}

/// Load .env file from project root (dev) or user home (production)
fn load_dotenv() {
    // Try project root first (development)
    let project_root = Path::new(env!("CARGO_MANIFEST_DIR")).parent().unwrap_or(Path::new("."));
    let dev_env = project_root.join(".env");
    
    if dev_env.exists() {
        println!("Loading .env from project root: {:?}", dev_env);
        let _ = dotenv::from_path(&dev_env);
        return;
    }
    
    // Fallback to user home (production)
    if let Some(home) = dirs::home_dir() {
        let user_env = home.join(".lightbot").join(".env");
        if user_env.exists() {
            println!("Loading .env from user home: {:?}", user_env);
            let _ = dotenv::from_path(&user_env);
        }
    }
}

fn toggle_window_visibility<R: Runtime>(app: &tauri::AppHandle<R>) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        let is_focused = window.is_focused().unwrap_or(false);

        if is_visible && is_focused {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

fn setup_system_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(app, &[&show_i, &separator, &quit_i])?;

    // Load tray icon (32x32 for standard, scales on retina)
    let icon = load_png_icon(include_bytes!("../icons/32x32.png"));

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .on_menu_event(|app, event| {
            let event_id = event.id.as_ref();
            if event_id == "show" {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            } else if event_id == "quit" {
                app.exit(0);
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { .. } = event {
                toggle_window_visibility(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

fn setup_global_hotkey<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<(), Box<dyn std::error::Error>> {
    // Read hotkey from env, fallback to Command+Shift+O
    let mut hotkey_str = std::env::var("GLOBAL_HOTKEY").unwrap_or_else(|_| "Command+Shift+O".to_string());
    
    // Clean up quotes if present (common when written by some env tools)
    hotkey_str = hotkey_str.trim_matches(|c| c == '\'' || c == '"').to_string();
    
    // Normalize "Cmd" to "Command" for platform compatibility
    let normalized_hotkey = hotkey_str.replace("Cmd", "Command");
    
    let shortcut: Shortcut = match normalized_hotkey.parse() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Invalid hotkey '{}', error: {:?}. Using default.", normalized_hotkey, e);
            "Command+Shift+O".parse::<Shortcut>()?
        }
    };

    println!("Registering global hotkey: {}", normalized_hotkey);

    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                // println!("🔥 Global hotkey '{}' triggered", normalized_hotkey);
                toggle_window_visibility(app);
            }
        })?;

    Ok(())
}

async fn spawn_python_sidecar<R: Runtime>(
    app: &tauri::AppHandle<R>,
) -> Result<(Option<Child>, u16), String> {
    // Check for manual sidecar port (Option 1 - Manual Dev Mode)
    if let Ok(manual_port) = std::env::var("LIGHTBOT_SIDECAR_PORT") {
        if let Ok(port) = manual_port.parse::<u16>() {
            println!("🚀 Using manual Python sidecar on port {}", port);
            
            // Verify the manual server is actually responsive
            let client = reqwest::Client::new();
            let health_url = format!("http://127.0.0.1:{}/health", port);
            
            match client.get(&health_url).timeout(std::time::Duration::from_secs(2)).send().await {
                Ok(resp) if resp.status().is_success() => {
                    println!("Verified manual sidecar is healthy on port {}", port);
                    return Ok((None, port));
                }
                _ => {
                    return Err(format!("Manual sidecar port {} provided via LIGHTBOT_SIDECAR_PORT but server is not responding at {}", port, health_url));
                }
            }
        }
    }

    // Find an available port
    let port = portpicker::pick_unused_port().ok_or("No available port")?;

    // Detect current target triple for bundled sidecar
    let arch = if cfg!(target_arch = "aarch64") { "aarch64" } else { "x86_64" };
    let triple = format!("{}-apple-darwin", arch);
    let sidecar_with_triple = format!("python-sidecar-{}", triple);

    // Get the directory of the current executable (for bundled app)
    let current_exe = std::env::current_exe().ok();
    let exe_dir = current_exe.as_ref().and_then(|p| p.parent().map(|p| p.to_path_buf()));
    
    // Try multiple possible paths for the sidecar binary
    let mut possible_paths = vec![
        // Bundled app: sidecar is in same directory as main executable (Contents/MacOS/)
        exe_dir.as_ref().map(|d| d.join(sidecar_with_triple.clone())),
        exe_dir.as_ref().map(|d| d.join("python-sidecar")),
        
        // Bundled paths via Resource (for older Tauri versions)
        app.path().resolve(format!("bin/{}", sidecar_with_triple), tauri::path::BaseDirectory::Resource).ok(),
        app.path().resolve("bin/python-sidecar", tauri::path::BaseDirectory::Resource).ok(),
        
        // Development paths (relative to app directory)
        app.path().resolve(format!("src-tauri/bin/{}", sidecar_with_triple), tauri::path::BaseDirectory::AppConfig).ok(),
        app.path().resolve("src-tauri/bin/python-sidecar", tauri::path::BaseDirectory::AppConfig).ok(),
    ];

    // Add some direct relative paths as fallback for dev
    possible_paths.push(Some(std::path::PathBuf::from(format!("src-tauri/bin/{}", sidecar_with_triple))));
    possible_paths.push(Some(std::path::PathBuf::from("src-tauri/bin/python-sidecar")));
    possible_paths.push(Some(std::path::PathBuf::from(format!("bin/{}", sidecar_with_triple))));
    possible_paths.push(Some(std::path::PathBuf::from("bin/python-sidecar")));

    let mut sidecar_path = None;
    for path in possible_paths.into_iter().flatten() {
        if path.exists() {
            sidecar_path = Some(path);
            break;
        }
    }

    let sidecar_path = sidecar_path.ok_or_else(|| {
        let err = format!("Python sidecar binary not found. Please run ./scripts/build-sidecar.sh. Expected: src-tauri/bin/{}", sidecar_with_triple);
        log_to_file(&err);
        err
    })?;

    let msg = format!("Spawning Python sidecar from: {:?}", sidecar_path);
    println!("{}", msg);
    log_to_file(&msg);

    // Spawn the Python sidecar process
    let mut command = std::process::Command::new(sidecar_path);
    command.arg("--port").arg(port.to_string());

    #[cfg(target_os = "macos")]
    {
        command.env("PYTHONUNBUFFERED", "1");
    }

    // Redirect sidecar stdout/stderr to the rotating log file
    // With Naming::Numbers, the current file is always lightbot.log
    let log_dir = std::env::var("LOG_DIR")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| {
            dirs::home_dir()
                .map(|h| h.join(".lightbot").join("logs"))
                .unwrap_or_else(|| std::path::PathBuf::from("logs"))
        });
    let _ = std::fs::create_dir_all(&log_dir);
    let log_file_path = log_dir.join("lightbot.log");
    
    use std::fs::OpenOptions;
    if let Ok(log_file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_file_path) 
    {
        command.stdout(log_file.try_clone().expect("Failed to clone log handle"));
        command.stderr(log_file);
        log::info!("Sidecar output redirected to rotating log: {:?}", log_file_path);
    }

    let child = match command.spawn() {
        Ok(c) => {
            log_to_file(&format!("Sidecar spawned with PID: {:?}", c.id()));
            c
        }
        Err(e) => {
            let err = format!("Failed to spawn sidecar: {}", e);
            log_to_file(&err);
            return Err(err);
        }
    };

    // Wait a bit for the server to start
    tokio::time::sleep(tokio::time::Duration::from_millis(1500)).await;

    // Verify the server is running
    let client = reqwest::Client::new();
    let health_url = format!("http://127.0.0.1:{}/health", port);

    let mut retries = 15;
    while retries > 0 {
        match client.get(&health_url).timeout(std::time::Duration::from_secs(2)).send().await {
            Ok(resp) if resp.status().is_success() => {
                let msg = format!("Python sidecar is healthy on port {}", port);
                println!("{}", msg);
                log_to_file(&msg);
                return Ok((Some(child), port));
            }
            Ok(resp) => {
                let err = format!("Health check returned status: {}", resp.status());
                log_to_file(&err);
                retries -= 1;
                if retries == 0 {
                    let final_err = "Sidecar health check failed - /health not returning success".to_string();
                    log_to_file(&final_err);
                    return Err(final_err);
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
            }
            Err(e) => {
                let err = format!("Health check request failed: {}", e);
                log_to_file(&err);
                retries -= 1;
                if retries == 0 {
                    let final_err = "Sidecar health check failed - server not responding".to_string();
                    log_to_file(&final_err);
                    return Err(final_err);
                }
                tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
            }
        }
    }

    Err("Failed to start sidecar".to_string())
}

#[tauri::command]
fn get_sidecar_status(state: tauri::State<SidecarState>) -> Result<u16, String> {
    let port = *state.port.lock().unwrap();
    if port > 0 {
        Ok(port)
    } else {
        let error = state.error.lock().unwrap();
        Err(error.clone().unwrap_or_else(|| "Sidecar not started yet".to_string()))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger first (before anything else)
    if let Err(e) = setup_logger() {
        eprintln!("Failed to initialize logger: {}", e);
    }
    log::info!("=== LightBot App Starting ===");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(SidecarState {
            port: Mutex::new(0),
            error: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![get_sidecar_status])
        .setup(|app| {
            // Load .env file for configuration (before hotkey setup)
            load_dotenv();

            // Setup system tray
            setup_system_tray(app.handle())?;

            // Setup global hotkey
            let _ = setup_global_hotkey(app.handle());

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match spawn_python_sidecar(&app_handle).await {
                    Ok((_child, port)) => {
                        println!("Python sidecar started on port {}", port);
                        
                        // Store the port in state
                        let state = app_handle.state::<SidecarState>();
                        *state.port.lock().unwrap() = port;
                        
                        // Emit event to frontend that sidecar is ready
                        let _ = app_handle.emit("sidecar-ready", port);
                    }
                    Err(e) => {
                        let err_msg = format!("Failed to start Python sidecar: {}", e);
                        eprintln!("{}", err_msg);
                        log_to_file(&err_msg);
                        
                        // Store the error in state
                        let state = app_handle.state::<SidecarState>();
                        *state.error.lock().unwrap() = Some(e.clone());
                        
                        let _ = app_handle.emit("sidecar-error", e);
                    }
                }
            });

            // Show the main window once everything is set up
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }

            Ok(())
        })
        .on_window_event(|app, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Hide window instead of closing (keep running in tray)
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.hide();
                }
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run()
}
