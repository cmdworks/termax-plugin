-- Migration 0004: Populate FTS5 index from existing plugins table
INSERT INTO plugins_fts (plugin_id, name, author, description, tags_blob)
SELECT p.id, p.name, p.author, p.description,
       COALESCE((SELECT GROUP_CONCAT(t.tag, ' ') FROM tags t WHERE t.plugin_id = p.id), '')
FROM plugins p;
