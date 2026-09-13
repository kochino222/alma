# Architecture Reference — Alma en Blanco

> Fuente: gitingest del repositorio (kochino222/alma). Actualizar con `gitingest https://github.com/kochino222/alma` cuando haya cambios estructurales.

---

## Contenido

Este archivo consolida los documentos clave de arquitectura para consultas rápidas sin tener que leer múltiples archivos.

### 1. Contrato Técnico Real (Anteriormente ART_BIBLE.md)
Esta sección documenta las reglas de arquitectura y las convenciones técnicas extraídas de la implementación real del juego.

#### 1.1. Separación Gameplay/Render (Confirmada, Respetar)
- `art_data.js` = SOLO generación de texturas. No tiene lógica de juego, no importa nada de `juego.js`.
- `juego.js` llama a `ArtData` en exactamente **2 lugares**:
  - `window.ArtData.generateBootTextures(this)` — boot, genera todo.
  - `window.ArtData.makeSymbolicEntity(scene, kind, accentColor)` — al spawnear cada enemigo (memoiza con `scene.textures.exists(key)`, así que solo genera una vez por `kind`).
- Todo lo demás en `juego.js` referencia texturas **por string literal** (`"player"`, `"coin"`, `"boulder"`, etc.), no por objeto. Esto significa: **podés cambiar completamente cómo se generan las texturas sin tocar juego.js, siempre que conserves las mismas keys** (o generes nuevas keys y actualices los pocos call-sites, ver tabla de texturas).

#### 1.2. Contrato de Texturas (Key → Generador → Consumidores)
| Key | Generador en art_data.js | Tamaño | Usado en juego.js (grupo/objeto) |
|---|---|---|---|
| `tile-desert/jungle/volcano/void` | `makeTile()` | 32×32 | `map.addTilesetImage()` — tilemap del terreno |
| `player` | `makePlayer(scene, key, layers)` | 32×46 (42×46 si `layers.tool`) | `this.player = physics.add.sprite(...)` |
| `coin` | `makeCoin()` | 24×24 | `coinsGroup` |
| `fragment` | `makeFragment()` | 24×28 | `fragmentsGroup` |
| `spike` | `makeSpike()` | 32×32 | `spikesGroup` (static) |
| `boulder` | `makeBoulder()` | 36×36 | `bouldersGroup` |
| `crate` | `makeCrate()` | 32×32 | `cratesGroup` |
| `bomb` | `makeBomb()` | 24×26 | `bombsGroup` |
| `pot` | `makePot()` | 32×32 | `potsGroup` |
| `exit` | `makeExit()` | 48×64 | `physics.add.staticImage` |
| `altar` | `makeAltar()` | 64×54 | `altarsGroup` (static) |
| `spore` | `makeSpore()` | 28×28 | `sporesGroup` |
| `ladder` | `makeLadder()` | 32×32 | `this.add.image` por cada tile de escalera |
| `break-wall` | `makeWall()` | 32×32 | `destructiblesGroup` (static) |
| `particle-white/fire/blue/spore` | `makeParticles()` | 6×6 / 8×8 | ~8 emisores de partículas distintos (dust, spark, blue, altarWater, sporeMist, footDust, deathBurst, deathSpark, merchantSparks) |
| `symbolic-<kind>` (×8) | `makeSymbolicEntity(scene, kind, accentColor)` | 40×42 | `SymbolicEntity.sprite` (`scene.add.image`) |

**Regla de oro para cada subtarea:** si cambiás el tamaño de una textura, revisá el `body.setSize()/setOffset()` correspondiente en `createEntities()` — están hardcodeados en px y no se recalculan solos.

#### 1.3. Paletas por Mundo (Extraídas de `LEVELS`, línea ~22)
| Mundo | tile | bgTop | bgMid | bgLow | accent | hazard | darkness |
|---|---|---|---|---|---|---|---|
| Desierto | tile-desert | `#261b1d` | `#7b4630` | `#d6964b` | `#ffce66` | `#cf4242` | 0.18 |
| Selva | tile-jungle | `#081b18` | `#124933` | `#2f7545` | `#75f1b4` | `#b97aff` | 0.42 |
| Volcán | tile-volcano | `#18080b` | `#5e1618` | `#ff6b2a` | `#ffb14a` | `#ff3f2e` | 0.26 |
| Vacío | tile-void | `#04050a` | `#131827` | `#282b38` | `#f4f0e2` | `#7df7ff` | 0.55 |

`accent` ya se usa como color dinámico en varios lugares (vetas de mineral, polvo de pie, sprites de enemigos) — cualquier mejora de iluminación/props debería seguir usando `this.levelInfo.accent/hazard` en vez de hardcodear colores nuevos, para no romper la coherencia que ya existe.

#### 1.4. Ganchos de Animación Disponibles para el Jugador
Todos viven en `GameScene`, dentro/cerca de `update()` y el bloque de movimiento (~línea 2470-2600):
- `this.player.facing` (1 / -1) + ya llama `setFlipX`
- `onGround` = `body.blocked.down || body.touching.down || this.onSlope`
- `this.player.wasGrounded` (para detectar transición aire→suelo = landing)
- `this.dashUntil` / `this.dashDirection` (dash activo mientras `time < dashUntil`)
- `this.staggerUntil` (usado junto con `setTint` de daño)
- `this.onLadder` (booleano)
- `this.carried` (objeto en brazos: crate/pot/bomb)
- `body.velocity.y` (para distinguir subida/caída)
- `squashPlayer(scaleX, scaleY, duration)` ya existe y se llama en jump/doubleJump/landing — se puede dejar como capa extra sobre la animación nueva, no hace falta borrarlo.

#### 1.5. Recomendación de Arquitectura para el Sistema de Animación
Dado que todo es procedural y no hay spritesheets: generar **múltiples texturas cacheadas** por pose en boot (ej. `player-idle-0`, `player-idle-1`, `player-run-0`... `player-dash`, `player-jump`, `player-fall`, `player-land`, `player-hurt`), todas del **mismo tamaño de lienzo** (para que `setTexture()` no cause saltos en el body — ver regla de oro arriba), y en el loop de `update()` elegir la key según los ganchos de la sección 1.4 y llamar `this.player.setTexture(key)` solo cuando cambia el estado (no cada frame). Esto respeta "generar una vez, cachear, reutilizar" de tu doc original y no toca física/colisiones.

#### 1.6. Breve de Implementación de Animación (para agentes)
##### Brief 1 — Variantes de textura del jugador (solo art_data.js)
```
CONTEXTO: "Alma en Blanco", Phaser 3, sin assets externos, gráficos por Phaser.Graphics.
El jugador se genera hoy con makePlayer(scene, key="player", layers={}) en art_data.js,
lienzo 32x46 (42x46 con herramienta), y se usa como physics.add.sprite en juego.js.
NO existe sistema de animación: hoy es una sola textura estática.

TAREA: En art_data.js, generalizá makePlayer en una función nueva
generateCharacterFrame(scene, key, pose, layers = {}) que reutilice el diseño actual
(silueta blanca, visor cian, contorno) pero dibuje variaciones según "pose":
"idle-0", "idle-1" (respiración sutil), "run-0".."run-3" (ciclo de carrera con
desplazamiento de piernas/brazos), "jump", "fall", "dash" (inclinación + motion lines),
"land" (agachado), "hurt" (retroceso). TODAS las poses deben generarse en un lienzo
del MISMO tamaño (32x46, sin contar herramienta) para no romper el body físico.
Generá también generateBootTextures actualizado que llame a esta función para cada
pose con key `player-${pose}` (ej. "player-idle-0", "player-run-2"), ADEMÁS de seguir
generando "player" tal cual está (no lo borres, otras partes del código podrían
depender de esa key por defecto).

ARCHIVOS QUE PODÉS TOCAR: solo art_data.2js
NO TOQUES: juego.js

CRITERIO DE ÉXITO:
- El juego sigue arrancando sin errores en consola
- makePlayer(scene, "player", {}) sigue existiendo y funcionando igual que antes
- Todas las texturas nuevas miden 32x46 (o 42x46 si layers.tool, igual que antes)
- Cada pose se ve visualmente distinta pero reconocible como el mismo personaje

AL TERMINAR: listá exactamente qué keys de textura nuevas generaste.
```

##### Brief 2 — Wiring de animación en GameScene (solo juego.js)
```
CONTEXTO: "Alma en Blanco", Phaser 3. art_data.js ya genera texturas "player-idle-0",
"player-idle-1", "player-run-0".."run-3", "player-jump", "player-fall",
"player-dash", "player-land", "player-hurt" (mismo tamaño de lienzo que "player").
this.player es un physics.add.sprite creado en createPlayer() (busca esa función).

TAREA: Dentro del update() de GameScene (o un método nuevo llamado desde ahí, ej.
updatePlayerAnimation(time, dt)), agregá lógica que llame this.player.setTexture(key)
según el estado actual, usando ESTOS campos que ya existen y no hay que crear:
this.player.facing, onGround (body.blocked.down || body.touching.down || this.onSlope),
this.player.wasGrounded, this.dashUntil/this.dashDirection, this.staggerUntil,
this.onLadder, this.carried, body.velocity.y. Prioridad de estados (de mayor a menor):
hurt (time < staggerUntil) > dash (time < dashUntil) > jump/fall (según velocity.y y
!onGround) > run (onGround && |velocity.x| > umbral) > idle. Alterná entre los frames
de "run-0".."run-3" con un timer simple basado en dt (no uses this.time.now directo,
usá el dt que ya recibe update). Llamá a setTexture SOLO cuando el estado cambie
respecto al frame anterior (guardá el último estado en this.currentAnimState), no en
cada frame, para no generar trabajo innecesario.

ARCHIVOS QUE PODÉS TOCAR: solo juego.js, y solo dentro de GameScene
NO TOQUES: física, colisiones, generación procedural del mapa, ProceduralMap,
SymbolicEntity, ControlRig, ni ninguna otra escena

CRITERIO DE ÉXITO:
- El juego arranca sin errores
- El personaje cambia de pose visible al caminar, saltar, caer, dashear y recibir daño
- squashPlayer() sigue funcionando igual que antes (no lo borres ni lo reemplaces)
- Ninguna física ni colisión cambió de comportamiento

AL TERMINAR: indicá qué campo usaste para cada transición de estado.
```

#### 1.7. Deuda Técnica y Riesgos (Extracto de ART_BIBLE.md)
- Los `body.setSize()/setOffset()` de props están hardcodeados en varios lugares de `createEntities()` — cualquier cambio de tamaño de textura (rocas, cajas, etc.) requiere tocar esas líneas a mano, no se recalculan solas.
- No se detectó ningún archivo CSS/HTML en lo que subiste — si la subtarea de UI necesita tocar la pantalla de inicio o el layout general, probablemente esté en el repo de GitHub que pasaste y no en estos dos archivos. Avisame cuando lleguemos a esa parte y lo reviso.

#### 1.8. Arquitectura General del Proyecto
Todo el código fuente del juego y la escena principal han sido migrados a una estructura de *ES Modules* dentro de la carpeta `src/`. `GameScene` se compone de múltiples sistemas delegados (ver `hermes/architecture-reference.md`).

### 2. Pulido de Animación Paper-Doll (Anteriormente ANIMATION_POLISH_SUMMARY.md y VALORES_ANTES_DESPUES.md)
Este documento detalla los ajustes técnicos y matemáticos aplicados al sistema de animación "Paper-Doll" del jugador, con el objetivo de mejorar la sensación de movimiento y la respuesta visual.

#### 2.1. LERP (Suavizado Global)
- **Cambio:** `1 - Math.exp(-dt / 70)` ANTES, `1 - Math.exp(-dt / 45)` DESPUÉS.
- **Impacto:** Respuesta +35% más rápida (70ms → 45ms), transiciones sedosas pero reactivas.

#### 2.2. RUN (Carrera)
- **Frecuencia del ciclo:** ANTES: `0.010 → 0.020`, DESPUÉS: `0.012 → 0.025` (+20-25%). Zancadas más rápidas = sensación enérgica tipo Rayman.
- **Amplitud piernas:** ANTES: `±45°`, DESPUÉS: `±52°` (+15%). Zancadas más largas = movimiento dinámico.
- **Amplitud brazos:** ANTES: `±34°`, DESPUÉS: `±42°` (+23%). Contrabalanceo más atlético.
- **Inclinación torso:** ANTES: `2° → 7°`, DESPUÉS: `3° → 10°` (+43% max). Sensación de velocidad.
- **TORSO BOBBING (cambio clave):** Uso de `sin²` (cuadrático) acelera el "golpe" del pie. ANTES: `const footImpact = Math.abs(Math.cos(phase));`, DESPUÉS: `const footImpact = Math.abs(Math.sin(phase)); const impactSquared = footImpact * footImpact;`. **Resultado:** Peso realista como Hollow Knight.
- **Bobbing range:** ANTES: `0.8-2.8px`, DESPUÉS: `1.2-3.8px` (+35-50%).
- **Squash & Stretch:** ANTES: `0.035` max, DESPUÉS: `0.055` max (+57-66%). Más "juicy" (estilo cartoon).

#### 2.3. IDLE (Respiración)
- **Frecuencia de respiración:** ANTES: `0.0026` (ciclo cada ~2.4s), DESPUÉS: `0.0020` (ciclo cada ~3.1s) (-23%). Respiración más calmada.
- **Amplitud de rotación (torso):** ANTES: `±1.2°`, DESPUÉS: `±0.7°` (-42%). Movimiento sutil, no mareante.
- **Amplitud de rotación (cabeza):** ANTES: `±0.8°`, DESPUÉS: `±0.5°` (-37%).
- **Amplitud de ScaleY:** ANTES: `±0.035` (±3.5%), DESPUÉS: `±0.022` (±2.2%) (-37%). Respiración orgánica, sin parecer globo.
- **Movimiento vertical (torso):** ANTES: `±0.35px`, DESPUÉS: `±0.25px` (-28%). Respiración terrenal.
- **Movimiento vertical (cabeza):** ANTES: `±0.55px`, DESPUÉS: `±0.40px` (-27%).
- **Asimetría mejorada (desfase):** ANTES: `+0.35 rad`, DESPUÉS: `+0.6 rad` (+71%). Cabeza respira en fase diferente al torso.

#### 2.4. ESTADOS AÉREOS
##### A. SUBIENDO (`vy < -10`)
- **Inclinación más dramática:** `torsoAngle: 7°→13° ⇒ 8°→15°`, `headAngle: 4°→10° ⇒ 5°→12°`. Energía ascendente más visible.
- **Brazo frontal "heroico":** `frontArm: -115°→-158° ⇒ -120°→-165°`.
- **Piernas asimétricas:** `frontLeg: -24°→-48° ⇒ -28°→-54°`, `backLeg: 5°→15° ⇒ 8°→20°`.
- **Squash más sutil:** `torsoScaleY: 0.95 ⇒ 0.96`.

##### B. ÁPICE MEJORADO (`vy ±20`)
- **Cambio:** ANTES: Transición abrupta en `vy = ±10`, DESPUÉS: Transición **gradual** con blend progresivo (`apexBlend = 1 - Math.abs(vy) / 20`).
- **Impacto:** Momento zen al llegar al ápice. Transición sin pops visuales. Se siente como Hollow Knight.

##### C. CAYENDO (`vy > 20`)
- **Inclinación hacia atrás:** `torsoAngle: 3°→-2° ⇒ 2°→-4°`, `headAngle: 2°→-4° ⇒ 1°→-6°`. Sensación de gravedad.
- **Brazos (resistencia al aire):** `frontArm: -115°→-145° ⇒ -110°→-152°`, `backArm: -100°→-140° ⇒ -95°→-148°`.
- **Piernas asimétricas:** `frontLeg: -18°→0° ⇒ -12°→+5°`, `backLeg: 12°→0° ⇒ 8°→-3°`.
- **Stretch sutil:** `torsoScaleY: 0.98→1.0 ⇒ 0.98→1.02` (+2% nuevo).

#### 2.5. Técnicas de Animación Aplicadas
- **Principios de animación:** Squash & Stretch (0.055 max), Slow In/Out (Lerp 45ms), Anticipation (inclinación torso), Follow Through (cabeza con delay).
- **Game Feel:** Cuadrático (sin² para bobbing), Asimetría (brazos/piernas nunca idénticos), Blend progresivo (transiciones sin pops).

### 3. GDD.md — Diseño de juego
- 4 mundos / 8 subetapas
- Economía tripartita (Oro/HP/Fragmentos) + inflación 1.0/1.4/1.8/2.2x
- Fase A: caverna densa 65%, dinamita, Ruta Principal vs Vaults
- Plano Astral: 4 leyes permanentes
- Control multitáctil nativo
- Objetos frágiles con probabilidad de pérdida
- Escenografía narrativa evolutiva (Máquina → Entidad)
- Pausa extendida: Glosario + Semillas

### 4. plan-refactor.md — Estado del refactor
- **Fase 0 ✅**: Tag `pre-refactor-2026-09-09`
- **Fase 1 ✅**: ES Modules, juego.js 4837→102 líneas
- **Fase 2 ✅**: Extraer bloques a `src/` — 14 módulos (core, audio, escenas, mundo, entidades, controles)
- **Fase 3 ✅**: Partir GameScene 2702→407 → 11 módulos en `src/sistemas/` (patrón fachada + funciones `(scene, ...)`)
- **Fase 4 ⬜**: Cierre docs (GDD/ART_BIBLE, revisar CODIGO_OPTIMIZADO.js, consolidar ramas)
- Detalle Fase 3: `hermes/plan-fase3-gamescene.md`

### 5. verificar.html — Verificador automático
- Carga juego real + self-test (48 mapas)
- Reporte JSON en `<pre id="verificacion">`
- Título de página: `OK` / `FALLO - ...`
- Uso headless: `chrome --headless --dump-dom URL | grep "<title>"`

### 6. art_data.js — Generación procedural
- `generateBootTextures()` orquesta todo
- `makePlayer()` = marco invisible 32×46 (collider)
- Partes paper-doll: `player-torso` (16×20), `player-head` (18×16), `player-limb` (6×14), `player-limb-back`
- Enemigos: `makeSymbolicEntity(kind, accentColor)` → 8 kinds, memoizado

### 7. devpanel.js — Panel de desarrollo
- Activa con `localStorage.devMode = '1'`
- Badge versión (long-press 500ms)
- Controles: física, recursos, flags, leyes, acciones
- Persiste en `localStorage.devPanelParams`

### 8. src/sistemas/ — Módulos de sistema (Fase 3)
- `GameScene.js` (407 líneas) = orquestador: `create`/`update`/`setupCollisions` + 79 fachadas de una línea que delegan.
- Cada módulo exporta funciones puras `function(scene, ...)`. Módulos (líneas):
  - `mercader.js` (119) — mercader, ofertas, compra, salas especiales
  - `destructibles.js` (96) — macetas/cajas/muros, impulso destructivo
  - `manos.js` (209) — acarreo de objetos + callbacks de colisión portables/rocas
  - `hud.js` (161) — HUD, layout, `showMessage`
  - `altar.js` (93) — altar/dios, negociación, sacrificio
  - `progresion.js` (245) — muerte, descenso, escena Astral
  - `combate.js` (197) — ataques simbólicos, daño, absorción
  - `mundo-dinamica.js` (211) — bombas, lava, iluminación, terreno, recolección
  - `interaccion.js` (122) — interacciones genéricas, salvaguardas de cueva
  - `movimiento.js` (547) — movimiento + animación procedural del jugador
  - `construccion.js` (521) — construcción de mundo/entidades (lo que `create()` orquesta)

---

## Cómo actualizar

```bash
# Desde la raíz del repo
gitingest https://github.com/kochino222/alma > hermes/architecture-reference.md
# O copiar manualmente los archivos cambiados a sus secciones correspondientes
```

---

## Cómo consultar (para agentes/subagentes)

> **Instrucción standing**: Cuando la tarea involucre arquitectura, texturas, enemigos, animación, economía, refactor, o cualquier decisión que toque múltiples sistemas, **leé este archivo primero**. Si la info no está acá, buscá en el archivo fuente correspondiente (referenciado en cada sección).

Ejemplos de cuándo consultar:
- "¿Qué texturas usa el jugador?" → Sección 1 (tabla texturas) + 6 (makePlayer)
- "¿Cómo agrego un enemigo nuevo?" → Sección 1 (roster) + 6 (makeSymbolicEntity)
- "¿Qué parámetros tocar para balancear cámara?" → plan-refactor.md §2 (GameScene) + verify.html
- "¿Cómo testeo sin romper saves?" → plan-refactor.md §5 (checklist + SAVE_KEY)

---

## Archivos fuente en el repo

| Archivo | Sección aquí | Última modif |
|---|---|---|
| `GDD.md` | 3 | 2026-09-09 |
| `hermes/plan-refactor.md` | 4 | 2026-09-11 |
| `hermes/plan-fase3-gamescene.md` | 4 (Fase 3) | 2026-09-11 |
| `hermes/verificar.html` | 5 | 2026-09-10 |
| `hermes/verificar-gamescene.html` | 5 (GameScene) | 2026-09-10 |
| `art_data.js` | 6 | 2026-09-10 |
| `devpanel.js` | 7 | 2026-09-10 |
| `src/escenas/GameScene.js` | 8 | 2026-09-11 |
| `src/sistemas/*.js` (11 módulos) | 8 | 2026-09-11 |
| `juego.js` | (entry point) | 2026-09-10 |
| `index.html` | (entry point) | 2026-09-10 |