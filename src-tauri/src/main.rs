use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;
use std::fs::OpenOptions;
use std::io::Write;
use tauri::Manager;
use std::sync::{Arc, Mutex};

struct SidecarState(Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>);

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      let log_path = app.path().app_log_dir().unwrap().join("sidecar.log");
      std::fs::create_dir_all(app.path().app_log_dir().unwrap()).unwrap();
      let mut log_file = OpenOptions::new()
          .create(true)
          .append(true)
          .open(&log_path)
          .unwrap();

      writeln!(log_file, "--- Sidecar starting ---").unwrap();

      #[cfg(windows)]
      let sidecar_result = app.shell().sidecar("back-rust")?.args(["--windows-hide"]);
      
      #[cfg(not(windows))]
      let sidecar_result = app.shell().sidecar("back-rust")?;
      
      let mut sidecar = sidecar_result;

      // 在 Windows 上隐藏控制台窗口
      #[cfg(windows)]
      {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        sidecar = sidecar.creation_flags(CREATE_NO_WINDOW);
      }

      match sidecar.spawn() {
        Ok((mut rx, child)) => {
          // 将 child 存入状态中，以便后续关闭
          let child_arc = Arc::new(Mutex::new(Some(child)));
          app.manage(SidecarState(child_arc.clone()));

          tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
              match event {
                CommandEvent::Stdout(line) => {
                  if let Ok(s) = String::from_utf8(line) {
                    print!("[back-rust] {}", s);
                    if let Ok(mut f) = OpenOptions::new().append(true).open(&log_path) {
                      let _ = writeln!(f, "STDOUT: {}", s);
                    }
                  }
                }
                CommandEvent::Stderr(line) => {
                  if let Ok(s) = String::from_utf8(line) {
                    eprint!("[back-rust] {}", s);
                    if let Ok(mut f) = OpenOptions::new().append(true).open(&log_path) {
                      let _ = writeln!(f, "STDERR: {}", s);
                    }
                  }
                }
                _ => {}
              }
            }
          });
        },
        Err(e) => {
          eprintln!("Failed to spawn sidecar: {}", e);
          let _ = writeln!(log_file, "SPAWN ERROR: {}", e);
        }
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building tauri application")
    .run(|app_handle, event| match event {
      tauri::RunEvent::Exit => {
        // 当程序退出时，显式杀死 sidecar 进程
        if let Some(state) = app_handle.try_state::<SidecarState>() {
          if let Ok(mut child_lock) = state.0.lock() {
            if let Some(child) = child_lock.take() {
              println!("Killing sidecar process...");
              let _ = child.kill();
            }
          }
        }
      }
      _ => {}
    });
}
