// Sistema de HUD - Alma en Blanco (Fase 3)
// Extraído de src/escenas/GameScene.js. Funciones puras que reciben `scene`.
// Rediseño UI "indie premium": sin cajas contenedoras; íconos flotantes generados
// procedimentalmente en art_data.js (nada de imágenes .png ni emojis).

import { TOTAL_STAGES, LAW_DEFS } from "../core/constantes.js";
import { screenW, screenH } from "../core/utils.js";
import { inflationMultiplier, inflatedPrice, lawActive, effectiveCoinBurden, playerMoveSpeed } from "../core/guardado.js";

// Ítems de inventario con ícono propio. `test(scene)` decide si se muestran.
// Orden = orden de alineación horizontal (estable, sin saltos).
const ITEM_SLOTS = [
  { key: "ui-item-feather",  test: s => !!s.featherBoots },
  { key: "ui-item-mirror",   test: s => !!s.guardianMirror },
  { key: "ui-item-dynamite", test: s => (s.bombs || 0) > 0 },
  // Daga: textura ya generada en art_data.js, pero aún no existe estado
  // "daga en posesión" (se consume al comprarla). Para activarla después:
  // { key: "ui-item-dagger", test: s => !!s.hasDagger },
];

const HP_BASE = 5;     // vidas máximas base
const ICON_GAP = 30;   // separación horizontal entre íconos (px)

// Crea un ícono flotante con una silueta (sombra) detrás para separarlo del fondo.
function addFloatingIcon(scene, texture) {
  const shadow = scene.add.image(0, 0, texture)
    .setTint(0x000000).setAlpha(0.32).setOrigin(0, 0)
    .setScrollFactor(0).setDepth(900).setVisible(false);
  const icon = scene.add.image(0, 0, texture)
    .setOrigin(0, 0).setScrollFactor(0).setDepth(901).setVisible(false);
  return { icon, shadow };
}

export function createHud(scene) {
  const sw = screenW(scene);
  const sh = screenH(scene);

  // Sin barra contenedora: el texto flota con stroke + sombra para leerse.
  scene.hudText = scene.add.text(16, 16, "", {
    fontFamily: "monospace",
    fontSize: `${sw < 520 ? 11 : 14}px`,
    color: "#eefcff",
    stroke: "#04121a",
    strokeThickness: sw < 520 ? 3 : 4,
    shadow: { offsetX: 1, offsetY: 2, color: "#000000", blur: 4, fill: true },
    lineSpacing: sw < 520 ? 2 : 4,
    wordWrap: { width: Math.min(468, sw - 24) }
  }).setScrollFactor(0).setDepth(901);

  scene.promptText = scene.add.text(sw / 2, sh - 86, "", {
    fontFamily: "monospace",
    fontSize: `${sw < 520 ? 12 : 15}px`,
    color: "#f7fbff",
    align: "center",
    backgroundColor: "rgba(2, 5, 12, 0.58)",
    padding: { left: 14, right: 14, top: 8, bottom: 8 },
    wordWrap: { width: Math.min(650, sw - 34) }
  }).setOrigin(0.5).setScrollFactor(0).setDepth(902);

  scene.lawText = scene.add.text(sw - 22, 20, "", {
    fontFamily: "monospace",
    fontSize: "13px",
    color: "#9fb1bb",
    align: "right",
    lineSpacing: 5
  }).setOrigin(1, 0).setScrollFactor(0).setDepth(901);

  scene.pauseBtn = scene.add.text(sw - 16, 20, "❚❚", {
    fontFamily: "monospace",
    fontSize: `${screenW(scene) < 520 ? 13 : 15}px`,
    color: "#eefcff",
    backgroundColor: "rgba(2, 5, 12, 0.72)",
    padding: { left: 10, right: 10, top: 7, bottom: 7 }
  }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(903).setInteractive({ useHandCursor: true });
  scene.pauseBtn.on("pointerdown", () => scene.pauseGame());

  if (scene.isCustomSeed) {
    scene.customSeedTag = scene.add.text(24, 122, "Modo Libre: Progreso desactivado", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#ff4766",
      backgroundColor: "rgba(4, 6, 11, 0.6)",
      padding: { left: 6, right: 6, top: 3, bottom: 3 }
    }).setScrollFactor(0).setDepth(902);
  }

  // Íconos de vida (HP)
  scene.healthIcons = [];
  for (let i = 0; i < HP_BASE; i += 1) {
    scene.healthIcons.push(addFloatingIcon(scene, "ui-health-active"));
  }

  // Íconos de inventario
  scene.itemIcons = ITEM_SLOTS.map(slot => addFloatingIcon(scene, slot.key));

  scene.darkness = scene.add.graphics().setScrollFactor(0).setDepth(850);
  scene.lightGlow = scene.add.graphics().setScrollFactor(0).setDepth(851);

  scene.layoutHud();
  scene.scale.on("resize", scene.layoutHud, scene);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.scale.off("resize", scene.layoutHud, scene));
}

export function layoutHud(scene) {
  if (!scene.healthIcons) return;
  const sw = screenW(scene);
  const sh = screenH(scene);
  const narrow = sw < 620 || sh < 460;
  const short = sh < 460;
  const fineHover = window.matchMedia("(pointer: fine)").matches && window.matchMedia("(hover: hover)").matches;
  const likelyTouch = window.matchMedia("(pointer: coarse)").matches || window.matchMedia("(any-pointer: coarse)").matches || (navigator.maxTouchPoints > 0 && !fineHover) || sw < 640 || sh < 460;
  const hudW = Math.min(468, sw - 24);
  const hpX = 16, hpY = 14, itemY = hpY + 32, textY = itemY + 34;

  scene.healthIcons.forEach((slot, i) => {
    slot.icon.setPosition(hpX + i * ICON_GAP, hpY);
    slot.shadow.setPosition(hpX + i * ICON_GAP + 2, hpY + 2);
  });
  scene.itemIcons.forEach((slot, i) => {
    slot.icon.setPosition(hpX + i * ICON_GAP, itemY);
    slot.shadow.setPosition(hpX + i * ICON_GAP + 2, itemY + 2);
  });

  scene.hudText.setPosition(16, textY);
  scene.hudText.setFontSize(narrow ? 11 : 14);
  scene.hudText.setWordWrapWidth(hudW);

  scene.promptText.setOrigin(short ? 1 : 0.5, short ? 0 : 1);
  scene.promptText.setPosition(short ? sw - 12 : sw / 2, short ? 14 : sh - (likelyTouch ? 205 : 56));
  scene.promptText.setFontSize(narrow ? 12 : 15);
  scene.promptText.setWordWrapWidth(short ? Math.max(140, sw - hudW - 68) : Math.min(650, sw - 64));
  scene.lawText.setPosition(sw - 22, scene.pauseBtn.y + scene.pauseBtn.height / 2 + 12);
  scene.lawText.setVisible(sw >= 760 && !short);
  if (scene.customSeedTag) {
    scene.customSeedTag.setPosition(16, textY + 96);
  }
}

// Actualiza los 5 íconos de vida según hp/maxHp. Tween opcional al perder un HP.
function refreshHealthIcons(scene) {
  const hp = Math.max(0, scene.hp || 0);
  const maxHp = Math.max(0, scene.maxHp || 0);
  const prev = scene._lastHudHp;
  scene.healthIcons.forEach((slot, i) => {
    const texture = i < hp ? "ui-health-active" : "ui-health-empty";
    const visible = i < maxHp;
    slot.icon.setTexture(texture).setVisible(visible);
    slot.shadow.setTexture(texture).setVisible(visible);
  });
  if (prev !== undefined && hp < prev && scene.tweens) {
    for (let i = hp; i < prev && i < scene.healthIcons.length; i += 1) {
      const icon = scene.healthIcons[i].icon;
      icon.setScale(0.55);
      scene.tweens.add({ targets: icon, scale: 1, duration: 200, ease: "Back.easeOut" });
    }
  }
  scene._lastHudHp = hp;
}

// Actualiza la fila de íconos de inventario según los ítems en posesión.
function refreshItemIcons(scene) {
  ITEM_SLOTS.forEach((slot, i) => {
    const visible = slot.test(scene);
    scene.itemIcons[i].icon.setVisible(visible);
    scene.itemIcons[i].shadow.setVisible(visible);
  });
}

export function updateHud(scene, time, dt) {
  const coinBurden = scene.featherBoots ? 0 : effectiveCoinBurden(scene.coins, scene.meta);
  const effectiveGravity = Math.round(scene.physics.world.gravity.y + coinBurden * (scene.debtMass || 1));
  const speed = Math.round((playerMoveSpeed(scene.featherBoots ? 0 : scene.coins, scene.meta, scene.godPowerTimer) + (time < scene.absorptionUntil ? 28 : 0)) * (scene.carried ? 0.9 : 1));
  const perception = time < scene.doubtUntil ? `invertida ${Math.ceil((scene.doubtUntil - time) / 1000)}s` : scene.levelInfo.key === "jungle"
    ? (scene.perceptionTimer > 0 ? (scene.inverted ? "invertida" : "expandida") : "clara")
    : "clara";
  const heat = scene.levelInfo.key === "volcano" ? ` · Calor ${Math.round(scene.heat)}%` : "";
  const power = scene.godPowerTimer > 0 ? ` · Fuego divino ${Math.ceil(scene.godPowerTimer / 1000)}s` : "";
  const absorption = time < scene.absorptionUntil ? `\nAbsorción ${Math.ceil((scene.absorptionUntil - time) / 1000)}s · Vel. +28 · Salto +48` : "";

  // --- Íconos de vida e inventario (sin texto) ---
  refreshHealthIcons(scene);
  refreshItemIcons(scene);

  // Estados sin ícono propio (temporales o pendientes de textura): texto compacto sin emojis.
  const statusItems = [
    scene.abyssBagCharges ? `Bolsa ${scene.abyssBagCharges}` : "",
    scene.certaintyAnchor ? "Ancla" : "",
    scene.bottledPyre ? "Pira" : "",
    time < scene.riskJumpUntil ? `Salto ${Math.ceil((scene.riskJumpUntil - time) / 1000)}s` : "",
    time < scene.riskInvulnerableUntil ? `Invulnerable ${Math.ceil((scene.riskInvulnerableUntil - time) / 1000)}s` : "",
    scene.riskFog ? "Visión -50%" : ""
  ].filter(Boolean);

  scene.hudText.setText([
    `Nivel ${scene.worldNumber}-${scene.substage} · ${scene.levelInfo.name}`,
    `${scene.levelInfo.concept}`,
    `Oro ${scene.coins} · Bombas ${scene.bombs} · Fragmentos ${scene.runFragments}`,
    `Peso +${coinBurden}${scene.creditPact ? " · Deuda +10%" : ""} · Vel. ${speed} · Gravedad ${effectiveGravity}`,
    `Percepción: ${perception}${heat}${power}${absorption}${statusItems.length ? `\nEstados: ${statusItems.join(" · ")}` : ""}`
  ]);
  scene.lawText.setText(`INFLACIÓN M${scene.worldNumber}: ${inflationMultiplier(scene.worldNumber).toFixed(1)}x\n` +
    LAW_DEFS.map(law => `${law.short} ${scene.meta[law.key] ? (lawActive(scene.meta, law.key) ? "●" : "○") : "·"}`).join("\n"));

  scene.nearPrompt = "";
  if (scene.graceAvailable) scene.nearPrompt = "El camino se ha cerrado. E: Desvanecerse";
  else if (scene.carried) scene.nearPrompt = `${scene.carried.type === "symbolic" ? "Pensamiento" : "Objeto"} sostenido · »: lanzar · Abajo+»: depositar · E: soltar`;
  else if (scene.actionHoldStartedAt) scene.nearPrompt = `Disolución del Ego ${Math.min(100, Math.round((time - scene.actionHoldStartedAt) / 25))}%`;
  else if (scene.nearPortable) scene.nearPrompt = "E: Levantar objeto";
  else if (scene.nearExit) scene.nearPrompt = scene.levelNumber === TOTAL_STAGES ? "E: trascender" : "E: seguir descendiendo";
  else if (scene.nearMerchant) {
    scene.nearPrompt = `MERCADER · ${scene.merchantOffers()[scene.merchantSelection].label} · E/Acción: comprar · »/Mayús: cambiar`;
  }
  else if (scene.nearSpecial) scene.nearPrompt = scene.nearSpecial.used ? "La sala especial está en silencio." : scene.nearSpecial.type === "barter"
    ? "ALTAR DEL TRUEQUE · E: 8 oro → 2 vida, o 2 vida → 3 fragmentos"
    : "POZO DEL RIESGO · E: poder temporal por visión y certeza";
  else if (scene.nearDramatic) {
    scene.nearPrompt = scene.nearDramatic.unlocked
      ? "Salto de renuncia: entrá y mantené el salto desde la flecha."
      : `RUTA DRAMÁTICA · E: ${scene.coins ? `ofrecer ${scene.coins} monedas` : "ofrecer 1 vida"}${scene.levelInfo.key === "volcano" ? " · » / Mayús: romper por 1 vida" : ""}`;
  }
  else if (scene.nearAltar) {
    const price = inflatedPrice(scene.worldNumber);
    scene.nearPrompt = scene.hp >= scene.maxHp ? "El altar no puede curar una vida completa." :
      scene.coins >= price ? `E: curar 1 HP por ${price} monedas` : `El altar pide ${price} monedas por 1 HP.`;
  }
  else if (scene.nearGod) scene.nearPrompt = "E: negociar · » / Mayús: absorber poder arriesgado";
  else if (scene.nearSymbolic) scene.nearPrompt = scene.nearSymbolic.vulnerable(time)
    ? `${scene.nearSymbolic.names[scene.nearSymbolic.kind]} · E: absorber (${scene.coins >= 3 ? "3 monedas" : "1 vida"})`
    : `${scene.nearSymbolic.names[scene.nearSymbolic.kind]} · » / Mayús: disipar`;
  else if (scene.levelInfo.key === "volcano") scene.nearPrompt = "E: gastar 1 vida para romper muros cercanos";
  else scene.nearPrompt = "RUTA PRINCIPAL · El peso no cierra la salida.";

  if (scene.messageTimer > 0) {
    scene.messageTimer -= dt;
    scene.promptText.setText(scene.currentMessage);
  } else {
    scene.promptText.setText(scene.nearPrompt);
  }
  scene.promptText.setVisible(Boolean(scene.promptText.text));
}

export function showMessage(scene, text, duration = 1600) {
  scene.currentMessage = text;
  scene.messageTimer = duration;
}
