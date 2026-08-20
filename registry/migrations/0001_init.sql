-- Migration 0001: Core tables
-- Run once on initial D1 database setup.

CREATE TABLE IF NOT EXISTS plugins (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  version          TEXT NOT NULL,
  author           TEXT NOT NULL,
  description      TEXT NOT NULL,
  scope            TEXT NOT NULL CHECK (scope IN ('official', 'community')),
  license          TEXT NOT NULL DEFAULT 'MIT',
  min_termax_ver   TEXT,
  icon_url         TEXT,
  page_url         TEXT,
  readme_url       TEXT NOT NULL,
  download_url     TEXT NOT NULL,
  downloads        INTEGER NOT NULL DEFAULT 0,
  published_at     INTEGER NOT NULL,   -- unix epoch seconds
  updated_at       INTEGER NOT NULL,   -- unix epoch seconds
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'yanked'))
);

CREATE TABLE IF NOT EXISTS tags (
  plugin_id   TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  PRIMARY KEY (plugin_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_tags_tag       ON tags(tag);
CREATE INDEX IF NOT EXISTS idx_plugins_scope  ON plugins(scope);
CREATE INDEX IF NOT EXISTS idx_plugins_status ON plugins(status);
CREATE INDEX IF NOT EXISTS idx_plugins_downloads ON plugins(downloads DESC);

CREATE TABLE IF NOT EXISTS installs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  plugin_id    TEXT NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  installed_at INTEGER NOT NULL,   -- day-precision unix epoch (floor to midnight)
  region       TEXT                -- Cloudflare colo code e.g. "BOM", "SIN"
);

CREATE INDEX IF NOT EXISTS idx_installs_plugin ON installs(plugin_id);
CREATE INDEX IF NOT EXISTS idx_installs_date   ON installs(installed_at);
