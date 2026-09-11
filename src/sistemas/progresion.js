// Sistema de progresion de la run - Alma en Blanco (Fase 3)
// Extraído de src/escenas/GameScene.js. Funciones puras que reciben `scene`.

import { TILE, TOTAL_STAGES } from "../core/constantes.js";
import { clamp } from "../core/utils.js";
import { loadMeta, saveMeta, lawActive, setRunFragmentBank } from "../core/guardado.js";
import { AUDIO } from "../audio/AudioEngine.js";

export function surrenderToAstral(scene, reason) {
  if (scene.ending) return;
  scene.preserveEtherealGold();
  scene.ending = true;
  scene.stopForAstral();
  scene.startAstral(false, reason);
}

export function descend(scene) {
  if (scene.ending) return;
  if (scene.usedExit) return;
  scene.usedExit = true;
  scene.runFragments += 1;
  setRunFragmentBank(scene.runFragments);
  scene.blue.explode(30, scene.exitDoor.x, scene.exitDoor.y);
  AUDIO.fragment();
  if (scene.levelNumber >= TOTAL_STAGES) {
    scene.completeRun();
    return;
  }
  scene.cameras.main.fadeOut(300, 4, 6, 10);
  scene.time.delayedCall(320, () => {
    if (scene.ending) return;
    scene.scene.start("Game", {
      level: scene.levelNumber + 1,
      seed: scene.seed,
      runId: scene.runId,
      isCustomSeed: scene.isCustomSeed,
      coins: scene.coins,
      fragments: scene.runFragments,
      hp: scene.hp,
      maxHp: scene.maxHp,
      creditPact: scene.creditPact,
      bombs: scene.bombs
    });
  });
}

export function stopForAstral(scene) {
  // Freeze before scene.start: shutdown may destroy objects synchronously.
  if (scene.player?.body) {
    scene.player.body.stop();
    scene.player.body.enable = false;
  }
  const world = scene.physics.world;
  for (const body of [...(world?.bodies?.entries || []), ...(world?.staticBodies?.entries || [])]) body.enable = false;
  for (const collider of world?.colliders?.getActive?.() || []) collider.active = false;
  scene.physics.pause();
  scene.controls.releaseAll();
  scene.cameras.main.stopFollow();
  scene.cameras.main.resetFX();
  scene.tweens.pauseAll();
  scene.time.removeAllEvents();
  for (const emitter of [scene.dust, scene.footDust, scene.spark, scene.blue, scene.sporeMist, scene.rubble]) {
    if (emitter) emitter.setActive(false);
  }
  scene.channelRing?.clear();
  for (const attack of scene.symbolicAttacks || []) attack.graphics?.destroy();
  scene.symbolicAttacks = [];
  AUDIO.stopDrone();
}

export function completeRun(scene) {
  if (scene.ending) return;
  scene.ending = true;
  scene.stopForAstral();
  const meta = loadMeta();
  meta.ascensions += 1;
  saveMeta(meta);
  scene.startAstral(true, "transcendence", 4);
}

export function startAstral(scene, victory, reason, bonusFragments = 0) {
  if (!scene.ending) return;
  scene.scene.start("Astral", {
    victory,
    runId: scene.runId,
    isCustomSeed: scene.isCustomSeed,
    runFragments: scene.runFragments + bonusFragments,
    reachedLevel: scene.levelNumber,
    reason
  });
}

export function die(scene, isSuicide = false) {
  // Guard: ya estamos muriendo o ya empezamos a transicionar al Astral.
  if (scene.ending) return;

  // Requerimiento #1: marcar el estado de muerte antes de cualquier otra cosa
  // para que update(), colisiones y otros handlers no-actúen sobre un jugador moribundo.
  scene.ending = true;

  // Preservar oro etéreo (igual que antes) — debe ocurrir antes del freeze total.
  scene.preserveEtherealGold();

  // PENALIZACIÓN DE LA "DISOLUCIÓN DEL EGO" (suicidio):
  // Al disolver el ego se disipa la conciencia recolectada (fragmentos).
  // Este bloque manipula EXCLUSIVAMENTE variables (lógica pura): la reducción
  // de fragmentos se aplica siempre, pero cualquier actualización visual del
  // HUD o sonido relacionado con fragmentos queda detrás de una guarda estricta
  // (`if (!scene.ending)`) Y de un try/catch, para que un fallo aquí jamás
  // detenga el ciclo de Phaser ni congele el juego.
  if (isSuicide && (scene.runFragments || 0) > 0) {
    try {
      // Reset a nivel de variables + sin-cronización con el banco de la run.
      scene.runFragments = 0;
      setRunFragmentBank(0);

      // Guardas estrictas: con scene.ending === true (como ocurre al llegar
      // aquí) NO tocamos HUD ni sonido; el loop de update() ya no pinta el HUD.
      if (!scene.ending) scene.updateHud?.(scene.time.now, 0);
      if (!scene.ending && AUDIO?.unlocked) AUDIO.reject?.();
    } catch (err) {
      if (window.console) {
        console.error("[Alma en Blanco] penalización de fragmentos (Disolución del Ego) falló: no se interrumpe la muerte.", err);
      }
    }
  }

  // Snapshot de la posición del jugador en el momento exacto de la muerte,
  // porque stopForAstral() viene después y la escena se reinicia.
  const deathX = scene.player?.x ?? 0;
  const deathY = scene.player?.y ?? 0;

  // Requerimiento #2: pausar las físicas del jugador manualmente.
  // (stopForAstral() también lo hace, pero lo aplicamos YA para que el sprite
  // quede quieto durante la animación de 1.5s. Ojo: NO llamamos stopForAstral()
  // todavía porque hace scene.time.removeAllEvents() y mataría nuestro delayedCall.)
  // Requerimiento #3: desvincular al jugador de la escalera y restaurar la
  // gravedad normal para que un cuerpo pausado no reciba gravedad especial.
  scene.onLadder = false;
  if (scene.player?.body) {
    scene.player.body.allowGravity = true;
    scene.player.body.stop();
    scene.player.body.enable = false;
  }

  // Requerimiento #3: ocultar el sprite del jugador. El cuerpo físico ya está
  // desactivado, así que no hay riesgo de quedar atrapado en colisiones.
  if (scene.player) {
    scene.player.setVisible(false);
  }

  // Requerimiento #4: explosión de partículas en la posición exacta del jugador.
  // Patrón idéntico al de scene.rubble (línea ~1692): emitter pre-creado,
  // emitting:false por defecto, y luego .explode(N, x, y) para detonar.
  // Usamos "particle-blue" + "particle-white" mezcladas en dos passes para
  // un efecto más dramático que el rubble de color único del nivel.
  if (!scene.deathBurst) {
    scene.deathBurst = scene.add.particles(0, 0, "particle-blue", {
      lifespan: { min: 520, max: 1100 },
      speed: { min: 90, max: 260 },
      angle: { min: 0, max: 360 },
      gravityY: 380,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      maxParticles: 60,
      emitting: false
    }).setDepth(20);
  }
  // Detonamos 24 partículas azules en todas direcciones.
  scene.deathBurst.explode(24, deathX, deathY);

  // Segundo pass con partículas blancas para dar destello interior.
  if (!scene.deathSpark) {
    scene.deathSpark = scene.add.particles(0, 0, "particle-white", {
      lifespan: { min: 280, max: 540 },
      speed: { min: 60, max: 180 },
      angle: { min: 0, max: 360 },
      gravityY: 220,
      scale: { start: 0.6, end: 0 },
      alpha: { start: 1, end: 0 },
      maxParticles: 40,
      emitting: false
    }).setDepth(21);
  }
  scene.deathSpark.explode(18, deathX, deathY);

  // Un pequeño flash en la cámara para anclar el momento dramático.
  scene.cameras.main.flash(180, 220, 240, 255);

  // Requerimiento #5: sonido de muerte sintético.
  // No modificamos el AudioEngine (fuera del alcance). Construimos un
  // acorde descendente con AUDIO.tone() — onda sine grave + glide negativo.
  if (AUDIO?.unlocked) {
    AUDIO.tone(110, 0.9, "sine", 0.16, -90);   // bajo que desciende al abismo
    AUDIO.tone(165, 0.7, "triangle", 0.08, -130); // quinta que cae más rápido
    AUDIO.noise(0.35, 0.05, 320);              // ruido sutil = "alma dispersándose"
  }

  // Requerimiento #6: temporizador de 1500ms antes de cambiar de escena.
  // Recién acá invocamos stopForAstral() (que hace removeAllEvents() pero ya
  // está nuestro delayedCall en cola y se ejecutará antes de que eso importe).
  // Guardamos el runId y los fragmentos en locales porque después del
  // stopForAstral() el contexto del scene puede limpiar referencias.
  const payload = {
    victory: false,
    runId: scene.runId,
    isCustomSeed: scene.isCustomSeed,
    runFragments: scene.runFragments,
    reachedLevel: scene.levelNumber,
    reason: "death"
  };
  const self = scene;
  scene.time.delayedCall(1500, function() {
    self.stopForAstral();
    self.scene.start("Astral", payload);
  });
}

export function preserveEtherealGold(scene) {
  if (scene.etherealGoldPreserved) return;
  scene.etherealGoldPreserved = true;
  if (lawActive(scene.meta, "etherealBond") && scene.coins > 0) {
    const preserved = Math.floor(scene.coins * 0.15);
    if (preserved > 0) {
      scene.runFragments = clamp(scene.runFragments + preserved, 0, 999);
      setRunFragmentBank(scene.runFragments);
    }
  }
}

export function checkDeathPlane(scene) {
  if (scene.ending) return;
  if (scene.hp <= 0 || !scene.player?.body) return;
  if (scene.player.y > scene.generated.rows * TILE + 120) {
    scene.player.body.stop();
    scene.player.body.enable = false;
    if (scene.ending) return;
    scene.hp = 0;
    scene.preserveEtherealGold();
    scene.ending = true;
    scene.stopForAstral();
    if (!scene.ending) return;
    scene.startAstral(false, "death");
  }
}
