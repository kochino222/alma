// Sistema de dinamica del mundo - Alma en Blanco (Fase 3)
// Extraído de src/escenas/GameScene.js. Funciones puras que reciben `scene`.

import { TILE } from "../core/constantes.js";
import { clamp, screenW, screenH, rectsOverlap } from "../core/utils.js";
import { setRunFragmentBank } from "../core/guardado.js";
import { AUDIO } from "../audio/AudioEngine.js";

export function deployBomb(scene, time) {
  if (scene.ending) return;
  if (scene.bombs <= 0) {
    scene.showMessage("No quedan bombas.", 1200); AUDIO.reject(); return;
  }
  scene.bombs -= 1;
  const dir = scene.player.facing || 1;
  const bomb = scene.bombsGroup.create(scene.player.x + dir * 22, scene.player.y - 4, "bomb");
  bomb.body.setCircle(10, 2, 3).setMaxVelocity(230, 520);
  bomb.setVelocity(dir * 135 + scene.player.body.velocity.x * 0.35, -105);
  bomb.setBounce(0.38).setDragX(180);
  bomb.detonatesAt = time + 2000;
  bomb.pickupType = "bomb";
  AUDIO.tone(105, 0.08, "square", 0.06, 35);
}

export function detonateBomb(scene, bomb) {
  if (scene.ending || !bomb?.active) return;
  const x = bomb.x, y = bomb.y, radius = TILE * 2.65;
  if (scene.carried?.target === bomb) scene.carried = null;
  bomb.disableBody(true, true);
  const removed = scene.destroyTerrainCircle(x, y, 2.65);
  scene.cratesGroup.children.iterate(crate => {
    if (crate?.active && Math.hypot(crate.x - x, crate.y - y) <= radius) scene.breakCrate(crate);
  });
  scene.destructiblesGroup.children.iterate(wall => {
    if (wall?.active && Math.hypot(wall.x - x, wall.y - y) <= radius) scene.breakWall(wall, true);
  });
  for (const entity of scene.symbolicEntities || []) {
    if (entity.state === "active" && Math.hypot(entity.x - x, entity.y - y) <= radius) entity.dissipate(scene.time.now);
  }
  if (Math.hypot(scene.player.x - x, scene.player.y - y) <= radius) scene.takeDamage(2, "explosion");
  if (scene.ending) return;
  scene.rubble.explode(Math.min(42, 12 + removed * 2), x, y);
  scene.spark.explode(28, x, y);
  scene.cameras.main.shake(250, 0.012);
  AUDIO.demolition();
}

export function destroyTerrainCircle(scene, worldX, worldY, radiusTiles = 2.5) {
  if (scene.ending || !scene.terrain) return 0;
  const centerX = Math.floor(worldX / TILE), centerY = Math.floor(worldY / TILE);
  const limit = Math.ceil(radiusTiles);
  let removed = 0;
  for (let oy = -limit; oy <= limit; oy += 1) for (let ox = -limit; ox <= limit; ox += 1) {
    if (ox * ox + oy * oy > radiusTiles * radiusTiles) continue;
    const tx = centerX + ox, ty = centerY + oy;
    if (ty < 0 || ty >= scene.generated.rows || tx < 0 || tx >= scene.generated.cols) continue;
    if (scene.generated.data[ty][tx] !== 1) continue;
    scene.terrain.removeTileAt(tx, ty, true, true);
    scene.generated.data[ty][tx] = -1;
    const veinMark = scene.veinMarks?.get(`${tx},${ty}`);
    if (veinMark) { veinMark.destroy(); scene.veinMarks.delete(`${tx},${ty}`); }
    removed += 1;
    if (scene.rubble && removed <= 30) scene.rubble.explode(1, tx * TILE + TILE / 2, ty * TILE + TILE / 2);
  }
  return removed;
}

export function updateWorldDynamics(scene, time, dt) {
  if (scene.ending) return;
  scene.bombsGroup?.children.iterate(bomb => {
    if (!bomb?.active) return;
    const remaining = bomb.detonatesAt - time;
    bomb.setTint(remaining < 500 && Math.floor(time / 70) % 2 ? 0xffffff : remaining < 1100 && Math.floor(time / 150) % 2 ? 0xff6b55 : 0xffffff);
    bomb.angle += bomb.body.velocity.x * 0.05;
    if (remaining <= 0) scene.detonateBomb(bomb);
  });
  scene.coinsGroup.children.iterate(coin => {
    if (!coin || !coin.active) return;
    coin.y += Math.sin(time * 0.004 + coin.phase) * 0.08;
    coin.angle += 1.5;
  });
  scene.fragmentsGroup.children.iterate(shard => {
    if (!shard || !shard.active) return;
    shard.y += Math.sin(time * 0.003 + shard.phase) * 0.1;
    shard.angle += 0.8;
  });
  scene.sporesGroup.children.iterate(spore => {
    if (!spore || !spore.active) return;
    spore.y += Math.sin(time * 0.0035 + spore.phase) * 0.06;
  });
  scene.bouldersGroup.children.iterate(rock => {
    if (!rock || !rock.active) return;
    if (rock.sleepingStone && Math.abs(rock.x - scene.player.x) < 76 && scene.player.y > rock.y && scene.player.y - rock.y < 390) {
      rock.sleepingStone = false;
      rock.body.allowGravity = true;
      rock.setVelocity(Phaser.Math.Between(-45, 45), 40);
      scene.showMessage("El argumento rueda cuesta abajo.", 1600);
      scene.cameras.main.shake(80, 0.003);
    }
    rock.angle += rock.body.velocity.x * 0.035;
    rock.impactSpeed = Math.max(rock.impactSpeed || 0, Math.abs(rock.body.velocity.x) + Math.abs(rock.body.velocity.y));
  });

  if (scene.levelInfo.key === "jungle" && scene.perceptionTimer > 0) {
    scene.perceptionTimer = Math.max(0, scene.perceptionTimer - dt);
    scene.inverted = scene.perceptionTimer > 0 && Math.floor(time / 950) % 2 === 0;
  } else {
    scene.inverted = false;
  }

  if (scene.levelInfo.key === "volcano") {
    let inLava = false;
    for (const zone of scene.lavaZones) {
      if (scene.physics.overlap(scene.player, zone)) inLava = true;
    }
    const onMainRoute = scene.generated.mainCorridors.some(r => rectsOverlap(scene.player.body, r, 8));
    scene.heat = clamp(scene.heat + dt * (inLava ? 0.09 : onMainRoute ? -0.015 : 0.007), 0, 120);
    if (scene.ending) return;
    if (inLava && time - scene.lastDamageAt > 460) {
      scene.takeDamage(2, "lava");
      if (scene.ending) return;
    }
    if (scene.heat >= 100 && time - scene.lastDamageAt > 900) {
      if (scene.ending) return;
      scene.takeDamage(1, "heat");
      if (scene.ending) return;
      scene.heat = 55;
    }
    scene.drawLava(time);
  }

  if (scene.godPowerTimer > 0) {
    scene.godPowerTimer = Math.max(0, scene.godPowerTimer - dt);
    if (time % 120 < 20) scene.blue.explode(1, scene.player.x, scene.player.y + 2);
    if (scene.godPowerTimer === 0) scene.bottledPyre = false;
  }
}

export function drawLava(scene, time) {
  if (!scene.lavaGraphics) return;
  scene.lavaGraphics.clear();
  for (const lava of scene.generated.lava) {
    scene.lavaGraphics.fillStyle(0xff3f2e, 0.82);
    scene.lavaGraphics.fillRoundedRect(lava.x, lava.y, lava.width, lava.height, 4);
    scene.lavaGraphics.fillStyle(0xffd464, 0.72);
    for (let x = lava.x; x < lava.x + lava.width; x += 18) {
      const y = lava.y + 4 + Math.sin(time * 0.008 + x * 0.08) * 3;
      scene.lavaGraphics.fillCircle(x + 8, y, 4);
    }
  }
}

export function updateLighting(scene, time) {
  const sw = screenW(scene);
  const sh = screenH(scene);
  const baseRadius = 215 + scene.meta.lightBonus * 34;
  const levelPenalty = scene.levelInfo.darkness * 120;
  const sporePenalty = scene.perceptionTimer > 0 ? 78 : 0;
  const normalRadius = clamp(baseRadius - levelPenalty - sporePenalty + (scene.godPowerTimer > 0 ? 82 : 0), 120, 380);
  const radius = scene.riskFog ? normalRadius * 0.5 : normalRadius;
  const cam = scene.cameras.main;
  const px = scene.player.x - cam.scrollX;
  const py = scene.player.y - cam.scrollY;
  scene.darkness.clear();
  scene.darkness.fillStyle(0x020309, scene.levelInfo.darkness + (scene.perceptionTimer > 0 ? 0.15 : 0));
  scene.darkness.fillRect(0, 0, sw, sh);
  scene.lightGlow.clear();
  scene.lightGlow.fillStyle(scene.levelInfo.accent, 0.08);
  scene.lightGlow.fillCircle(px, py, radius);
  scene.lightGlow.fillStyle(0xffffff, 0.04);
  scene.lightGlow.fillCircle(px, py, radius * 0.58 + Math.sin(time * 0.003) * 8);
}

export function collectCoin(scene, player, coin) {
  if (scene.ending) return;
  coin.disableBody(true, true);
  scene.coins += scene.abyssBagCharges > 0 ? 2 : 1;
  if (scene.abyssBagCharges > 0) scene.abyssBagCharges -= 1;
  scene.spark.explode(8, coin.x, coin.y);
  AUDIO.coin();
  if (scene.levelInfo.key === "desert" && scene.coins % 5 === 0) {
    scene.showMessage("La riqueza se instala en tus huesos.", 1600);
  }
}

export function collectFragment(scene, player, shard) {
  if (scene.ending) return;
  if (!shard.active) return;
  if (shard.dramaticId) {
    const route = scene.generated.dramaticRoutes.find(r => r.id === shard.dramaticId);
    if (!route?.unlocked) return;
    route.collected = true;
    const entry = scene.dramaticLabels.find(item => item.route.id === route.id);
    if (entry) entry.label.setText("RUTA DRAMÁTICA\nOFRENDA RECORDADA");
  }
  shard.disableBody(true, true);
  scene.runFragments += 1;
  setRunFragmentBank(scene.runFragments);
  scene.blue.explode(16, shard.x, shard.y);
  AUDIO.fragment();
  scene.showMessage("Un pensamiento sobrevive al cuerpo.", 1500);
}

export function touchSpore(scene, player, spore) {
  if (scene.ending) return;
  spore.disableBody(true, true);
  scene.perceptionTimer = 7600;
  scene.sporeMist.explode(28, spore.x, spore.y);
  AUDIO.tone(220, 0.18, "triangle", 0.09, 220);
  scene.showMessage("La selva toma prestada tu certeza.", 2100);
}
