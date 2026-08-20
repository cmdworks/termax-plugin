use extism_pdk::*;

#[host_fn("termax")]
extern "ExtismHost" {
    fn termax_exec(plugin_id: String, command: String) -> String;
    fn termax_settings_get(plugin_id: String, key: String) -> String;
    fn termax_status_bar_set_text(plugin_id: String, item_id: String, text: String);
    fn termax_status_bar_set_tooltip(plugin_id: String, item_id: String, tooltip: String);
}

#[plugin_fn]
pub fn execute_command(command_id: String) -> FnResult<()> {
    if command_id == "update_stats" {
        let show_cpu = unsafe { termax_settings_get("sys-monitor".into(), "show_cpu".into()).unwrap_or_default() };
        let show_memory = unsafe { termax_settings_get("sys-monitor".into(), "show_memory".into()).unwrap_or_default() };

        let show_cpu_bool = show_cpu.is_empty() || show_cpu == "true";
        let show_memory_bool = show_memory.is_empty() || show_memory == "true";

        if show_cpu_bool {
            // --- CPU ---
            let cpu_sum_str = unsafe { termax_exec("sys-monitor".into(), "ps -A -o %cpu | awk '{s+=$1} END {print s}'".into())? };
            let cores_str = unsafe { termax_exec("sys-monitor".into(), "sysctl -n hw.ncpu".into())? };
            
            let cpu_sum: f64 = cpu_sum_str.trim().parse().unwrap_or(0.0);
            let cores: f64 = cores_str.trim().parse().unwrap_or(1.0);
            let cpu_percent = cpu_sum / cores;

            unsafe {
                let _ = termax_status_bar_set_text("sys-monitor".into(), "sys-cpu".into(), format!("CPU: {:.1}%", cpu_percent));
                let _ = termax_status_bar_set_tooltip("sys-monitor".into(), "sys-cpu".into(), format!("{:.1}% total CPU usage across {} cores", cpu_sum, cores));
            }
        } else {
            unsafe { let _ = termax_status_bar_set_text("sys-monitor".into(), "sys-cpu".into(), "".into()); }
        }

        if show_memory_bool {
            // --- Memory ---
            let mem_script = r#"vm_stat | perl -ne '/page size of (\d+) bytes/ and $size=$1; /Pages active:\s+(\d+)/ and $active=$1; /Pages wired down:\s+(\d+)/ and $wired=$1; /Pages occupied by compressor:\s+(\d+)/ and $comp=$1; END { print int(($active+$wired+$comp)*$size/1048576) }'"#;
            let used_mb_str = unsafe { termax_exec("sys-monitor".into(), mem_script.into())? };
            let total_bytes_str = unsafe { termax_exec("sys-monitor".into(), "sysctl -n hw.memsize".into())? };
            
            let used_mb: f64 = used_mb_str.trim().parse().unwrap_or(0.0);
            let total_bytes: f64 = total_bytes_str.trim().parse().unwrap_or(0.0);
            let total_gb = total_bytes / 1024.0 / 1024.0 / 1024.0;
            let percent = if total_bytes > 0.0 { (used_mb / (total_bytes / 1024.0 / 1024.0)) * 100.0 } else { 0.0 };

            unsafe {
                let _ = termax_status_bar_set_text("sys-monitor".into(), "sys-memory".into(), format!("RAM: {:.1}%", percent));
                let _ = termax_status_bar_set_tooltip("sys-monitor".into(), "sys-memory".into(), format!("{:.1} GB / {:.1} GB Active", used_mb / 1024.0, total_gb));
            }
        } else {
            unsafe { let _ = termax_status_bar_set_text("sys-monitor".into(), "sys-memory".into(), "".into()); }
        }
    }
    
    Ok(())
}
