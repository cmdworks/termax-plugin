#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function getAllPlugins() {
  const scopes = ['official', 'community'];
  const list = [];
  for (const scope of scopes) {
    if (fs.existsSync(scope)) {
      const entries = fs.readdirSync(scope, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && fs.existsSync(path.join(scope, entry.name, 'termax-plugin.json'))) {
          list.push({
            scope,
            id: entry.name,
            path: `${scope}/${entry.name}`,
          });
        }
      }
    }
  }
  return list;
}

function getChangedFiles(baseCommit = 'HEAD~1', headCommit = 'HEAD') {
  try {
    const output = execSync(`git diff --name-only ${baseCommit} ${headCommit}`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function parseChangedPluginDirs(fileList) {
  const pluginMap = new Map();

  for (const filePath of fileList) {
    const normalized = filePath.replace(/\\/g, '/').trim();
    const match = normalized.match(/^(?:plugins\/)?(official|community)\/([a-zA-Z0-9_-]+)/);
    if (match) {
      const scope = match[1];
      const id = match[2];
      const pluginPath = `${scope}/${id}`;

      if (fs.existsSync(pluginPath) || fs.existsSync(`plugins/${pluginPath}`)) {
        const key = `${scope}/${id}`;
        if (!pluginMap.has(key)) {
          pluginMap.set(key, {
            scope,
            id,
            path: fs.existsSync(pluginPath) ? pluginPath : `plugins/${pluginPath}`,
          });
        }
      }
    }
  }

  return Array.from(pluginMap.values());
}

async function main() {
  if (process.argv.includes('--all')) {
    console.log(JSON.stringify(getAllPlugins()));
    return;
  }

  let fileList = [];

  if (!process.stdin.isTTY) {
    try {
      const stdinData = fs.readFileSync(0, 'utf-8');
      fileList = stdinData.split('\n').filter(Boolean);
    } catch {
      fileList = [];
    }
  }

  if (fileList.length === 0) {
    const base = process.argv[2] || 'HEAD~1';
    const head = process.argv[3] || 'HEAD';
    fileList = getChangedFiles(base, head);
  }

  let plugins = parseChangedPluginDirs(fileList);
  
  // If no git diff detected (e.g. initial run), fall back to all plugins
  if (plugins.length === 0 && process.env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    plugins = getAllPlugins();
  }

  console.log(JSON.stringify(plugins));
}

main();
