// Guardado unificado (Base64 + Ofuscación) - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)

import { LEVELS, LAW_DEFS, MAX_LAW_TIER, SAVE_KEY, RUN_FRAGMENT_KEY, DEFAULT_META } from "./constantes.js";
import { clamp } from "./utils.js";

// ===== Conversión a forma de guardado =====
// El meta-progreso permanente se persiste en localStorage con la clave
// 'blank-soul-save-v4' y la forma base { leyes: {...}, fragmentos: N, medallas: [] }.
// El string JSON se ofusca con Base64 (btoa/atob). El banco de fragmentos
// por run (sessionStorage) se mantiene transitorio entre niveles de una run.

export function toSaveShape(meta) {
  const leyes = {};
  for (const law of LAW_DEFS) {
    leyes[law.key] = clamp(Math.floor(Number(meta?.[law.key]) || 0), 0, MAX_LAW_TIER);
    const activeKey = `active${law.key[0].toUpperCase()}${law.key.slice(1)}`;
    leyes[activeKey] = clamp(Math.floor(Number(meta?.[activeKey]) ?? (meta?.[law.key] ? 1 : 1)), 0, 1);
  }
  return {
    leyes,
    fragmentos: clamp(Math.floor(Number(meta?.fragments) || 0), 0, 999),
    medallas: Array.isArray(meta?.medallas) ? meta.medallas.slice() : [],
    ascensiones: clamp(Math.floor(Number(meta?.ascensions) || 0), 0, 999)
  };
}

export function fromSaveShape(decoded) {
  const flat = { ...DEFAULT_META };
  const leyes = decoded?.leyes || {};
  flat.fragments = clamp(Math.floor(Number(decoded?.fragmentos) || 0), 0, 999);
  flat.ascensions = clamp(Math.floor(Number(decoded?.ascensiones) || 0), 0, 999);
  flat.medallas = Array.isArray(decoded?.medallas) ? decoded.medallas.slice() : [];
  for (const law of LAW_DEFS) {
    flat[law.key] = clamp(Math.floor(Number(leyes[law.key]) || 0), 0, MAX_LAW_TIER);
    const activeKey = `active${law.key[0].toUpperCase()}${law.key.slice(1)}`;
    flat[activeKey] = leyes[activeKey] === undefined ? (flat[law.key] ? 1 : 1) : (Number(leyes[activeKey]) ? 1 : 0);
  }
  return flat;
}

export function loadMeta() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_META };
    const decoded = JSON.parse(atob(raw));
    return normalizeMeta(fromSaveShape(decoded));
  } catch (error) {
    return { ...DEFAULT_META };
  }
}

export function saveMeta(meta) {
  localStorage.setItem(SAVE_KEY, btoa(JSON.stringify(toSaveShape(meta))));
}

export function normalizeMeta(meta) {
  const next = { ...DEFAULT_META };
  next.fragments = clamp(Math.floor(Number(meta?.fragments) || 0), 0, 999);
  next.ascensions = clamp(Math.floor(Number(meta?.ascensions) || 0), 0, 999);
  next.medallas = Array.isArray(meta?.medallas) ? meta.medallas.slice() : [];
  for (const law of LAW_DEFS) {
    next[law.key] = clamp(Math.floor(Number(meta?.[law.key]) || 0), 0, MAX_LAW_TIER);
    const activeKey = `active${law.key[0].toUpperCase()}${law.key.slice(1)}`;
    next[activeKey] = meta?.[activeKey] === undefined ? (next[law.key] ? 1 : 1) : (Number(meta[activeKey]) ? 1 : 0);
  }
  return next;
}

// ===== Helpers de run / economía =====

export function gravityMultiplier(meta) {
  return 1;
}

export function trapMultiplier(meta) {
  return 1;
}

export function economyMultiplier(meta) {
  return meta?.economyGrace && lawActive(meta, "economyGrace") ? 0.72 : 1;
}

export function inflationMultiplier(worldNumber) {
  return [1, 1.4, 1.8, 2.2][clamp(Math.floor(worldNumber || 1), 1, 4) - 1];
}

export function inflatedPrice(worldNumber, base = 20) {
  return Math.round(base * inflationMultiplier(worldNumber));
}

export function daggerReward(worldNumber) {
  return [35, 50, 65, 80][clamp(Math.floor(worldNumber || 1), 1, 4) - 1];
}

export function lawUnlocked(meta, law) {
  if (law.tier === 1) return true;
  return LAW_DEFS.some(candidate => candidate.tier === law.tier - 1 && meta[candidate.key] > 0);
}

export function lawActive(meta, key) {
  const activeKey = `active${key[0].toUpperCase()}${key.slice(1)}`;
  return Boolean(meta?.[key] && (meta?.[activeKey] === undefined || meta[activeKey]));
}

export function runFragmentBank() {
  return clamp(Number(sessionStorage.getItem(RUN_FRAGMENT_KEY)) || 0, 0, 999);
}

export function setRunFragmentBank(value) {
  sessionStorage.setItem(RUN_FRAGMENT_KEY, String(clamp(value, 0, 999)));
}

export function resetRunFragmentBank() {
  sessionStorage.setItem(RUN_FRAGMENT_KEY, "0");
}

export function newRunId() {
  return `run-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

export function effectiveCoinBurden(coins, meta) {
  const count = Math.max(0, Number(coins) || 0);
  const frontLoad = Math.min(count, 18) * 7;
  const excess = Math.sqrt(Math.max(0, count - 18)) * 13;
  return Math.round(clamp((frontLoad + excess) * economyMultiplier(meta), 0, 225));
}

export function playerMoveSpeed(coins, meta, powerTimer = 0) {
  const penalty = effectiveCoinBurden(coins, meta) * 0.34;
  return clamp(190 - penalty + (powerTimer > 0 ? 26 : 0), 118, 220);
}