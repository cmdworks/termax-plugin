-- Migration 0003: Clean up broken triggers and recreate FTS5 virtual table

DROP TRIGGER IF EXISTS fts_after_insert;
DROP TRIGGER IF EXISTS fts_after_update;
DROP TRIGGER IF EXISTS fts_after_delete;
DROP TRIGGER IF EXISTS fts_after_tag_insert;
DROP TRIGGER IF EXISTS fts_after_tag_delete;
DROP TABLE IF EXISTS plugins_fts;

CREATE VIRTUAL TABLE IF NOT EXISTS plugins_fts USING fts5(
  plugin_id    UNINDEXED,
  name,
  author,
  description,
  tags_blob,
  tokenize     = 'unicode61 remove_diacritics 2'
);
