#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const repoRoot = path.resolve(__dirname, '../..');
const outputPath = process.argv[2] || path.join(__dirname, '../index.json');
const baseUrl = process.env.REGISTRY_BASE_URL || 'https://plugins.termax.pp.ua';

const scopes = ['official', 'community'];
const pluginList = [];

for (const scope of scopes) {
  const scopeDir = path.join(repoRoot, scope);
  if (!fs.existsSync(scopeDir)) continue;

  const entries = fs.readdirSync(scopeDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const manifestPath = path.join(scopeDir, entry.name, 'termax-plugin.json');
    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const id = manifest.id;
        const version = manifest.version;

        pluginList.push({
          id: id,
          name: manifest.name,
          version: version,
          author: manifest.author,
          description: manifest.description,
          scope: scope,
          license: manifest.license || 'MIT',
          minTermaxVersion: manifest.minTermaxVersion || null,
          iconUrl: manifest.icon ? `${baseUrl}/${scope}/${id}/latest/${manifest.icon}` : null,
          pageUrl: `https://termax.pp.ua/plugins/${id}`,
          readmeUrl: `${baseUrl}/${scope}/${id}/latest/README.md`,
          downloadUrl: `${baseUrl}/${scope}/${id}/latest/${id}.tar.gz`,
          downloads: 0,
          publishedAt: Math.floor(Date.now() / 1000),
          updatedAt: Math.floor(Date.now() / 1000),
          tags: manifest.tags || [],
        });
      } catch (err) {
        console.warn(`⚠️ Skipped ${scope}/${entry.name}: failed to parse manifest (${err.message})`);
      }
    }
  }
}

const registryData = {
  version: 1,
  generated: Math.floor(Date.now() / 1000),
  plugins: pluginList,
};

fs.writeFileSync(outputPath, JSON.stringify(registryData, null, 2), 'utf8');
console.log(`✅ Generated registry with ${pluginList.length} plugins at ${outputPath}`);
