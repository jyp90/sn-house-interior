import { newId } from '../model/ids';
import type { Plan } from '../model/schema';
import { parsePlan } from './parse';
import { defaultStorage } from './storage';

export const REVISIONS_KEY = 'homefit:revisions:v1';
export const MAX_REVISIONS = 20;
export const AUTO_REVISION_MS = 5 * 60 * 1000;

export type Revision = { id: string; at: number; label?: string; plan: Plan };

export function loadRevisions(storage: Storage | undefined = defaultStorage()): Revision[] {
  let raw: string | null | undefined;
  try {
    raw = storage?.getItem(REVISIONS_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry: unknown): Revision[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { id, at, label, plan } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || typeof at !== 'number') return [];
    const parsed = parsePlan(plan);
    if (!parsed.ok) return [];
    return [{ id, at, ...(typeof label === 'string' ? { label } : {}), plan: parsed.plan }];
  });
}

export function saveRevisions(list: Revision[], storage: Storage | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(REVISIONS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function addRevision(list: Revision[], plan: Plan, now: number, label?: string): Revision[] {
  const trimmed = label?.trim();
  const revision: Revision = { id: newId('rev'), at: now, ...(trimmed ? { label: trimmed } : {}), plan };
  return [...list, revision].slice(-MAX_REVISIONS);
}

export function shouldAutoSnapshot(list: Revision[], now: number, interval = AUTO_REVISION_MS): boolean {
  const last = list[list.length - 1];
  return !last || now - last.at >= interval;
}

export function recordAutoRevision(plan: Plan, now: number, storage: Storage | undefined = defaultStorage()): boolean {
  const list = loadRevisions(storage);
  if (!shouldAutoSnapshot(list, now)) return false;
  return saveRevisions(addRevision(list, plan, now), storage);
}

const two = (n: number) => String(n).padStart(2, '0');

export function formatRevisionTime(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
