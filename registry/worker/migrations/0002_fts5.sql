-- Migration 0002: FTS5 full-text search index
-- Adds a virtual FTS5 table over the plugins content table.
-- BM25 ranking weights: id(0) name(10) author(3) description(5) tags_blob(8)

CREATE VIRTUAL TABLE IF NOT EXISTS plugins_fts USING fts5(
  id           UNINDEXED,
  name,
  author,
  description,
  tags_blob,                          -- space-separated tag string for FTS indexing
  content     = 'plugins',
  content_rowid = 'rowid',
  tokenize    = 'unicode61 remove_diacritics 2'
);

-- Populate FTS from existing rows (idempotent on first run since table is empty)
INSERT OR IGNORE INTO plugins_fts (rowid, id, name, author, description, tags_blob)
SELECT p.rowid, p.id, p.name, p.author, p.description,
       COALESCE((SELECT GROUP_CONCAT(t.tag, ' ') FROM tags t WHERE t.plugin_id = p.id), '')
FROM plugins p;

-- ── Sync triggers ────────────────────────────────────────────────────────────

CREATE TRIGGER IF NOT EXISTS fts_after_insert
AFTER INSERT ON plugins BEGIN
  INSERT INTO plugins_fts (rowid, id, name, author, description, tags_blob)
  VALUES (
    new.rowid, new.id, new.name, new.author, new.description,
    COALESCE((SELECT GROUP_CONCAT(t.tag, ' ') FROM tags t WHERE t.plugin_id = new.id), '')
  );
END;

CREATE TRIGGER IF NOT EXISTS fts_after_update
AFTER UPDATE ON plugins BEGIN
  UPDATE plugins_fts
  SET name        = new.name,
      author      = new.author,
      description = new.description,
      tags_blob   = COALESCE((SELECT GROUP_CONCAT(t.tag, ' ') FROM tags t WHERE t.plugin_id = new.id), '')
  WHERE rowid = new.rowid;
END;

CREATE TRIGGER IF NOT EXISTS fts_after_delete
AFTER DELETE ON plugins BEGIN
  DELETE FROM plugins_fts WHERE rowid = old.rowid;
END;

-- Tags table changes also need to refresh the FTS tags_blob
CREATE TRIGGER IF NOT EXISTS fts_after_tag_insert
AFTER INSERT ON tags BEGIN
  UPDATE plugins_fts
  SET tags_blob = (SELECT GROUP_CONCAT(t.tag, ' ') FROM tags t WHERE t.plugin_id = new.plugin_id)
  WHERE id = new.plugin_id;
END;

CREATE TRIGGER IF NOT EXISTS fts_after_tag_delete
AFTER DELETE ON tags BEGIN
  UPDATE plugins_fts
  SET tags_blob = COALESCE((SELECT GROUP_CONCAT(t.tag, ' ') FROM tags t WHERE t.plugin_id = old.plugin_id), '')
  WHERE id = old.plugin_id;
END;
