// GameScene - Escena principal de juego - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)

import {
  LEVELS, TILE, BASE_GRAVITY, TOTAL_STAGES
} from "../core/constantes.js";
import {
  clamp, hashSeed, mulberry32
} from "../core/utils.js";
import {
  loadMeta, gravityMultiplier, lawActive, runFragmentBank, newRunId
} from "../core/guardado.js";
import { AUDIO } from "../audio/AudioEngine.js";
import { ProceduralMap } from "../mundo/ProceduralMap.js";
import { SymbolicEntity } from "../entidades/SymbolicEntity.js";
import { ControlRig } from "../controles/ControlRig.js";

import * as Mercader from "../sistemas/mercader.js";
import * as Destructibles from "../sistemas/destructibles.js";
import * as Manos from "../sistemas/manos.js";
import * as Hud from "../sistemas/hud.js";
import * as Altar from "../sistemas/altar.js";
import * as Progresion from "../sistemas/progresion.js";
import * as Combate from "../sistemas/combate.js";
import * as MundoDinamica from "../sistemas/mundo-dinamica.js";
import * as Interaccion from "../sistemas/interaccion.js";
import * as Movimiento from "../sistemas/movimiento.js";
import * as Construccion from "../sistemas/construccion.js";
const Between = Phaser.Math.Between;

export class GameScene extends Phaser.Scene {
  constructor() {
    super("Game");
  }

  init(data) {
    this.levelNumber = clamp(data.level || 1, 1, TOTAL_STAGES);
    this.worldNumber = Math.ceil(this.levelNumber / 2);
    this.substage = this.levelNumber % 2 ? 1 : 2;
    this.seed = data.seed || `blank-${Date.now()}`;
    this.runId = data.runId || newRunId();
    this.maxHp = clamp(data.maxHp || 5, 1, 5);
    this.hp = clamp(data.hp || 5, 1, this.maxHp);
    this.creditPact = Boolean(data.creditPact);
    this.debtMass = this.creditPact ? 1.1 : 1;
    this.coins = data.coins || 0;
    this.bombs = data.bombs ?? 3;
    this.runFragments = data.fragments || runFragmentBank();
    this.stageFragmentBase = this.runFragments;
    this.isCustomSeed = Boolean(data.isCustomSeed);
  }

  create() {
    this.meta = loadMeta();
    this.levelInfo = LEVELS[this.worldNumber - 1] || LEVELS[0];
    this.currentSeed = /^\d+$/.test(String(this.seed)) ? Number(this.seed) : hashSeed(String(this.seed));
    this.rng = mulberry32(this.currentSeed);
    this.cameras.main.fadeIn(350, 4, 6, 10);
    this.cameras.main.setBackgroundColor(Phaser.Display.Color.IntegerToColor(this.levelInfo.bgTop).rgba);
    this.physics.world.gravity.y = Math.round(BASE_GRAVITY * gravityMultiplier(this.meta) * this.debtMass);
    this.physics.world.TILE_BIAS = 24;
    this.invulnUntil = 0;
    this.lastDamageAt = -1000;
    this.lastGroundedAt = -9999;
    this.lastJumpPressAt = -9999;
    this.dashReadyAt = 0;
    this.dashUntil = 0;
    this.dashDirection = 1;
    this.doubtUntil = 0;
    this.staggerUntil = 0;
    this.absorptionUntil = 0;
    this.nearSymbolic = null;
    this.nearPortable = null;
    this.nearStunned = null;
    this.nearSpecial = null;
    this.nearMerchant = false;
    this.merchantSelection = 0;
    this.featherBoots = false;
    this.guardianMirror = false;
    this.sacrificeDaggerUsed = false;
    this.abyssBagCharges = 0;
    this.certaintyAnchor = false;
    this.bottledPyre = false;
    this.amnesiaReady = lawActive(this.meta, "selectiveAmnesia");
    this.airJumps = 1;
    this.inertiaUntil = 0;
    this.inertiaDirection = 0;
    this.fluidezAirUntil = 0;
    this.fluidezAirVelocity = 0;
    this.symbolicAttacks = [];
    this.playerHistory = [];
    this.idleGroundSince = 0;
    this.localGravityUntil = 0;
    this.riskFog = false;
    this.riskJumpUntil = 0;
    this.riskInvulnerableUntil = 0;
    this.nearPrompt = "";
    this.perceptionTimer = 0;
    this.inverted = false;
    this.heat = this.levelInfo.key === "volcano" ? 14 : 0;
    this.godPowerTimer = 0;
    this.ascentUntil = 0;
    this.walkDustTimer = 0;
    this.skidDustReadyAt = 0;
    this.maxFallSpeed = 0;
    this.landingFeelReadyAt = 0;
    this.nearDramatic = null;
    this.warnedDramaticId = null;
    this.carried = null;
    this.thrownEntities = [];
    this.actionHoldStartedAt = 0;
    this.channelToneAt = 0;
    this.confinementAnchor = null;
    this.confinedSince = 0;
    this.graceAvailable = false;
    this.interactionConsumedUntil = 0;
    this.usedExit = false;
    this.ending = false;
    this.onSlope = false;
    this.currentMessage = this.levelInfo.mantra;
    this.messageTimer = 4300;

    this.createBackground();
    this.generated = new ProceduralMap(this.currentSeed, this.levelInfo, this.meta, this.levelNumber).generate();
    this.createWorld();
    this.createEntities();
    this.createPlayer();
    this.createEffects();
    this.rubble = this.add.particles(0, 0, "particle-white", {
      lifespan: { min: 260, max: 620 }, speed: { min: 45, max: 210 }, gravityY: 420,
      tint: this.levelInfo.accent, scale: { start: 0.75, end: 0 }, alpha: { start: 0.8, end: 0 },
      maxParticles: 90, emitting: false
    }).setDepth(19);
    this.symbolicEntities = this.generated.symbolicSpawns.map(spawn => new SymbolicEntity(this, spawn));
    if (this.creditPact) this.spawnDebtCreditor();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const entity of this.symbolicEntities) entity.destroy();
      for (const attack of this.symbolicAttacks || []) attack.graphics?.destroy();
      this.symbolicAttacks = [];
      this.symbolicEntities = [];
      this.nearSymbolic = null;
    });
    this.createHud();
    if (!this.sys.game.__blankSoulPointersReady) {
      this.input.addPointer(4);
      this.sys.game.__blankSoulPointersReady = true;
    }
    this.controls = new ControlRig(this);
    this.setupCollisions();
    this.cameras.main.setBounds(0, 0, this.generated.cols * TILE, this.generated.rows * TILE);
    this.cameras.main.startFollow(this.player, true, 0.2, 0.15);
    this.configureCamera();
    this.scale.on("resize", this.configureCamera, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off("resize", this.configureCamera, this));
    this.physics.world.setBounds(0, 0, this.generated.cols * TILE, this.generated.rows * TILE + 360);
    this.input.on("pointerdown", () => { AUDIO.unlock(); AUDIO.setDrone(this.levelInfo); });
    this.input.keyboard.on("keydown", () => { AUDIO.unlock(); AUDIO.setDrone(this.levelInfo); });
    this.input.keyboard.on("keydown-ESC", this.pauseGame, this);
    this.input.keyboard.on("keydown-P", this.pauseGame, this);
    AUDIO.setDrone(this.levelInfo);
  }

  configureCamera() { return Construccion.configureCamera(this); }

  createBackground() { return Construccion.createBackground(this); }

  createWorld() { return Construccion.createWorld(this); }

  createEntities() { return Construccion.createEntities(this); }

  createSpecialSites() { return Construccion.createSpecialSites(this); }

  createGod() { return Construccion.createGod(this); }

  spawnDebtCreditor() { return Construccion.spawnDebtCreditor(this); }

  createPlayer() { return Construccion.createPlayer(this); }

  createEffects() { return Construccion.createEffects(this); }

  createHud() { return Hud.createHud(this); }

  layoutHud() { return Hud.layoutHud(this); }

  pauseGame() {
    if (this.ending) return;
    if (this.scene.isPaused("Game")) return;
    this.scene.pause();
    this.scene.launch("Pause", { seed: this.currentSeed });
  }

  setupCollisions() {
    this.physics.add.collider(this.player, this.terrain);
    this.physics.add.collider(this.cratesGroup, this.terrain, this.onPortableTerrainHit, null, this);
    this.physics.add.collider(this.cratesGroup, this.cratesGroup);
    this.physics.add.collider(this.bouldersGroup, this.terrain, this.onBoulderTerrainHit, null, this);
    this.physics.add.collider(this.bombsGroup, this.terrain);
    this.physics.add.collider(this.bombsGroup, this.cratesGroup);
    this.physics.add.collider(this.potsGroup, this.terrain, this.onPortableTerrainHit, null, this);
    this.physics.add.collider(this.potsGroup, this.destructiblesGroup, this.onPortableWallHit, null, this);
    this.physics.add.collider(this.potsGroup, this.cratesGroup);
    this.physics.add.collider(this.player, this.potsGroup, this.onPushCrate, null, this);
    this.physics.add.collider(this.bouldersGroup, this.spikesGroup, this.onPortableSpikeHit, null, this);
    this.physics.add.collider(this.cratesGroup, this.spikesGroup, this.onPortableSpikeHit, null, this);
    this.physics.add.collider(this.potsGroup, this.spikesGroup, this.onPortableSpikeHit, null, this);
    this.physics.add.collider(this.bouldersGroup, this.cratesGroup, this.onBoulderCrateHit, null, this);
    this.physics.add.collider(this.player, this.cratesGroup, this.onPushCrate, null, this);
    this.physics.add.collider(this.player, this.destructiblesGroup);
    this.physics.add.collider(this.cratesGroup, this.destructiblesGroup, this.onPortableWallHit, null, this);
    this.physics.add.collider(this.bouldersGroup, this.destructiblesGroup, this.crackWall, null, this);
    this.physics.add.overlap(this.player, this.coinsGroup, this.collectCoin, null, this);
    this.physics.add.overlap(this.player, this.fragmentsGroup, this.collectFragment, null, this);
    this.physics.add.overlap(this.player, this.spikesGroup, () => this.takeDamage(2, "spikes"), null, this);
    this.physics.add.overlap(this.player, this.bouldersGroup, this.onBoulderHit, null, this);
    this.physics.add.overlap(this.player, this.sporesGroup, this.touchSpore, null, this);
    this.physics.add.overlap(this.player, this.exitDoor, () => { this.nearExit = true; }, null, this);
  }

  update(time, delta) {
    if (this.ending) return;
    const dt = Math.min(delta, 40);
    const settle = Math.max(0, this.cameraSettleMs || 0) * 400 / 700;
    this.cameraSettleMs = Math.max(0, (this.cameraSettleMs || 0) - dt);
    // Dynamic lerp removed — using fixed values from startFollow (0.2, 0.15)
    // this.cameras.main.setLerp(1 - Math.exp(-dt / (150 + settle)), 1 - Math.exp(-dt / ((this.cameraPortrait ? 260 : 170) + settle)));
    this.nearExit = false;
    this.nearAltar = null;
    this.nearGod = false;
    this.resolveSlope();
    const controls = this.controls.read();
    if (controls.bombPressed) this.deployBomb(time);
    this.updateProximity();
    if (!this.certaintyAnchor && (this.inverted || time < this.doubtUntil)) controls.axis *= -1;
    if (time < this.staggerUntil) {
      controls.axis = 0;
      controls.jumpPressed = false;
      controls.up = controls.down = false;
    }
    this.handleLadders(controls);
    this.handleMovement(controls, time, dt);
    this.updatePlayerAnimation(time);
    if (this.ending) return;
    this.updateHandsRig?.(controls, time, dt);
    if (this.ending) return;
    for (const entity of this.symbolicEntities || []) {
      if (this.ending) return;
      entity.update(time, dt);
      if (this.ending) return;
    }
    this.updateSymbolicAttacks(time, dt);
    if (this.ending) return;
    this.updateProximity();
    this.handleInteractions(controls, time);
    if (this.ending) return;
    this.updateWorldDynamics(time, dt);
    if (this.ending) return;
    this.updateCaveSafeguards?.(controls, time, dt);
    if (this.ending) return;
    this.updateHud(time, dt);
    this.updateLighting(time);
    if (this.ending) return;
    this.checkDeathPlane();
    if (this.ending) return;

    // Camera jitter fix for roundPixels: snap scroll when player nearly stopped
    const cam = this.cameras.main;
    const vx = this.player?.body?.velocity?.x ?? 0;
    const vy = this.player?.body?.velocity?.y ?? 0;
    const speed = Math.hypot(vx, vy);
    if (speed < 8) {
      const targetX = this.player.x - cam.width / 2 + (cam.deadzone?.x ?? 0) + (cam.deadzone?.width ?? 0) / 2;
      const targetY = this.player.y - cam.height / 2 + (cam.deadzone?.y ?? 0) + (cam.deadzone?.height ?? 0) / 2;
      const dx = targetX - cam.scrollX;
      const dy = targetY - cam.scrollY;
      if (Math.abs(dx) < 0.5) cam.scrollX = Math.round(targetX);
      if (Math.abs(dy) < 0.5) cam.scrollY = Math.round(targetY);
    }
  }

  handleMovement(controls, time, dt) { return Movimiento.handleMovement(this, controls, time, dt); }

  // ══════════════════════════════════════════════════════════════════════════
  // ANIMACIÓN PROCEDURAL PULIDA (Paper-Doll Rig) — Optimizada para Game Feel
  // ══════════════════════════════════════════════════════════════════════════
  // Trigonometría pura para animar this.playerRig y this.rigParts.
  // NO toca físicas ni colisiones (solo visual). El flip se hace con scaleX.
  updatePlayerAnimation(time) { return Movimiento.updatePlayerAnimation(this, time); }

  squashPlayer(scaleX, scaleY, duration) { return Movimiento.squashPlayer(this, scaleX, scaleY, duration); }

  stabilizePlayerBody() { return Movimiento.stabilizePlayerBody(this); }

  spawnSymbolicAttack(owner, type, x, y, vx, vy, duration) { return Combate.spawnSymbolicAttack(this, owner, type, x, y, vx, vy, duration); }

  parryAttack(owner, time, attack = null) { return Combate.parryAttack(this, owner, time, attack); }

  updateSymbolicAttacks(time, dt) { return Combate.updateSymbolicAttacks(this, time, dt); }

  handleLadders(controls) { return Movimiento.handleLadders(this, controls); }

  resolveSlope() { return Movimiento.resolveSlope(this); }

  handleInteractions(controls, time) { return Interaccion.handleInteractions(this, controls, time); }

  nearbyPortable(includeSymbolic = true) { return Manos.nearbyPortable(this, includeSymbolic); }

  tryPickupNearby(time, includeSymbolic = true) { return Manos.tryPickupNearby(this, time, includeSymbolic); }

  updateHandsRig(controls, time, dt) { return Manos.updateHandsRig(this, controls, time, dt); }

  releaseCarried(soft, time) { return Manos.releaseCarried(this, soft, time); }

  dropCarried(time) { return Manos.dropCarried(this, time); }

  onPortableTerrainHit(object) { return Manos.onPortableTerrainHit(this, object); }

  onPortableWallHit(object) { return Manos.onPortableWallHit(this, object); }

  onPortableSpikeHit(object, spike) { return Manos.onPortableSpikeHit(this, object, spike); }

  breakPot(pot) { return Destructibles.breakPot(this, pot); }

  seismicLifeStrike(time) { return Destructibles.seismicLifeStrike(this, time); }

  hasVerticalEscape() { return Interaccion.hasVerticalEscape(this); }

  isCaveConfined() { return Interaccion.isCaveConfined(this); }

  updateCaveSafeguards(controls, time) { return Interaccion.updateCaveSafeguards(this, controls, time); }

  surrenderToAstral(reason) { return Progresion.surrenderToAstral(this, reason); }

  updateProximity() { return Combate.updateProximity(this); }

  absorbSymbolic(entity, time) { return Combate.absorbSymbolic(this, entity, time); }

  cycleMerchant() { return Mercader.cycleMerchant(this); }

  merchantOffers() { return Mercader.merchantOffers(this); }

  buyMerchantItem(time) { return Mercader.buyMerchantItem(this, time); }

  rejectPurchase(message) { return Mercader.rejectPurchase(this, message); }

  useSpecialRoom(room, time) { return Mercader.useSpecialRoom(this, room, time); }

  sacrificeForRoute(route, useLife = false) { return Altar.sacrificeForRoute(this, route, useLife); }

  deployBomb(time) { return MundoDinamica.deployBomb(this, time); }

  detonateBomb(bomb) { return MundoDinamica.detonateBomb(this, bomb); }

  destroyTerrainCircle(worldX, worldY, radiusTiles = 2.5) { return MundoDinamica.destroyTerrainCircle(this, worldX, worldY, radiusTiles); }

  breakCrate(crate) { return Destructibles.breakCrate(this, crate); }

  updateWorldDynamics(time, dt) { return MundoDinamica.updateWorldDynamics(this, time, dt); }

  drawLava(time) { return MundoDinamica.drawLava(this, time); }

  updateHud(time, dt) { return Hud.updateHud(this, time, dt); }

  updateLighting(time) { return MundoDinamica.updateLighting(this, time); }

  collectCoin(player, coin) { return MundoDinamica.collectCoin(this, player, coin); }

  collectFragment(player, shard) { return MundoDinamica.collectFragment(this, player, shard); }

  touchSpore(player, spore) { return MundoDinamica.touchSpore(this, player, spore); }

  onPushCrate(player, crate) { return Manos.onPushCrate(this, player, crate); }

  onBoulderHit(player, rock) { return Manos.onBoulderHit(this, player, rock); }

  onBoulderTerrainHit(rock, tile) { return Manos.onBoulderTerrainHit(this, rock, tile); }

  onBoulderCrateHit(rock, crate) { return Manos.onBoulderCrateHit(this, rock, crate); }

  crackWall(rock, wall) { return Destructibles.crackWall(this, rock, wall); }

  breakWall(wall, force = false) { return Destructibles.breakWall(this, wall, force); }

  destructiveImpulse(time) { return Destructibles.destructiveImpulse(this, time); }

  useAltar() { return Altar.useAltar(this); }

  negotiateWithGod() { return Altar.negotiateWithGod(this); }

  absorbGodPower(time) { return Altar.absorbGodPower(this, time); }

  takeDamage(amount, source) { return Combate.takeDamage(this, amount, source); }

  checkDeathPlane() { return Progresion.checkDeathPlane(this); }

  descend() { return Progresion.descend(this); }

  stopForAstral() { return Progresion.stopForAstral(this); }

  completeRun() { return Progresion.completeRun(this); }

  startAstral(victory, reason, bonusFragments = 0) { return Progresion.startAstral(this, victory, reason, bonusFragments); }

  die(isSuicide = false) { return Progresion.die(this, isSuicide); }

  preserveEtherealGold() { return Progresion.preserveEtherealGold(this); }

  showMessage(text, duration = 1600) { return Hud.showMessage(this, text, duration); }
}