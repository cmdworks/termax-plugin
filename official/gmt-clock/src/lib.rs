use extism_pdk::*;
use serde::{Deserialize, Serialize};
use chrono::Utc;

#[derive(Serialize, Deserialize, Debug)]
pub struct PluginConfig {
    pub show_gmt: Option<bool>,
}

#[plugin_fn]
pub fn activate() -> FnResult<()> {
    unsafe {
        // Register the setting
        let schema = serde_json::json!({
            "type": "boolean",
            "title": "Show GMT Time",
            "description": "Show the current GMT time in the status bar",
            "default": true
        });
        termax_settings_register_custom_block(
            "gmt-clock",
            "show_gmt",
            &schema.to_string()
        )?;
        
        // Initial set text
        let now = Utc::now().format("%H:%M:%S").to_string();
        termax_status_bar_set_text(
            "gmt-clock",
            "gmt-time",
            &format!("GMT: {}", now)
        )?;
    }
    Ok(())
}

#[plugin_fn]
pub fn execute_command(command_id: String) -> FnResult<()> {
    // Check if the command is to update time
    if command_id == "update_time" {
        let config_str = config::get("show_gmt")?;
        let show = config_str.as_deref().unwrap_or("true") != "false";
        
        if show {
            let now = Utc::now().format("%H:%M:%S").to_string();
            unsafe {
                termax_status_bar_set_text(
                    "gmt-clock",
                    "gmt-time",
                    &format!("GMT: {}", now)
                )?;
            }
        } else {
            unsafe {
                termax_status_bar_set_text(
                    "gmt-clock",
                    "gmt-time",
                    ""
                )?;
            }
        }
    }
    Ok(())
}

#[plugin_fn]
pub fn deactivate() -> FnResult<()> {
    Ok(())
}

#[host_fn("termax")]
extern "ExtismHost" {
    fn termax_status_bar_set_text(plugin_id: &str, item_id: &str, text: &str);
    fn termax_settings_register_custom_block(plugin_id: &str, block_id: &str, schema_json: &str);
}
