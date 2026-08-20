#!/usr/bin/env node

/**
 * Validates a termax-plugin.json file against the Termax plugin specification.
 * Usage: node validate-manifest.js <path/to/termax-plugin.json>
 */

import fs from 'node:fs';
import path from 'node:path';

function error(msg) {
  console.error(`❌ Validation Error: ${msg}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`⚠️ Warning: ${msg}`);
}

const manifestPath = process.argv[2];
if (!manifestPath) {
  error('No manifest path provided. Usage: node validate-manifest.js <path/to/termax-plugin.json>');
}

const fullPath = path.resolve(process.cwd(), manifestPath);
if (!fs.existsSync(fullPath)) {
  error(`File does not exist at path: ${fullPath}`);
}

let json;
try {
  const content = fs.readFileSync(fullPath, 'utf8');
  json = JSON.parse(content);
} catch (e) {
  error(`Failed to parse JSON: ${e.message}`);
}

// ── Check Required Fields ──
const required = ['id', 'name', 'version', 'author', 'description', 'main'];
for (const field of required) {
  if (!json[field] || typeof json[field] !== 'string') {
    error(`Missing required string field '${field}'`);
  }
}

// ── Validate 'id' (kebab-case, 2-32 chars) ──
const idRegex = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;
if (!idRegex.test(json.id)) {
  error(`Field 'id' ("${json.id}") must be lowercase kebab-case between 2 and 32 characters (e.g. 'sys-monitor').`);
}

// ── Validate 'version' (semver) ──
const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
if (!semverRegex.test(json.version)) {
  error(`Field 'version' ("${json.version}") must be a valid semver string (e.g. '1.0.0').`);
}

// ── Validate 'main' (must end with .wasm) ──
if (!json.main.endsWith('.wasm')) {
  error(`Field 'main' ("${json.main}") must point to a '.wasm' binary file.`);
}

// ── Validate 'tags' (optional array of kebab strings) ──
if (json.tags !== undefined) {
  if (!Array.isArray(json.tags)) {
    error(`Field 'tags' must be an array of strings.`);
  }
  const tagRegex = /^[a-z][a-z0-9-]*$/;
  for (const tag of json.tags) {
    if (typeof tag !== 'string' || !tagRegex.test(tag)) {
      error(`Tag "${tag}" must be lowercase kebab-case.`);
    }
  }
}

// ── Validate 'permissions' (optional array of allowed permissions) ──
const allowedPermissions = ['network', 'fs', 'exec', 'terminal.read', 'terminal.write', 'ipc'];
if (json.permissions !== undefined) {
  if (!Array.isArray(json.permissions)) {
    error(`Field 'permissions' must be an array.`);
  }
  for (const perm of json.permissions) {
    if (!allowedPermissions.includes(perm)) {
      error(`Unknown permission "${perm}". Allowed: ${allowedPermissions.join(', ')}`);
    }
  }
}

// ── Validate contributes if present ──
if (json.contributes !== undefined && typeof json.contributes !== 'object') {
  error(`Field 'contributes' must be an object.`);
}

console.log(`✅ Plugin manifest '${json.id}' (v${json.version}) is valid!`);
process.exit(0);
