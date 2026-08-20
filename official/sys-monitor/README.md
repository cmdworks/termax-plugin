# System Monitor Plugin

A native WebAssembly plugin for Termax that displays live CPU and Memory usage directly in your terminal status bar.

## Features

- ⚡ **Real-time CPU Usage**: Updates every 2 seconds via periodic scheduler command.
- 💾 **Memory Utilization**: Displays active memory consumption in megabytes/gigabytes.
- ⚙️ **Configurable**: Toggle CPU and Memory indicators independently in Termax Settings.
- 🔒 **Sandboxed Execution**: Runs as a lightweight WebAssembly module using WASI.

## Configuration

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `show_cpu` | boolean | `true` | Show or hide the CPU usage percentage in the status bar. |
| `show_memory` | boolean | `true` | Show or hide the RAM usage gauge in the status bar. |

## Permissions

- `exec`: Required to query system performance metrics.
