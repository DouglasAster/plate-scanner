// Converts the vehicle registry at https://pdxicescan.com/vehicle-registry into a
// Plate Scanner file (see "The plate list file" in README.md) for the app's Import.
//
// Usage:
//   node scripts/import-pdxicescan.js [output.json]
//   node scripts/import-pdxicescan.js --bundle saved-index.js [output.json]
//
// The default output, data/pdxicescan-registry.json, is committed and built into the
// app (see src/lib/builtinRegistry.ts), so installs never contact the site.
//
// The site has no API: its data is compiled into the page's JavaScript bundle. This
// script downloads the bundle and parses it as text. It never runs the site's code.
// Minified names change with every site update, so tables are recognized by their
// contents and by which warning the page shows for them, not by name.
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const SITE = 'https://pdxicescan.com';
const PAGE = `${SITE}/vehicle-registry`;

// Warning titles the page shows (translation keys) -> note added to the vehicle.
const FLAGS = {
  detentionAlertTitle: 'ALERT: Reported detention history (involved in immigration-related arrests).',
  rentalCautionTitle: 'CAUTION: Possible rental vehicle. ICE/DHS return rentals every few weeks; verify before acting.',
  nonIceLeaTitle: 'Possibly non-ICE law enforcement (e.g. FBI, USMS, DEA, state or local police), which may be working with ICE.',
  scoutAlertTitle: 'Possible scout or surveillance vehicle.',
  obscuredPlateTitle: 'May remove, cover, or obscure license plates.',
};

const MAKES = [
  'Alfa Romeo', 'Land Rover', 'Mercedes-Benz', 'Mercedes', 'Acura', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chevy',
  'Chrysler', 'Dodge', 'Fiat', 'Ford', 'Genesis', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jaguar', 'Jeep', 'Kia', 'Lexus',
  'Lincoln', 'Mazda', 'Mini', 'Mitsubishi', 'Nissan', 'Polestar', 'Porsche', 'Ram', 'Rivian', 'Subaru', 'Tesla', 'Toyota',
  'Volkswagen', 'VW', 'Volvo',
];

// ---- Fetching ----

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (plate-scanner importer)' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

async function loadBundle(bundlePath) {
  if (bundlePath) return { source: path.resolve(bundlePath), code: fs.readFileSync(bundlePath, 'utf8') };
  const html = await fetchText(PAGE);
  const m = html.match(/<script[^>]+src="(\/assets\/index-[^"]+\.js)"/);
  if (!m) throw new Error('Could not find the app bundle on the page. The site may have changed.');
  const url = SITE + m[1];
  console.error(`Downloading ${url}`);
  return { source: url, code: await fetchText(url) };
}

// ---- Reading the bundle ----

function walk(node, visit, parent = null) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'loc' || key === 'extra') continue;
    const v = node[key];
    if (Array.isArray(v)) for (const c of v) walk(c, visit, node);
    else if (v && typeof v.type === 'string') walk(v, visit, node);
  }
}

const keyOf = (p) => (p.key.type === 'Identifier' ? p.key.name : p.key.value);

// Turns a literal (string, number, boolean, array, object) into a value; null otherwise.
function literal(n) {
  switch (n && n.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return n.value;
    case 'UnaryExpression': // minified booleans: !0 / !1
      return n.operator === '!' && n.argument.type === 'NumericLiteral' ? !n.argument.value : null;
    case 'ArrayExpression':
      return n.elements.map(literal);
    case 'ObjectExpression':
      return Object.fromEntries(n.properties.filter((p) => p.type === 'ObjectProperty').map((p) => [keyOf(p), literal(p.value)]));
    default:
      return null;
  }
}

function analyze(code) {
  const ast = parser.parse(code, { sourceType: 'module', errorRecovery: true });
  const tables = {}; // name -> { kind: 'object', value } | { kind: 'set', value: Set }
  const helpers = {}; // helper function name -> table it looks plates up in
  let registryParts = null; // tables combined to build the registry list

  walk(ast.program, (n) => {
    if (n.type !== 'VariableDeclarator' || n.id.type !== 'Identifier' || !n.init) return;
    const name = n.id.name;
    const init = n.init;

    if (init.type === 'ObjectExpression' && init.properties.length >= 5) {
      tables[name] = { kind: 'object', value: literal(init) };
    } else if (init.type === 'NewExpression' && init.callee.name === 'Set' && init.arguments[0]?.type === 'ArrayExpression') {
      tables[name] = { kind: 'set', value: new Set(literal(init.arguments[0])) };
    } else if (init.type === 'ArrowFunctionExpression') {
      // Plate lookups look like  e=>{...;return!!T[t]}  or  e=>e?S.has(...):!1
      const src = code.slice(init.start, init.end);
      const m = src.match(/return!!([A-Za-z_$][\w$]*)\[t\]/) || src.match(/^e=>e\?([A-Za-z_$][\w$]*)\.has\(/);
      if (m && src.length < 200) helpers[name] = m[1];
    }

    // The registry: Object.keys({...A,...B,...}).sort(...)
    const call = init.type === 'CallExpression' && init.callee.type === 'MemberExpression' ? init.callee.object : null;
    if (
      call?.type === 'CallExpression' &&
      code.slice(call.callee.start, call.callee.end) === 'Object.keys' &&
      call.arguments[0]?.type === 'ObjectExpression' &&
      call.arguments[0].properties.length >= 4 &&
      call.arguments[0].properties.every((p) => p.type === 'SpreadElement' && p.argument.type === 'Identifier')
    ) {
      registryParts = call.arguments[0].properties.map((p) => p.argument.name);
    }
  });

  // Which warning the page shows for each lookup: in a component, `F=helper(e)` and
  // later `F&&jsx(... n.someTitle ...)`.
  const flagTables = {}; // table name -> FLAGS key
  walk(ast.program, (fn) => {
    if (!/Function/.test(fn.type) || !fn.body || fn.body.type !== 'BlockStatement') return;
    const local = {};
    walk(fn.body, (n) => {
      if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init?.type === 'CallExpression' && helpers[n.init.callee.name]) {
        local[n.id.name] = helpers[n.init.callee.name];
      }
    });
    if (!Object.keys(local).length) return;
    walk(fn.body, (n) => {
      if (n.type !== 'LogicalExpression' || n.operator !== '&&' || n.left.type !== 'Identifier' || !local[n.left.name]) return;
      const title = code.slice(n.right.start, n.right.end).match(/\.(\w+Title)\b/);
      if (title && FLAGS[title[1]]) flagTables[local[n.left.name]] = title[1];
    });
  });

  if (!registryParts) throw new Error('Could not find the registry list in the bundle. The site may have changed.');
  return { tables, registryParts, flagTables };
}

// ---- Building vehicles ----

const isUrl = (s) => typeof s === 'string' && /^https?:\/\//.test(s);
const FIRST_SEEN = /^(Week of )?((January|February|March|April|May|June|July|August|September|October|November|December) \d{4}|\d{1,2}\/\d{1,2}\/\d{4})( - .+)?$/; // optional place: "7/31/2026 - Macadam ICE"
// "WA - Black Ford Explorer", "Federal - White Dodge Durango", "**PLATE SWITCHER** WA - ..."
const DESCRIPTION = /^(?:(\*+[^*]+\*+)\s*)?([A-Za-z][A-Za-z ]{1,9}?) - (.+)$/;

function classify(value) {
  const vals = Object.values(value).flat().filter((v) => v != null);
  if (!vals.length) return null;
  if (vals.every((v) => v === true)) return 'flag';
  if (vals.every(isUrl)) return 'photos';
  if (vals.filter((v) => typeof v === 'string' && FIRST_SEEN.test(v)).length > vals.length * 0.9) return 'firstSeen';
  if (vals.filter((v) => typeof v === 'string' && DESCRIPTION.test(v)).length > vals.length * 0.8) return 'description';
  if (vals.every((v) => typeof v === 'string')) return 'notes';
  return null;
}

const normalizePlate = (raw) => raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** "WA - Black Ford Expedition (often removes plates)." -> state, color, make, model, extra */
function parseDescription(desc) {
  const m = desc.match(DESCRIPTION);
  if (!m) return { extra: desc };
  const marker = m[1] ? m[1].replace(/\*/g, '').trim() : '';
  const state = /^[A-Z]{2}$/.test(m[2]) ? m[2] : m[2].trim();
  let rest = m[3].trim();
  let extra = marker ? `${marker[0].toUpperCase()}${marker.slice(1).toLowerCase()}.` : '';
  const paren = rest.match(/^(.*?)\s*\((.*)\)\.?$/);
  if (paren) {
    rest = paren[1];
    extra = [extra, paren[2][0].toUpperCase() + paren[2].slice(1)].filter(Boolean).join(' ');
  }
  rest = rest.replace(/\.$/, '');
  const yearMatch = rest.match(/\b(19[89]\d|20[0-4]\d)\b/);
  let year = yearMatch ? Number(yearMatch[1]) : null;
  if (year == null && /^(19[89]\d|20[0-4]\d)$/.test(extra)) {
    year = Number(extra); // "Silver Ford Taurus (2003)"
    extra = '';
  }
  if (yearMatch) rest = rest.replace(yearMatch[0], '').replace(/\s+/g, ' ').trim();
  // "Black Dodge Durango or Black Jeep Grand Cherokee": too ambiguous to split.
  if (/\bor\b/i.test(rest)) return { state, year, extra: [rest.replace(/\.?$/, '.'), extra].filter(Boolean).join(' ') };
  const make = MAKES.find((mk) => new RegExp(`(^|\\s)${mk.replace(/[-]/g, '\\-')}(\\s|$)`, 'i').test(rest));
  if (!make) return { state, year, extra: [rest, extra].filter(Boolean).join(' ') };
  const i = rest.toLowerCase().indexOf(make.toLowerCase());
  return {
    state,
    year,
    color: rest.slice(0, i).trim(),
    make: rest.slice(i, i + make.length),
    model: rest.slice(i + make.length).trim(),
    extra,
  };
}

function buildVehicles({ tables, registryParts, flagTables }) {
  const parts = registryParts.map((name) => ({ name, table: tables[name] })).filter((p) => p.table?.kind === 'object');
  const byRole = {};
  for (const p of parts) {
    const role = flagTables[p.name] ? 'flag' : classify(p.table.value);
    (byRole[role ?? 'unknown'] ||= []).push(p);
  }
  // Flag tables outside the registry (scout, obscured plates) still apply to registry plates.
  const flags = Object.entries(flagTables).map(([name, title]) => ({ title, table: tables[name] }));

  const get = (role, plate) => (byRole[role] || []).map((p) => p.table.value[plate]).filter((v) => v != null);
  const hasFlag = (table, plate) => (table.kind === 'set' ? table.value.has(plate) : table.value[plate] === true);

  const plates = [...new Set(parts.flatMap((p) => Object.keys(p.table.value)))];
  const vehicles = new Map();
  const plateless = [];
  let photos = 0;

  for (const key of plates) {
    // "NP-004" etc. are the site's IDs for vehicles with no plate. They're kept with an
    // empty plate and a stable id, so importing an updated registry merges them.
    const noPlate = /^NP-?\d+$/i.test(key);
    const plate = noPlate ? '' : normalizePlate(key);
    if (!plate && !noPlate) continue;
    if (noPlate) plateless.push(key);
    const desc = get('description', key)[0];
    const d = desc ? parseDescription(desc) : {};
    const notes = [];
    if (noPlate) notes.push(`No plate. Listed on the site as ${key}.`);
    if (d.state) notes.push(`${d.state} plate.`);
    if (key.includes('?')) notes.push('Plate number partly uncertain.');
    if (d.extra) notes.push(d.extra.replace(/\.?$/, '.'));
    if (desc && !d.make) notes.push(`Registry description: ${desc}`);
    for (const f of flags) if (hasFlag(f.table, key)) notes.push(FLAGS[f.title]);
    for (const n of [...get('notes', key)].flat()) if (n && !notes.includes(n)) notes.push(n);
    const firstSeen = get('firstSeen', key)[0];
    if (firstSeen) notes.push(`First reported: ${firstSeen}.`);
    if (get('photos', key).length) photos++;

    const nonIce = flags.some((f) => f.title === 'nonIceLeaTitle' && hasFlag(f.table, key));
    const v = {
      ...(noPlate ? { id: `pdxicescan-${key.toUpperCase()}` } : {}),
      plate,
      make: d.make || '',
      model: d.model || '',
      color: d.color || '',
      year: d.year ?? null,
      agency: nonIce ? 'Possibly non-ICE law enforcement' : 'ICE/DHS',
      notes: notes.join('\n'),
      images: [],
      videos: [],
      sightings: [],
    };
    const mapKey = plate || v.id;
    const prev = vehicles.get(mapKey);
    if (prev) prev.notes = [prev.notes, v.notes].filter(Boolean).join('\n');
    else vehicles.set(mapKey, v);
  }

  return { vehicles: [...vehicles.values()], plateless, photos, byRole, flags };
}

// ---- Main ----

async function main() {
  const args = process.argv.slice(2);
  const bundleAt = args.indexOf('--bundle');
  const bundlePath = bundleAt >= 0 ? args.splice(bundleAt, 2)[1] : null;
  const out = path.resolve(args[0] || path.join(__dirname, '..', 'data', 'pdxicescan-registry.json'));

  const { source, code } = await loadBundle(bundlePath);
  const result = buildVehicles(analyze(code));
  const today = new Date().toISOString().slice(0, 10);
  for (const v of result.vehicles) v.notes = [v.notes, 'Source: pdxicescan.com vehicle registry.'].filter(Boolean).join('\n');

  // "source" and "generated" are extra fields the app reads for the built-in list.
  const file = { format: 'plate-scanner', version: 1, source: 'pdxicescan.com vehicle registry', generated: today, vehicles: result.vehicles };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(file, null, 2) + '\n');

  const roles = Object.entries(result.byRole).map(([r, ps]) => `${r}: ${ps.length}`).join(', ');
  const flagNames = result.flags.map((f) => f.title.replace(/Title$/, '')).join(', ');
  console.error(`Read ${source}`);
  console.error(`Registry tables found (${roles}); warnings found: ${flagNames || 'none'}`);
  console.error(`Wrote ${result.vehicles.length} vehicles to ${out}`);
  if (result.plateless.length) console.error(`Includes ${result.plateless.length} vehicles without a plate (${result.plateless.join(', ')})`);
  if (result.photos) console.error(`${result.photos} vehicles have photos on the site; photos aren't imported yet.`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
