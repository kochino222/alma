# Plan Fase 3 — Partir `GameScene` en módulos de sistema

> **Para Hermes:** usar la skill `subagent-driven-development` para implementar este plan tarea por tarea.
> **Rama de trabajo:** `refactor-fase3` (creada desde `main`). **Un commit por módulo.**
> **Línea base de verificación:** `hermes/verificar-gamescene.html` (25 checks) y `hermes/verificar.html` (self-test 48 mapas). El **título de la página debe decir `OK`** después de cada commit.

**Goal:** Reducir `GameScene` de 2702 líneas / 79 métodos a un orquestador delgado (~400–500 líneas) delegando cada sistema en un módulo `src/sistemas/*.js`, sin cambiar el comportamiento del juego.

**Architecture:** Patrón *fachada + sistema*. Cada módulo exporta funciones puras `function(scene, ...args)` que reciben la escena explícitamente. `GameScene` conserva los 79 nombres de método como fachadas de una línea que delegan (`metodo(...) { return Modulo.metodo(this, ...); }`). Esto preserva la superficie pública intacta: los colliders (`setupCollisions`) pasan `this.collectCoin` por referencia y el harness llama `scene.takeDamage(...)` / `scene.descend()` / `scene.merchantOffers()` — **ninguno de esos puntos se toca**.

**Tech Stack:** ES Modules nativo, Phaser 3.80.1 (CDN, global `window.Phaser`), sin bundler, sin framework de tests (la verificación es el harness de navegador headless).

---

## 0. Reglas de transformación (aplicar en CADA tarea)

Estas reglas son idénticas en todos los módulos. El implementador las debe interiorizar antes de empezar.

1. **Copiar el cuerpo verbatim.** El origen de verdad es `src/escenas/GameScene.js`. No reescribir lógica; sólo mover.
2. **`this.` → `scene.`** en todo el cuerpo copiado. Dentro de funciones flecha anidadas, `this` era léxico (la escena) y ahora pasa a ser `scene` por cierre — correcto.
3. **`this` desnudo → `scene`.** Buscar `this` SIN punto (p. ej. pasar `this` como argumento o `return this`). Si aparece, reemplazar por `scene`. Si no aparece, nada que hacer.
4. **Dependencias importadas al tope del módulo.** Cada módulo importa sólo lo que sus funciones usan:
   - `AUDIO` desde `"../audio/AudioEngine.js"`
   - `setRunFragmentBank` (y lo que use) desde `"../core/guardado.js"`
   - helpers de `"../core/utils.js"` si aparecen
   - Si un cuerpo usa `Between`, declarar al tope del módulo: `const Between = Phaser.Math.Between;`
5. **Llamadas entre sistemas** se mantienen vía `scene.metodo(...)` (la fachada sigue existiendo en la escena). No importar módulos hermanos salvo que una función de utilidad pura lo exija.
6. **Rutas de import relativas**: desde `src/sistemas/`, los módulos en `src/` se importan con `"../core/...", "../audio/...", "../mundo/...", "../entidades/..."`.
7. **CRLF y 2 espacios.** El repo usa CRLF; editar respetándolo para no generar diffs enormes. Indentación de 2 espacios.
8. **Orden de `const`:** respetar TDZ. Al mover código, toda `const` debe quedar antes de su primer uso (trampa documentada en Fase 2).
9. **Nunca tocar** `constructor`, `init`, `create`, `update`, `setupCollisions`, `pauseGame` — permanecen en `GameScene` (sólo sus *cuerpos internos* siguen llamando a `this.*`, que ahora son fachadas).

### Plantilla de módulo

```js
// <Nombre del sistema> - Alma en Blanco (Fase 3)
// Extraído de src/escenas/GameScene.js. Funciones puras que reciben `scene`.

import { AUDIO } from "../audio/AudioEngine.js";
// + los imports de guardado.js / utils.js que usen los cuerpos

export function metodoEjemplo(scene, ...args) {
  // cuerpo copiado de GameScene, con this. -> scene.
}
```

### Plantilla de fachada en `GameScene.js`

```js
metodoEjemplo(...args) { return <Modulo>.metodoEjemplo(this, ...args); }
```

Y al tope de `GameScene.js` agregar el import del módulo:

```js
import * as <Modulo> from "../sistemas/<modulo>.js";
```

> El import con `* as` (namespace) evita colisiones de nombres entre módulos y mantiene legible `Modulo.metodo`.

---

## 1. Mapa definitivo de módulos (79 métodos → 11 módulos + 6 que se quedan)

| Módulo (`src/sistemas/`) | Métodos (línea origen en GameScene.js) | ~Líneas |
|---|---|---|
| `mercader.js` | `cycleMerchant` (1873), `merchantOffers` (1879), `buyMerchantItem` (1894), `rejectPurchase` (1955), `useSpecialRoom` (1959) | ~113 |
| `destructibles.js` | `breakPot` (1681), `seismicLifeStrike` (1706), `breakCrate` (2073), `crackWall` (2326), `breakWall` (2334), `destructiveImpulse` (2343) | ~90 |
| `manos.js` | `nearbyPortable` (1509), `tryPickupNearby` (1528), `updateHandsRig` (1553), `releaseCarried` (1610), `dropCarried` (1651), `onPortableTerrainHit` (1658), `onPortableWallHit` (1666), `onPortableSpikeHit` (1671), `onPushCrate` (2296), `onBoulderHit` (2302), `onBoulderTerrainHit` (2309), `onBoulderCrateHit` (2320) | ~204 |
| `hud.js` | `createHud` (667), `layoutHud` (724), `updateHud` (2171), `showMessage` (2699) | ~154 |
| `altar.js` | `useAltar` (2363), `negotiateWithGod` (2382), `absorbGodPower` (2400), `sacrificeForRoute` (1986) | ~88 |
| `progresion.js` | `surrenderToAstral` (1789), `descend` (2485), `stopForAstral` (2515), `completeRun` (2539), `startAstral` (2549), `die` (2561), `preserveEtherealGold` (2687), `checkDeathPlane` (2469) | ~252 |
| `combate.js` | `spawnSymbolicAttack` (1361), `parryAttack` (1368), `updateSymbolicAttacks` (1381), `updateProximity` (1797), `absorbSymbolic` (1846), `takeDamage` (2423) | ~191 |
| `mundo-dinamica.js` | `deployBomb` (2014), `detonateBomb` (2030), `destroyTerrainCircle` (2053), `updateWorldDynamics` (2086), `drawLava` (2157), `updateLighting` (2236), `collectCoin` (2257), `collectFragment` (2269), `touchSpore` (2287) | ~204 |
| `interaccion.js` | `handleInteractions` (1461), `hasVerticalEscape` (1721), `isCaveConfined` (1736), `updateCaveSafeguards` (1745) | ~116 |
| `movimiento.js` | `handleMovement` (847), `updatePlayerAnimation` (993), `squashPlayer` (1335), `stabilizePlayerBody` (1353), `handleLadders` (1430), `resolveSlope` (1441) | ~545 |
| `construccion.js` | `configureCamera` (154), `createBackground` (165), `createWorld` (235), `createEntities` (307), `createSpecialSites` (392), `createGod` (532), `spawnDebtCreditor` (558), `createPlayer` (569), `createEffects` (613) | ~513 |

**Se quedan en `GameScene`:** `constructor` (23), `init` (27), `create` (44), `setupCollisions` (759), `pauseGame` (752), `update` (786).

**Orden de extracción (de hoja a núcleo):** `mercader` → `destructibles` → `manos` → `hud` → `altar` → `progresion` → `combate` → `mundo-dinamica` → `interaccion` → `movimiento` → `construccion`.

> `showMessage` se extrae en el módulo `hud.js` (tarea 4), pero es llamado por `mercader`, `destructibles`, `mundo-dinamica`, etc. **No importa el orden**: antes de la tarea 4 `scene.showMessage()` resuelve al método real; después, a la fachada. Ambas rutas funcionan.

---

## 2. Tareas

### Tarea 0 — Red de seguridad y línea base

**Objective:** Rama limpia y verificación de que el estado actual está verde antes de tocar nada.

**Step 1 — Crear rama**

> ⚠️ **Corrección de base (verificado 2026-09-11):** la Fase 2 NO vive en `main` (que tiene un único commit `efd5a28`), sino en `fix-camara-idle` (commit `57f14e0 refactorizacion2`). La rama sale de `fix-camara-idle`.

```bash
cd C:/Users/santy/Documents/GitHub/alma
git status          # esperado: working tree limpio (o sólo hermes/plan-fase3-gamescene.md)
git checkout fix-camara-idle
git checkout -b refactor-fase3
```

**Step 2 — Levantar servidor y verificar línea base**

```bash
python -m http.server 8123
# en otra terminal, o usar background=true
```

**Step 3 — Correr ambos harness y confirmar `OK`**

```bash
chrome --headless=new --virtual-time-budget=20000 --dump-dom http://127.0.0.1:8123/hermes/verificar-gamescene.html | grep -o "<title>[^<]*"
# esperado: <title>OK</title>

chrome --headless=new --virtual-time-budget=20000 --dump-dom http://127.0.0.1:8123/hermes/verificar.html | grep -o "<title>[^<]*"
# esperado: <title>OK</title>
```

> Si `chrome` no está en el PATH en Windows, usar la ruta completa:
> `"C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new ...`
> o `msedge` con los mismos flags. El servidor `http.server` debe seguir corriendo.

**Step 4 — Commit**

```bash
git add -A
git commit -m "chore: línea base Fase 3 (sin cambios funcionales)"
```

**Verificación de la tarea:** ambos `grep` devuelven `<title>OK</title>`.

---

### Tarea 1 — `src/sistemas/mercader.js`

**Objective:** Extraer el subsistema del mercader (el más autocontenido) como prueba del patrón.

**Files:**
- Create: `src/sistemas/mercader.js`
- Modify: `src/escenas/GameScene.js` (reemplazar 5 cuerpos por fachadas + agregar import)

**Step 1 — Crear el módulo** con las 5 funciones (`cycleMerchant`, `merchantOffers`, `buyMerchantItem`, `rejectPurchase`, `useSpecialRoom`), copiando los cuerpos de las líneas indicadas en §1 y aplicando las reglas 0.2–0.6.

Ejemplo resuelto (cuerpo real de `rejectPurchase`, líneas 1955–1957):

```js
// src/sistemas/mercader.js
import { AUDIO } from "../audio/AudioEngine.js";
import { setRunFragmentBank } from "../core/guardado.js";

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
```

> `useSpecialRoom` llama a `scene.rejectPurchase(...)` — la fachada que sigue existiendo en `GameScene`. Correcto por diseño.

**Step 2 — Reemplazar los cuerpos en `GameScene.js` por fachadas.** Por ejemplo:

```js
rejectPurchase(message) { return Mercader.rejectPurchase(this, message); }
useSpecialRoom(room, time) { return Mercader.useSpecialRoom(this, room, time); }
```

Y agregar el import al tope de `GameScene.js`:

```js
import * as Mercader from "../sistemas/mercader.js";
```

**Step 3 — Verificar**

```bash
chrome --headless=new --virtual-time-budget=20000 --dump-dom http://127.0.0.1:8123/hermes/verificar-gamescene.html | grep -o "<title>[^<]*"
# esperado: <title>OK</title>   (el harness llama scene.merchantOffers y scene.buyMerchantItem)
```

**Step 4 — Commit**

```bash
git add src/sistemas/mercader.js src/escenas/GameScene.js
git commit -m "refactor: extraer sistema mercader de GameScene"
```

**Verificación de la tarea:** `grep` devuelve `<title>OK</title>`; el paso "mercader vende bombas" y "mercader cobra precio del mundo" siguen en `ok: true` (inspeccionar el `<pre id="verificacion">` si se quiere detalle).

---

### Tarea 2 — `src/sistemas/destructibles.js`

**Objective:** Extraer rotura de macetas/cajas/muros + impulso destructivo + golpe sísmico.

**Files:** Create `src/sistemas/destructibles.js`; Modify `src/escenas/GameScene.js`.

**Métodos:** `breakPot`, `seismicLifeStrike`, `breakCrate`, `crackWall`, `breakWall`, `destructiveImpulse` (líneas en §1).

Ejemplo resuelto (cuerpo real de `breakCrate`, líneas 2073–2084):

```js
export function breakCrate(scene, crate) {
  if (!crate?.active) return false;
  if (scene.carried?.target === crate) scene.carried = null;
  const x = crate.x, y = crate.y;
  crate.disableBody(true, true);
  scene.rubble.explode(8, x, y);
  if (scene.rng() < 0.35) {
    scene.bombs += 1;
    scene.showMessage("La caja escondía una bomba.", 1400);
  }
  return true;
}
```

Fachadas (ejemplo):

```js
breakCrate(crate) { return Destructibles.breakCrate(this, crate); }
```

Import: `import * as Destructibles from "../sistemas/destructibles.js";`

**Verificar** (mismo comando `chrome --headless ... | grep "<title>"` → `OK`), **commit**:

```bash
git add src/sistemas/destructibles.js src/escenas/GameScene.js
git commit -m "refactor: extraer sistema destructibles de GameScene"
```

---

### Tarea 3 — `src/sistemas/manos.js`

**Objective:** Extraer el acarreo de objetos (manos) + callbacks de colisión de portables y rocas.

**Files:** Create `src/sistemas/manos.js`; Modify `src/escenas/GameScene.js`.

**Métodos:** `nearbyPortable`, `tryPickupNearby`, `updateHandsRig`, `releaseCarried`, `dropCarried`, `onPortableTerrainHit`, `onPortableWallHit`, `onPortableSpikeHit`, `onPushCrate`, `onBoulderHit`, `onBoulderTerrainHit`, `onBoulderCrateHit`.

> ⚠️ Los callbacks `onPortableTerrainHit`, `onPortableWallHit`, `onPortableSpikeHit`, `onPushCrate`, `onBoulderHit`, `onBoulderTerrainHit`, `onBoulderCrateHit`, `crackWall` están referenciados en `setupCollisions` como `this.onPortableTerrainHit`. **No modificar `setupCollisions`**: la fachada mantiene `this.metodo` válido.

**Verificar** → `OK`; **commit**:

```bash
git add src/sistemas/manos.js src/escenas/GameScene.js
git commit -m "refactor: extraer sistema de manos/portables de GameScene"
```

---

### Tarea 4 — `src/sistemas/hud.js`

**Objective:** Extraer el HUD y `showMessage`.

**Files:** Create `src/sistemas/hud.js`; Modify `src/escenas/GameScene.js`.

**Métodos:** `createHud`, `layoutHud`, `updateHud`, `showMessage`.

> `createHud` se llama desde `create()` (`this.createHud()`). Como `create` se queda en GameScene, sigue funcionando vía fachada. `showMessage` lo usan casi todos los demás módulos vía `scene.showMessage()`.

**Verificar** → `OK`; **commit**:

```bash
git add src/sistemas/hud.js src/escenas/GameScene.js
git commit -m "refactor: extraer sistema HUD de GameScene"
```

---

### Tarea 5 — `src/sistemas/altar.js`

**Objective:** Extraer interacción con altar/dios y sacrificio por ruta.

**Files:** Create `src/sistemas/altar.js`; Modify `src/escenas/GameScene.js`.

**Métodos:** `useAltar`, `negotiateWithGod`, `absorbGodPower`, `sacrificeForRoute`.

**Verificar** → `OK`; **commit**:

```bash
git add src/sistemas/altar.js src/escenas/GameScene.js
git commit -m "refactor: extraer sistema altar/dios de GameScene"
```

---

### Tarea 6 — `src/sistemas/progresion.js`

**Objective:** Extraer la progresión de la run (muerte, descenso, escena Astral).

**Files:** Create `src/sistemas/progresion.js`; Modify `src/escenas/GameScene.js`.

**Métodos:** `surrenderToAstral`, `descend`, `stopForAstral`, `completeRun`, `startAstral`, `die`, `preserveEtherealGold`, `checkDeathPlane`.

> ⚠️ El harness llama `scene.descend()` con un spy sobre `scene.scene.start`. La fachada `descend() { return Progresion.descend(this); }` conserva ese contrato. `descend`/`die` probablemente referencian `scene.scene.start("Astral"...)` o similar — el spy sigue funcionando porque actúa sobre `scene.scene`, no sobre el módulo.

**Verificar** → `OK` (los pasos "descenso pide Game nivel+1" y "descenso suma 1 fragmento" deben seguir `ok: true`); **commit**:

```bash
git add src/sistemas/progresion.js src/escenas/GameScene.js
git commit -m "refactor: extraer sistema de progresion de GameScene"
```

---

### Tarea 7 — `src/sistemas/combate.js`

**Objective:** Extraer combate simbólico, absorción y daño.

**Files:** Create `src/sistemas/combate.js`; Modify `src/escenas/GameScene.js`.

**Métodos:** `spawnSymbolicAttack`, `parryAttack`, `updateSymbolicAttacks`, `updateProximity`, `absorbSymbolic`, `takeDamage`.

> ⚠️ El harness llama `scene.takeDamage(1, "test")` dos veces. La fachada conserva el contrato. Los checks de "daño resta HP" e "invulnerabilidad bloquea 2do golpe" deben seguir verdes.

**Verificar** → `OK`; **commit**:

```bash
git add src/sistemas/combate.js src/escenas/GameScene.js
git commit -m "refactor: extraer sistema de combate de GameScene"
```

---

### Tarea 8 — `src/sistemas/mundo-dinamica.js`

**Objective:** Extraer dinámica del mundo: bombas, lava, iluminación, terreno, recolección.

**Files:** Create `src/sistemas/mundo-dinamica.js`; Modify `src/escenas/GameScene.js`.

**Métodos:** `deployBomb`, `detonateBomb`, `destroyTerrainCircle`, `updateWorldDynamics`, `drawLava`, `updateLighting`, `collectCoin`, `collectFragment`, `touchSpore`.

> ⚠️ El harness llama `scene.deployBomb(time)` y `scene.destroyTerrainCircle(x, y, r)`. `collectCoin`/`collectFragment`/`touchSpore` están referenciados por `setupCollisions` (`this.collectCoin`). Las fachadas mantienen ambos contratos.

**Verificar** → `OK` (pasos "bomba desplegada" y "bomba destruye terreno" verdes); **commit**:

```bash
git add src/sistemas/mundo-dinamica.js src/escenas/GameScene.js
git commit -m "refactor: extraer sistema de dinamica del mundo de GameScene"
```

---

### Tarea 9 — `src/sistemas/interaccion.js`

**Objective:** Extraer interacciones genéricas y salvaguardas de cueva.

**Files:** Create `src/sistemas/interaccion.js`; Modify `src/escenas/GameScene.js`.

**Métodos:** `handleInteractions`, `hasVerticalEscape`, `isCaveConfined`, `updateCaveSafeguards`.

> `updateCaveSafeguards` se llama en `update()` como `this.updateCaveSafeguards?.(...)`. La fachada mantiene ese optional-chaining válido.

**Verificar** → `OK`; **commit**:

```bash
git add src/sistemas/interaccion.js src/escenas/GameScene.js
git commit -m "refactor: extraer sistema de interaccion de GameScene"
```

---

### Tarea 10 — `src/sistemas/movimiento.js`

**Objective:** Extraer movimiento y animación del jugador (el sistema más grande).

**Files:** Create `src/sistemas/movimiento.js`; Modify `src/escenas/GameScene.js`.

**Métodos:** `handleMovement`, `updatePlayerAnimation` (342 líneas), `squashPlayer`, `stabilizePlayerBody`, `handleLadders`, `resolveSlope`.

> ⚠️ `resolveSlope` se llama al inicio de `update()` (`this.resolveSlope()`), y `updatePlayerAnimation`/`handleMovement`/`handleLadders` también desde `update()`. Todas vía fachada. Este módulo tiene muchos `this.` en flechas anidadas: aplicar la regla 0.2 con cuidado y revisar que no quede ningún `this` desnudo.

**Verificar** → `OK` (pasos "avanza a la derecha", "salta", "vuelve al suelo", "dash activa" verdes); **commit**:

```bash
git add src/sistemas/movimiento.js src/escenas/GameScene.js
git commit -m "refactor: extraer sistema de movimiento de GameScene"
```

---

### Tarea 11 — `src/sistemas/construccion.js`

**Objective:** Extraer la construcción del mundo/entidades (lo que `create()` orquesta).

**Files:** Create `src/sistemas/construccion.js`; Modify `src/escenas/GameScene.js`.

**Métodos:** `configureCamera`, `createBackground`, `createWorld`, `createEntities`, `createSpecialSites`, `createGod`, `spawnDebtCreditor`, `createPlayer`, `createEffects`.

> ⚠️ Estos métodos crean los objetos que `setupCollisions` y el harness inspeccionan (`scene.terrain`, `scene.player`, `scene.playerRig`, `scene.rigParts`, `scene.coinsGroup`, etc.). Se llaman desde `create()` en orden. Las fachadas deben conservar **el orden y los argumentos exactos**. `createEntities`/`createSpecialSites` usan `this.physics.add...` y `this.add...` internamente — se transforma a `scene.physics.add...` / `scene.add...`.

**Verificar** → `OK` (el harness chequea `terrain`, `player`, `rigParts`, los 10 grupos, `hud`, `darkness`, `controls`, cámara, `levelInfo`, `mergeMerchant`, `specialRooms`); **commit**:

```bash
git add src/sistemas/construccion.js src/escenas/GameScene.js
git commit -m "refactor: extraer sistema de construccion de GameScene"
```

---

### Tarea 12 — Cierre y limpieza

**Objective:** Limpiar imports muertos, documentar, verificación final completa.

**Step 1 — Limpiar imports de `GameScene.js`.** Varios imports del tope (`TILE`, `randInt`, `rectsOverlap`, `makeRect`, `daggerReward`, `inflationMultiplier`, `inflatedPrice`, `lawActive`, `effectiveCoinBurden`, `trapMultiplier`, `playerMoveSpeed`, `ControlRig`, `SymbolicEntity`, `ProceduralMap`, …) pueden haber quedado sin uso si los únicos consumidores ya se movieron a los módulos. Revisar uno por uno: **sólo borrar el import si `search_files` confirma 0 usos** del símbolo en `GameScene.js` (incluyendo `create`/`update`/fachadas).

```bash
# ejemplo de chequeo por símbolo:
grep -n "randInt" src/escenas/GameScene.js
# si no hay matches, es seguro quitar randInt del import de utils.js
```

**Step 2 — Verificación final de AMBOS harness.**

```bash
chrome --headless=new --virtual-time-budget=20000 --dump-dom http://127.0.0.1:8123/hermes/verificar-gamescene.html | grep -o "<title>[^<]*"
chrome --headless=new --virtual-time-budget=20000 --dump-dom http://127.0.0.1:8123/hermes/verificar.html | grep -o "<title>[^<]*"
# ambos: <title>OK</title>
```

**Step 3 — Medir el resultado.**

```bash
wc -l src/escenas/GameScene.js src/sistemas/*.js
# esperado: GameScene.js en el rango ~400–550; los módulos suman ~2470
```

**Step 4 — Actualizar `hermes/plan-refactor.md`.** Marcar Fase 3 como completada (tabla §2: nueva fila de `src/sistemas/` con los 11 módulos; §4 Fase 3 → ✅; §7 registro). Commitear código + documento juntos.

```bash
git add -A
git commit -m "docs: marcar Fase 3 completada; limpiar imports muertos"
```

**Verificación de la tarea:** ambos harness `OK`; `wc -l` confirma el encogimiento; `git log --oneline` muestra 13 commits (0–12).

---

## 3. Tests / validación

No hay framework de tests: la validación es el **harness de navegador headless**. Regla de oro: **después de cada tarea, el `grep` del título debe devolver `<title>OK</title>` en ambos harness** (`verificar-gamescene.html` y `verificar.html`). Si devuelve `FALLO`, revertir el módulo recién extraído (`git checkout -- src/...`) y reintentar — nunca apilar el siguiente módulo sobre un estado rojo.

Los 25 checks de `verificar-gamescene.html` cubren exactamente las superficies que las fachadas protegen: estructura (`terrain`, `player`, `rigParts`, 10 grupos, `hud`, `darkness`), `ControlRig`, cámara, enemigos, movimiento/salto/dash, monedas, daño+inmunidad, bomba+terreno, ley económica, descenso, mercader.

**Checklist manual (opcional, al final, para lo que el self-test no cubre):** pausa/reanudar, guardado/carga, táctil móvil. (Ídem al §5 de `plan-refactor.md`.)

---

## 4. Riesgos, tradeoffs y preguntas abiertas

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | `this` desnudo no convertido dentro de flechas anidadas | Regla 0.3: buscar `this` sin punto; en cada módulo correr `grep -n "[^.]this" <modulo>.js` antes de commitear |
| 2 | Imports olvidados en el módulo nuevo | Regla 0.4 + el harness captura `ReferenceError`/`SyntaxError` como `FALLO` |
| 3 | Callbacks de colisión rotos al mover métodos | Fachadas mantienen `this.metodo`; `setupCollisions` no se toca |
| 4 | Orden de `const` (TDZ) al cortar/pegar | Trampa documentada en Fase 2; respetar orden original del cuerpo |
| 5 | CRLF / indentación generan diffs gigantes | Editar respetando CRLF y 2 espacios (regla 0.7) |
| 6 | `chrome` no está en el PATH de Windows | Ruta completa `"C:\Program Files\Google\Chrome\Application\chrome.exe"` o `msedge` |

**Tradeoff aceptado:** las 79 fachadas dejan `GameScene.js` en ~400–550 líneas, no en las ~300–400 idealizadas en `plan-refactor.md`. Es el precio de **no tocar** ni los colliders ni el harness. Un posible **Fase 3b** (fuera de alcance ahora) eliminaría fachadas no usadas externamente y convertiría llamadas entre sistemas a imports directos; sólo tras estabilizar Fase 3 y tener el harness verde.

**Preguntas abiertas:**
- ¿Delegar cada tarea a un subagente (modelo barato, Haiku/Cline) con la skill `subagent-driven-development`, o ejecutar Herminia directo? El plan está escrito para cualquiera de las dos rutas; cada tarea es autocontenida y verificable.
- ¿Mantener `export { ... }` de `juego.js` (líneas 76–103) que re-exporta símbolos "para compatibilidad Fase 1" y el comentario "será removido en Fase 3"? Se deja intacto en este plan; si se quiere limpiar, va como tarea extra al final.
