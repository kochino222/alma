// Sistema de destructibles - Alma en Blanco (Fase 3)
// Extraído de src/escenas/GameScene.js. Funciones puras que reciben `scene`.

import { TILE } from "../core/constantes.js";
import { randInt } from "../core/utils.js";
import { AUDIO } from "../audio/AudioEngine.js";

export function breakPot(scene, pot) {
  if (!pot?.active) return false;
  if (scene.carried?.target === pot) scene.carried = null;
  const x = pot.x, y = pot.y;
  pot.disableBody(true, true);
  scene.rubble.explode(12, x, y);
  const roll = scene.rng();
  if (roll < 0.15) {
    if (scene.rng() < 0.55) { scene.bombs += 1; scene.showMessage("La vasija ocultaba una bomba.", 1400); }
    else {
      const spore = scene.sporesGroup.create(x, y - 8, "spore");
      spore.body.setCircle(12, 2, 2); spore.phase = scene.rng() * Math.PI * 2;
      scene.showMessage("Una espora despierta entre la arcilla.", 1400);
    }
  } else {
    const count = randInt(scene.rng, 1, 3);
    for (let i = 0; i < count; i += 1) {
      const coin = scene.coinsGroup.create(x + (i - (count - 1) / 2) * 18, y - 8, "coin");
      coin.body.setCircle(10, 2, 2); coin.phase = scene.rng() * Math.PI * 2;
    }
  }
  AUDIO.noise(0.14, 0.09, 980);
  return true;
}

export function seismicLifeStrike(scene, time) {
  if (scene.ending) return;
  scene.hp -= 1;
  const removed = scene.destroyTerrainCircle(scene.player.x, scene.player.y + 10, 2);
  scene.destructiblesGroup.children.iterate(wall => {
    if (wall?.active && Math.hypot(wall.x - scene.player.x, wall.y - scene.player.y) < TILE * 2.2) scene.breakWall(wall, true);
  });
  scene.rubble.explode(30, scene.player.x, scene.player.y + 12);
  scene.cameras.main.shake(220, 0.011);
  AUDIO.demolition();
  scene.interactionConsumedUntil = time + 500;
  scene.showMessage(`Golpe sísmico: 1 vida abre ${removed} fragmentos de roca.`, 1900);
  if (scene.hp <= 0) scene.die();
}

export function breakCrate(scene, crate) {
  if (!crate?.active) return false;
  if (scene.carried?.target === crate) scene.carried = null;
  const x = crate.x, y = crate.y;
  crate.disableBody(true, true);
  scene.rubble.explode(8, x, y);
  if (scene.rng() < 0.35) {
    scene.bombs += 1;
    scene.showMessage("La caja escondía una bomba.", 1400);
  }
  return true;
}

export function crackWall(scene, rock, wall) {
  if (scene.ending) return;
  if (!wall.active) return;
  if (Math.abs(rock.body.velocity.x) + Math.abs(rock.body.velocity.y) > 180 || scene.godPowerTimer > 0) {
    scene.breakWall(wall);
  }
}

export function breakWall(scene, wall, force = false) {
  if (!wall || !wall.active) return false;
  if (!force && wall.dramaticId && !scene.generated.dramaticRoutes.find(r => r.id === wall.dramaticId)?.unlocked) return false;
  scene.spark.explode(18, wall.x, wall.y);
  wall.disableBody(true, true);
  AUDIO.noise(0.12, 0.12, 650);
  return true;
}

export function destructiveImpulse(scene, time) {
  if (scene.hp <= 1) {
    scene.showMessage("Solo queda una vida. El ego no encuentra crédito.", 1700);
    AUDIO.reject();
    return;
  }
  scene.hp -= 1;
  let broken = 0;
  scene.destructiblesGroup.children.iterate(wall => {
    if (wall && wall.active && Phaser.Math.Distance.Between(scene.player.x, scene.player.y, wall.x, wall.y) < 135) {
      if (scene.breakWall(wall)) broken += 1;
    }
  });
  scene.cameras.main.shake(170, 0.008);
  scene.spark.explode(36, scene.player.x, scene.player.y);
  scene.destroyTerrainCircle(scene.player.x, scene.player.y, 2.1);
  AUDIO.dash();
  scene.showMessage(broken ? "Entregás algo de vos y el mundo se abre." : "El poder florece sin un objeto.", 1900);
}
