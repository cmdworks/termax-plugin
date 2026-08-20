import type { Env, PublishPayload } from './types';

// Verify HMAC-SHA256 signature
export async function verifySignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  // Convert hex signature to Uint8Array
  const cleanSig = signatureHeader.replace(/^sha256=/, '').trim();
  const sigBytes = new Uint8Array(
    cleanSig.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(rawBody));
}

// Upsert plugin into D1 and sync tags
export async function upsertPlugin(
  payload: PublishPayload['plugin'],
  env: Env
): Promise<{ success: boolean; id: string }> {
  const now = Math.floor(Date.now() / 1000);
  const {
    id,
    name,
    version,
    author,
    description,
    scope = 'community',
    license = 'MIT',
    minTermaxVersion = null,
    iconUrl = null,
    pageUrl = null,
    readmeUrl,
    downloadUrl,
    tags = [],
  } = payload;

  // Insert or Update plugin record
  await env.DB.prepare(`
    INSERT INTO plugins (
      id, name, version, author, description, scope, license,
      min_termax_ver, icon_url, page_url, readme_url, download_url,
      published_at, updated_at, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      version = excluded.version,
      author = excluded.author,
      description = excluded.description,
      scope = excluded.scope,
      license = excluded.license,
      min_termax_ver = excluded.min_termax_ver,
      icon_url = excluded.icon_url,
      page_url = excluded.page_url,
      readme_url = excluded.readme_url,
      download_url = excluded.download_url,
      updated_at = excluded.updated_at,
      status = 'active'
  `).bind(
    id,
    name,
    version,
    author,
    description,
    scope,
    license,
    minTermaxVersion,
    iconUrl,
    pageUrl,
    readmeUrl,
    downloadUrl,
    now,
    now
  ).run();

  // Clear existing tags and re-insert
  await env.DB.prepare('DELETE FROM tags WHERE plugin_id = ?').bind(id).run();

  if (tags.length > 0) {
    const stmts = tags.map((tag) =>
      env.DB.prepare('INSERT OR IGNORE INTO tags (plugin_id, tag) VALUES (?, ?)').bind(
        id,
        tag.toLowerCase().trim()
      )
    );
    await env.DB.batch(stmts);
  }

  // Invalidate cache
  try {
    await env.KV.delete('registry:index');
    await env.KV.delete(`readme:${id}`);
  } catch (err) {
    console.error('Failed to invalidate KV cache for', id, err);
  }

  return { success: true, id };
}
