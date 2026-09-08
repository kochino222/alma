# ART_BIBLE — Alma en Blanco
Auditoría técnica real, extraída de `juego.js` (4387 líneas) y `art_data.js` (357 líneas).
Este archivo se pega como contexto fijo en cada subtarea de Cline.

## 1. Hallazgo principal

**No existe ningún sistema de animación.** Cada entidad tiene UNA sola textura estática,
generada una única vez en `ArtData.generateBootTextures(scene)` (llamado en `BootScene.create()`,
línea ~430). El jugador (`this.player`, un `physics.add.sprite`) hoy solo se manipula con:

- `setFlipX(facing < 0)` — dirección
- `setScale(scaleX, scaleY)` + tween a `(1,1)` vía `squashPlayer()` — squash/stretch en salto/aterrizaje/dash
- `setTint(0xff5b67)` — flash de daño

Esto es una buena noticia: no hay que migrar nada, solo **agregar** un sistema de variantes
de textura y un wiring que las seleccione, sin tocar física ni colisiones.

## 2. Separación gameplay/render (confirmada, respetar)

- `art_data.js` = SOLO generación de texturas. No tiene lógica de juego, no importa nada de `juego.js`.
- `juego.js` llama a `ArtData` en exactamente **2 lugares**:
  - `window.ArtData.generateBootTextures(this)` — boot, genera todo.
  - `window.ArtData.makeSymbolicEntity(scene, kind, accentColor)` — al spawnear cada enemigo (memoiza con `scene.textures.exists(key)`, así que solo genera una vez por `kind`).
- Todo lo demás en `juego.js` referencia texturas **por string literal** (`"player"`, `"coin"`, `"boulder"`, etc.), no por objeto. Esto significa: **podés cambiar completamente cómo se generan las texturas sin tocar juego.js, siempre que conserves las mismas keys** (o generes nuevas keys y actualices los pocos call-sites, ver tabla abajo).

## 3. Contrato de texturas (key → generador → consumidores)

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

## 4. Paletas por mundo (extraídas de `LEVELS`, línea ~22)

| Mundo | tile | bgTop | bgMid | bgLow | accent | hazard | darkness |
|---|---|---|---|---|---|---|---|
| Desierto | tile-desert | `#261b1d` | `#7b4630` | `#d6964b` | `#ffce66` | `#cf4242` | 0.18 |
| Selva | tile-jungle | `#081b18` | `#124933` | `#2f7545` | `#75f1b4` | `#b97aff` | 0.42 |
| Volcán | tile-volcano | `#18080b` | `#5e1618` | `#ff6b2a` | `#ffb14a` | `#ff3f2e` | 0.26 |
| Vacío | tile-void | `#04050a` | `#131827` | `#282b38` | `#f4f0e2` | `#7df7ff` | 0.55 |

`accent` ya se usa como color dinámico en varios lugares (vetas de mineral, polvo de pie,
sprites de enemigos) — cualquier mejora de iluminación/props debería seguir usando
`this.levelInfo.accent/hazard` en vez de hardcodear colores nuevos, para no romper la
coherencia que ya existe.

## 5. Roster de enemigos (`SymbolicEntity`, 8 kinds)

| kind | Nombre in-game | Mecánica clave | Sprite actual (`makeSymbolicEntity`) |
|---|---|---|---|
| `creditor` | El Acreedor | Persigue, lanza lazo (`lassoActiveUntil`) | rect + círculo cabeza + piernas |
| `inflation` | La Inflación | Se "infla" (`ballooning`) y explota | rect + círculo cabeza + piernas (mismo branch que creditor) |
| `doubt` | La Duda | Invierte controles al golpear (`doubtUntil`) | círculo + piernas |
| `bias` | El Sesgo / Reflejo | Solo se mueve si `!observedByPlayer` (tipo estatua) | círculo + piernas (mismo branch que doubt) |
| `impulse` | El Impulso Ciego | Carga y embiste (`chargeUntil`, `chargeVelocityY`) | triángulo |
| `guilt` | La Culpa | Persigue en línea recta con "winding" (`targetX`) | triángulo (mismo branch que impulse) |
| `dogma` | El Dogma | Pulsa (`pulseStart`) | rect + círculo genérico (branch default) |
| `relativeVoid` | El Vacío Relativo | Vulnerable solo sin `attackAt` | rect + círculo genérico (branch default, **idéntico a dogma**) |

**Deuda técnica detectada:** `dogma` y `relativeVoid` caen en el mismo `else` genérico →
hoy son visualmente indistinguibles entre sí, y `creditor`/`inflation` comparten forma,
igual que `doubt`/`bias` e `impulse`/`guilt`. En la práctica solo hay **4 siluetas para 8
enemigos**. Esto es exactamente lo que pide tu doc original ("el jugador debe poder
reconocerlos antes de leer su nombre") — hoy no se cumple. Subtarea clara: una silueta
única por kind, idealmente reflejando su mecánica (ej. `bias` con apariencia de espejo/estatua,
`impulse` con pose de embestida).

## 6. Ganchos de animación disponibles para el jugador (no crear de cero, enganchar acá)

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

## 7. Recomendación de arquitectura para el sistema de animación

Dado que todo es procedural y no hay spritesheets: generar **múltiples texturas cacheadas**
por pose en boot (ej. `player-idle-0`, `player-idle-1`, `player-run-0`... `player-dash`,
`player-jump`, `player-fall`, `player-land`, `player-hurt`), todas del **mismo tamaño de
lienzo** (para que `setTexture()` no cause saltos en el body — ver regla de oro arriba),
y en el loop de `update()` elegir la key según los ganchos de la sección 6 y llamar
`this.player.setTexture(key)` solo cuando cambia el estado (no cada frame). Esto respeta
"generar una vez, cachear, reutilizar" de tu doc original y no toca física/colisiones.

## 8. Primeros dos briefs listos para Cline

### Brief 1 — Variantes de textura del jugador (solo art_data.js)

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

ARCHIVOS QUE PODÉS TOCAR: solo art_data.js
NO TOQUES: juego.js

CRITERIO DE ÉXITO:
- El juego sigue arrancando sin errores en consola
- makePlayer(scene, "player", {}) sigue existiendo y funcionando igual que antes
- Todas las texturas nuevas miden 32x46 (o 42x46 si layers.tool, igual que antes)
- Cada pose se ve visualmente distinta pero reconocible como el mismo personaje

AL TERMINAR: listá exactamente qué keys de textura nuevas generaste.
```

### Brief 2 — Wiring de animación en GameScene (solo juego.js)

```
CONTEXTO: "Alma en Blanco", Phaser 3. art_data.js ya genera texturas "player-idle-0",
"player-idle-1", "player-run-0".."player-run-3", "player-jump", "player-fall",
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

## 9. Riesgos / deuda técnica para tener en cuenta más adelante

- `dogma` y `relativeVoid` comparten sprite (sección 5) — subtarea futura de enemigos.
- `creditor`/`inflation` y `doubt`/`bias` también comparten forma entre sí.
- Los `body.setSize()/setOffset()` de props están hardcodeados en varios lugares de
  `createEntities()` — cualquier cambio de tamaño de textura (rocas, cajas, etc.) requiere
  tocar esas líneas a mano, no se recalculan solas.
- No se detectó ningún archivo CSS/HTML en lo que subiste — si la subtarea de UI necesita
  tocar la pantalla de inicio o el layout general, probablemente esté en el repo de GitHub
  que pasaste y no en estos dos archivos. Avisame cuando lleguemos a esa parte y lo reviso.
