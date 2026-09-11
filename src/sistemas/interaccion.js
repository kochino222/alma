// Sistema de interacciones y salvaguardas - Alma en Blanco (Fase 3)
// Extraído de src/escenas/GameScene.js. Funciones puras que reciben `scene`.

import { TILE, JUMP_SPEED } from "../core/constantes.js";
import { clamp } from "../core/utils.js";
import { AUDIO } from "../audio/AudioEngine.js";

export function handleInteractions(scene, controls, time) {
  if (controls.interactPressed) {
    if (scene.carried) {
      scene.dropCarried(time);
      return;
    }
    if (scene.graceAvailable) {
      scene.surrenderToAstral("grace");
      return;
    }
    if (scene.tryPickupNearby(time, controls.down || Boolean(scene.nearStunned))) return;
    const grounded = scene.player.body.blocked.down || scene.player.body.touching.down || scene.onSlope;
    if (controls.down && grounded) {
      if (scene.ending || scene.hp <= 0) return;
      scene.seismicLifeStrike(time);
      return;
    }
    if (scene.nearExit) {
      scene.descend();
      return;
    }
    if (scene.nearMerchant) {
      scene.buyMerchantItem(time);
      return;
    }
    if (scene.nearSpecial) {
      scene.useSpecialRoom(scene.nearSpecial, time);
      return;
    }
    if (scene.nearDramatic) {
      scene.sacrificeForRoute(scene.nearDramatic);
      return;
    }
    if (scene.nearAltar) {
      scene.useAltar();
      return;
    }
    if (scene.nearGod) {
      scene.negotiateWithGod();
      return;
    }
    if (scene.nearSymbolic) {
      scene.absorbSymbolic(scene.nearSymbolic, time);
      return;
    }
  }
}

export function hasVerticalEscape(scene) {
  if (!scene.terrain || !scene.player?.body) return true;
  const tx = Math.floor(scene.player.x / TILE);
  const footTy = Math.floor(scene.player.body.bottom / TILE);
  const maxRiseTiles = Math.max(5, Math.floor(JUMP_SPEED ** 2 / (2 * Math.max(1, scene.physics.world.gravity.y) * TILE)));
  for (let ox = -2; ox <= 2; ox += 1) {
    let clear = true;
    for (let oy = 1; oy <= maxRiseTiles; oy += 1) {
      if (scene.generated.data[footTy - oy]?.[tx + ox] === 1) { clear = false; break; }
    }
    if (clear) return true;
  }
  return false;
}

export function isCaveConfined(scene) {
  const tx = Math.floor(scene.player.x / TILE);
  const ty = Math.floor(scene.player.y / TILE);
  const solid = (x, y) => scene.generated.data[y]?.[x] === 1;
  const leftClosed = [1, 2].some(distance => [0, 1].every(dy => solid(tx - distance, ty + dy)));
  const rightClosed = [1, 2].some(distance => [0, 1].every(dy => solid(tx + distance, ty + dy)));
  return leftClosed && rightClosed && !scene.hasVerticalEscape();
}

export function updateCaveSafeguards(scene, controls, time) {
  if (scene.ending) return;
  const grounded = scene.player.body.blocked.down || scene.player.body.touching.down || scene.onSlope;
  if (!scene.confinementAnchor) scene.confinementAnchor = { x: scene.player.x, y: scene.player.y };
  if (Math.abs(scene.player.x - scene.confinementAnchor.x) > 64 || Math.abs(scene.player.y - scene.confinementAnchor.y) > 96 || !grounded) {
    scene.confinementAnchor = { x: scene.player.x, y: scene.player.y };
    scene.confinedSince = 0;
    scene.graceAvailable = false;
  } else if (scene.isCaveConfined()) {
    if (!scene.confinedSince) scene.confinedSince = time;
    scene.graceAvailable = time - scene.confinedSince >= 7000;
  } else {
    scene.confinedSince = 0;
    scene.graceAvailable = false;
  }

  const contextual = scene.carried || scene.nearbyPortable() || scene.nearExit || scene.nearMerchant || scene.nearSpecial ||
    scene.nearDramatic || scene.nearAltar || scene.nearGod || scene.nearSymbolic;
  const canChannel = grounded && !controls.down && !contextual && time >= scene.interactionConsumedUntil;
  if (controls.interact && canChannel) {
    if (!scene.actionHoldStartedAt) scene.actionHoldStartedAt = time;
    const progress = clamp((time - scene.actionHoldStartedAt) / 2500, 0, 1);
    scene.channelRing.clear();
    scene.channelRing.lineStyle(2 + progress * 3, 0x9dfcff, 0.35 + progress * 0.6);
    scene.channelRing.strokeCircle(scene.player.x, scene.player.y, 58 - progress * 38);
    if (time >= scene.channelToneAt) {
      AUDIO.tone(110 + progress * 330, 0.12, "sine", 0.025 + progress * 0.045, 35);
      scene.channelToneAt = time + Math.max(90, 260 - progress * 150);
      scene.blue.explode(2, scene.player.x + Phaser.Math.Between(-42, 42), scene.player.y + Phaser.Math.Between(-34, 34));
    }
    // Disolución del Ego completada: disuelve la conciencia. Marcamos la
    // muerte como suicidio (isSuicide=true) para que die() aplique la
    // penalización de fragmentos de forma segura.
    if (progress >= 1) { scene.hp = 0; scene.die(true); return; }
  } else {
    if (controls.interactReleased && scene.actionHoldStartedAt && time - scene.actionHoldStartedAt < 420 && scene.levelInfo.key === "volcano" && !contextual) {
      scene.destructiveImpulse(time);
    }
    scene.actionHoldStartedAt = 0;
    scene.channelToneAt = 0;
    scene.channelRing.clear();
  }
}
