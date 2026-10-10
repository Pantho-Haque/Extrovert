/** Import from Ferdium (FR-X27): map an exported configuration's services onto our catalog. */
import type { ServiceType } from '../../shared/types';
import { parseCustomUrl } from '../services/catalog';

export interface ImportedService {
  type: ServiceType;
  label?: string;
  url?: string;
}

// Ferdium recipe ids → our services. Matched by substring because recipe ids vary between versions.
const RECIPES: [RegExp, ServiceType][] = [
  [/whatsapp/, 'whatsapp'],
  [/messenger/, 'messenger'],
  [/instagram/, 'instagram'],
  [/linkedin/, 'linkedin'],
  [/gmail|googlemail|google-mail/, 'gmail'],
  [/calendar/, 'calendar'],
  [/drive/, 'drive'],
  [/meet/, 'meet'],
  [/hangoutschat|google-chat|googlechat/, 'chat'],
  [/facebook/, 'facebook'],
];

export interface FerdiumImport {
  services: ImportedService[];
  skipped: string[];
}

export function parseFerdiumExport(json: string): FerdiumImport {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("This file isn't a Ferdium export (it isn't valid JSON).");
  }
  const list = (data as { services?: unknown })?.services;
  if (!Array.isArray(list)) throw new Error("This file isn't a Ferdium export (no services list found).");

  const services: ImportedService[] = [];
  const skipped: string[] = [];
  for (const raw of list) {
    const s = raw as { recipeId?: unknown; name?: unknown; customUrl?: unknown };
    const recipe = String(s.recipeId ?? '').toLowerCase();
    const name = typeof s.name === 'string' && s.name.trim() ? s.name.trim() : recipe;
    const type = RECIPES.find(([re]) => re.test(recipe))?.[1];
    if (type) {
      services.push({ type, ...(name && !new RegExp(`^${type}$`, 'i').test(name) ? { label: name } : {}) });
      continue;
    }
    const custom = typeof s.customUrl === 'string' ? parseCustomUrl(s.customUrl) : null;
    if (custom) services.push({ type: 'custom', url: custom.url, label: name || custom.name });
    else skipped.push(name || 'Unknown service');
  }
  return { services, skipped };
}
