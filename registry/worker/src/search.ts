import type { Env, PluginEntry, PluginRow } from './types';
import { rowToEntry } from './types';

// Levenshtein distance for fuzzy fallback
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

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
      terms.push(token);
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
    if (cached) {
      return cached as PluginEntry[];
    }
  } catch (err) {
    console.error('KV cache read error:', err);
  }

  let entries: PluginEntry[] = [];

  // If no terms provided but filters exist (e.g. browsing by tag or scope)
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
    // 2. Full-Text Search using FTS5 (BM25 ranking)
    const ftsTokens = parsed.terms
      .map((term) => term.replace(/['"*]/g, ''))
      .filter(Boolean);

    if (ftsTokens.length > 0) {
      // Prefix matching on tokens for instant search as you type
      const ftsQuery = ftsTokens.map((t) => `${t}*`).join(' ');

      let sql = `
        SELECT
          p.*,
          GROUP_CONCAT(t.tag, ',') AS tags,
          -bm25(plugins_fts, 0, 10, 3, 5, 8) AS score
        FROM plugins_fts
        JOIN plugins p ON plugins_fts.rowid = p.rowid
        LEFT JOIN tags t ON p.id = t.plugin_id
        WHERE plugins_fts MATCH ? AND p.status = 'active'
      `;
      const params: (string | number)[] = [ftsQuery];

      if (parsed.scope) {
        sql += ' AND p.scope = ?';
        params.push(parsed.scope);
      }
      if (parsed.author) {
        sql += ' AND LOWER(p.author) = ?';
        params.push(parsed.author);
      }

      sql += ' GROUP BY p.id ORDER BY score DESC, p.downloads DESC LIMIT 30';

      const result = await env.DB.prepare(sql).bind(...params).all<PluginRow>();
      entries = (result.results || []).map(rowToEntry);

      if (parsed.tags.length > 0) {
        entries = entries.filter((entry) =>
          parsed.tags.every((t) => entry.tags.includes(t))
        );
      }
    }

    // 3. Fuzzy fallback if FTS returned 0 results
    if (entries.length === 0 && ftsTokens.length > 0) {
      let fallbackSql = `
        SELECT p.*, GROUP_CONCAT(t.tag, ',') AS tags
        FROM plugins p
        LEFT JOIN tags t ON p.id = t.plugin_id
        WHERE p.status = 'active'
      `;
      const fallbackParams: (string | number)[] = [];

      if (parsed.scope) {
        fallbackSql += ' AND p.scope = ?';
        fallbackParams.push(parsed.scope);
      }
      if (parsed.author) {
        fallbackSql += ' AND LOWER(p.author) = ?';
        fallbackParams.push(parsed.author);
      }

      fallbackSql += ' GROUP BY p.id';

      const allActive = await env.DB.prepare(fallbackSql).bind(...fallbackParams).all<PluginRow>();
      const allEntries = (allActive.results || []).map(rowToEntry);

      const targetWord = ftsTokens.join(' ').toLowerCase();

      const fuzzyScored = allEntries
        .map((entry) => {
          const nameScore = levenshtein(targetWord, entry.name.toLowerCase());
          const idScore = levenshtein(targetWord, entry.id.toLowerCase());
          const minDistance = Math.min(nameScore, idScore);
          return { entry, minDistance };
        })
        .filter((item) => item.minDistance <= 3)
        .sort((a, b) => a.minDistance - b.minDistance)
        .map((item) => item.entry);

      entries = fuzzyScored.slice(0, 10);

      if (parsed.tags.length > 0) {
        entries = entries.filter((entry) =>
          parsed.tags.every((t) => entry.tags.includes(t))
        );
      }
    }
  }

  // Exact ID matches should always be promoted to rank 1
  if (parsed.terms.length === 1) {
    const singleTerm = parsed.terms[0]!.toLowerCase();
    const exactIndex = entries.findIndex((e) => e.id.toLowerCase() === singleTerm);
    if (exactIndex > 0) {
      const [exact] = entries.splice(exactIndex, 1);
      if (exact) entries.unshift(exact);
    }
  }

  // 4. Cache in KV for 5 minutes
  try {
    await env.KV.put(cacheKey, JSON.stringify(entries), { expirationTtl: 300 });
  } catch (err) {
    console.error('KV cache write error:', err);
  }

  return entries;
}
