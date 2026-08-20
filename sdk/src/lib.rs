//! Termax Plugin SDK
//!
//! Re-exports the generated WIT bindings and provides ergonomic helpers
//! for writing Termax plugins in Rust.
//!
//! # Quick start
//!
//! ```toml
//! # In your plugin's Cargo.toml:
//! [dependencies]
//! termax-plugin-sdk = { path = "../../sdk" }
//! ```
//!
//! ```rust
//! use termax_plugin_sdk::prelude::*;
//!
//! struct MyPlugin;
//!
//! impl TermaxPlugin for MyPlugin {
//!     fn on_command(cmd: &str, _args: &[String]) {
//!         match cmd {
//!             "my_command" => { /* do work */ }
//!             _ => {}
//!         }
//!     }
//! }
//!
//! export_plugin!(MyPlugin);
//! ```

wit_bindgen::generate!({
    world: "termax-plugin",
    path: "wit/",
});

pub mod prelude {
    pub use super::*;
}

// ── Host API helpers ─────────────────────────────────────────────────────────

/// Write a line to the status bar item with the given id.
pub fn status_bar_set(id: &str, text: &str) {
    host::status_bar_set_text(id, text);
}

/// Set a tooltip on a status bar item.
pub fn status_bar_tooltip(id: &str, tooltip: &str) {
    host::status_bar_set_tooltip(id, tooltip);
}

/// Send a desktop notification.
pub fn notify(title: &str, body: &str) {
    host::notify(title, body);
}

/// Read a plugin setting value. Returns `None` if the key doesn't exist.
pub fn setting_get(key: &str) -> Option<String> {
    host::settings_get(key)
}
