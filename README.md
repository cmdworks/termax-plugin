# Termax Plugins Repository

Official and community WebAssembly plugins for [Termax](https://github.com/cmdworks/termax), powered by Cloudflare Workers, D1 (SQLite + FTS5), and R2 storage.

## Structure

- `official/`: First-party plugins maintained by the Termax team.
- `community/`: Community-contributed plugins submitted via Pull Requests.
- `registry/`: Cloudflare Worker API, D1 database migrations, and registry automation scripts.
- `sdk/`: Rust SDK with WIT bindings for building Termax plugins.

## Building a Plugin

```bash
./build.sh official/sys-monitor
# or
./build.sh official/gmt-clock
```

## Contributing a Plugin

1. Create a new directory in `community/<plugin-id>/`
2. Add your Rust source, `Cargo.toml`, `termax-plugin.json`, and `README.md`
3. Validate your manifest:
   ```bash
   node registry/scripts/validate-manifest.js community/<plugin-id>/termax-plugin.json
   ```
4. Submit a Pull Request. Once approved and merged, CI automatically compiles the WASM module and deploys it to the public registry!
