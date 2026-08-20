#!/usr/bin/env node

/**
 * Signs and pushes a published plugin manifest payload to the Worker /admin/publish endpoint.
 *
 * Usage:
 *   node push-to-worker.js <path/to/manifest.json> [workerEndpointUrl]
 *
 * Environment variables:
 *   WORKER_ADMIN_SECRET : HMAC-SHA256 secret key
 *   REGISTRY_BASE_URL   : (optional) Base CDN url, default: https://plugins.termax.pp.ua
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const manifestPath = process.argv[2];
const workerUrl = process.argv[3] || 'https://api.plugins.termax.pp.ua/admin/publish';
const secret = process.env.WORKER_ADMIN_SECRET;
const baseUrl = process.env.REGISTRY_BASE_URL || 'https://plugins.termax.pp.ua';

if (!manifestPath) {
  console.error('❌ Usage: node push-to-worker.js <path/to/manifest.json> [workerEndpointUrl]');
  process.exit(1);
}

if (!secret) {
  console.error('❌ Error: WORKER_ADMIN_SECRET environment variable is missing.');
  process.exit(1);
}

const fullPath = path.resolve(process.cwd(), manifestPath);
if (!fs.existsSync(fullPath)) {
  console.error(`❌ Error: Manifest not found at ${fullPath}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
} catch (err) {
  console.error(`❌ Error parsing manifest JSON: ${err.message}`);
  process.exit(1);
}

const scope = manifest.scope || 'community';
const pluginId = manifest.id;
const version = manifest.version;

const readmeUrl = `${baseUrl}/${scope}/${pluginId}/latest/README.md`;
const downloadUrl = `${baseUrl}/${scope}/${pluginId}/latest/${pluginId}.tar.gz`;
const iconUrl = manifest.icon ? `${baseUrl}/${scope}/${pluginId}/latest/${manifest.icon}` : null;
const pageUrl = `https://termax.pp.ua/plugins/${pluginId}`;

const payload = {
  plugin: {
    id: pluginId,
    name: manifest.name,
    version: version,
    author: manifest.author,
    description: manifest.description,
    scope: scope,
    license: manifest.license || 'MIT',
    tags: manifest.tags || [],
    minTermaxVersion: manifest.minTermaxVersion || null,
    readmeUrl: readmeUrl,
    downloadUrl: downloadUrl,
    iconUrl: iconUrl,
    pageUrl: pageUrl,
  },
};

const payloadString = JSON.stringify(payload);

// Generate HMAC-SHA256 signature
const hmac = crypto.createHmac('sha256', secret);
hmac.update(payloadString);
const signature = hmac.digest('hex');

async function sendPublish() {
  console.log(`📡 Pushing ${scope}/${pluginId} (v${version}) to ${workerUrl}...`);

  try {
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Termax-Signature': signature,
      },
      body: payloadString,
    });

    const body = await res.text();
    if (!res.ok) {
      console.error(`❌ Worker rejected publish (HTTP ${res.status}): ${body}`);
      process.exit(1);
    }

    console.log(`✅ Successfully published ${pluginId} to registry:`, body);
  } catch (err) {
    console.error(`❌ Failed to connect to Worker: ${err.message}`);
    process.exit(1);
  }
}

sendPublish();
