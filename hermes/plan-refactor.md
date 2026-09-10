# Plan de refactor — Alma en Blanco

> Documento vivo. Escrito por Herminia (asistente de Santiago) para que el plan **no dependa de una conversación**.
> **Fases 0 y 1 completadas** — rama `mejoras-graficas`, tag de seguridad `pre-refactor-2026-09-09`.

---

## 1. Objetivo

Diseccionar `juego.js` — originalmente un monolito de **4782 líneas / 227 KB** — en archivos con responsabilidad única, **sin romper el juego**.

Es un refactor de *estructura*, no de *comportamiento*. Al terminar, el juego debe verse y comportarse **exactamente igual**.

---

## 2. Estado actual (post-Fase 1)

| Archivo | Líneas | Rol |
|---|---|---|
| `index.html` | 24 | Carga Phaser 3.80.1 (CDN) + un solo `<script type="module">` |
| `juego.js` | **4816** | Módulo ES. Todo el juego, ya sin IIFE |
| `art_data.js` | 387 | Módulo ES. `export const ArtData` + puente `window.ArtData` |
| `hermes/verificar.html` | — | Verificador automático de estado (ver §6) |
| `hermes/plan-refactor.md` | — | Este documento |

`juego.js` sigue teniendo el mismo código que antes: **el +34 de líneas son la cabecera, el bloque de exports y comentarios**. Ningún bloque fue movido todavía.

### Mapa de bloques (líneas reales, sin cambios desde el inicio)

| Líneas | Bloque | Tamaño |
|---|---|---|
| 1–302 | Cabecera de módulo + constantes + ~40 helpers (`TILE`, `LEVELS`, `LAW_DEFS`, `loadMeta`, `rectsOverlap`…) | 302 |
| 303–426 | `AudioEngine` | 124 |
| 428–448 | `BootScene` | 21 |
| 449–598 | `MenuScene` | 150 |
| 599–1080 | `ProceduralMap` | 482 |
| 1081–1414 | `SymbolicEntity` | 334 |
| 1415–1696 | `ControlRig` | 282 |
| **1697–4362** | **`GameScene`** — **79 métodos** | **2666 (55%)** |
| 4364–4577 | `AstralScene` | 214 |
| 4579–4690 | `PauseScene` | 112 |
| 4691–4746 | `installSelfTests` + `installNativeTouchGuards` | 56 |
| 4747–4793 | `config` + arranque del juego | 47 |
| 4795–4816 | Bloque de `export` | 22 |

**El diagnóstico real:** las 9 clases chicas están bien separadas por responsabilidad. El problema no es el reparto de clases — **el problema es `GameScene`**, que concentra el 55% del archivo en 79 métodos. Ese es el objetivo de la Fase 3.

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

### ⬜ Fase 2 — Extraer los bloques fáciles (PENDIENTE)

Un commit por archivo, verificando en cada uno. Orden propuesto:

1. `src/core/constantes.js` — `VIEW_W`, `TILE`, `LEVELS`, `LAW_DEFS`, `SAVE_KEY`…
2. `src/core/utils.js` — `hashSeed`, `mulberry32`, `rectsOverlap`, `makeRect`, multiplicadores…
3. `src/core/guardado.js` — `loadMeta`, `saveMeta`, `toSaveShape`, `fromSaveShape`, `normalizeMeta`…
4. `src/audio/AudioEngine.js`
5. `src/escenas/` → `BootScene.js`, `MenuScene.js`, `PauseScene.js`, `AstralScene.js`
6. `src/mundo/ProceduralMap.js`
7. `src/entidades/SymbolicEntity.js`
8. `src/controles/ControlRig.js`
9. `src/sistemas/selfTests.js` + `touchGuards.js`
10. Reemplazar el puente `window.ArtData` por un `import { ArtData }` real.

Tras esta fase: `juego.js` baja a ~**2700 líneas** (sólo `GameScene` + arranque).

**Etapa delegable:** el corte mecánico de estos bloques **no necesita razonamiento caro** → conviene delegarlo a un subagente/modelo barato, con este documento como especificación.

### ⬜ Fase 3 — Partir `GameScene` (PENDIENTE — el refactor de verdad)

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
| — | 2 | ⬜ pendiente | Delegable a modelo barato |
| — | 3 | ⬜ pendiente | — |
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
