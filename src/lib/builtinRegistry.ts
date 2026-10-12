import { parseDataFile, type Vehicle } from './schema';

// A copy of the pdxicescan.com vehicle registry, built into the app so installs never
// contact the site. Regenerate it with `node scripts/import-pdxicescan.js`.
const raw: { source?: unknown; generated?: unknown } = require('../../data/pdxicescan-registry.json');

export const BUILTIN_SOURCE = typeof raw.source === 'string' ? raw.source : 'built-in list';
export const BUILTIN_DATE = typeof raw.generated === 'string' ? raw.generated : '';

/** The built-in vehicles, validated like any imported file. Fresh copies each call. */
export function builtinVehicles(): Vehicle[] {
  return parseDataFile(raw).vehicles;
}
