#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';

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
    // Matches (plugins/)?(official|community)/<plugin-id>/...
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

  const plugins = parseChangedPluginDirs(fileList);
  console.log(JSON.stringify(plugins));
}

main();
