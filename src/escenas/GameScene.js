// GameScene - Escena principal de juego - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)

import {
  LEVELS, TILE, BASE_GRAVITY, TOTAL_STAGES, JUMP_SPEED, SACRIFICE_JUMP_SPEED, LAW_DEFS
} from "../core/constantes.js";
import {
  clamp, screenW, screenH, hashSeed, mulberry32, randInt, rectsOverlap, makeRect
} from "../core/utils.js";
import {
  loadMeta, saveMeta, gravityMultiplier, trapMultiplier, economyMultiplier,
  inflationMultiplier, inflatedPrice, daggerReward, lawActive,
  runFragmentBank, setRunFragmentBank, effectiveCoinBurden, playerMoveSpeed, newRunId
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

  configureCamera() {
    const sw = screenW(this);
    const sh = screenH(this);
    const portrait = sh > sw;
    this.cameras.main.deadzone = new Phaser.Geom.Rectangle(0, 0, Math.min(120, sw * 0.25), portrait ? 100 : 80);
    this.cameras.main.setFollowOffset(0, portrait ? -40 : -30);
    // Keep the existing scroll on rotation; following converges without recentering.
    this.cameraPortrait = portrait;
    this.cameraSettleMs = 700;
  }

  createBackground() {
    const width = 78 * TILE;
    const height = 72 * TILE;
    const g = this.add.graphics().setScrollFactor(0.25).setDepth(-30);
    g.fillStyle(this.levelInfo.bgTop, 1);
    g.fillRect(-200, -100, width + 400, height + 200);
    g.fillStyle(this.levelInfo.bgMid, 0.68);
    g.fillRect(-200, height * 0.24, width + 400, height * 0.38);
    g.fillStyle(this.levelInfo.bgLow, 0.32);
    g.fillRect(-200, height * 0.58, width + 400, height * 0.52);

    if (this.levelInfo.key === "desert") {
      for (let i = 0; i < 16; i += 1) {
        const x = i * 190 + 30;
        const y = 230 + Math.sin(i) * 36;
        g.fillStyle(i % 2 ? 0x4a2f2a : 0x69402d, 0.6);
        g.fillRect(x, y, 26, 260);
        g.fillRect(x - 10, y, 46, 12);
      }
      g.lineStyle(3, 0xffc76f, 0.18);
      for (let y = 330; y < 1100; y += 90) {
        g.beginPath();
        g.moveTo(-50, y);
        for (let x = -50; x < width + 200; x += 80) g.lineTo(x, y + Math.sin((x + y) * 0.008) * 22);
        g.strokePath();
      }
    }

    if (this.levelInfo.key === "jungle") {
      g.lineStyle(5, 0x0f2e21, 0.72);
      for (let x = 20; x < width + 260; x += 84) {
        g.beginPath();
        g.moveTo(x, -20);
        for (let y = -20; y < height + 60; y += 80) g.lineTo(x + Math.sin(y * 0.012 + x) * 28, y);
        g.strokePath();
      }
      for (let i = 0; i < 120; i += 1) {
        g.fillStyle(i % 2 ? 0x72f0b1 : 0xb987ff, 0.08);
        g.fillCircle(Between(0, width), Between(0, height), Between(5, 15));
      }
    }

    if (this.levelInfo.key === "volcano") {
      for (let i = 0; i < 28; i += 1) {
        g.fillStyle(0x2a1113, 0.72);
        const x = i * 95;
        g.fillTriangle(x - 80, 700, x + 80, 700, x + 10, 180 + (i % 5) * 40);
      }
      g.lineStyle(4, 0xff7438, 0.32);
      for (let x = 40; x < width; x += 170) {
        g.beginPath();
        g.moveTo(x, 200);
        g.lineTo(x + 38, 440);
        g.lineTo(x - 14, 760);
        g.strokePath();
      }
    }

    if (this.levelInfo.key === "void" && this.stageNumber === TOTAL_STAGES) {
      for (let i = 0; i < 130; i += 1) {
        g.fillStyle(i % 11 === 0 ? 0x9dfcff : 0xf4f0e2, Phaser.Math.FloatBetween(0.15, 0.82));
        g.fillRect(Between(0, width), Between(0, height), i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
      }
      g.lineStyle(2, 0xf4f0e2, 0.14);
      for (let i = 0; i < 10; i += 1) {
        g.strokeCircle(width * 0.5, 520 + i * 78, 220 + i * 85);
      }
    }
  }

  createWorld() {
    const map = this.make.tilemap({ data: this.generated.data, tileWidth: TILE, tileHeight: TILE });
    const tileset = map.addTilesetImage(this.levelInfo.tile, this.levelInfo.tile, TILE, TILE, 0, 0, 1);
    this.terrain = map.createLayer(0, tileset, 0, 0);
    this.terrain.setCollision(1);
    this.terrain.setDepth(1);
    this.map = map;
    this.veinMarks = new Map();
    for (const vein of this.generated.veinCells) {
      const mark = this.add.graphics().setDepth(2);
      const x = vein.tx * TILE, y = vein.ty * TILE;
      mark.lineStyle(2, this.levelInfo.accent, 0.72);
      mark.beginPath(); mark.moveTo(x + 5, y + 3); mark.lineTo(x + 17, y + 13);
      mark.lineTo(x + 10, y + 21); mark.lineTo(x + 27, y + 29); mark.strokePath();
      this.veinMarks.set(`${vein.tx},${vein.ty}`, mark);
    }
    this.routeGraphics = this.add.graphics().setDepth(3);
    this.routeGraphics.lineStyle(2, 0x8af0b0, 0.65);
    for (const p of this.generated.path) {
      this.routeGraphics.lineBetween(p.rect.x + 4, p.y + 2, p.rect.x + p.rect.width - 4, p.y + 2);
      if (p.exitDirection) {
        const x = p.departureX - p.exitDirection * 24;
        this.routeGraphics.lineBetween(x - p.exitDirection * 15, p.y - 15, x, p.y - 15);
        this.routeGraphics.lineBetween(x, p.y - 15, x - p.exitDirection * 6, p.y - 21);
        this.routeGraphics.lineBetween(x, p.y - 15, x - p.exitDirection * 6, p.y - 9);
      }
    }
    this.dramaticLabels = [];
    for (const route of this.generated.dramaticRoutes) {
      this.routeGraphics.lineStyle(2, 0xffb14a, 0.65);
      this.routeGraphics.lineBetween(route.launchX, route.floorY - 12, route.launchX, route.floorY - 62);
      this.routeGraphics.lineBetween(route.launchX, route.floorY - 62, route.launchX - 8, route.floorY - 52);
      this.routeGraphics.lineBetween(route.launchX, route.floorY - 62, route.launchX + 8, route.floorY - 52);
      const label = this.add.text(route.x, route.floorY - 90, "RUTA DRAMÁTICA\nOFRENDA", {
        fontFamily: "monospace", fontSize: "11px", color: "#ffcf83", align: "center",
        backgroundColor: "#171015", padding: { x: 5, y: 4 }
      }).setOrigin(0.5).setDepth(4);
      this.dramaticLabels.push({ route, label });
    }

    this.slopeGraphics = this.add.graphics().setDepth(0);
    this.slopeGraphics.fillStyle(this.levelInfo.accent, 0.18);
    this.slopeGraphics.lineStyle(2, this.levelInfo.accent, 0.28);
    for (const slope of this.generated.slopes) {
      this.slopeGraphics.beginPath();
      if (slope.dir > 0) {
        this.slopeGraphics.moveTo(slope.x, slope.y + slope.height);
        this.slopeGraphics.lineTo(slope.x + slope.width, slope.y);
        this.slopeGraphics.lineTo(slope.x + slope.width, slope.y + slope.height);
      } else {
        this.slopeGraphics.moveTo(slope.x, slope.y);
        this.slopeGraphics.lineTo(slope.x + slope.width, slope.y + slope.height);
        this.slopeGraphics.lineTo(slope.x, slope.y + slope.height);
      }
      this.slopeGraphics.closePath();
      this.slopeGraphics.fillPath();
      this.slopeGraphics.strokePath();
    }

    this.ladderZones = [];
    this.ladderGroup = this.add.group();
    for (const ladder of this.generated.ladders) {
      for (let y = ladder.y; y < ladder.y + ladder.height; y += TILE) {
        const tile = this.add.image(ladder.x + 16, y + 16, "ladder").setDepth(0);
        this.ladderGroup.add(tile);
      }
      const zone = this.add.zone(ladder.x + 16, ladder.y + ladder.height / 2, TILE, ladder.height);
      this.physics.add.existing(zone, true);
      this.ladderZones.push(zone);
    }
  }

  createEntities() {
    this.coinsGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const c of this.generated.coins) {
      const coin = this.coinsGroup.create(c.x, c.y, "coin");
      coin.body.setCircle(10, 2, 2);
      coin.phase = this.rng() * Math.PI * 2;
    }

    this.fragmentsGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const f of this.generated.fragments) {
      const shard = this.fragmentsGroup.create(f.x, f.y, "fragment");
      shard.body.setSize(18, 22).setOffset(3, 4);
      shard.phase = this.rng() * Math.PI * 2;
      shard.dramaticId = f.dramaticId || null;
    }

    this.spikesGroup = this.physics.add.staticGroup();
    for (const s of this.generated.spikes) this.spikesGroup.create(s.x, s.y + 7, "spike").refreshBody();

    this.cratesGroup = this.physics.add.group({
      bounceX: 0.02,
      bounceY: 0,
      dragX: 780,
      maxVelocityX: 140
    });
    for (const c of this.generated.crates) {
      const crate = this.cratesGroup.create(c.x, c.y, "crate");
      crate.body.setSize(30, 30);
      crate.pickupType = "crate";
    }

    this.bouldersGroup = this.physics.add.group({ bounceX: 0.25, bounceY: 0.2, dragX: 12 });
    for (const b of this.generated.boulders) {
      const rock = this.bouldersGroup.create(b.x, b.y, "boulder");
      rock.body.setCircle(17, 1, 1);
      rock.body.allowGravity = false;
      rock.body.setMaxVelocity(240, 420);
      rock.sleepingStone = true;
      rock.pickupType = "boulder";
    }

    this.altarsGroup = this.physics.add.staticGroup();
    for (const a of this.generated.altars) {
      const altar = this.altarsGroup.create(a.x, a.y, "altar").refreshBody();
      altar.body.setSize(62, 50).setOffset(1, 2);
    }

    this.sporesGroup = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const s of this.generated.spores) {
      const spore = this.sporesGroup.create(s.x, s.y, "spore");
      spore.body.setCircle(12, 2, 2);
      spore.phase = this.rng() * Math.PI * 2;
    }

    this.lavaZones = [];
    this.lavaGraphics = this.add.graphics().setDepth(2);
    for (const lava of this.generated.lava) {
      const zone = this.add.zone(lava.x + lava.width / 2, lava.y + lava.height / 2, lava.width, lava.height);
      this.physics.add.existing(zone, true);
      this.lavaZones.push(zone);
    }
    this.drawLava(0);

    this.destructiblesGroup = this.physics.add.staticGroup();
    for (const d of this.generated.destructibles) {
      const wall = this.destructiblesGroup.create(d.x, d.y, "break-wall").refreshBody();
      wall.hp = 1;
      wall.dramaticId = d.dramaticId || null;
    }

    this.exitDoor = this.physics.add.staticImage(this.generated.exit.x, this.generated.exit.y + 6, "exit");
    this.exitDoor.refreshBody();

    this.bombsGroup = this.physics.add.group({ bounceX: 0.42, bounceY: 0.32, dragX: 180 });
    this.potsGroup = this.physics.add.group({ bounceX: 0.28, bounceY: 0.18, dragX: 420 });
    for (const p of this.generated.pots) {
      const pot = this.potsGroup.create(p.x, p.y, "pot");
      pot.body.setSize(26, 29).setOffset(3, 2);
      pot.pickupType = "pot";
    }

    if (this.generated.god) this.createGod();
    this.createSpecialSites();
  }

  createSpecialSites() {
    this.specialSites = [];
    for (const room of this.generated.specialRooms) {
      const g = this.add.graphics().setDepth(4);
      const color = room.type === "barter" ? 0x75f1b4 : 0xff596e;
      const w = room.widthTiles * TILE, h = room.heightTiles * TILE;
      g.fillStyle(0x03050a, 0.94); g.fillRect(room.x - w / 2, room.y - h + 25, w, h);
      g.lineStyle(3, color, 0.82); g.beginPath();
      g.arc(room.x, room.y - h + 25 + w / 2, w / 2 - 3, Math.PI, Math.PI * 2);
      g.lineTo(room.x + w / 2 - 3, room.y + 25); g.moveTo(room.x - w / 2 + 3, room.y + 25);
      g.lineTo(room.x - w / 2 + 3, room.y - h / 2); g.strokePath();
      g.strokeCircle(room.x, room.y - 7, room.type === "barter" ? 15 : 20);
      if (room.type === "barter") g.lineBetween(room.x - 24, room.y + 17, room.x + 24, room.y + 17);
      else { g.lineBetween(room.x - 20, room.y - 7, room.x + 20, room.y - 7); g.lineBetween(room.x, room.y - 27, room.x, room.y + 13); }
      const label = this.add.text(room.x, room.y + 35, room.type === "barter" ? "ALTAR DEL TRUEQUE" : "POZO DEL RIESGO", {
        fontFamily: "monospace", fontSize: "11px", color: `#${color.toString(16).padStart(6, "0")}`, align: "center"
      }).setOrigin(0.5).setDepth(5);
      this.specialSites.push({ room, graphics: g, label });
    }
    const merchant = this.generated.merchant;
    if (!merchant) return;
    const caveW = merchant.widthTiles * TILE, caveH = merchant.heightTiles * TILE;
    this.merchantGraphics = this.add.graphics().setDepth(6);
    this.merchantGraphics.fillStyle(0x020308, 0.96).fillRect(merchant.x - caveW / 2, merchant.y - caveH + 28, caveW, caveH);
    const biomeArch = { desert: 0xd7a85c, jungle: 0x62c98e, volcano: 0xe76842, void: 0xc9c5da }[this.levelInfo.key];
    this.merchantGraphics.lineStyle(4, biomeArch, 0.8).beginPath();
    this.merchantGraphics.arc(merchant.x, merchant.y - caveH + 28 + caveW / 2, caveW / 2 - 4, Math.PI, Math.PI * 2);
    this.merchantGraphics.lineTo(merchant.x + caveW / 2 - 4, merchant.y + 28);
    this.merchantGraphics.moveTo(merchant.x - caveW / 2 + 4, merchant.y + 28);
    this.merchantGraphics.lineTo(merchant.x - caveW / 2 + 4, merchant.y - caveH / 2);
    this.merchantGraphics.strokePath();
    this.merchantGraphics.lineStyle(2, biomeArch, 0.35);
    for (let i = -2; i <= 2; i += 1) this.merchantGraphics.strokeCircle(merchant.x + i * 32, merchant.y - 54, 17);

    // --- Evolución narrativa del Mercader según el mundo actual ---
    const floorY = merchant.y + 30;            // nivel del suelo de la cueva
    const machineW = 58, machineH = 76;        // tamaño de la máquina expendedora
    const cx = merchant.x;
    const W = this.worldNumber;

    if (W === 1 || W === 2) {
      // Máquina expendedora rectangular: fría, puramente transaccional
      this.merchantGraphics.fillStyle(0x20242c, 1);
      this.merchantGraphics.fillRoundedRect(cx - machineW / 2, floorY - machineH, machineW, machineH, 5);
      this.merchantGraphics.lineStyle(2, 0x9dfcff, 0.85);
      this.merchantGraphics.strokeRoundedRect(cx - machineW / 2, floorY - machineH, machineW, machineH, 5);
      // Vitrina con mercancías
      this.merchantGraphics.fillStyle(0x0b1119, 0.92);
      this.merchantGraphics.fillRoundedRect(cx - machineW / 2 + 6, floorY - machineH + 6, machineW - 12, 30, 3);
      this.merchantGraphics.fillStyle(0x9dfcff, 0.16);
      this.merchantGraphics.fillRect(cx - machineW / 2 + 8, floorY - machineH + 8, machineW - 16, 26);
      // Mesa selector / botones luminosos
      const btnColors = [0xff596e, 0x75f1b4, 0x9ef9ff, 0xffb14a];
      this.merchantGraphics.fillStyle(0x10141d, 1);
      this.merchantGraphics.fillRect(cx - machineW / 2 + 6, floorY - machineH + 41, machineW - 12, 18);
      for (let i = 0; i < 4; i += 1) {
        this.merchantGraphics.fillStyle(btnColors[i], 0.9);
        this.merchantGraphics.fillCircle(cx - machineW / 2 + 14 + i * 12, floorY - machineH + 50, 3);
      }
      // Rejilla + ranura de entrega inferior
      this.merchantGraphics.fillStyle(0x151b26, 1);
      this.merchantGraphics.fillRect(cx - machineW / 2 + 10, floorY - 22, machineW - 20, 12);
      this.merchantGraphics.fillStyle(0x0c0f16, 1);
      this.merchantGraphics.fillRoundedRect(cx - 18, floorY - 7, 36, 7, 2);
      this.merchantGraphics.lineStyle(1, 0xbfd9e6, 0.35);
      this.merchantGraphics.strokeRect(cx - 18, floorY - 7, 36, 7);
    } else if (W === 3) {
      // Máquina rota / ladeada + entidad reparándola + chispas
      const tilt = 0.17;
      this.merchantGraphics.save();
      this.merchantGraphics.translateCanvas(cx, floorY);
      this.merchantGraphics.rotateCanvas(tilt);
      this.merchantGraphics.fillStyle(0x2a2f3a, 1);
      this.merchantGraphics.fillRoundedRect(-machineW / 2, -machineH, machineW, machineH, 5);
      this.merchantGraphics.lineStyle(2, 0x5d6470, 0.9);
      this.merchantGraphics.strokeRoundedRect(-machineW / 2, -machineH, machineW, machineH, 5);
      // Vitrina agrietada
      this.merchantGraphics.fillStyle(0x0b1119, 0.92);
      this.merchantGraphics.fillRoundedRect(-machineW / 2 + 6, -machineH + 6, machineW - 12, 30, 3);
      this.merchantGraphics.lineStyle(1, 0x9dfcff, 0.55);
      this.merchantGraphics.beginPath();
      this.merchantGraphics.moveTo(0, -machineH + 10);
      this.merchantGraphics.lineTo(-12, -machineH + 24);
      this.merchantGraphics.lineTo(6, -machineH + 34);
      this.merchantGraphics.strokePath();
      // Botones apagados / en cortocircuito
      for (let i = 0; i < 4; i += 1) {
        this.merchantGraphics.fillStyle(i % 2 ? 0xff596e : 0x3a4150, 0.6);
        this.merchantGraphics.fillCircle(-machineW / 2 + 14 + i * 12, -machineH + 50, 3);
      }
      this.merchantGraphics.restore();
      // Silueta de la entidad al lado, "arreglando" la máquina
      const sideX = cx + machineW / 2 + 18, sideY = floorY - 4;
      this.merchantGraphics.fillStyle(0x232a33, 0.92);
      this.merchantGraphics.fillRoundedRect(sideX - 9, sideY - 54, 17, 32, 6);   // torso
      this.merchantGraphics.fillCircle(sideX, sideY - 62, 9);                      // cabeza
      this.merchantGraphics.fillRect(sideX + 4, sideY - 46, 28, 4);                // brazo hacia la máquina
      this.merchantGraphics.fillRect(sideX - 6, sideY - 20, 3, 22);                // piernas
      this.merchantGraphics.fillRect(sideX + 4, sideY - 20, 3, 22);
      this.merchantGraphics.lineStyle(2, 0xffb14a, 0.9);
      this.merchantGraphics.strokeCircle(sideX, sideY - 62, 9);
      // Chispas (particle-fire) saliendo del panel abierto
      this.merchantSparks = this.add.particles(cx + machineW / 4, floorY - machineH + 22, "particle-fire", {
        lifespan: { min: 220, max: 480 },
        speed: { min: 18, max: 85 },
        gravityY: 260,
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.9, end: 0 },
        frequency: 34,
        maxParticles: 40,
        emitting: true
      }).setDepth(7);
    } else {
      // Mundo 4: la Entidad se muestra completa — diseño final
      this.merchantGraphics.fillStyle(0x3a4150, 1);
      this.merchantGraphics.fillRoundedRect(cx - machineW / 2 - 4, floorY - 8, machineW + 8, 8, 3); // plinto
      this.merchantGraphics.lineStyle(2, 0x9ef9ff, 1);
      this.merchantGraphics.fillStyle(0x9ef9ff, 0.16);
      this.merchantGraphics.fillRoundedRect(cx - 13, floorY - 66, 26, 34, 6);
      this.merchantGraphics.strokeRoundedRect(cx - 13, floorY - 66, 26, 34, 6);
      this.merchantGraphics.fillCircle(cx, floorY - 76, 12);
      this.merchantGraphics.strokeCircle(cx, floorY - 76, 12);
      // Brazos de la entidad
      this.merchantGraphics.lineBetween(cx - 10, floorY - 34, cx - 14, floorY - 6);
      this.merchantGraphics.lineBetween(cx + 10, floorY - 34, cx + 14, floorY - 6);
      // Halo/emblema del linaje
      this.merchantGraphics.lineStyle(2, 0xffb14a, 0.9);
      this.merchantGraphics.strokeCircle(cx, floorY - 76, 15);
      // Caja dispensadora abierta a sus pies con mercancías
      this.merchantGraphics.fillStyle(0x20242c, 1);
      this.merchantGraphics.fillRect(cx - 30, floorY - 12, 24, 12);
      this.merchantGraphics.fillStyle(0xffb14a, 1).fillCircle(cx - 24, floorY - 17, 3);
      this.merchantGraphics.fillStyle(0x75f1b4, 1).fillCircle(cx - 17, floorY - 17, 3);
      this.merchantGraphics.fillStyle(0x9ef9ff, 1).fillCircle(cx - 10, floorY - 17, 3);
    }
    this.merchantLabel = this.add.text(merchant.x, merchant.y + 39, "MERCADER TURBIO", {
      fontFamily: "monospace", fontSize: "11px", color: "#9dfcff"
    }).setOrigin(0.5).setDepth(7);
  }

  createGod() {
    const g = this.add.graphics().setDepth(0);
    const god = this.generated.god;
    g.fillStyle(0xe9e4d7, 0.92);
    g.fillRoundedRect(god.x - 150, god.y - 18, 300, 192, 28);
    g.fillStyle(0x292c36, 1);
    g.fillCircle(god.x, god.y + 58, 54);
    g.fillStyle(0xf7fbff, 1);
    g.fillCircle(god.x, god.y + 58, 34);
    g.fillStyle(0x05060a, 1);
    g.fillCircle(god.x, god.y + 58, 12);
    g.lineStyle(3, 0x6f7382, 0.58);
    for (let i = 0; i < 7; i += 1) {
      const x = god.x - 126 + i * 42;
      g.beginPath();
      g.moveTo(x, god.y + 5);
      g.lineTo(x + Math.sin(i) * 26, god.y + 166);
      g.strokePath();
    }
    g.fillStyle(0xe9e4d7, 0.55);
    g.fillRoundedRect(god.x - 230, god.y + 64, 80, 140, 24);
    g.fillRoundedRect(god.x + 150, god.y + 64, 80, 140, 24);
    this.godZone = this.add.zone(god.zone.x + god.zone.width / 2, god.zone.y + god.zone.height / 2, god.zone.width, god.zone.height);
    this.physics.add.existing(this.godZone, true);
  }

  spawnDebtCreditor() {
    if ((this.symbolicEntities || []).some(entity => entity.kind === "creditor")) return;
    const p = this.generated.path[Math.min(4, this.generated.path.length - 1)];
    const entity = new SymbolicEntity(this, { kind: "creditor", x: p.centerX, y: p.y - 19,
      left: p.rect.x + 30, right: p.rect.x + p.rect.width - 30,
      phase: this.rng() * Math.PI * 2, direction: -1 });
    entity.debtCollector = true;
    this.symbolicEntities.push(entity);
    this.blue.explode(18, entity.x, entity.y);
  }

  createPlayer() {
    this.player = this.physics.add.sprite(this.generated.spawn.x, this.generated.spawn.y, "player");
    this.player.setDepth(8);
    this.player.body.setSize(20, 35).setOffset(6, 10);
    this.player.body.setCollideWorldBounds(true);
    this.player.body.setMaxVelocity(300, 620);
    this.player.body.setDragX(0);
    this.player.facing = 1;
    this.player.wasGrounded = true;

    // === RIG ESQUELÉTICO (Paper-Doll) — ETAPA 2 ===
    // El sprite físico pasa a ser un collider Arcade invisible. Toda la fisica
    // (setSize/setOffset/setCollideWorldBounds, etc.) se conserva intacta arriba;
    // la representación visual ahora la lleva el contenedor this.playerRig.
    this.player.setVisible(false);

    // Contenedor visual anclado a la posicion del collider. Se mueve con el
    // jugador en handleMovement() (ETAPA 2: solo pose neutra, aun sin animar).
    this.playerRig = this.add.container(this.player.x, this.player.y).setDepth(8);

    // Piezas del cuerpo. Los miembros pivotan desde el hombro/cadera (en lugar del
    // centro) gracias a setOrigin(0.5, 0); sus coordenadas x/y son relativas al
    // contenedor y arman una figura humanoide en pose neutra.
    // Orden estricto (atras -> adelante):
    //   backArm -> backLeg -> torso -> head -> frontLeg -> frontArm
    const rigBackArm = this.add.sprite(-9, -8, "player-limb-back").setOrigin(0.5, 0);
    const rigBackLeg = this.add.sprite(-4, 7, "player-limb-back").setOrigin(0.5, 0);
    const rigTorso = this.add.sprite(0, -1, "player-torso");
    const rigHead = this.add.sprite(0, -14, "player-head");
    const rigFrontLeg = this.add.sprite(4, 7, "player-limb").setOrigin(0.5, 0);
    const rigFrontArm = this.add.sprite(9, -8, "player-limb").setOrigin(0.5, 0);

    // Referencias guardadas para animar (trigonometria) en la ETAPA 3.
    this.rigParts = {
      head: rigHead,
      torso: rigTorso,
      backArm: rigBackArm,
      backLeg: rigBackLeg,
      frontArm: rigFrontArm,
      frontLeg: rigFrontLeg
    };
    this.playerRig.add([rigBackArm, rigBackLeg, rigTorso, rigHead, rigFrontLeg, rigFrontArm]);
  }

  createEffects() {
    this.dust = this.add.particles(0, 0, "particle-white", {
      lifespan: { min: 220, max: 430 },
      speed: { min: 20, max: 115 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.45, end: 0 },
      emitting: false
    }).setDepth(20);
    this.spark = this.add.particles(0, 0, "particle-fire", {
      lifespan: { min: 240, max: 520 },
      speed: { min: 35, max: 190 },
      gravityY: 320,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.9, end: 0 },
      emitting: false
    }).setDepth(20);
    this.blue = this.add.particles(0, 0, "particle-blue", {
      lifespan: { min: 360, max: 760 },
      speed: { min: 25, max: 130 },
      scale: { start: 1.1, end: 0 },
      alpha: { start: 0.85, end: 0 },
      emitting: false
    }).setDepth(20);
    // Fuente de salud: flujo sutil de motas que ascienden desde el cuenco
    this.altarWater = this.add.particles(0, 0, "particle-blue", {
      lifespan: { min: 520, max: 1150 },
      speedX: { min: -14, max: 14 },
      speedY: { min: -46, max: -16 },
      gravityY: -14,
      scale: { start: 0.62, end: 0 },
      alpha: { start: 0.5, end: 0 },
      frequency: 90,
      maxParticles: 26,
      emitting: false
    }).setDepth(7);
    this.sporeMist = this.add.particles(0, 0, "particle-spore", {
      lifespan: { min: 550, max: 1150 },
      speed: { min: 8, max: 48 },
      gravityY: -25,
      scale: { start: 0.9, end: 0 },
      alpha: { start: 0.42, end: 0 },
      emitting: false
    }).setDepth(20);
    this.footDust = this.add.particles(0, 0, "particle-white", {
      lifespan: { min: 150, max: 300 },
      speedX: { min: -20, max: 20 }, speedY: { min: -18, max: -7 },
      gravityY: 35, tint: this.levelInfo.accent,
      scale: { start: 0.45, end: 0 }, alpha: { start: 0.36, end: 0 },
      maxParticles: 24, emitting: false
    }).setDepth(7);
    this.channelRing = this.add.graphics().setDepth(21);
    this.portableHalo = this.add.graphics().setDepth(18);
  }

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

  handleMovement(controls, time, dt) {
    const body = this.player.body;
    const onGround = body.blocked.down || body.touching.down || this.onSlope;
    // ETAPA 2: el contenedor visual sigue al collider invisible en cada frame.
    if (this.playerRig) {
      this.playerRig.setPosition(this.player.x, this.player.y);
    }
    if (onGround && Math.abs(body.velocity.x) < 8 && !controls.axis) {
      if (!this.idleGroundSince) this.idleGroundSince = time;
    } else this.idleGroundSince = 0;
    if (!this.playerHistory) this.playerHistory = [];
    this.playerHistory.push({ time, x: this.player.x, y: this.player.y, facing: this.player.facing });
    while (this.playerHistory.length && this.playerHistory[0].time < time - 1150) this.playerHistory.shift();
    if (!onGround && body.velocity.y > 0) this.maxFallSpeed = Math.max(this.maxFallSpeed, body.velocity.y);
    if (onGround) { this.lastGroundedAt = time; this.airJumps = 1; }
    if (controls.jumpPressed) this.lastJumpPressAt = time;

    const coinBurden = this.featherBoots ? 0 : effectiveCoinBurden(this.coins, this.meta);
    const empowered = time < this.absorptionUntil;
    const speed = (playerMoveSpeed(this.featherBoots ? 0 : this.coins, this.meta, this.godPowerTimer) + (empowered ? 28 : 0)) * (this.carried ? 0.9 : 1);
    const accel = onGround ? 0.23 : 0.14;
    if (controls.axis) {
      this.inertiaDirection = Math.sign(controls.axis);
      this.inertiaUntil = 0;
    }
    const inertialAxis = controls.axis;
    const desired = inertialAxis * speed;
    if (onGround && controls.axis && Math.sign(controls.axis) !== Math.sign(body.velocity.x) && Math.abs(body.velocity.x) > 70 && time >= this.skidDustReadyAt) {
      this.footDust.explode(4, body.center.x + Math.sign(body.velocity.x) * 9, body.bottom - 2);
      this.skidDustReadyAt = time + 180;
    }
    body.velocity.x = Phaser.Math.Linear(body.velocity.x, desired, inertialAxis ? accel : (onGround ? 0.18 : 0.04));
    if (!controls.axis && onGround && Math.abs(body.velocity.x) < 8) body.velocity.x = 0;
    const ascending = time < this.ascentUntil;
    body.setGravityY(time < this.localGravityUntil ? -2 * this.physics.world.gravity.y : ascending ? 0 : coinBurden * (this.debtMass || 1));
    body.setMaxVelocity(300, ascending ? 820 : 620 + coinBurden * 0.55);

    if (controls.axis !== 0) {
      this.player.facing = Math.sign(controls.axis);
      this.player.setFlipX(this.player.facing < 0);
    }

    const canCoyote = time - this.lastGroundedAt <= 110;
    const buffered = time - this.lastJumpPressAt <= 125;
    if (buffered && canCoyote && !this.onLadder && !(time < this.staggerUntil)) {
      const route = this.generated.dramaticRoutes.find(r => r.unlocked &&
        rectsOverlap(makeRect(body.x, body.y, body.width, body.height), r.launchZone));
      if (route) {
        this.ascentUntil = time + 1700;
        body.setGravityY(0).setMaxVelocity(300, 820);
      }
      body.setVelocityY(route ? -SACRIFICE_JUMP_SPEED : -(JUMP_SPEED + (empowered ? 48 : 0) + (time < this.riskJumpUntil ? 80 : 0)));
      this.lastJumpPressAt = -9999;
      this.lastGroundedAt = -9999;
      this.player.wasGrounded = false;
      this.footDust.explode(5, this.player.x - 9, this.player.y + 22);
      this.footDust.explode(5, this.player.x + 9, this.player.y + 22);
      this.squashPlayer(0.8, 1.25, 130);
      AUDIO.jump();
      if (this.nearDramatic && !this.nearDramatic.unlocked) {
        this.showMessage("Ese ascenso exige una ofrenda. E: entregar oro o 1 vida.", 1800);
      }
    } else if (buffered && !canCoyote && !this.onLadder && lawActive(this.meta, "doubleJump") && this.airJumps > 0 && this.coins > 0 && !(time < this.staggerUntil)) {
      this.coins -= 1;
      this.airJumps -= 1;
      body.setVelocityY(-(JUMP_SPEED + 20));
      if (lawActive(this.meta, "willInertia") && Math.abs(body.velocity.x) > 24) {
        this.fluidezAirVelocity = body.velocity.x;
        this.fluidezAirUntil = time + 1500;
      }
      this.lastJumpPressAt = -9999;
      this.dust.explode(8, this.player.x, this.player.y + 16);
      this.squashPlayer(0.84, 1.2, 120);
      AUDIO.jump();
      this.showMessage("Doble Salto Sacramental: 1 moneda.", 1100);
    }

    if (controls.jumpReleased && body.velocity.y < -120) {
      body.setVelocityY(-120);
    }

    if (controls.attackPressed && time >= this.dashReadyAt) {
      if (this.carried) {
        this.releaseCarried(controls.down, time);
        this.dashReadyAt = time + 180;
      } else if (this.nearMerchant) {
        this.cycleMerchant();
        this.dashReadyAt = time + 220;
      } else if (this.nearDramatic && !this.nearDramatic.unlocked && this.levelInfo.key === "volcano") {
        this.sacrificeForRoute(this.nearDramatic, true);
        this.dashReadyAt = time + 720;
      } else if (this.nearGod && this.levelInfo.key === "void") {
        this.absorbGodPower(time);
      } else {
        const dir = this.player.facing || controls.facing || 1;
        this.dashDirection = dir;
        this.dashUntil = time + 160;
        body.setVelocityX(dir * 300);
        if (lawActive(this.meta, "willInertia")) {
          this.fluidezAirVelocity = dir * 300;
          this.fluidezAirUntil = time + 520;
        }
        body.setVelocityY(Math.min(body.velocity.y, -60));
        this.invulnUntil = Math.max(this.invulnUntil, time + 160);
        this.dashReadyAt = time + 720;
        this.dust.explode(14, this.player.x - dir * 10, this.player.y + 14);
        AUDIO.dash();
      }
    }

    if (time < this.dashUntil) body.setVelocityX(this.dashDirection * 300);

    if (onGround && this.player.wasGrounded === false && body.velocity.y >= 0) {
      // Ignore tiny contact oscillations: only a real fall gets landing feedback.
      if (this.maxFallSpeed >= 80 && time >= this.landingFeelReadyAt) {
        this.footDust.explode(7, this.player.x, this.player.y + 24);
        this.squashPlayer(1.25, 0.75, 150);
        this.landingFeelReadyAt = time + 220;
      }
      if (this.maxFallSpeed >= 390) this.cameras?.main?.shake(100, 0.005);
      this.maxFallSpeed = 0;
      if (lawActive(this.meta, "greedTransmutation") && this.coins > 0 && this.maxFallSpeed >= 340) {
        const mass = this.featherBoots ? 0 : effectiveCoinBurden(this.coins, this.meta);
        const radius = clamp(44 + mass * 0.48, 44, 150);
        this.blue.explode(clamp(Math.round(8 + mass / 12), 8, 26), this.player.x, this.player.y + 20);
        for (const entity of this.symbolicEntities || []) {
          if (entity.state === "active" && Math.hypot(entity.x - this.player.x, entity.y - this.player.y) <= radius) {
            entity.stunnedUntil = Math.max(entity.stunnedUntil, time + 1200);
          }
        }
      }
    }
    if (!onGround && lawActive(this.meta, "willInertia") && time < this.fluidezAirUntil) body.velocity.x = this.fluidezAirVelocity;
    this.player.wasGrounded = onGround;
    this.walkDustTimer += dt;
    if (onGround && body.velocity.y >= 0 && !this.onLadder && controls.axis && Math.abs(body.velocity.x) > 35 && this.walkDustTimer >= 85) {
      this.footDust.explode(1, body.center.x - this.player.facing * 8, body.bottom - 1);
      this.walkDustTimer = 0;
    } else if (!onGround || !controls.axis) this.walkDustTimer = 85;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ANIMACIÓN PROCEDURAL PULIDA (Paper-Doll Rig) — Optimizada para Game Feel
  // ══════════════════════════════════════════════════════════════════════════
  // Trigonometría pura para animar this.playerRig y this.rigParts.
  // NO toca físicas ni colisiones (solo visual). El flip se hace con scaleX.
  updatePlayerAnimation(time) {
    if (!this.player?.body || !this.playerRig || !this.rigParts) return;

    const body = this.player.body;
    const parts = this.rigParts;

    // ============================================================
    // 1. Estado persistente de la animación
    // ============================================================
    if (!this.rigAnim) {
      this.rigAnim = {
        torsoAngle: 0,
        torsoScaleY: 1,
        torsoY: parts.torso.y,

        headAngle: 0,
        headY: parts.head.y,

        frontLeg: 0,
        backLeg: 0,
        frontArm: 0,
        backArm: 0,

        lastTime: time
      };

      this.rigTorsoBaseY = parts.torso.y;
      this.rigHeadBaseY = parts.head.y;
    }

    const R = this.rigAnim;

    // ============================================================
    // 2. Datos físicos
    // ============================================================
    const vx = body.velocity.x;
    const vy = body.velocity.y;
    const speedX = Math.abs(vx);
    const onGround = Boolean(body.blocked.down || this.onSlope);

    // ============================================================
    // 3. Flip visual
    // ============================================================
    this.playerRig.setScale(this.player.facing, 1);

    // ============================================================
    // 4. Delta estable para suavizado independiente del FPS
    // ============================================================
    const dt = Phaser.Math.Clamp(time - R.lastTime, 1, 50);
    R.lastTime = time;

    // ✨ OPTIMIZADO: Lerp más responsivo (45ms → transición sedosa, no resbaladiza).
    const lerp = 1 - Math.exp(-dt / 45);

    // ============================================================
    // 5. Defaults / objetivo de pose
    // ============================================================
    let targetTorsoAngle = 0;
    let targetTorsoScaleY = 1;

    let targetTorsoY = this.rigTorsoBaseY;
    let targetHeadAngle = 0;
    let targetHeadY = this.rigHeadBaseY;

    let targetFrontLeg = 0;
    let targetBackLeg = 0;
    let targetFrontArm = 0;
    let targetBackArm = 0;

    // ============================================================
    // 6. PRIORIDAD DE ESTADOS
    // ============================================================

    // ------------------------------------------------------------
    // HURT / STAGGER
    // ------------------------------------------------------------
    if (this.staggerUntil > time) {
      // Retroceso fuerte, pero con pequeñas diferencias entre miembros
      // para evitar el aspecto perfectamente simétrico.
      targetTorsoAngle = -24;
      targetHeadAngle = -18;

      targetFrontArm = -148;
      targetBackArm = -122;

      targetFrontLeg = -34;
      targetBackLeg = 28;

      targetTorsoY = this.rigTorsoBaseY + 1;
      targetHeadY = this.rigHeadBaseY - 1;
      targetTorsoScaleY = 0.96;
    }
    // ------------------------------------------------------------
    // DASH
    // ------------------------------------------------------------
    else if (this.dashUntil > time) {
      // Inclinación agresiva hacia delante.
      targetTorsoAngle = 30;
      targetHeadAngle = 25;

      // Brazos completamente arrastrados hacia atrás.
      targetFrontArm = -62;
      targetBackArm = -82;

      // Piernas compactas para reforzar la sensación de impulso.
      targetFrontLeg = -18;
      targetBackLeg = 12;

      targetTorsoY = this.rigTorsoBaseY - 1;
      targetHeadY = this.rigHeadBaseY - 2;
      targetTorsoScaleY = 0.93;
    }

    // ------------------------------------------------------------
    // AIRE
    // ------------------------------------------------------------
    else if (!onGround) {
      const jumpReference = 382;
      const fallReference = 620;

      // ----------------------------------------------------------
      // SUBIENDO (vy < -10)
      // ----------------------------------------------------------
      if (vy < -10) {
        const rise = Phaser.Math.Clamp(
          Math.abs(vy) / jumpReference,
          0,
          1
        );

        // ✨ PULIDO: Inclinación más enérgica (+2°) para sensación de impulso.
        targetTorsoAngle = Phaser.Math.Linear(8, 15, rise);
        targetHeadAngle = Phaser.Math.Linear(5, 12, rise);

        // ✨ Brazo frontal más dramático (alcanza -165° en pico).
        targetFrontArm = Phaser.Math.Linear(-120, -165, rise);

        // Brazo trasero compensa.
        targetBackArm = Phaser.Math.Linear(12, 30, rise);

        // ✨ Piernas: asimetría más marcada para energía dinámica.
        targetFrontLeg = Phaser.Math.Linear(-28, -54, rise);
        targetBackLeg = Phaser.Math.Linear(8, 20, rise);

        targetTorsoY = this.rigTorsoBaseY - Phaser.Math.Linear(0, 2.0, rise);
        targetHeadY = this.rigHeadBaseY - Phaser.Math.Linear(0, 1.4, rise);

        // ✨ Squash más sutil para evitar deformación excesiva.
        targetTorsoScaleY = Phaser.Math.Linear(1, 0.96, rise);
      }

      // ----------------------------------------------------------
      // ✨ ÁPICE MEJORADO: Momento zen suspendido (vy entre -20 y +20)
      // ----------------------------------------------------------
      else if (Math.abs(vy) <= 20) {
        // Micro-transición dentro del ápice (cuanto más cerca de 0, más suspendido).
        const apexBlend = 1 - Math.abs(vy) / 20;

        // Brazos flotantes simétricos.
        targetFrontArm = Phaser.Math.Linear(-118, -135, apexBlend);
        targetBackArm = Phaser.Math.Linear(-112, -128, apexBlend);

        // Piernas compactas pero no idénticas.
        targetFrontLeg = Phaser.Math.Linear(-10, -18, apexBlend);
        targetBackLeg = Phaser.Math.Linear(6, 12, apexBlend);

        // Torso casi neutral = suspensión.
        targetTorsoAngle = Phaser.Math.Linear(4, 1, apexBlend);
        targetHeadAngle = Phaser.Math.Linear(2, 0, apexBlend);

        targetTorsoY = this.rigTorsoBaseY - Phaser.Math.Linear(0.5, 1.2, apexBlend);
        targetHeadY = this.rigHeadBaseY - Phaser.Math.Linear(0.3, 0.8, apexBlend);

        targetTorsoScaleY = Phaser.Math.Linear(0.99, 0.975, apexBlend);
      }

      // ----------------------------------------------------------
      // CAYENDO (vy > 20)
      // ----------------------------------------------------------
      else {
        const fall = Phaser.Math.Clamp(
          vy / fallReference,
          0,
          1
        );

        // ✨ Torso se inclina hacia atrás progresivamente (-4° en caída máxima).
        targetTorsoAngle = Phaser.Math.Linear(2, -4, fall);
        targetHeadAngle = Phaser.Math.Linear(1, -6, fall);

        // ✨ Brazos: resistencia al aire (más elevados = -152°).
        targetFrontArm = Phaser.Math.Linear(-110, -152, fall);
        targetBackArm = Phaser.Math.Linear(-95, -148, fall);

        // ✨ Piernas: extensión asimétrica (no idénticas).
        targetFrontLeg = Phaser.Math.Linear(-12, 5, fall);
        targetBackLeg = Phaser.Math.Linear(8, -3, fall);

        targetTorsoY = this.rigTorsoBaseY + Phaser.Math.Linear(0, 2.2, fall);
        targetHeadY = this.rigHeadBaseY + Phaser.Math.Linear(0, 1.5, fall);

        // ✨ Stretch muy sutil en caída máxima.
        targetTorsoScaleY = Phaser.Math.Linear(0.98, 1.02, fall);
      }
    }
    // ------------------------------------------------------------
    // RUN
    // ------------------------------------------------------------
    else if (speedX > 15) {
      const speed01 = Phaser.Math.Clamp(speedX / 300, 0, 1);

      // ✨ PULIDO: Frecuencia más rápida (0.012 → 0.025) para carrera enérgica.
      const frequency = Phaser.Math.Linear(0.012, 0.025, speed01);
      const phase = time * frequency;

      const legWave = Math.sin(phase);
      const armWave = Math.sin(phase + Math.PI);

      // ✨ Amplitud de piernas aumentada (45° → 52°) para zancadas más largas.
      targetFrontLeg = legWave * 52;
      targetBackLeg = -legWave * 52;

      // ✨ Brazos: amplitud aumentada (34° → 42°) para contrabalanceo visible.
      targetFrontArm = armWave * 42;
      targetBackArm = -armWave * 42;

      // ✨ Inclinación hacia delante más pronunciada (7° → 10° a velocidad max).
      targetTorsoAngle = Phaser.Math.Linear(3, 10, speed01);
      targetHeadAngle = Phaser.Math.Linear(1, 6, speed01);

      // ✨ TORSO BOBBING MEJORADO: peso realista en cada pisada.
      // Usamos sin² (footImpact²) para acelerar el "golpe" del pie.
      const footImpact = Math.abs(Math.sin(phase));
      const impactSquared = footImpact * footImpact;
      const bob = impactSquared * Phaser.Math.Linear(1.2, 3.8, speed01);

      targetTorsoY = this.rigTorsoBaseY + bob;
      targetHeadY = this.rigHeadBaseY + bob * 0.75;

      // ✨ Squash & Stretch: compresión más visible (0.035 → 0.055).
      targetTorsoScaleY = 1 - impactSquared * Phaser.Math.Linear(0.020, 0.055, speed01);
    }

    // ------------------------------------------------------------
    // IDLE (Respiración)
    // ------------------------------------------------------------
    else {
      // ✨ PULIDO: Respiración más lenta (0.0026 → 0.0020) y asimétrica.
      const breath = Math.sin(time * 0.0020);
      const breathSoft = Math.sin(time * 0.0020 + 0.6);

      // ✨ Amplitud reducida (1.2° → 0.7°) para respiración sutil, no mareante.
      targetTorsoAngle = breath * 0.7;
      targetHeadAngle = breathSoft * 0.5;

      // ✨ ScaleY más sutil (0.035 → 0.022) para evitar "inflar" demasiado.
      targetTorsoScaleY = 1 + breath * 0.022;

      // ✨ Movimiento vertical reducido para respiración orgánica, no flotante.
      targetTorsoY = this.rigTorsoBaseY - breath * 0.25;
      targetHeadY = this.rigHeadBaseY - breath * 0.40;

      // Extremidades en reposo.
      targetFrontLeg = 0;
      targetBackLeg = 0;
      targetFrontArm = 0;
      targetBackArm = 0;
    }
    // ============================================================
    // 7. Suavizado de TODA la pose
    // ============================================================
    R.torsoAngle = Phaser.Math.Linear(
      R.torsoAngle,
      targetTorsoAngle,
      lerp
    );

    R.torsoScaleY = Phaser.Math.Linear(
      R.torsoScaleY,
      targetTorsoScaleY,
      lerp
    );

    R.torsoY = Phaser.Math.Linear(
      R.torsoY,
      targetTorsoY,
      lerp
    );

    R.headAngle = Phaser.Math.Linear(
      R.headAngle,
      targetHeadAngle,
      lerp
    );

    R.headY = Phaser.Math.Linear(
      R.headY,
      targetHeadY,
      lerp
    );

    R.frontLeg = Phaser.Math.Linear(
      R.frontLeg,
      targetFrontLeg,
      lerp
    );

    R.backLeg = Phaser.Math.Linear(
      R.backLeg,
      targetBackLeg,
      lerp
    );

    R.frontArm = Phaser.Math.Linear(
      R.frontArm,
      targetFrontArm,
      lerp
    );

    R.backArm = Phaser.Math.Linear(
      R.backArm,
      targetBackArm,
      lerp
    );

    // ============================================================
    // 8. Aplicación final al Paper-Doll Rig
    // ============================================================
    parts.torso.rotation = Phaser.Math.DegToRad(R.torsoAngle);
    parts.torso.y = R.torsoY;
    parts.torso.scaleY = R.torsoScaleY;

    parts.head.rotation = Phaser.Math.DegToRad(R.headAngle);
    parts.head.y = R.headY;

    parts.frontLeg.rotation = Phaser.Math.DegToRad(R.frontLeg);
    parts.backLeg.rotation = Phaser.Math.DegToRad(R.backLeg);

    parts.frontArm.rotation = Phaser.Math.DegToRad(R.frontArm);
    parts.backArm.rotation = Phaser.Math.DegToRad(R.backArm);
  }

  squashPlayer(scaleX, scaleY, duration) {
    if (!this.player?.setScale || !this.tweens?.add || this.ending) return;
    if (this.squashTween) this.squashTween.stop();
    this.player.setScale(scaleX, scaleY);
    this.stabilizePlayerBody();
    this.squashTween = this.tweens.add({
      targets: this.player, scaleX: 1, scaleY: 1, duration,
      ease: "Back.Out",
      onUpdate: () => this.stabilizePlayerBody(),
      onComplete: () => {
        if (this.ending) return;
        this.player.setScale(1, 1);
        this.player.body.setSize(20, 35).setOffset(6, 10);
        this.squashTween = null;
      }
    });
  }

  stabilizePlayerBody() {
    const body = this.player?.body;
    if (!body) return;
    const sx = Math.max(0.01, Math.abs(this.player.scaleX || 1));
    const sy = Math.max(0.01, Math.abs(this.player.scaleY || 1));
    body.setSize(20 / sx, 35 / sy).setOffset(6 / sx, 10 / sy);
  }

  spawnSymbolicAttack(owner, type, x, y, vx, vy, duration) { return Combate.spawnSymbolicAttack(this, owner, type, x, y, vx, vy, duration); }

  parryAttack(owner, time, attack = null) { return Combate.parryAttack(this, owner, time, attack); }

  updateSymbolicAttacks(time, dt) { return Combate.updateSymbolicAttacks(this, time, dt); }

  handleLadders(controls) {
    this.onLadder = this.ladderZones.some(zone => this.physics.overlap(this.player, zone));
    if (this.onLadder && (controls.up || controls.down)) {
      this.player.body.allowGravity = false;
      this.player.body.setVelocityY((controls.down ? 1 : 0) * 120 - (controls.up ? 1 : 0) * 120);
      this.player.body.velocity.x = Phaser.Math.Linear(this.player.body.velocity.x, controls.axis * 95, 0.2);
    } else {
      this.player.body.allowGravity = true;
    }
  }

  resolveSlope() {
    this.onSlope = false;
    const body = this.player.body;
    const footX = body.x + body.width / 2;
    const footY = body.y + body.height;
    for (const slope of this.generated.slopes) {
      if (footX < slope.x || footX > slope.x + slope.width) continue;
      const t = (footX - slope.x) / slope.width;
      const lineY = slope.dir > 0
        ? slope.y + slope.height - t * slope.height
        : slope.y + t * slope.height;
      if (footY >= lineY - 4 && footY <= lineY + 20 && body.velocity.y >= -30) {
        this.player.y -= footY - lineY;
        body.setVelocityY(0);
        this.onSlope = true;
        break;
      }
    }
  }

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