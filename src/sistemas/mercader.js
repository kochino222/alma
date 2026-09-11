// Sistema del mercader - Alma en Blanco (Fase 3)
// Extraído de src/escenas/GameScene.js. Funciones puras que reciben `scene`.

import { BASE_GRAVITY } from "../core/constantes.js";
import { gravityMultiplier, inflationMultiplier, inflatedPrice, daggerReward, setRunFragmentBank } from "../core/guardado.js";
import { AUDIO } from "../audio/AudioEngine.js";

export function cycleMerchant(scene) {
  scene.merchantSelection = (scene.merchantSelection + 1) % scene.merchantOffers().length;
  AUDIO.tone(330 + scene.merchantSelection * 55, 0.06, "square", 0.035);
  scene.showMessage(`Mercader: ${scene.merchantOffers()[scene.merchantSelection].label}`, 1400);
}

export function merchantOffers(scene) {
  const price = inflatedPrice(scene.worldNumber);
  return [
    { key: "feather", label: `Botas Pluma · ${price} oro` },
    { key: "mirror", label: `Espejo Guardián · ${price} oro` },
    { key: "bag", label: `Bolsa del Abismo · ${price} oro` },
    { key: "anchor", label: `Ancla de la Certeza · ${price} oro` },
    { key: "pyre", label: `Pira Embotellada · ${price} oro` },
    { key: "bombs", label: `Paquete de 3 bombas · ${price} oro` },
    { key: "heal", label: `Curación +1 HP · ${price} oro` },
    { key: "dagger", label: `Daga · 1 vida → ${daggerReward(scene.worldNumber)} oro` },
    { key: "credit", label: `Pacto de Crédito · +${Math.round(100 * inflationMultiplier(scene.worldNumber))} oro` }
  ];
}

export function buyMerchantItem(scene, time) {
  const offer = scene.merchantOffers()[scene.merchantSelection];
  const price = inflatedPrice(scene.worldNumber);
  if (offer.key === "feather") {
    if (scene.featherBoots) return scene.showMessage("Las Botas Pluma ya niegan el peso de este nivel.", 1600);
    if (scene.coins < price) return scene.rejectPurchase(`Las Botas Pluma cuestan ${price} monedas.`);
    scene.coins -= price; scene.featherBoots = true;
    scene.showMessage("Botas Pluma: el oro deja de pesar durante este nivel.", 2100);
  } else if (offer.key === "mirror") {
    if (scene.guardianMirror) return scene.showMessage("El Espejo Guardián ya espera un impacto.", 1600);
    if (scene.coins < price) return scene.rejectPurchase(`El Espejo Guardián cuesta ${price} monedas.`);
    scene.coins -= price; scene.guardianMirror = true;
    scene.showMessage("Espejo Guardián: el próximo daño será reflejado al vacío.", 2100);
  } else if (offer.key === "bag") {
    if (scene.abyssBagCharges > 0) return scene.showMessage("La Bolsa todavía recoge ecos de monedas.", 1500);
    if (scene.coins < price) return scene.rejectPurchase(`La Bolsa del Abismo cuesta ${price} monedas.`);
    scene.coins -= price; scene.abyssBagCharges = 15;
    scene.showMessage("Bolsa del Abismo: duplica las próximas 15 monedas.", 2000);
  } else if (offer.key === "anchor") {
    if (scene.certaintyAnchor) return scene.showMessage("El Ancla ya fija tu certeza en este nivel.", 1500);
    if (scene.coins < price) return scene.rejectPurchase(`El Ancla de la Certeza cuesta ${price} monedas.`);
    scene.coins -= price; scene.certaintyAnchor = true;
    scene.inverted = false; scene.doubtUntil = 0;
    scene.showMessage("Ancla de la Certeza: las inversiones ya no te gobiernan.", 2100);
  } else if (offer.key === "pyre") {
    if (scene.bottledPyre) return scene.showMessage("Ya llevás una Pira Embotellada.", 1500);
    if (scene.coins < price) return scene.rejectPurchase(`La Pira Embotellada cuesta ${price} monedas.`);
    scene.coins -= price; scene.bottledPyre = true;
    scene.godPowerTimer = Math.max(scene.godPowerTimer, 10000);
    scene.showMessage("Pira Embotellada: diez segundos de impulso abrasador.", 2100);
  } else if (offer.key === "bombs") {
    if (scene.coins < price) return scene.rejectPurchase(`Tres bombas cuestan ${price} monedas.`);
    scene.coins -= price; scene.bombs += 3;
    scene.showMessage("El Mercader entrega tres promesas con mecha.", 1900);
  } else if (offer.key === "heal") {
    if (scene.hp >= scene.maxHp) return scene.rejectPurchase("Tu vida ya está completa.");
    if (scene.coins < price) return scene.rejectPurchase(`Curarse cuesta ${price} monedas.`);
    scene.coins -= price; scene.hp = Math.min(scene.maxHp, scene.hp + 1);
    scene.showMessage(`Curación: ${price} monedas por 1 HP.`, 1700);
  } else if (offer.key === "dagger") {
    if (scene.sacrificeDaggerUsed) return scene.showMessage("La Daga ya cobró su única herida.", 1600);
    if (scene.hp <= 1) return scene.rejectPurchase("La Daga no toma la última vida.");
    const reward = daggerReward(scene.worldNumber);
    scene.hp -= 1; scene.coins += reward; scene.sacrificeDaggerUsed = true;
    scene.showMessage(`Daga de Sacrificio: una vida se convierte en ${reward} monedas.`, 2100);
  } else if (offer.key === "credit") {
    if (scene.creditPact) return scene.showMessage("La deuda ya conoce tu nombre.", 1700);
    const credit = Math.round(100 * inflationMultiplier(scene.worldNumber));
    scene.creditPact = true;
    scene.debtMass = 1.1;
    scene.maxHp = Math.max(1, scene.maxHp - 1);
    scene.hp = Math.min(scene.hp, scene.maxHp);
    scene.coins += credit;
    scene.physics.world.gravity.y = Math.round(BASE_GRAVITY * gravityMultiplier(scene.meta) * scene.debtMass);
    scene.spawnDebtCreditor();
    scene.showMessage(`Pacto firmado: +${credit} oro, -1 HP máximo y +10% peso de deuda.`, 3000);
  }
  scene.blue.explode(18, scene.generated.merchant.x, scene.generated.merchant.y);
  AUDIO.buy();
}

export function rejectPurchase(scene, message) {
  scene.showMessage(message, 1600); AUDIO.reject();
}

export function useSpecialRoom(scene, room, time) {
  if (room.used) return scene.showMessage("La sala ya pronunció su única respuesta.", 1600);
  if (room.type === "barter") {
    if (scene.coins >= 8 && scene.hp < scene.maxHp) {
      scene.coins -= 8; scene.hp = Math.min(scene.maxHp, scene.hp + 2);
      scene.showMessage("Trueque: 8 monedas por 2 vidas.", 2000);
    } else if (scene.hp > 2) {
      scene.hp -= 2; scene.runFragments += 3; setRunFragmentBank(scene.runFragments);
      scene.showMessage("Trueque: 2 vidas por 3 fragmentos de conciencia.", 2200);
    } else return scene.rejectPurchase("El altar pide 8 monedas y una herida abierta, o más de 2 vidas.");
  } else {
    if (scene.rng() < 0.5) {
      scene.invulnUntil = Math.max(scene.invulnUntil, time + 8000);
      scene.riskInvulnerableUntil = time + 8000;
      scene.showMessage("El Pozo concede 8 s de invulnerabilidad y toma la mitad de tu visión.", 2400);
    } else {
      scene.riskJumpUntil = time + 12000;
      scene.showMessage("El Pozo potencia tu salto durante 12 s y toma la mitad de tu visión.", 2400);
    }
    scene.riskFog = true;
    scene.doubtUntil = Math.max(scene.doubtUntil, time + 3500);
  }
  room.used = true;
  scene.blue.explode(28, room.x, room.y);
  AUDIO.altar();
}
