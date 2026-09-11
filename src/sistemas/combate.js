// Sistema de combate simbolico - Alma en Blanco (Fase 3)
// Extraído de src/escenas/GameScene.js. Funciones puras que reciben `scene`.

import { rectsOverlap, makeRect } from "../core/utils.js";
import { trapMultiplier, setRunFragmentBank } from "../core/guardado.js";
import { AUDIO } from "../audio/AudioEngine.js";

export function spawnSymbolicAttack(scene, owner, type, x, y, vx, vy, duration) {
  if (scene.ending) return;
  const graphics = scene.add.graphics().setDepth(12);
  scene.symbolicAttacks.push({ owner, type, x, y, vx, vy, born: scene.time.now,
    expires: scene.time.now + duration, hit: false, gravity: type === "coinRain" ? 260 : 0, graphics });
}

export function parryAttack(scene, owner, time, attack = null) {
  if (attack) {
    attack.graphics.destroy();
    attack.dead = true;
  }
  owner.stunnedUntil = Math.max(owner.stunnedUntil, time + 1500);
  owner.windupUntil = 0; owner.attackAt = 0; owner.chargeUntil = 0;
  scene.dashReadyAt = Math.min(scene.dashReadyAt, time + 360);
  scene.blue.explode(18, scene.player.x, scene.player.y);
  scene.showMessage("Parry simbólico: ataque disipado; pensamiento aturdido.", 1700);
  AUDIO.dash();
}

export function updateSymbolicAttacks(scene, time, dt) {
  if (scene.ending) return;
  if (!scene.symbolicAttacks) scene.symbolicAttacks = [];
  const playerRect = scene.player.body;
  for (const attack of scene.symbolicAttacks) {
    if (scene.ending) return;
    if (attack.dead) continue;
    attack.x += attack.vx * dt / 1000;
    attack.y += attack.vy * dt / 1000;
    attack.vy += (attack.gravity || 0) * dt / 1000;
    attack.graphics.clear();
    const rect = attack.type === "pillar"
      ? makeRect(attack.x - 18, attack.y - 250, 36, 500)
      : attack.type === "lasso" ? makeRect(attack.x - 15, attack.y - 9, 30, 18)
      : makeRect(attack.x - 7, attack.y - 7, 14, 14);
    if (attack.type === "pillar") {
      attack.graphics.fillStyle(0xff5b32, 0.72).fillRect(rect.x, rect.y, rect.width, rect.height);
      attack.graphics.fillStyle(0xffd45e, 0.85).fillRect(attack.x - 5, rect.y, 10, rect.height);
    } else if (attack.type === "lasso") {
      attack.graphics.lineStyle(2, 0xffce66, 0.78);
      attack.graphics.lineBetween(attack.owner.x, attack.owner.y - 8, attack.x, attack.y);
      attack.graphics.strokeCircle(attack.x, attack.y, 13);
    } else {
      attack.graphics.fillStyle(0xffce66, 0.95).fillCircle(attack.x, attack.y, 7);
    }
    if (rectsOverlap(playerRect, rect)) {
      if (time < scene.dashUntil) scene.parryAttack(attack.owner, time, attack);
      else if (attack.type === "lasso") {
        const stolen = Math.min(2, scene.coins);
        scene.coins -= stolen;
        attack.owner.storedCoins += stolen;
        attack.owner.lassoActiveUntil = 0;
        attack.hit = true; attack.dead = true; attack.graphics.destroy();
        scene.showMessage(stolen ? `El lazo arrastra ${stolen} monedas hacia El Acreedor.` : "El lazo encuentra tus bolsillos vacíos.", 1600);
      }
      else {
        attack.hit = true; attack.dead = true; attack.graphics.destroy();
        scene.takeDamage(1, "symbolic");
        if (scene.ending) return;
      }
    } else if (time >= attack.expires) {
      attack.dead = true; attack.graphics.destroy();
      if (attack.type === "lasso") attack.owner.lassoActiveUntil = 0;
      if (!attack.hit && attack.owner.state === "active") attack.owner.stunnedUntil = Math.max(attack.owner.stunnedUntil, time + 1500);
    }
  }
  scene.symbolicAttacks = scene.symbolicAttacks.filter(attack => !attack.dead);
}

export function updateProximity(scene) {
  // Requerimiento #2: si el juego ya está acabando, ocultá el prompt de
  // proximidad al instante y NO evalúes distancias contra un jugador muerto.
  if (scene.ending) {
    scene.promptText?.setText("").setVisible(false);
    return;
  }
  scene.nearSymbolic = (scene.symbolicEntities || []).filter(entity => entity.state === "active" &&
    Math.hypot(scene.player.x - entity.x, scene.player.y - entity.y) < 76)
    .sort((a, b) => Math.hypot(scene.player.x - a.x, scene.player.y - a.y) - Math.hypot(scene.player.x - b.x, scene.player.y - b.y))[0] || null;
  scene.nearStunned = (scene.symbolicEntities || []).filter(entity => entity.state === "active" && entity.stunnedUntil > scene.time.now &&
    Math.hypot(scene.player.x - entity.x, scene.player.y - entity.y) < 65)
    .sort((a, b) => Math.hypot(scene.player.x - a.x, scene.player.y - a.y) - Math.hypot(scene.player.x - b.x, scene.player.y - b.y))[0] || null;
  scene.nearPortable = scene.nearStunned ? { type: "symbolic", target: scene.nearStunned, distance: Math.hypot(scene.player.x - scene.nearStunned.x, scene.player.y - scene.nearStunned.y) } : scene.nearbyPortable(false);
  scene.portableHalo?.clear();
  if (scene.nearPortable) {
    const object = scene.nearPortable.target;
    scene.portableHalo?.lineStyle(1.5, 0x8af0b0, 0.38);
    scene.portableHalo?.strokeCircle(object.x, object.y, 26 + Math.sin(scene.time.now * 0.008) * 3);
  }
  scene.nearExit = scene.physics.overlap(scene.player, scene.exitDoor);
  scene.nearMerchant = Boolean(scene.generated.merchant &&
    Math.hypot(scene.player.x - scene.generated.merchant.x, scene.player.y - scene.generated.merchant.y) < 92);
  scene.nearSpecial = scene.generated.specialRooms.find(room =>
    Math.hypot(scene.player.x - room.x, scene.player.y - room.y) < 92) || null;
  scene.nearAltar = null;
  scene.altarsGroup.children.iterate(altar => {
    if (!altar || !altar.active) return;
    if (Phaser.Math.Distance.Between(scene.player.x, scene.player.y, altar.x, altar.y) < 80) scene.nearAltar = altar;
  });
  // La fuente de salud mana un flujo sutil de agua mientras el Alma está cerca
  if (scene.altarWater) {
    if (scene.nearAltar) {
      scene.altarWater.x = scene.nearAltar.x;
      scene.altarWater.y = scene.nearAltar.y - 8;
      scene.altarWater.emitting = true;
    } else {
      scene.altarWater.emitting = false;
    }
  }
  scene.nearGod = Boolean(scene.godZone && scene.physics.overlap(scene.player, scene.godZone));
  scene.nearDramatic = scene.generated.dramaticRoutes.find(r =>
    !r.collected && Math.abs(scene.player.x - r.x) < 110 && Math.abs(scene.player.y - r.y) < 80) || null;
  if (scene.nearDramatic && !scene.nearDramatic.unlocked && scene.warnedDramaticId !== scene.nearDramatic.id) {
    scene.warnedDramaticId = scene.nearDramatic.id;
    scene.showMessage("RUTA DRAMÁTICA: el salto común no alcanza. E: ofrecer tu oro (o 1 vida).", 3800);
  }
}

export function absorbSymbolic(scene, entity, time) {
  if (entity.state !== "active" || Math.hypot(scene.player.x - entity.x, scene.player.y - entity.y) >= 76) return false;
  if (!entity.vulnerable(time)) {
    scene.showMessage(`${entity.names[entity.kind]} está alerta. Esperá el halo verde o acercate por detrás.`, 2000);
    return false;
  }
  if (scene.coins < 3 && scene.hp <= 1) {
    scene.showMessage("Absorber exige 3 monedas o una vida que puedas entregar.", 2000);
    AUDIO.reject();
    return false;
  }
  const price = scene.coins >= 3 ? "3 monedas" : "1 vida";
  if (!entity.dissipate(time, true)) return false;
  if (scene.coins >= 3) scene.coins -= 3;
  else scene.hp -= 1;
  scene.absorptionUntil = time + 8000;
  scene.doubtUntil = 0;
  scene.perceptionTimer = 0;
  scene.inverted = false;
  scene.riskFog = false;
  scene.localGravityUntil = 0;
  scene.nearSymbolic = null;
  AUDIO.fragment();
  scene.showMessage(`Certidumbre absorbida: -${price}. Velocidad y salto aumentados durante 8 s.`, 2600);
  return true;
}

export function takeDamage(scene, amount, source) {
  // Requerimiento #1: primerísima línea. Blinda contra daño letal duplicado
  // y contra colisiones que se evalúan justo al morir (fix al Crash on Death).
  if (scene.ending || scene.hp <= 0) return false;
  const time = scene.time.now;
  if (source !== "abyss" && time < scene.invulnUntil) return;
  if (source !== "abyss" && scene.guardianMirror) {
    scene.guardianMirror = false;
    scene.invulnUntil = time + 650;
    scene.blue.explode(22, scene.player.x, scene.player.y);
    AUDIO.fragment();
    scene.showMessage("El Espejo Guardián absorbió el impacto.", 1700);
    return;
  }
  if (source !== "abyss" && scene.amnesiaReady) {
    scene.amnesiaReady = false;
    const zoneFragments = Math.max(0, scene.runFragments - scene.stageFragmentBase);
    scene.runFragments = scene.stageFragmentBase + Math.floor(zoneFragments * 0.5);
    setRunFragmentBank(scene.runFragments);
    scene.invulnUntil = time + 650;
    scene.blue.explode(22, scene.player.x, scene.player.y);
    AUDIO.fragment();
    scene.showMessage("Amnesia Selectiva: el golpe se olvida junto a la mitad de los fragmentos de zona.", 2300);
    return;
  }
  const scaled = source === "abyss" ? scene.hp : source === "heat" ? amount : Math.max(1, Math.round(amount * trapMultiplier(scene.meta)));
  scene.hp = Math.max(0, scene.hp - scaled);
  scene.lastDamageAt = time;
  if (scene.hp <= 0) {
    scene.die();
    return;
  }
  if (scene.ending) return;
  scene.invulnUntil = time + 900;
  scene.player.setTint(0xff5b67);
  scene.time.delayedCall(120, () => {
    if (scene.ending) return;
    if (scene.player?.active) scene.player.clearTint();
  });
  scene.cameras.main.shake(100, 0.005);
  scene.dust.explode(16, scene.player.x, scene.player.y);
  AUDIO.hurt();
  scene.showMessage(source === "spikes" ? "El sentido tiene filos." : source === "lava" ? "El poder quema aquello que lo sostiene." : "El mundo responde con fuerza.", 1300);
  if (scene.ending) return;
}
