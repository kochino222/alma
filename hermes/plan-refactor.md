# Plan de refactor — Alma en Blanco

> Documento vivo. Escrito por Herminia (asistente de Santiago) para que el plan **no dependa de una conversación**.
> Última verificación contra el repo: rama `mejoras-graficas`, commit `49d38dc` ("entroclaudio"), working tree limpio.

---

## 1. Objetivo

Diseccionar `juego.js` — hoy un monolito de **4782 líneas / 227 KB** — en archivos con responsabilidad única, **sin romper el juego**.

Esto es un refactor de *estructura*, no de *comportamiento*. Al terminar, el juego debe verse y comportarse **exactamente igual** que hoy.

---

## 2. Estado actual verificado

| Archivo | Líneas | Rol |
|---|---|---|
| `index.html` | ~30 | Carga Phaser 3.80.1 (CDN), `art_data.js`, `juego.js`, `estilos.css` |
| `juego.js` | **4782** | Todo el juego, envuelto en un IIFE |
| `art_data.js` | 382 | Arte procedural, expuesto como `window.ArtData` |

**Estructura de `juego.js`:**

```js
(() => {
  "use strict";
  if (!window.Phaser) { /* fallback */ return; }
  ...
  // TODO el juego acá adentro
})();
```

Consecuencia crítica: **todo es privado**. Clases, constantes y funciones viven dentro del IIFE y no existen fuera de él.

### Mapa de bloques (líneas reales)

| Líneas | Bloque | Tamaño |
|---|---|---|
| 1–291 | Cabecera IIFE + constantes + ~40 helpers (`TILE`, `LEVELS`, `LAW_DEFS`, `loadMeta`, `rectsOverlap`…) | 291 |
| 292–415 | `AudioEngine` | 124 |
| 417–437 | `BootScene` | 21 |
| 438–587 | `MenuScene` | 150 |
| 588–1069 | `ProceduralMap` | 482 |
| 1070–1403 | `SymbolicEntity` | 334 |
| 1404–1685 | `ControlRig` | 282 |
| **1686–4351** | **`GameScene`** — **79 métodos** | **2666 (56%)** |
| 4353–4566 | `AstralScene` | 214 |
| 4568–4679 | `PauseScene` | 112 |
| 4680–4735 | `installSelfTests` + `installNativeTouchGuards` | 56 |
| 4736–4782 | `config` + arranque del juego | 47 |

**El diagnóstico real:** las 9 clases chicas están bien separadas por responsabilidad. El problema no es el reparto de clases — **el problema es `GameScene`**, que concentra el 56% del archivo en 79 métodos.

Un `GameScene` de 2666 líneas es *normal* en Phaser (es la escena principal y toca todo), así que no hay que "arreglarlo" por culpa: hay que **partirlo por grupos de responsabilidad** (ver Fase 4).

---

## 3. Por qué NO se puede "cortar y pegar"

Cortar cada clase a un archivo propio y cargarlos con `<script>` clásicos **rompe el juego**. Motivo:

```html
<script src="ProceduralMap.js"></script>  <!-- define ProceduralMap local a su archivo -->
<script src="GameScene.js"></script>      <!-- NO ve ProceduralMap, ni TILE, ni LEVELS -->
```

Cada `<script>` clásico tiene su propio scope. `GameScene` en otro archivo no vería `TILE`, `LEVELS`, `rectsOverlap`, `AudioEngine`… Cero comunicación. El juego no arrancaría y el error sería confuso (`TILE is not defined`).

**La forma correcta es ES Modules** (`import`/`export`), que sí permiten dependencias explícitas entre archivos.

### Precedente: ya se hizo una vez

La rama `separacion_arte` muestra que **`index.html` llegó a tener 4229 líneas** con el juego embebido, y de ahí se extrajo a `juego.js` + `art_data.js`. Ese refactor funcionó porque `art_data.js` expone `window.ArtData` y `juego.js` lo consume con guardas:

```js
if (window.ArtData) { window.ArtData.generateBootTextures(this); }
```

O sea: **ya hay un patrón probado en este repo** (global en `window`). EsModules es la versión correcta y escalable del mismo movimiento.

---

## 4. Plan por fases

Principio rector: **una fase = un commit = un estado jugable**. Si algo se rompe, se revierte sin perder el resto.

### Fase 0 — Red de seguridad (nada de código)
- [ ] Tag/rama de respaldo: `git tag pre-refactor-<fecha>` sobre `mejoras-graficas`.
- [ ] Definir planilla de prueba manual mínima (checklist para saber si el juego quedó igual).
- [ ] Copia de seguridad del save (`localStorage`, clave `blank-soul-save-v4`) por si el refactor cambia algo.
- [ ] Página de testeo aparte en GitHub Pages, para no tocar la versión jugable mientras se refactoriza.

**Checklist de prueba (ejecutar en cada fase):**
- [ ] Carga el menú y arranca una partida
- [ ] Movimiento, salto, escaleras, pendientes
- [ ] Coger/soltar objetos, romper macetas/cajas
- [ ] Ataques simbólicos y parry
- [ ] Mercader: comprar, rechazar, precios inflados
- [ ] Altar, bomba, cavar terreno, derrumbe de paredes
- [ ] Muerte, descenso de mundo, escena Astral
- [ ] Pausa y reanudar
- [ ] Guardado/carga entre sesiones
- [ ] Controles táctiles (móvil)

### Fase 1 — Convertir a ES Modules **sin partir nada** (el paso crítico)
Resultado: `juego.js` sigue siendo 1 archivo de ~4782 líneas, pero deja de ser un IIFE privado.

- `juego.js` → `src/juego.js` como módulo: exporta lo que necesite, elimina el wrapper IIFE (el IIFE ya no hace falta: el módulo ES tiene su propio scope).
- `index.html`: `<script src="juego.js">` → `<script type="module" src="src/main.js">`
- Mantener Phaser por CDN *antes* del módulo (Phaser debe existir en `window`).
- `art_data.js` → pasar de `window.ArtData` a `export`.

👉 **Esta fase sola no reduce líneas, pero es la que hace posible todo lo demás.** Si esta fase sale bien y el juego carga igual, el riesgo grande ya pasó.

⚠️ **GitHub Pages sirve los módulos con MIME correcto sin configuración**, pero hay dos trampas:
1. Los módulos **exigen servidor HTTP** — abrir `index.html` con doble clic (`file://`) fallará por CORS. Hay que testear con `python -m http.server` o directo en Pages.
2. Pages cachea con fuerza. Para verificar un cambio, usar `?v=<n>` o hard-refresh.

### Fase 2 — Extraer los bloques fáciles (bajo riesgo, alto alivio)
Extraer en este orden, **un commit cada uno**, verificando el checklist cada vez:

1. `src/core/constantes.js` — `VIEW_W`, `TILE`, `LEVELS`, `LAW_DEFS`, `SAVE_KEY`…
2. `src/core/utils.js` — `hashSeed`, `mulberry32`, `rectsOverlap`, `makeRect`, multiplicadores…
3. `src/core/guardado.js` — `loadMeta`, `saveMeta`, `toSaveShape`, `fromSaveShape`, `normalizeMeta`…
4. `src/audio/AudioEngine.js`
5. `src/escenas/BootScene.js`, `MenuScene.js`, `PauseScene.js`, `AstralScene.js`
6. `src/mundo/ProceduralMap.js`
7. `src/entidades/SymbolicEntity.js`
8. `src/controles/ControlRig.js`
9. `src/sistemas/selfTests.js` + `touchGuards.js`

Tras esta fase: `juego.js` baja de 4782 a ~**2700 líneas** (sólo `GameScene` + arranque).

### Fase 3 — Partir `GameScene` (el refactor de verdad)
Aquí está el verdadero valor. `GameScene` queda como **orquestador** (Phaser exige una clase de escena), y los 79 métodos se agrupan en módulos de sistema que la escena compone:

| Módulo propuesto | Métodos representativos | ~Líneas |
|---|---|---|
| `escena/construccion.js` | `create`, `createWorld`, `createEntities`, `createSpecialSites`, `createGod`, `createPlayer`, `createEffects`, `createBackground`, `configureCamera` | ~650 |
| `escena/hud.js` | `createHud`, `layoutHud`, `updateHud`, `showMessage` | ~200 |
| `jugador/movimiento.js` | `handleMovement`, `handleLadders`, `resolveSlope`, `updatePlayerAnimation`, `squashPlayer`, `stabilizePlayerBody` | ~400 |
| `jugador/manos.js` | `updateHandsRig`, `tryPickupNearby`, `nearbyPortable`, `releaseCarried`, `dropCarried`, `onPortable*` | ~250 |
| `combate/simbolico.js` | `spawnSymbolicAttack`, `parryAttack`, `updateSymbolicAttacks`, `absorbSymbolic`, `takeDamage` | ~200 |
| `mundo/dinamica.js` | `updateWorldDynamics`, `drawLava`, `updateLighting`, `destroyTerrainCircle`, `deployBomb`, `detonateBomb` | ~200 |
| `mundo/destructibles.js` | `breakPot`, `breakCrate`, `crackWall`, `breakWall`, `onBoulder*`, `onPushCrate` | ~200 |
| `economia/mercader.js` | `cycleMerchant`, `merchantOffers`, `buyMerchantItem`, `rejectPurchase`, `useSpecialRoom` | ~150 |
| `progresion/run.js` | `descend`, `completeRun`, `die`, `startAstral`, `stopForAstral`, `checkDeathPlane`, `surrenderToAstral`, `preserveEtherealGold` | ~250 |
| `interaccion/altar.js` | `useAltar`, `negotiateWithGod`, `absorbGodPower`, `seismicLifeStrike`, `sacrificeForRoute` | ~200 |

Criterio de corte: **módulos como funciones puras o clases que reciben `scene` como parámetro** (patrón "sistema"), en vez de herencia o mixins. Así cada pieza es testeable y no hay sorpresas de `this`.

👉 `GameScene` final esperado: **~300–400 líneas** (constructor, `init`, `update` como despachador, y los campos de estado).

### Fase 4 — Cierre
- Actualizar `GDD.md` / `ART_BIBLE.md` con la nueva estructura.
- Borrar `CODIGO_OPTIMIZADO.js` si quedó obsoleto (verificar antes).
- Consolidar ramas (`separacion_arte`, `separacionboba`) o cerrarlas.

---

## 5. Riesgos y trampas conocidas

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | **Todo es privado (IIFE)** | ES Modules es obligatorio; cortar y pegar con `<script>` clásico NO funciona |
| 2 | **`file://` rompe los módulos** | Testear con `python -m http.server` o en Pages, nunca con doble clic |
| 3 | **Pérdida de estado compartido** | Al extraer, listar para cada módulo qué necesita *importar* antes de mover una sola línea |
| 4 | **`this` en métodos extraídos** | Pasar `scene` explícito o mantener los métodos que usan `this` dentro de la clase |
| 5 | **`localStorage` y saves** | `SAVE_KEY = "blank-soul-save-v4"` no debe cambiar; el guardado codifica/decodifica Base64 y versiones de save pueden invalidar partidas |
| 6 | **Orden de carga de scripts** | Phaser (CDN) debe cargarse antes del módulo; `ArtData` antes de `BootScene` |
| 7 | **Finales de línea CRLF** | El repo está en CRLF; editar mezclando LF genera diffs gigantes de ruido |
| 8 | **`PauseScene` sin indentar** | La clase en línea 4568 está a 0 espacios mientras el resto usa 4 → quedó pegada tarde; sin efecto funcional, pero cuidado al moverla |
| 9 | **Caché de GitHub Pages** | Verificar con hard-refresh o query string |
| 10 | **Costo en tokens** | El trabajo mecánico de cortar/pegar no necesita modelo caro → delegable (ver Decisión) |

---

## 6. Decisión pendiente

El refactor a ES Modules es más delicado que cortar y pegar. Opciones planteadas:

- **A)** Herminia lo hace paso a paso, verificando que el juego cargue en cada fase.
- **B)** Delegar la parte mecánica a un subagente/modelo barato y supervisar (ahorra tokens de razonamiento).
- **C)** Primero armar la memoria del proyecto; refactor en otra sesión.
- **D)** Explicar más el riesgo antes de decidir.

**Recomendación:** hacer **Fase 0 + Fase 1 con verificación propia** (es donde se rompe todo si se hace mal), y recién después delegar la extracción mecánica de la Fase 2.

---

## 7. Registro de avance

| Fecha | Fase | Estado | Notas |
|---|---|---|---|
| — | 0 | ⬜ pendiente | — |
| — | 1 | ⬜ pendiente | — |
| — | 2 | ⬜ pendiente | — |
| — | 3 | ⬜ pendiente | — |
| — | 4 | ⬜ pendiente | — |

> Al cerrar cada fase: marcar acá, commitear el código **y** este documento en el mismo commit.
