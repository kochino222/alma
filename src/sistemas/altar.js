// Sistema de altar y dios - Alma en Blanco (Fase 3)
// Extraído de src/escenas/GameScene.js. Funciones puras que reciben `scene`.

import { inflatedPrice, setRunFragmentBank } from "../core/guardado.js";
import { AUDIO } from "../audio/AudioEngine.js";

export function useAltar(scene) {
  const price = inflatedPrice(scene.worldNumber);
  if (scene.hp >= scene.maxHp) {
    scene.showMessage("El altar no encuentra una herida que cerrar.", 1500);
    AUDIO.reject();
    return;
  }
  if (scene.coins < price) {
    scene.showMessage(`El altar exige ${price} monedas por 1 HP.`, 1500);
    AUDIO.reject();
    return;
  }
  scene.coins -= price;
  scene.hp = Math.min(scene.maxHp, scene.hp + 1);
  scene.blue.explode(22, scene.nearAltar.x, scene.nearAltar.y);
  AUDIO.altar();
  scene.showMessage(`El altar devuelve 1 HP por ${price} monedas.`, 2000);
}

export function negotiateWithGod(scene) {
  if (scene.runFragments >= 3) {
    scene.completeRun();
    return;
  }
  if (scene.coins >= 10) {
    scene.coins -= 10;
    scene.runFragments += 2;
    setRunFragmentBank(scene.runFragments);
    scene.blue.explode(44, scene.player.x, scene.player.y);
    AUDIO.altar();
    scene.showMessage("Dios acepta la broma de la propiedad.", 2200);
    return;
  }
  scene.showMessage("Dios no dice nada. Quizá esa sea la respuesta.", 2200);
  AUDIO.tone(55, 0.4, "sine", 0.09, 0);
}

export function absorbGodPower(scene, time) {
  if (scene.runFragments < 1) {
    scene.showMessage("No queda conciencia para quemar.", 1600);
    AUDIO.reject();
    return;
  }
  scene.runFragments -= 1;
  setRunFragmentBank(scene.runFragments);
  scene.godPowerTimer = 8000;
  scene.invulnUntil = time + 500;
  scene.cameras.main.flash(220, 145, 247, 255);
  scene.cameras.main.shake(220, 0.006);
  scene.blue.explode(55, scene.player.x, scene.player.y);
  scene.destroyTerrainCircle(scene.player.x, scene.player.y, 2.35);
  AUDIO.fragment();
  if (scene.hp > 1 && scene.rng() < 0.35) {
    scene.hp -= 1;
    scene.showMessage("El poder de Dios no cabe bien en un cuerpo en blanco.", 2100);
  } else {
    scene.showMessage("Durante ocho segundos, se filtra la autoría.", 2100);
  }
}

export function sacrificeForRoute(scene, route, useLife = false) {
  if (route.unlocked) {
    scene.showMessage("Acceso abierto. Saltá desde la flecha y mantené el salto para alcanzar el fragmento.", 2800);
    return;
  }
  let price;
  if (!useLife && scene.coins > 0) {
    price = `${scene.coins} monedas`;
    scene.coins = 0;
  } else if (scene.hp > 1) {
    scene.hp -= 1;
    price = "1 vida";
  } else {
    scene.showMessage("Falta una ofrenda: oro o más de una vida. La ruta principal sigue abierta.", 2600);
    AUDIO.reject();
    return;
  }
  route.unlocked = true;
  scene.destructiblesGroup.children.iterate(wall => {
    if (wall?.active && wall.dramaticId === route.id) scene.breakWall(wall);
  });
  const entry = scene.dramaticLabels.find(item => item.route.id === route.id);
  if (entry) entry.label.setText("RUTA DRAMÁTICA\nSALTO DE RENUNCIA").setColor("#8af0b0");
  scene.blue.explode(20, route.x, route.y);
  AUDIO.altar();
  scene.showMessage(`Ofrenda: ${price}. Acceso abierto; mantené el salto desde la flecha.`, 3400);
}
