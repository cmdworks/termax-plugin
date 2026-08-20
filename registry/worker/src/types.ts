// Worker environment bindings (generated shape — keep in sync with wrangler.toml)

export interface Env {
  // Cloudflare D1 — SQLite database
  DB: D1Database;

  // Cloudflare KV — cache layer
  KV: KVNamespace;

  // Cloudflare R2 — file/asset storage
  R2: R2Bucket;

  // Cloudflare Vectorize — semantic search
  VECTORIZE: VectorizeIndex;

  // Variables
  REGISTRY_BASE_URL: string;
  ENVIRONMENT: string;

  // Secrets (set via wrangler secret put)
  ADMIN_SECRET: string;
}

// ── D1 row shapes ──────────────────────────────────────────────────────────

export interface PluginRow {
  id:             string;
  name:           string;
  version:        string;
  author:         string;
  description:    string;
  scope:          'official' | 'community';
  license:        string;
  min_termax_ver: string | null;
  icon_url:       string | null;
  page_url:       string | null;
  readme_url:     string;
  download_url:   string;
  downloads:      number;
  published_at:   number;
  updated_at:     number;
  status:         'active' | 'deprecated' | 'yanked';
  // Joined
  tags?:          string;   // comma-separated from GROUP_CONCAT
  score?:         number;   // FTS BM25 score
}

// ── API response shapes ────────────────────────────────────────────────────

export interface PluginEntry {
  id:             string;
  name:           string;
  version:        string;
  author:         string;
  description:    string;
  scope:          'official' | 'community';
  license:        string;
  minTermaxVersion: string | null;
  iconUrl:        string | null;
  pageUrl:        string | null;
  readmeUrl:      string;
  downloadUrl:    string;
  downloads:      number;
  publishedAt:    number;
  updatedAt:      number;
  tags:           string[];
}

export interface RegistryIndex {
  version:   number;
  generated: number;
  plugins:   PluginEntry[];
}

// ── Admin webhook payload ──────────────────────────────────────────────────

export interface PublishPayload {
  plugin: {
    id:             string;
    name:           string;
    version:        string;
    author:         string;
    description:    string;
    scope:          'official' | 'community';
    license?:       string;
    tags?:          string[];
    minTermaxVersion?: string;
    readmeUrl:      string;
    downloadUrl:    string;
    iconUrl?:       string;
    pageUrl?:       string;
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function rowToEntry(row: PluginRow): PluginEntry {
  return {
    id:               row.id,
    name:             row.name,
    version:          row.version,
    author:           row.author,
    description:      row.description,
    scope:            row.scope,
    license:          row.license,
    minTermaxVersion: row.min_termax_ver,
    iconUrl:          row.icon_url,
    pageUrl:          row.page_url,
    readmeUrl:        row.readme_url,
    downloadUrl:      row.download_url,
    downloads:        row.downloads,
    publishedAt:      row.published_at,
    updatedAt:        row.updated_at,
    tags:             row.tags ? row.tags.split(',').filter(Boolean) : [],
  };
}
