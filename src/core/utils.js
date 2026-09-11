// Utilidades compartidas - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)
// NOTA: Phaser se carga como script clásico (global), no como módulo ES.
// Por eso NO se importa desde "phaser" (specifier sin import map falla en el navegador).

export const clamp = Phaser.Math.Clamp;
export const Between = Phaser.Math.Between;

export function screenW(scene) {
  return Math.max(320, scene.scale.width || 960);
}

export function screenH(scene) {
  return Math.max(320, scene.scale.height || 540);
}

export function hashSeed(text) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function choice(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function rectsOverlap(a, b, pad = 0) {
  return a.x < b.x + b.width + pad &&
    a.x + a.width > b.x - pad &&
    a.y < b.y + b.height + pad &&
    a.y + a.height > b.y - pad;
}

export function makeRect(x, y, w, h) {
  return { x, y, width: w, height: h };
}