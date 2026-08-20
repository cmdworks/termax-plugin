import type { Env, PluginEntry, PluginRow } from './types';
import { rowToEntry } from './types';

export interface ParsedQuery {
  terms: string[];
  tags: string[];
  scope?: 'official' | 'community';
  author?: string;
}

export function parseSearchQuery(rawQuery: string, explicitTags: string[] = []): ParsedQuery {
  const tokens = rawQuery.trim().split(/\s+/).filter(Boolean);
  const terms: string[] = [];
  const tags: string[] = [...explicitTags];
  let scope: 'official' | 'community' | undefined;
  let author: string | undefined;

  for (const token of tokens) {
    if (token === '@official') {
      scope = 'official';
    } else if (token === '@community') {
      scope = 'community';
    } else if (token.startsWith('@author:')) {
      author = token.slice(8).toLowerCase();
    } else if (token.startsWith('#')) {
      tags.push(token.slice(1).toLowerCase());
    } else {
      terms.push(token.toLowerCase());
    }
  }

  return { terms, tags, scope, author };
}

export async function searchPlugins(
  rawQuery: string,
  explicitTags: string[],
  env: Env
): Promise<PluginEntry[]> {
  const parsed = parseSearchQuery(rawQuery, explicitTags);
  const cacheKey = `search:${parsed.terms.join('+')}:${parsed.tags.sort().join(',')}:${parsed.scope ?? ''}:${parsed.author ?? ''}`;

  // 1. Check KV cache
  try {
    const cached = await env.KV.get(cacheKey, 'json');
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached as PluginEntry[];
    }
  } catch (err) {
    console.error('KV cache read error:', err);
  }

  let entries: PluginEntry[] = [];

  // If no terms provided but filters exist (e.g. browsing all or by tag/scope)
  if (parsed.terms.length === 0) {
    let sql = `
      SELECT p.*, GROUP_CONCAT(t.tag, ',') AS tags
      FROM plugins p
      LEFT JOIN tags t ON p.id = t.plugin_id
      WHERE p.status = 'active'
    `;
    const params: (string | number)[] = [];

    if (parsed.scope) {
      sql += ' AND p.scope = ?';
      params.push(parsed.scope);
    }
    if (parsed.author) {
      sql += ' AND LOWER(p.author) = ?';
      params.push(parsed.author);
    }

    sql += ' GROUP BY p.id ORDER BY p.downloads DESC, p.published_at DESC LIMIT 50';

    const result = await env.DB.prepare(sql).bind(...params).all<PluginRow>();
    entries = (result.results || []).map(rowToEntry);

    if (parsed.tags.length > 0) {
      entries = entries.filter((entry) =>
        parsed.tags.every((t) => entry.tags.includes(t))
      );
    }
  } else {
    // Search with resilient matching (LIKE across name, id, description, author, and tags)
    let sql = `
      SELECT p.*, GROUP_CONCAT(t.tag, ',') AS tags
      FROM plugins p
      LEFT JOIN tags t ON p.id = t.plugin_id
      WHERE p.status = 'active'
    `;
    const params: (string | number)[] = [];

    if (parsed.scope) {
      sql += ' AND p.scope = ?';
      params.push(parsed.scope);
    }
    if (parsed.author) {
      sql += ' AND LOWER(p.author) = ?';
      params.push(parsed.author);
    }

    // Match each keyword term
    for (const term of parsed.terms) {
      const wildcard = `%${term}%`;
      sql += ` AND (
        LOWER(p.name) LIKE ?
        OR LOWER(p.id) LIKE ?
        OR LOWER(p.description) LIKE ?
        OR LOWER(p.author) LIKE ?
        OR EXISTS (SELECT 1 FROM tags t2 WHERE t2.plugin_id = p.id AND LOWER(t2.tag) LIKE ?)
      )`;
      params.push(wildcard, wildcard, wildcard, wildcard, wildcard);
    }

    sql += ' GROUP BY p.id ORDER BY p.downloads DESC, p.published_at DESC LIMIT 50';

    const result = await env.DB.prepare(sql).bind(...params).all<PluginRow>();
    entries = (result.results || []).map(rowToEntry);

    // Apply explicit tag filters if provided
    if (parsed.tags.length > 0) {
      entries = entries.filter((entry) =>
        parsed.tags.every((t) => entry.tags.includes(t))
      );
    }
  }

  // Exact ID match rank promotion
  if (parsed.terms.length === 1) {
    const singleTerm = parsed.terms[0]!.toLowerCase();
    const exactIndex = entries.findIndex((e) => e.id.toLowerCase() === singleTerm);
    if (exactIndex > 0) {
      const [exact] = entries.splice(exactIndex, 1);
      if (exact) entries.unshift(exact);
    }
  }

  // Only cache positive results in KV for 5 minutes
  if (entries.length > 0) {
    try {
      await env.KV.put(cacheKey, JSON.stringify(entries), { expirationTtl: 300 });
    } catch (err) {
      console.error('KV cache write error:', err);
    }
  }

  return entries;
}
