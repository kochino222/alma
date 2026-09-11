// Sistema de movimiento y animacion del jugador - Alma en Blanco (Fase 3)
// Extraído de src/escenas/GameScene.js. Funciones puras que reciben `scene`.

import { JUMP_SPEED, SACRIFICE_JUMP_SPEED } from "../core/constantes.js";
import { clamp, rectsOverlap, makeRect } from "../core/utils.js";
import { lawActive, effectiveCoinBurden, playerMoveSpeed } from "../core/guardado.js";
import { AUDIO } from "../audio/AudioEngine.js";

export function handleMovement(scene, controls, time, dt) {
  const body = scene.player.body;
  const onGround = body.blocked.down || body.touching.down || scene.onSlope;
  // ETAPA 2: el contenedor visual sigue al collider invisible en cada frame.
  if (scene.playerRig) {
    scene.playerRig.setPosition(scene.player.x, scene.player.y);
  }
  if (onGround && Math.abs(body.velocity.x) < 8 && !controls.axis) {
    if (!scene.idleGroundSince) scene.idleGroundSince = time;
  } else scene.idleGroundSince = 0;
  if (!scene.playerHistory) scene.playerHistory = [];
  scene.playerHistory.push({ time, x: scene.player.x, y: scene.player.y, facing: scene.player.facing });
  while (scene.playerHistory.length && scene.playerHistory[0].time < time - 1150) scene.playerHistory.shift();
  if (!onGround && body.velocity.y > 0) scene.maxFallSpeed = Math.max(scene.maxFallSpeed, body.velocity.y);
  if (onGround) { scene.lastGroundedAt = time; scene.airJumps = 1; }
  if (controls.jumpPressed) scene.lastJumpPressAt = time;

  const coinBurden = scene.featherBoots ? 0 : effectiveCoinBurden(scene.coins, scene.meta);
  const empowered = time < scene.absorptionUntil;
  const speed = (playerMoveSpeed(scene.featherBoots ? 0 : scene.coins, scene.meta, scene.godPowerTimer) + (empowered ? 28 : 0)) * (scene.carried ? 0.9 : 1);
  const accel = onGround ? 0.23 : 0.14;
  if (controls.axis) {
    scene.inertiaDirection = Math.sign(controls.axis);
    scene.inertiaUntil = 0;
  }
  const inertialAxis = controls.axis;
  const desired = inertialAxis * speed;
  if (onGround && controls.axis && Math.sign(controls.axis) !== Math.sign(body.velocity.x) && Math.abs(body.velocity.x) > 70 && time >= scene.skidDustReadyAt) {
    scene.footDust.explode(4, body.center.x + Math.sign(body.velocity.x) * 9, body.bottom - 2);
    scene.skidDustReadyAt = time + 180;
  }
  body.velocity.x = Phaser.Math.Linear(body.velocity.x, desired, inertialAxis ? accel : (onGround ? 0.18 : 0.04));
  if (!controls.axis && onGround && Math.abs(body.velocity.x) < 8) body.velocity.x = 0;
  const ascending = time < scene.ascentUntil;
  body.setGravityY(time < scene.localGravityUntil ? -2 * scene.physics.world.gravity.y : ascending ? 0 : coinBurden * (scene.debtMass || 1));
  body.setMaxVelocity(300, ascending ? 820 : 620 + coinBurden * 0.55);

  if (controls.axis !== 0) {
    scene.player.facing = Math.sign(controls.axis);
    scene.player.setFlipX(scene.player.facing < 0);
  }

  const canCoyote = time - scene.lastGroundedAt <= 110;
  const buffered = time - scene.lastJumpPressAt <= 125;
  if (buffered && canCoyote && !scene.onLadder && !(time < scene.staggerUntil)) {
    const route = scene.generated.dramaticRoutes.find(r => r.unlocked &&
      rectsOverlap(makeRect(body.x, body.y, body.width, body.height), r.launchZone));
    if (route) {
      scene.ascentUntil = time + 1700;
      body.setGravityY(0).setMaxVelocity(300, 820);
    }
    body.setVelocityY(route ? -SACRIFICE_JUMP_SPEED : -(JUMP_SPEED + (empowered ? 48 : 0) + (time < scene.riskJumpUntil ? 80 : 0)));
    scene.lastJumpPressAt = -9999;
    scene.lastGroundedAt = -9999;
    scene.player.wasGrounded = false;
    scene.footDust.explode(5, scene.player.x - 9, scene.player.y + 22);
    scene.footDust.explode(5, scene.player.x + 9, scene.player.y + 22);
    scene.squashPlayer(0.8, 1.25, 130);
    AUDIO.jump();
    if (scene.nearDramatic && !scene.nearDramatic.unlocked) {
      scene.showMessage("Ese ascenso exige una ofrenda. E: entregar oro o 1 vida.", 1800);
    }
  } else if (buffered && !canCoyote && !scene.onLadder && lawActive(scene.meta, "doubleJump") && scene.airJumps > 0 && scene.coins > 0 && !(time < scene.staggerUntil)) {
    scene.coins -= 1;
    scene.airJumps -= 1;
    body.setVelocityY(-(JUMP_SPEED + 20));
    if (lawActive(scene.meta, "willInertia") && Math.abs(body.velocity.x) > 24) {
      scene.fluidezAirVelocity = body.velocity.x;
      scene.fluidezAirUntil = time + 1500;
    }
    scene.lastJumpPressAt = -9999;
    scene.dust.explode(8, scene.player.x, scene.player.y + 16);
    scene.squashPlayer(0.84, 1.2, 120);
    AUDIO.jump();
    scene.showMessage("Doble Salto Sacramental: 1 moneda.", 1100);
  }

  if (controls.jumpReleased && body.velocity.y < -120) {
    body.setVelocityY(-120);
  }

  if (controls.attackPressed && time >= scene.dashReadyAt) {
    if (scene.carried) {
      scene.releaseCarried(controls.down, time);
      scene.dashReadyAt = time + 180;
    } else if (scene.nearMerchant) {
      scene.cycleMerchant();
      scene.dashReadyAt = time + 220;
    } else if (scene.nearDramatic && !scene.nearDramatic.unlocked && scene.levelInfo.key === "volcano") {
      scene.sacrificeForRoute(scene.nearDramatic, true);
      scene.dashReadyAt = time + 720;
    } else if (scene.nearGod && scene.levelInfo.key === "void") {
      scene.absorbGodPower(time);
    } else {
      const dir = scene.player.facing || controls.facing || 1;
      scene.dashDirection = dir;
      scene.dashUntil = time + 160;
      body.setVelocityX(dir * 300);
      if (lawActive(scene.meta, "willInertia")) {
        scene.fluidezAirVelocity = dir * 300;
        scene.fluidezAirUntil = time + 520;
      }
      body.setVelocityY(Math.min(body.velocity.y, -60));
      scene.invulnUntil = Math.max(scene.invulnUntil, time + 160);
      scene.dashReadyAt = time + 720;
      scene.dust.explode(14, scene.player.x - dir * 10, scene.player.y + 14);
      AUDIO.dash();
    }
  }

  if (time < scene.dashUntil) body.setVelocityX(scene.dashDirection * 300);

  if (onGround && scene.player.wasGrounded === false && body.velocity.y >= 0) {
    // Ignore tiny contact oscillations: only a real fall gets landing feedback.
    if (scene.maxFallSpeed >= 80 && time >= scene.landingFeelReadyAt) {
      scene.footDust.explode(7, scene.player.x, scene.player.y + 24);
      scene.squashPlayer(1.25, 0.75, 150);
      scene.landingFeelReadyAt = time + 220;
    }
    if (scene.maxFallSpeed >= 390) scene.cameras?.main?.shake(100, 0.005);
    scene.maxFallSpeed = 0;
    if (lawActive(scene.meta, "greedTransmutation") && scene.coins > 0 && scene.maxFallSpeed >= 340) {
      const mass = scene.featherBoots ? 0 : effectiveCoinBurden(scene.coins, scene.meta);
      const radius = clamp(44 + mass * 0.48, 44, 150);
      scene.blue.explode(clamp(Math.round(8 + mass / 12), 8, 26), scene.player.x, scene.player.y + 20);
      for (const entity of scene.symbolicEntities || []) {
        if (entity.state === "active" && Math.hypot(entity.x - scene.player.x, entity.y - scene.player.y) <= radius) {
          entity.stunnedUntil = Math.max(entity.stunnedUntil, time + 1200);
        }
      }
    }
  }
  if (!onGround && lawActive(scene.meta, "willInertia") && time < scene.fluidezAirUntil) body.velocity.x = scene.fluidezAirVelocity;
  scene.player.wasGrounded = onGround;
  scene.walkDustTimer += dt;
  if (onGround && body.velocity.y >= 0 && !scene.onLadder && controls.axis && Math.abs(body.velocity.x) > 35 && scene.walkDustTimer >= 85) {
    scene.footDust.explode(1, body.center.x - scene.player.facing * 8, body.bottom - 1);
    scene.walkDustTimer = 0;
  } else if (!onGround || !controls.axis) scene.walkDustTimer = 85;
}

export function updatePlayerAnimation(scene, time) {
  if (!scene.player?.body || !scene.playerRig || !scene.rigParts) return;

  const body = scene.player.body;
  const parts = scene.rigParts;

  // ============================================================
  // 1. Estado persistente de la animación
  // ============================================================
  if (!scene.rigAnim) {
    scene.rigAnim = {
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

    scene.rigTorsoBaseY = parts.torso.y;
    scene.rigHeadBaseY = parts.head.y;
  }

  const R = scene.rigAnim;

  // ============================================================
  // 2. Datos físicos
  // ============================================================
  const vx = body.velocity.x;
  const vy = body.velocity.y;
  const speedX = Math.abs(vx);
  const onGround = Boolean(body.blocked.down || scene.onSlope);

  // ============================================================
  // 3. Flip visual
  // ============================================================
  scene.playerRig.setScale(scene.player.facing, 1);

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

  let targetTorsoY = scene.rigTorsoBaseY;
  let targetHeadAngle = 0;
  let targetHeadY = scene.rigHeadBaseY;

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
  if (scene.staggerUntil > time) {
    // Retroceso fuerte, pero con pequeñas diferencias entre miembros
    // para evitar el aspecto perfectamente simétrico.
    targetTorsoAngle = -24;
    targetHeadAngle = -18;

    targetFrontArm = -148;
    targetBackArm = -122;

    targetFrontLeg = -34;
    targetBackLeg = 28;

    targetTorsoY = scene.rigTorsoBaseY + 1;
    targetHeadY = scene.rigHeadBaseY - 1;
    targetTorsoScaleY = 0.96;
  }
  // ------------------------------------------------------------
  // DASH
  // ------------------------------------------------------------
  else if (scene.dashUntil > time) {
    // Inclinación agresiva hacia delante.
    targetTorsoAngle = 30;
    targetHeadAngle = 25;

    // Brazos completamente arrastrados hacia atrás.
    targetFrontArm = -62;
    targetBackArm = -82;

    // Piernas compactas para reforzar la sensación de impulso.
    targetFrontLeg = -18;
    targetBackLeg = 12;

    targetTorsoY = scene.rigTorsoBaseY - 1;
    targetHeadY = scene.rigHeadBaseY - 2;
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

      targetTorsoY = scene.rigTorsoBaseY - Phaser.Math.Linear(0, 2.0, rise);
      targetHeadY = scene.rigHeadBaseY - Phaser.Math.Linear(0, 1.4, rise);

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

      targetTorsoY = scene.rigTorsoBaseY - Phaser.Math.Linear(0.5, 1.2, apexBlend);
      targetHeadY = scene.rigHeadBaseY - Phaser.Math.Linear(0.3, 0.8, apexBlend);

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

      targetTorsoY = scene.rigTorsoBaseY + Phaser.Math.Linear(0, 2.2, fall);
      targetHeadY = scene.rigHeadBaseY + Phaser.Math.Linear(0, 1.5, fall);

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

    targetTorsoY = scene.rigTorsoBaseY + bob;
    targetHeadY = scene.rigHeadBaseY + bob * 0.75;

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
    targetTorsoY = scene.rigTorsoBaseY - breath * 0.25;
    targetHeadY = scene.rigHeadBaseY - breath * 0.40;

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

export function squashPlayer(scene, scaleX, scaleY, duration) {
  if (!scene.player?.setScale || !scene.tweens?.add || scene.ending) return;
  if (scene.squashTween) scene.squashTween.stop();
  scene.player.setScale(scaleX, scaleY);
  scene.stabilizePlayerBody();
  scene.squashTween = scene.tweens.add({
    targets: scene.player, scaleX: 1, scaleY: 1, duration,
    ease: "Back.Out",
    onUpdate: () => scene.stabilizePlayerBody(),
    onComplete: () => {
      if (scene.ending) return;
      scene.player.setScale(1, 1);
      scene.player.body.setSize(20, 35).setOffset(6, 10);
      scene.squashTween = null;
    }
  });
}

export function stabilizePlayerBody(scene) {
  const body = scene.player?.body;
  if (!body) return;
  const sx = Math.max(0.01, Math.abs(scene.player.scaleX || 1));
  const sy = Math.max(0.01, Math.abs(scene.player.scaleY || 1));
  body.setSize(20 / sx, 35 / sy).setOffset(6 / sx, 10 / sy);
}

export function handleLadders(scene, controls) {
  scene.onLadder = scene.ladderZones.some(zone => scene.physics.overlap(scene.player, zone));
  if (scene.onLadder && (controls.up || controls.down)) {
    scene.player.body.allowGravity = false;
    scene.player.body.setVelocityY((controls.down ? 1 : 0) * 120 - (controls.up ? 1 : 0) * 120);
    scene.player.body.velocity.x = Phaser.Math.Linear(scene.player.body.velocity.x, controls.axis * 95, 0.2);
  } else {
    scene.player.body.allowGravity = true;
  }
}

export function resolveSlope(scene) {
  scene.onSlope = false;
  const body = scene.player.body;
  const footX = body.x + body.width / 2;
  const footY = body.y + body.height;
  for (const slope of scene.generated.slopes) {
    if (footX < slope.x || footX > slope.x + slope.width) continue;
    const t = (footX - slope.x) / slope.width;
    const lineY = slope.dir > 0
      ? slope.y + slope.height - t * slope.height
      : slope.y + t * slope.height;
    if (footY >= lineY - 4 && footY <= lineY + 20 && body.velocity.y >= -30) {
      scene.player.y -= footY - lineY;
      body.setVelocityY(0);
      scene.onSlope = true;
      break;
    }
  }
}
