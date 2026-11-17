// Convert a git-native v3 Postman collection (YAML files) into a single
// Postman Collection v2.1 JSON file that can be imported via Postman > Import.
// Usage: node scripts/export-postman-collection.mjs [collectionDir] [outFile]
// Without arguments, every collection under postman/collections is exported.
import fs from 'node:fs';
import path from 'node:path';
import * as yaml from 'js-yaml';

const COLLECTIONS_DIR = 'postman/collections';
const readYaml = (file) => yaml.load(fs.readFileSync(file, 'utf8'));
const toExec = (code) => code.split('\n');

const SCRIPT_EVENT = {
  beforeRequest: 'prerequest',
  'http:beforeRequest': 'prerequest',
  afterResponse: 'test',
  'http:afterResponse': 'test',
};

function toEvents(scripts = []) {
  return scripts
    .filter((s) => SCRIPT_EVENT[s.type])
    .map((s) => ({
      listen: SCRIPT_EVENT[s.type],
      script: { type: 'text/javascript', exec: toExec(s.code) },
    }));
}

function toUrl(rawUrl, pathVariables = []) {
  const [base, queryString] = rawUrl.split('?');
  const [host, ...segments] = base.split('/').filter(Boolean);
  const url = { raw: rawUrl, host: [host], path: segments };
  if (queryString) {
    url.query = queryString.split('&').map((pair) => {
      const [key, value = ''] = pair.split('=');
      return { key, value };
    });
  }
  if (pathVariables.length) {
    url.variable = pathVariables.map(({ key, value, description }) => ({
      key,
      value,
      ...(description && { description }),
    }));
  }
  return url;
}

function toBody(body) {
  if (!body || body.type === 'none') return undefined;
  if (['json', 'text', 'xml', 'html', 'javascript'].includes(body.type)) {
    return {
      mode: 'raw',
      raw: body.content,
      options: { raw: { language: body.type === 'text' ? 'text' : body.type } },
    };
  }
  if (body.type === 'urlencoded') return { mode: 'urlencoded', urlencoded: body.content };
  if (body.type === 'formdata') return { mode: 'formdata', formdata: body.content };
  throw new Error(`Unsupported body type: ${body.type}`);
}

function toRequestItem(file) {
  const req = readYaml(file);
  const name = req.name ?? path.basename(file, '.request.yaml');
  const request = {
    method: req.method,
    header: req.headers ?? [],
    url: toUrl(req.url, req.pathVariables),
  };
  const body = toBody(req.body);
  if (body) request.body = body;
  if (req.description) request.description = req.description;
  if (req.auth) request.auth = req.auth;

  const item = { name, request, response: [] };
  const events = toEvents(req.scripts);
  if (events.length) item.event = events;
  return { order: req.order ?? Infinity, item };
}

function readDefinition(dir) {
  const file = path.join(dir, '.resources', 'definition.yaml');
  return fs.existsSync(file) ? readYaml(file) : {};
}

function toItems(dir) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith('.request.yaml')) {
      entries.push(toRequestItem(full));
    } else if (entry.isDirectory() && entry.name !== '.resources') {
      const def = readDefinition(full);
      const folder = { name: def.name ?? entry.name, item: toItems(full) };
      if (def.description) folder.description = def.description;
      const events = toEvents(def.scripts);
      if (events.length) folder.event = events;
      entries.push({ order: def.order ?? Infinity, item: folder });
    }
  }
  return entries
    .sort((a, b) => a.order - b.order || a.item.name.localeCompare(b.item.name))
    .map((e) => e.item);
}

function exportCollection(srcDir, outFile) {
  const def = readDefinition(srcDir);
  const name = def.name ?? path.basename(srcDir);
  const collection = {
    info: {
      name,
      description: def.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: toItems(srcDir),
    event: toEvents(def.scripts),
    variable: (def.variables ?? []).map(({ key, value }) => ({ key, value: String(value) })),
  };
  if (def.auth) collection.auth = def.auth;

  const target = outFile ?? path.join('postman', `${name}.postman_collection.json`);
  fs.writeFileSync(target, JSON.stringify(collection, null, 2) + '\n');
  console.log(`Exported ${collection.item.length} items -> ${target}`);
}

const [srcArg, outArg] = process.argv.slice(2);
if (srcArg) {
  exportCollection(srcArg, outArg);
} else {
  for (const entry of fs.readdirSync(COLLECTIONS_DIR, { withFileTypes: true })) {
    if (entry.isDirectory()) exportCollection(path.join(COLLECTIONS_DIR, entry.name));
  }
}
