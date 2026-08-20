import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { searchPlugins } from './search';
import { verifySignature, upsertPlugin } from './admin';
import type { Env, PluginRow, RegistryIndex, PublishPayload } from './types';
import { rowToEntry } from './types';

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for all routes
app.use('*', cors({ origin: '*' }));

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'termax-plugin-registry',
  });
});

// ── Search Plugins ───────────────────────────────────────────────────────────
app.get('/search', async (c) => {
  const query = c.req.query('q') ?? '';
  const rawTags = c.req.query('tag')?.split(',').map((t) => t.trim()).filter(Boolean) ?? [];

  const results = await searchPlugins(query, rawTags, c.env);
  return c.json({
    total: results.length,
    plugins: results,
  });
});

// ── Get Plugin Detail ────────────────────────────────────────────────────────
app.get('/plugin/:id', async (c) => {
  const id = c.req.param('id');

  const row = await c.env.DB.prepare(`
    SELECT p.*, GROUP_CONCAT(t.tag, ',') AS tags
    FROM plugins p
    LEFT JOIN tags t ON p.id = t.plugin_id
    WHERE p.id = ? AND p.status != 'yanked'
    GROUP BY p.id
  `).bind(id).first<PluginRow>();

  if (!row) {
    return c.json({ error: 'Plugin not found' }, 404);
  }

  return c.json(rowToEntry(row));
});

// ── Get Plugin README (Markdown) ─────────────────────────────────────────────
app.get('/plugin/:id/readme', async (c) => {
  const id = c.req.param('id');
  const kvKey = `readme:${id}`;

  // Check KV cache
  try {
    const cached = await c.env.KV.get(kvKey);
    if (cached) {
      return new Response(cached, {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    }
  } catch (err) {
    console.error('KV get error:', err);
  }

  // Look up plugin to find scope & path in R2
  const row = await c.env.DB.prepare('SELECT scope FROM plugins WHERE id = ?').bind(id).first<{ scope: string }>();
  const scope = row?.scope || 'community';
  const r2Key = `${scope}/${id}/latest/README.md`;

  try {
    const obj = await c.env.R2.get(r2Key);
    if (obj) {
      const text = await obj.text();
      // Cache in KV for 1 hour
      await c.env.KV.put(kvKey, text, { expirationTtl: 3600 });
      return new Response(text, {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
      });
    }
  } catch (err) {
    console.error('R2 get error:', err);
  }

  return new Response('# No README Available\n\nThis plugin does not provide a README.md file.', {
    status: 200,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
});

// ── Track Plugin Install (Atomic Rate-Limited Counter) ───────────────────────
app.post('/plugin/:id/install', async (c) => {
  const id = c.req.param('id');
  const clientIp = c.req.header('CF-Connecting-IP') || 'unknown';
  const colo = c.req.header('CF-Ray')?.split('-')?.[1] || 'UNKNOWN';
  const dayKey = Math.floor(Date.now() / 86400000);
  const rateLimitKey = `rl:install:${id}:${clientIp}:${dayKey}`;

  let alreadyCounted = false;
  try {
    const count = await c.env.KV.get(rateLimitKey);
    if (count) alreadyCounted = true;
  } catch (err) {
    console.error('Rate limit check error:', err);
  }

  if (!alreadyCounted) {
    const todayMidnight = dayKey * 86400;

    // Increment downloads in plugins table & record event
    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE plugins SET downloads = downloads + 1 WHERE id = ?').bind(id),
      c.env.DB.prepare('INSERT INTO installs (plugin_id, installed_at, region) VALUES (?, ?, ?)').bind(
        id,
        todayMidnight,
        colo
      ),
    ]);

    try {
      await c.env.KV.put(rateLimitKey, '1', { expirationTtl: 86400 });
    } catch (err) {
      console.error('KV rate limit put error:', err);
    }
  }

  return c.json({ success: true });
});

// ── Admin Webhook (GitHub Actions publish event) ─────────────────────────────
app.post('/admin/publish', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('X-Termax-Signature');

  const isValid = await verifySignature(rawBody, signature, c.env.ADMIN_SECRET);
  if (!isValid) {
    return c.json({ error: 'Unauthorized signature' }, 401);
  }

  let payload: PublishPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  if (!payload.plugin || !payload.plugin.id) {
    return c.json({ error: 'Missing plugin payload' }, 400);
  }

  const result = await upsertPlugin(payload.plugin, c.env);
  return c.json(result);
});

// ── Full Index JSON (for offline load / full registry sync) ──────────────────
app.get('/index.json', async (c) => {
  const kvKey = 'registry:index';

  try {
    const cached = await c.env.KV.get(kvKey, 'json');
    if (cached) {
      return c.json(cached);
    }
  } catch (err) {
    console.error('KV index read error:', err);
  }

  const result = await c.env.DB.prepare(`
    SELECT p.*, GROUP_CONCAT(t.tag, ',') AS tags
    FROM plugins p
    LEFT JOIN tags t ON p.id = t.plugin_id
    WHERE p.status = 'active'
    GROUP BY p.id
    ORDER BY p.downloads DESC, p.published_at DESC
  `).all<PluginRow>();

  const indexData: RegistryIndex = {
    version: 1,
    generated: Math.floor(Date.now() / 1000),
    plugins: (result.results || []).map(rowToEntry),
  };

  try {
    await c.env.KV.put(kvKey, JSON.stringify(indexData), { expirationTtl: 300 });
  } catch (err) {
    console.error('KV index write error:', err);
  }

  return c.json(indexData);
});

export default app;
