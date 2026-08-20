# Termax Plugin Registry & Infrastructure

This directory contains the Cloudflare Worker, database migrations, JSON schemas, and automation scripts powering the Termax Plugin Registry (`api.plugins.termax.pp.ua` and `plugins.termax.pp.ua`).

## Directory Structure

```
plugins/
├── registry/
│   ├── worker/         # Cloudflare Worker (Hono + D1 + KV + R2 + Vectorize)
│   ├── migrations/     # Versioned SQLite D1 migrations (FTS5 + tables)
│   ├── schema/         # JSON Schema for termax-plugin.json
│   ├── scripts/        # Automation scripts for CI/CD and validation
│   └── index.json      # Static offline/seed registry index
├── official/           # First-party plugins maintained by cmdworks
│   ├── sys-monitor/
│   └── gmt-clock/
├── community/          # Community contributed plugins
└── sdk/                # Shared Rust WIT bindings & helpers
```

## Local Worker Development

1. Navigate to the worker directory:
   ```bash
   cd plugins/registry/worker
   npm install
   ```

2. Apply local D1 database migrations:
   ```bash
   npx wrangler d1 migrations apply termax-plugins-db --local
   ```

3. Start the local worker server:
   ```bash
   npx wrangler dev
   ```

4. Test search and health endpoints:
   ```bash
   curl "http://localhost:8787/health"
   curl "http://localhost:8787/search?q=monitor"
   curl "http://localhost:8787/search?q=@official"
   ```

## Deploying Infrastructure

To deploy worker updates and apply remote database migrations, push a git tag matching `registry-v*`:

```bash
git tag registry-v1.0.0
git push origin registry-v1.0.0
```

This triggers the `.github/workflows/plugin-infra-deploy.yml` workflow.

## Publishing Plugins

When changes are merged to `main` under `plugins/official/**` or `plugins/community/**`, the `.github/workflows/plugin-build.yml` workflow automatically:
1. Detects which plugins were modified using git diff.
2. Validates their `termax-plugin.json` manifests.
3. Builds the WebAssembly (`wasm32-wasip1`) binaries.
4. Bundles them into `.tar.gz` packages.
5. Uploads artifacts to Cloudflare R2 (`termax-plugins` bucket).
6. Calls the Worker `/admin/publish` webhook with HMAC signature to update D1 and refresh caches.

## Validating Manifests Locally

```bash
node plugins/registry/scripts/validate-manifest.js plugins/official/sys-monitor/termax-plugin.json
```
