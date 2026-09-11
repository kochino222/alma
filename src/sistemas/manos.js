// Sistema de manos y portables - Alma en Blanco (Fase 3)
// Extraído de src/escenas/GameScene.js. Funciones puras que reciben `scene`.

import { TILE } from "../core/constantes.js";
import { clamp } from "../core/utils.js";
import { effectiveCoinBurden } from "../core/guardado.js";
import { AUDIO } from "../audio/AudioEngine.js";

export function nearbyPortable(scene, includeSymbolic = true) {
  const candidates = [];
  const addGroup = (group, type) => group?.children?.iterate(object => {
    if (!object?.active || object === scene.carried?.target) return;
    const distance = Math.hypot(scene.player.x - object.x, scene.player.y - object.y);
    if (distance < 62) candidates.push({ type, target: object, distance });
  });
  addGroup(scene.cratesGroup, "crate");
  addGroup(scene.bouldersGroup, "boulder");
  addGroup(scene.potsGroup, "pot");
  addGroup(scene.bombsGroup, "bomb");
  for (const entity of includeSymbolic ? (scene.symbolicEntities || []) : []) {
    if (entity.state !== "active" || !entity.vulnerable(scene.time.now)) continue;
    const distance = Math.hypot(scene.player.x - entity.x, scene.player.y - entity.y);
    if (distance < 68) candidates.push({ type: "symbolic", target: entity, distance });
  }
  return candidates.sort((a, b) => a.distance - b.distance)[0] || null;
}

export function tryPickupNearby(scene, time, includeSymbolic = true) {
  if (scene.ending || scene.carried) return false;
  const portable = scene.nearbyPortable(includeSymbolic);
  if (!portable) return false;
  const { target, type } = portable;
  if (type !== "symbolic" && (!target?.active || !target?.body)) return false;
  scene.carried = { target, type };
  if (type === "symbolic") {
    target.state = "carried";
    target.ring.clear();
  } else {
    target.body.stop();
    target.body.enable = false;
    target.setAngularVelocity?.(0);
    if (type === "boulder") target.sleepingStone = false;
  }
  target.thrownByPlayer = false;
  scene.interactionConsumedUntil = time + 320;
  scene.actionHoldStartedAt = 0;
  scene.blue.explode(8, scene.player.x, scene.player.y - 26);
  AUDIO.tone(245, 0.08, "square", 0.045, 80);
  scene.showMessage(type === "symbolic" ? "La idea aturdida pesa menos sobre los hombros." : "Objeto levantado. »: lanzar · Abajo+»: depositar.", 1800);
  return true;
}

export function updateHandsRig(scene, controls, time, dt) {
  if (scene.ending) return;
  if (scene.carried) {
    const { target, type } = scene.carried;
    if (!target || (type === "symbolic" && !target.sprite) || (type !== "symbolic" && !target.active)) { scene.carried = null; return; }
    const x = scene.player.x, y = scene.player.y - 28;
    if (type === "symbolic") {
      target.x = x; target.y = y; target.sprite.setPosition(x, y).setVisible(true).setAngle(Math.sin(time * 0.008) * 4);
    } else target.setPosition(x, y).setAngle(Math.sin(time * 0.009) * 5);
    return;
  }
  const gravity = scene.physics.world.gravity.y;
  for (const thrown of scene.thrownEntities || []) {
    const entity = thrown.target;
    if (!entity || entity.state !== "thrown") { thrown.dead = true; continue; }
    // Guarda anti-crash: si el sprite/referencia fue anulado, descartar el lanzamiento.
    if (!entity.sprite || !entity.sprite.active) { thrown.dead = true; continue; }
    try {
      thrown.vy += gravity * dt / 1000;
      entity.x += thrown.vx * dt / 1000;
      entity.y += thrown.vy * dt / 1000;
      entity.sprite.setPosition(entity.x, entity.y).setAngle(entity.sprite.angle + thrown.vx * dt * 0.0012);
      const tile = scene.terrain.getTileAtWorldXY(entity.x, entity.y + 15, true);
      let hitOther = false;
      for (const other of scene.symbolicEntities || []) {
        if (other === entity || other.state !== "active") continue;
        if (Math.hypot(other.x - entity.x, other.y - entity.y) < 34) {
          other.dissipate(time); hitOther = true; break;
        }
      }
      if (hitOther || tile?.index === 1 || time >= thrown.expires) {
        entity.state = "dissipated"; entity.respawnAt = time + 8000; entity.sprite.setVisible(false);
        scene.blue.explode(16, entity.x, entity.y); thrown.dead = true;
      }
    } catch (err) {
      thrown.dead = true;
    }
  }
  scene.thrownEntities = (scene.thrownEntities || []).filter(item => !item.dead);

  for (const group of [scene.cratesGroup, scene.bouldersGroup, scene.potsGroup, scene.bombsGroup]) group?.children?.iterate(object => {
    if (!object?.active || !object.body?.enable) return;
    object.impactSpeed = Math.max(object.impactSpeed || 0, Math.hypot(object.body.velocity.x, object.body.velocity.y));
    if (!object.thrownByPlayer) return;
    for (const entity of scene.symbolicEntities || []) {
      if (entity.state !== "active" || Math.hypot(entity.x - object.x, entity.y - object.y) >= 38) continue;
      if (object.pickupType === "pot") scene.breakPot(object);
      entity.stunnedUntil = Math.max(entity.stunnedUntil, time + 1500);
      entity.windupUntil = 0; entity.attackAt = 0; entity.chargeUntil = 0;
      scene.blue.explode(10, entity.x, entity.y);
      object.thrownByPlayer = false;
      scene.showMessage("El pensamiento queda aturdido por el peso de lo real.", 1500);
      break;
    }
  });
}

export function releaseCarried(scene, soft, time) {
  if (!scene.carried || !scene.carried.target) return false;
  const carried = scene.carried;
  const dir = scene.player.facing || 1;
  // Limpiar referencias y estado visual (aura verde del portaobjetos) antes de
  // que el objeto vuelva a entrar en las físicas activas del mundo.
  scene.carried = null;
  scene.portableHalo?.clear();
  if (carried.type === "symbolic") {
    const entity = carried.target;
    if (!entity?.sprite) return false;
    try {
      entity.state = "thrown";
      entity.ring?.clear();
      entity.sprite.setVisible(true);
      scene.thrownEntities = scene.thrownEntities || [];
      scene.thrownEntities.push({ target: entity, vx: soft ? 0 : dir * 320, vy: soft ? 20 : -140, expires: time + 2300 });
    } catch (err) {
      return false;
    }
  } else {
    const object = carried.target;
    // Guarda anti-crash: si el objeto o su cuerpo físico ya fueron anulados
    // (p. ej. una vasija rota), no reintroducirlo en las físicas activas.
    if (!object || !object.active || !object.body) return false;
    try {
      object.body.enable = true;
      object.body.setMaxVelocity(360, 620);
      object.setPosition(scene.player.x + dir * 22, scene.player.y - (soft ? 2 : 20));
      object.setVelocity(soft ? 0 : dir * 320, soft ? 25 : -140);
      object.setAngularVelocity?.(soft ? 0 : dir * 460);
      object.thrownByPlayer = !soft;
      object.impactSpeed = 0;
    } catch (err) {
      return false;
    }
  }
  AUDIO.dash();
  return true;
}

export function dropCarried(scene, time) {
  if (!scene.carried) return false;
  scene.releaseCarried(true, time);
  scene.interactionConsumedUntil = time + 250;
  return true;
}

export function onPortableTerrainHit(scene, object) {
  if (scene.ending || !object?.active) return;
  const force = object.impactSpeed || 0;
  object.impactSpeed = 0;
  if (object.pickupType === "pot" && force > 130) scene.breakPot(object);
  if (object.thrownByPlayer && force >= 120) object.thrownByPlayer = false;
}

export function onPortableWallHit(scene, object) {
  if (scene.ending || !object?.active) return;
  if (object.pickupType === "pot" && (object.impactSpeed || 0) > 130) scene.breakPot(object);
}

export function onPortableSpikeHit(scene, object, spike) {
  if (scene.ending || !object?.active || !spike?.active) return;
  spike.disableBody(true, true);
  object.setVelocityY(Math.min(0, object.body.velocity.y));
  object.setAngularVelocity?.(0);
  object.thrownByPlayer = false;
  scene.rubble.explode(7, spike.x, spike.y);
  scene.showMessage("El objeto cubre los filos y crea un apoyo seguro.", 1700);
}

export function onPushCrate(scene, player, crate) {
  if (scene.ending) return;
  const pushPower = scene.featherBoots ? 1.05 : clamp(1.05 - effectiveCoinBurden(scene.coins, scene.meta) * 0.0022, 0.55, 1.05);
  crate.body.velocity.x *= pushPower;
}

export function onBoulderHit(scene, player, rock) {
  if (scene.ending) return;
  const force = Math.abs(rock.body.velocity.x) + Math.abs(rock.body.velocity.y);
  if (force > 145) scene.takeDamage(2, "boulder");
  if (scene.ending) return;
}

export function onBoulderTerrainHit(scene, rock, tile) {
  if (scene.ending || !rock?.active || !tile) return;
  const force = Math.max(rock.impactSpeed || 0, Math.abs(rock.body.velocity.x) + Math.abs(rock.body.velocity.y));
  if (force < 260 || scene.time.now < (rock.terrainBreakReadyAt || 0)) return;
  rock.terrainBreakReadyAt = scene.time.now + 240;
  rock.impactSpeed = 0;
  scene.destroyTerrainCircle(tile.pixelX + TILE / 2, tile.pixelY + TILE / 2, 0.85);
  scene.rubble.explode(8, tile.pixelX + TILE / 2, tile.pixelY + TILE / 2);
  AUDIO.demolition();
}

export function onBoulderCrateHit(scene, rock, crate) {
  if (scene.ending || !crate?.active) return;
  const force = Math.max(rock.impactSpeed || 0, Math.abs(rock.body.velocity.x) + Math.abs(rock.body.velocity.y));
  if (force >= 210) scene.breakCrate(crate);
}
