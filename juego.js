// Alma en Blanco - módulo principal (Fase 2 refactor)
// Importa desde src/ en lugar de tener todo inline
// Fase 1: ES Modules. Fase 2: extracción a src/

import "./art_data.js";
import { installSelfTests, installNativeTouchGuards } from "./src/sistemas/selfTests.js";
import { AUDIO } from "./src/audio/AudioEngine.js";
import { BootScene } from "./src/escenas/BootScene.js";
import { MenuScene } from "./src/escenas/MenuScene.js";
import { AstralScene } from "./src/escenas/AstralScene.js";
import { PauseScene } from "./src/escenas/PauseScene.js";
import { GameScene } from "./src/escenas/GameScene.js";
import { VIEW_W, VIEW_H, BASE_GRAVITY, SAVE_KEY, LEVELS } from "./src/core/constantes.js";

if (!window.Phaser) {
  document.querySelector(".fallback").textContent = "No se pudo cargar Phaser. Revisá la conexión a Internet y recargá la página.";
  throw new Error("[Alma] Phaser no está disponible: no se puede iniciar el juego.");
}

installSelfTests();

const config = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: window.innerWidth || VIEW_W,
  height: window.innerHeight || VIEW_H,
  backgroundColor: "#05060a",
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: BASE_GRAVITY },
      debug: false,
      fps: 60,
      fixedStep: true
    }
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    parent: "game-root"
  },
  scene: [BootScene, MenuScene, GameScene, AstralScene, PauseScene]
};

window.__BLANK_SOUL_CONFIG__ = {
  title: "Alma en Blanco V6: Destrezas Astrales",
  levels: LEVELS.map(l => ({ id: l.id, key: l.key, name: l.name, concept: l.concept })),
  physics: {
    baseGravity: BASE_GRAVITY,
    maxVelocity: 300,
    frictionTarget: 0.8,
    coyoteMs: 110,
    jumpBufferMs: 125
  },
  storageKey: SAVE_KEY
};

window.addEventListener("load", () => {
  if (!window.Phaser) {
    document.querySelector(".fallback").textContent = "No se pudo cargar Phaser. Revisá la conexión a Internet y recargá la página.";
    return;
  }
  window.__BLANK_SOUL_GAME__ = new Phaser.Game(config);
  installNativeTouchGuards(window.__BLANK_SOUL_GAME__);

  // DevPanel: se activa con localStorage.devMode = '1'
  // Long-press 500ms en el badge abre el panel.
  if (localStorage.getItem("devMode") === "1") {
    import("./devpanel.js").catch(() => {}); // carga perezosa, no rompe si falta
  }
});

// Re-export para compatibilidad (Fase 1) - será removido en Fase 3
export {
  VIEW_W, VIEW_H, BASE_GRAVITY, SAVE_KEY, LEVELS
} from "./src/core/constantes.js";

export {
  loadMeta, saveMeta, normalizeMeta,
  gravityMultiplier, economyMultiplier, inflationMultiplier,
  inflatedPrice, playerMoveSpeed, effectiveCoinBurden,
  lawActive, lawUnlocked, runFragmentBank, newRunId
} from "./src/core/guardado.js";

export {
  screenW, screenH, hashSeed, mulberry32, randInt, choice,
  clamp, rectsOverlap, makeRect
} from "./src/core/utils.js";

export { AudioEngine, AUDIO } from "./src/audio/AudioEngine.js";
export { BootScene } from "./src/escenas/BootScene.js";
export { MenuScene } from "./src/escenas/MenuScene.js";
export { GameScene } from "./src/escenas/GameScene.js";
export { AstralScene } from "./src/escenas/AstralScene.js";
export { PauseScene } from "./src/escenas/PauseScene.js";
export { ProceduralMap } from "./src/mundo/ProceduralMap.js";
export { SymbolicEntity } from "./src/entidades/SymbolicEntity.js";
export { ControlRig } from "./src/controles/ControlRig.js";
export { installSelfTests, installNativeTouchGuards } from "./src/sistemas/selfTests.js";
export { config };