import { ENDPOINTS } from './trackdechets.js';
export const SETTINGS_KEY = 'frigo.settings.v1';
const defaults = { siret: '', name: '', contact: '', phone: '', mail: '', address: '', token: '', environment: 'sandbox', dryRun: true };
export function loadSettings(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(SETTINGS_KEY) ?? '{}');
    const settings = { ...defaults };
    for (const key of Object.keys(defaults)) if (typeof saved?.[key] === typeof defaults[key]) settings[key] = saved[key];
    if (!Object.hasOwn(ENDPOINTS, settings.environment)) settings.environment = 'sandbox';
    return settings;
  } catch { return { ...defaults }; }
}
export function saveSettings(settings, storage = globalThis.localStorage) {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
