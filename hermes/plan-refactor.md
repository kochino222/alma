# Plan de refactor — Alma en Blanco

> Documento vivo. Escrito por Herminia (asistente de Santiago) para que el plan **no dependa de una conversación**.
> **Fases 0, 1, 2 y 3 completadas** — rama `refactor-fase3`, tag de seguridad `pre-refactor-2026-09-09`.

---

## 1. Objetivo

Diseccionar `juego.js` — originalmente un monolito de **4837 líneas / 231 KB** — en archivos con responsabilidad única, **sin romper el juego**.

Es un refactor de *estructura*, no de *comportamiento*. Al terminar, el juego debe verse y comportarse **exactamente igual**.

---

## 2. Estado actual (post-Fase 2)

| Archivo | Líneas | Rol |
|---|---|---|
| `index.html` | 25 | Carga Phaser 3.80.1 (CDN) + un solo `<script type="module">` |
| `juego.js` | **102** | Punto de entrada: imports + `config` + arranque. Sin lógica de juego |
| `art_data.js` | 387 | Módulo ES. `export const ArtData` + puente `window.ArtData` |
| `src/` | 5079 | 25 módulos con responsabilidad única (ver abajo) |
| `devpanel.js` | 399 | Panel de desarrollo (long-press 500ms en el badge de versión) |
| `hermes/verificar.html` | — | Verificador automático: Phaser, escenas, texturas, self-test 48 mapas |
| `hermes/verificar-gamescene.html` | — | Verificador de `GameScene`: 25 checks de sistemas, física y cruces entre módulos |
| `hermes/plan-refactor.md` | — | Este documento |

### Mapa de `src/` (líneas reales)

| Ruta | Líneas | Rol |
|---|---|---|
| `src/core/constantes.js` | 110 | `VIEW_W/H`, `TILE`, `LEVELS`, `LAW_DEFS`, `DEFAULT_META`, `SAVE_KEY`… |
| `src/core/utils.js` | 52 | `clamp`, `Between`, `screenW/H`, `hashSeed`, `mulberry32`, `rectsOverlap`… |
| `src/core/guardado.js` | 131 | Save/load Base64, `normalizeMeta`, leyes, inflación, banco de fragmentos |
| `src/audio/AudioEngine.js` | 128 | `class AudioEngine` **+ singleton `AUDIO`** |
| `src/escenas/BootScene.js` | 23 | Genera texturas y arranca el menú |
| `src/escenas/MenuScene.js` | 156 | Menú principal |
| `src/escenas/GameScene.js` | **407** | Orquestador: `create`/`update`/`setupCollisions` + 79 fachadas que delegan a `src/sistemas/` |
| `src/escenas/AstralScene.js` | 221 | Meta-progreso / negociación de leyes |
| `src/escenas/PauseScene.js` | 117 | Pausa + copia de semilla |
| `src/mundo/ProceduralMap.js` | 487 | Generador procedural + su `selfTest()` |
| `src/entidades/SymbolicEntity.js` | 339 | Los 8 enemigos simbólicos |
| `src/controles/ControlRig.js` | 287 | Teclado + táctil multitáctil |
| `src/controles/touchGuards.js` | 16 | Bloqueo de gestos nativos del canvas |
| `src/sistemas/selfTests.js` | 59 | `installSelfTests`, `installNativeTouchGuards` |
| `src/sistemas/` (11 módulos Fase 3) | 2521 | `mercader`, `destructibles`, `manos`, `hud`, `altar`, `progresion`, `combate`, `mundo-dinamica`, `interaccion`, `movimiento`, `construccion` — detalle en `plan-fase3-gamescene.md` |

### Tres ajustes obligatorios que se aplicaron (dependencias cruzadas)

1. **`AUDIO` singleton**: no alcanzaba con exportar la clase — medio juego usa `AUDIO.jump()`, `AUDIO.unlock()`. `AudioEngine.js` exporta **clase + instancia**.
2. **`touchGuards` antes que las escenas**: `BootScene.create()` y `ControlRig` llaman a `installNativeTouchGuards` desde el primer frame. Se extrajo como módulo propio **antes** de las escenas, no al final.
3. **`playerMoveSpeed` en `guardado.js`**: `SymbolicEntity` lo usa (`updateBias`), así que quedó exportado desde el módulo de economía, no en `utils.js`.

### Trampas encontradas al extraer (documentadas para la Fase 3)

| Trampa | Qué pasó | Regla |
|---|---|---|
| **Phaser no es un módulo** | `import { Clamp } from "phaser"` falla: Phaser se carga como script clásico (global), no hay import map | Usar `Phaser.Math.Clamp` directo en `utils.js` |
| **Orden de `const` al mover código** | En `ProceduralMap.addDramaticRoutes()` se movió `const id` **debajo** de su primer uso → `ReferenceError: Cannot access 'id' before initialization` | Al cortar/pegar, verificar que toda `const` quede **antes** de usarse (TDZ) |
| **Imports olvidados** | `PauseScene` usaba `screenH` sin importarlo | Tras cada extracción, correr el chequeo de símbolos (ver §5) |

---

## 3. Por qué NO se puede "cortar y pegar"

Cortar cada clase a un archivo propio y cargarlos con `<script>` clásicos **rompe el juego**:

```html
<script src="ProceduralMap.js"></script>  <!-- define ProceduralMap local a su archivo -->
<script src="GameScene.js"></script>      <!-- NO ve ProceduralMap, ni TILE, ni LEVELS -->
```

Cada `<script>` clásico tiene su propio scope. El error que verías es confuso (`TILE is not defined`). **La forma correcta es ES Modules**, que sí declaran dependencias explícitas.

### Precedente

La rama `separacion_arte` muestra que `index.html` llegó a tener **4229 líneas** con el juego embebido, de donde se extrajo a `juego.js` + `art_data.js`. Ese refactor funcionó por un global en `window`. ES Modules es la versión correcta y escalable del mismo movimiento.

---

## 4. Fases

Principio rector: **una fase = un commit = un estado jugable verificable**.

### ✅ Fase 0 — Red de seguridad (COMPLETADA)

- [x] Commit del plan (`2376af1`).
- [x] Tag `pre-refactor-2026-09-09` → estado congelado, recuperable con `git checkout pre-refactor-2026-09-09`.
- [x] Verificado que `SAVE_KEY` (`"blank-soul-save-v4"`) **no se tocó**: el formato de guardado es idéntico.
- [x] Checklist de prueba definido (ver §5).

> ⚠️ **Pendiente tuyo:** el save vive en el `localStorage` **de tu navegador**, no en el repo — no puedo respaldarlo desde acá. Para tener copia, en la consola de la página jugable (F12) antes de seguir:
> ```js
> copy(localStorage.getItem("blank-soul-save-v4"))
> ```
> Eso copia el save al portapapeles; pegalo en un archivo de texto. El refactor no lo modifica, pero es gratis asegurarlo.

### ✅ Fase 1 — Convertir a ES Modules sin partir nada (COMPLETADA)

**Lo que se hizo:**

1. **`juego.js`**: se eliminó el IIFE `(() => { … })()`. El aislamiento ahora lo da el *scope de módulo* (idéntico: nada es global salvo lo que se asigna a `window`).
   - `"use strict"` eliminado: los módulos ES ya son estrictos por definición.
   - El `return` de la guarda de Phaser se cambió por `throw` — **un `return` es ilegal en el nivel superior de un módulo**, y sin ese cambio el archivo no compilaba.
   - Se agregó `import "./art_data.js";` para garantizar que el arte esté cargado antes de que corra el juego.
   - Se agregó un bloque `export { … }` con **55 nombres** (todas las clases, constantes y helpers), verificado uno por uno contra el archivo. **Nada los importa todavía — es intencional**, y no cambia el comportamiento.
2. **`art_data.js`**: `window.ArtData = (() => {…})();` → `export const ArtData = (() => {…})();`, con un puente temporal `window.ArtData = ArtData;` al final para no tocar los dos puntos donde el juego lo lee.
3. **`index.html`**: `<script src="art_data.js">` **eliminado** (un módulo con `export` no puede cargarse como script clásico: daría `SyntaxError`), y `juego.js` pasó a `<script type="module">`.

**Desvío consciente del plan original:** los archivos **quedaron en la raíz**, no en `src/`. Mover archivos *y* cambiar el modelo de ejecución en el mismo commit son dos riesgos juntos y difíciles de diagnosticar. El `src/` entra en la Fase 2, cuando ya no haya nada más cambiando.

**Segundo desvío:** se conservó la indentación de 4 espacios original para que el diff sea mínimo y revisable. Se normaliza en la Fase 2, al mover cada bloque a su archivo.

### ✅ Fase 2 — Extraer los bloques fáciles (COMPLETADA)

Un commit por bloque lógico, verificando en cada paso. Orden ejecutado:

1. `src/core/constantes.js` ✅
2. `src/core/utils.js` ✅
3. `src/core/guardado.js` ✅
4. `src/audio/AudioEngine.js` ✅ (+ singleton `AUDIO`)
5. `src/controles/touchGuards.js` ✅ (adelantado: lo necesita `BootScene`)
6. `src/controles/ControlRig.js` ✅
7. `src/escenas/BootScene.js`, `MenuScene.js`, `PauseScene.js`, `AstralScene.js` ✅
8. `src/mundo/ProceduralMap.js` ✅
9. `src/entidades/SymbolicEntity.js` ✅
10. `src/sistemas/selfTests.js` ✅
11. `src/escenas/GameScene.js` ✅ (bloque grande, se extrajo entero)
12. Reescritura de `juego.js` como punto de entrada ✅

**Resultado: `juego.js` pasó de 4837 → 102 líneas.**

Pendiente de Fase 2 (cosmético): reemplazar el puente `window.ArtData` por un `import { ArtData }` real, y normalizar la indentación de 4 espacios a 2.

### ✅ Fase 3 — Partir `GameScene` (COMPLETADA — 2026-09-11)

`GameScene` queda como orquestador (Phaser exige una clase de escena) y los 79 métodos se agrupan en módulos de sistema que la escena compone:

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

Criterio de corte: **módulos que reciben `scene` como parámetro** (patrón "sistema"), en vez de herencia o mixins. Así cada pieza es testeable y no hay sorpresas de `this`.

👉 `GameScene` final esperado: **~300–400 líneas**.

**Resultado (2026-09-11, rama `refactor-fase3`, 11 commits):**
- 11 módulos en `src/sistemas/` (2521 líneas): `mercader`, `destructibles`, `manos`, `hud`, `altar`, `progresion`, `combate`, `mundo-dinamica`, `interaccion`, `movimiento`, `construccion`.
- `GameScene.js`: 2702 → **407 líneas**. Patrón **fachada + sistema**: cada método queda como fachada de una línea que delega a una función `(scene, ...)`; así no se tocaron `setupCollisions` ni el harness.
- Limpieza de 17 imports muertos en GameScene; 0 `this` desnudos y 0 imports muertos en los módulos.
- Ambos harness `OK` (25 checks + self-test 48 mapas). Flake pre-existente documentado: el check "recoger moneda" falla ~1 de cada 3-6 corridas por timing físico en headless (no es regresión).
- Ejecutado por subagente `deepseek-v4-flash`; cierre (Tarea 12) por Herminia.

### ⬜ Fase 4 — Cierre
- Actualizar `GDD.md` / `ART_BIBLE.md` con la nueva estructura.
- Revisar `CODIGO_OPTIMIZADO.js` (¿obsoleto?) antes de borrarlo.
- Consolidar o cerrar `separacion_arte` y `separacionboba`.

---

## 5. Cómo verificar (obligatorio en cada fase)

**El juego ya no se puede abrir con doble clic** (`file://`): los módulos exigen servidor HTTP por CORS. Esto es normal, no un error.

```bash
cd C:/Users/santy/Documents/GitHub/alma
python -m http.server 8123
# abrir http://127.0.0.1:8123  ->  el juego
# abrir http://127.0.0.1:8123/hermes/verificar.html  ->  el reporte automático
```

`hermes/verificar.html` carga el juego real y reporta: versión de Phaser, escena activa, texturas cargadas, tamaño del canvas y **errores de consola capturados**. Si todo está bien, el **título de la página dice `OK`**; si no, dice `FALLO - <detalle>`. También ejecuta el **self-test que ya traía el juego** (`window.__BLANK_SOUL_SELF_TEST__`: 48 mapas procedurales + chequeos de física y economía).

Sin navegador gráfico:
```bash
chrome --headless=new --virtual-time-budget=20000 --dump-dom http://127.0.0.1:8123/hermes/verificar.html | grep -o "<title>[^<]*"
```

**GitHub Pages funciona sin ninguna configuración extra.**

### Checklist manual (lo que el self-test no cubre)
- [ ] Menú → INICIAR DESCENSO
- [ ] Movimiento, salto, escaleras, pendientes
- [ ] Coger/soltar objetos, romper macetas/cajas
- [ ] Ataques simbólicos y parry
- [ ] Mercader: comprar, rechazar, precios inflados
- [ ] Altar, bomba, cavar terreno, derrumbe de paredes
- [ ] Muerte, descenso de mundo, escena Astral
- [ ] Pausa y reanudar
- [ ] Guardado/carga entre sesiones
- [ ] Controles táctiles (móvil)

---

## 6. Riesgos y trampas conocidas

| # | Riesgo | Estado |
|---|---|---|
| 1 | **Todo era privado (IIFE)** | ✅ Resuelto en Fase 1 con ES Modules |
| 2 | **`file://` rompe los módulos** | ⚠️ Documentado en §5: usar servidor HTTP |
| 3 | **`return` es ilegal en top-level de módulo** | ✅ Resuelto (se cambió por `throw`) |
| 4 | **Un módulo no puede cargarse como `<script>` clásico** | ✅ Resuelto (se quitó el tag de `art_data.js`) |
| 5 | **`this` en métodos extraídos** | ⏳ Mitigar en Fase 3: pasar `scene` explícito |
| 6 | **`localStorage` y saves** | `SAVE_KEY` intacto; respaldo manual sugerido en §4 |
| 7 | **Orden de carga de scripts** | ✅ Resuelto: Phaser clásico antes del módulo; `art_data.js` por `import` |
| 8 | **Finales de línea CRLF** | ✅ Normalizado; editar siempre respetando CRLF (si no, diffs enormes) |
| 9 | **`PauseScene` sin indentar** (línea 4579) | Nota cosmética: quedó pegada tarde. Sin efecto funcional |
| 10 | **Caché de GitHub Pages** | Verificar con hard-refresh o `?v=<n>` |

---

## 7. Registro de avance

| Fecha | Fase | Estado | Resultado |
|---|---|---|---|
| 2026-09-09 | 0 | ✅ hecho | Tag `pre-refactor-2026-09-09`, plan commiteado (`2376af1`) |
| 2026-09-09 | 1 | ✅ hecho | ES Modules; **11/11 campos idénticos** vs. el estado anterior y self-test byte a byte igual |
| 2026-09-11 | 2 | ✅ hecho | `juego.js` 4837→102; 14 módulos en `src/` |
| 2026-09-11 | 3 | ✅ hecho | 11 módulos en `src/sistemas/`; GameScene 2702→407; fachadas; ambos harness `OK` |
| — | 4 | ⬜ pendiente | — |

### Evidencia de la Fase 1

Comparación automática contra el tag `pre-refactor` (mismo test, mismo servidor, versión clásica vs. módulos):

| Campo | Antes | Después |
|---|---|---|
| Phaser | 3.80.1 | 3.80.1 |
| Escenas activas | `["Menu"]` | `["Menu"]` |
| Escenas registradas | 5 | 5 |
| Texturas cargadas | 33 | 33 |
| Canvas | 764×485 | 764×485 |
| Errores de consola | `[]` | `[]` |
| Self-test | `ok: true`, 48 mapas, 0 fallos | `ok: true`, 48 mapas, 0 fallos |

**11/11 campos idénticos.** Además se verificó visualmente que el menú renderiza completo (título, leyes, botones).

> Al cerrar cada fase: marcar acá, y commitear el código **y** este documento juntos.
