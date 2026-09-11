// Self-tests y touch guards - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)

import { DEFAULT_META, LEVELS, BASE_GRAVITY, JUMP_SPEED, SACRIFICE_JUMP_SPEED } from "../core/constantes.js";
import { ProceduralMap } from "../mundo/ProceduralMap.js";
import { normalizeMeta, gravityMultiplier, economyMultiplier, inflatedPrice, daggerReward } from "../core/guardado.js";

export function installSelfTests() {
  window.__BLANK_SOUL_SELF_TEST__ = function runSelfTest(seedBase = "test-seed") {
    const metaCases = [
      { ...DEFAULT_META },
      { ...DEFAULT_META, economyGrace: 1, willInertia: 1, doubleJump: 1, etherealBond: 1, selectiveAmnesia: 1, greedTransmutation: 1 }
    ];
    const results = [];
    const failures = [];
    for (const meta of metaCases) {
      LEVELS.forEach(level => {
        for (let i = 0; i < 6; i += 1) {
          const map = new ProceduralMap(`${seedBase}-${i}`, level, meta).generate();
          const result = map.selfTest();
          results.push({ level: level.key, seed: i, ...result });
          if (!result.ok) failures.push({ level: level.key, seed: i, failures: result.failures });
        }
      });
    }
    const normalized = normalizeMeta({ fragments: 12, economyGrace: 4, willInertia: -2, doubleJump: "3" });
    if (normalized.economyGrace !== 1 || normalized.doubleJump !== 1) failures.push({ system: "meta clamp", failures: ["laws not clamped"] });
    if (normalized.willInertia !== 0) failures.push({ system: "meta clamp", failures: ["negative law not clamped"] });
    if (Math.round(BASE_GRAVITY * gravityMultiplier({ gravityRelief: 0 })) !== 800) failures.push({ system: "physics", failures: ["base gravity drifted"] });
    if (economyMultiplier({ economyGrace: 1 }) !== 0.72) failures.push({ system: "economy", failures: ["gold burden law drifted"] });
    if (inflatedPrice(4) !== 44 || daggerReward(4) !== 80) failures.push({ system: "economy", failures: ["world inflation drifted"] });
    return {
      ok: failures.length === 0,
      failures,
      mapsChecked: results.length,
      averageCoins: Math.round(results.reduce((sum, r) => sum + r.coins, 0) / results.length),
      averageHazards: Math.round(results.reduce((sum, r) => sum + r.hazards, 0) / results.length),
      controls: {
        coyoteMs: 110,
        jumpBufferMs: 125,
        variableJumpCutoff: -120,
        touchButtons: 8
      }
    };
  };
}

export function installNativeTouchGuards(game) {
  const canvas = game && game.canvas;
  if (!canvas || canvas.__blankSoulTouchGuardsInstalled) return;
  const preventNativeGesture = event => {
    if (event.cancelable) event.preventDefault();
  };
  ["touchstart", "touchmove", "touchend", "touchcancel", "gesturestart"].forEach(type => {
    canvas.addEventListener(type, preventNativeGesture, { passive: false });
  });
  canvas.style.touchAction = "none";
  canvas.style.webkitUserSelect = "none";
  canvas.__blankSoulTouchGuardsInstalled = true;
}