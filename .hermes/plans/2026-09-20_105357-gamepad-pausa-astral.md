# Plan: gamepad para pausa + negociación astral + reinicio

## Meta

Extender el soporte de gamepad (ya integrado) para: pausar/resumir con el botón
Start, y operar la escena de negociación tras morir (navegar leyes, negociar,
reiniciar) con el control.

## Contexto

- El gamepad ya funciona en juego (`GamepadRig` + `ControlRig.read()`). Falta
  exponer los botones Start/Select y darle navegación a las escenas de menú.
- `GameScene.pauseGame()` se dispara hoy solo por teclado (ESC/P). Pausar → `scene.launch("Pause")` (GameScene queda pausada, PauseScene corre). Reanudar → `resumeGame()`.
- `AstralScene` (negociación post-muerte) hoy solo acepta teclado (UP/W/DOWN/S navega, SPACE/E compra, ENTER reinicia) y pointer. No tiene `update()`.
- `MenuScene` arranca por ENTER/ESPACIO o pointer. No tiene `update()`.
- `GamepadRig` no toca `ControlRig` para esto: se usa `readEdges()` (flancos) vía
  `this.controls.gamepadRig`, evitando interferir con `ControlRig.previous`.

### Esquema de botones (estándar X-Input)

| Botón | índice | uso en menú |
|---|---|---|
| A (jump) | 0 | confirmar / negociar ley |
| B (interact) | 1 | atrás / reanudar |
| Start | 9 | pausa (en juego) · reiniciar (en Astral) · arrancar (en Menu) |
| Select/Back | 8 | atrás |

D-pad / stick / hat → navegar (arriba/abajo), ya soportado por `readRawPad`.

## Cambios

### 1) `src/controles/GamepadRig.js`

**1a.** `DEFAULT_BUTTON_MAP` — agregar `start: 9` y `back: 8`.

**1b.** `readRawPad` — agregar al retorno `start` y `back`:
```js
    start: buttonDown(padLike, map.start),
    back: buttonDown(padLike, map.back)
```

**1c.** Agregar constante y helper puro (testable headless):
```js
export const EMPTY_EDGES = { up: false, down: false, left: false, right: false, confirm: false, back: false, start: false };

// Puro: dado el estado previo y el actual (held-state), devuelve los flancos.
export function computeEdges(prev, cur) {
  const p = prev || {};
  const edges = {
    up: !!(cur.up && !p.up),
    down: !!(cur.down && !p.down),
    left: !!(cur.left && !p.left),
    right: !!(cur.right && !p.right),
    confirm: !!(cur.jump && !p.jump),
    back: !!(cur.interact && !p.interact) || !!(cur.back && !p.back),
    start: !!(cur.start && !p.start)
  };
  return { edges, next: cur };
}
```

**1d.** En el constructor de `GamepadRig` agregar `this._edgePrev = null;`.

**1e.** Agregar método `readEdges()` (la primera lectura fija línea de base y no
emite flancos: evita doble-disparo al entrar a una escena con un botón ya apretado):
```js
  readEdges() {
    const cur = this.read() || {};
    if (!this._edgePrev) {
      this._edgePrev = cur;
      return { ...EMPTY_EDGES };
    }
    const { edges, next } = computeEdges(this._edgePrev, cur);
    this._edgePrev = next;
    return edges;
  }
```

**1f.** En `destroy()` agregar `this._edgePrev = null;`.

### 2) `src/escenas/GameScene.js`

En `update()`, justo después de `const controls = this.controls.read();` (línea ~230):
```js
    const padEdges = this.controls.gamepadRig.readEdges();
    if (padEdges.start) {
      this.pauseGame();
      return;
    }
```

### 3) `src/escenas/PauseScene.js`

- Import: `import { GamepadRig } from "../controles/GamepadRig.js";`
- En `create()`, al final: instanciar y limpiar en shutdown.
- Agregar `update()` que reanuda con Start/A/B.

### 4) `src/escenas/AstralScene.js`

- Import `GamepadRig`.
- En `create()`: instanciar + shutdown cleanup.
- Agregar `update()`: up/down → `moveSelect`, confirm(A) → `buySelected`, start → `restartRun`.

### 5) `src/escenas/MenuScene.js` (bonus, completa el flujo)

- Import `GamepadRig`; instanciar + cleanup; `update()` → `startRun()` con start/confirm.
- Refactor mínimo: el `const startGame = () => {...}` local pasa a método `startRun()`;
  `const startGame = () => this.startRun();`.

## Tests (extender `hermes/verificar-gamepad.html`)

- `readRawPad`: botón 9 → `start:true`; botón 8 → `back:true`.
- `computeEdges`: flanco de subida, sostenido (sin flanco), confirm/back.

## Verificación

- `node --check` en los 5 `.js` tocados.
- `verificar-gamepad.html` → `<title>OK</title>`.
- `verificar.html` y `verificar-gamescene.html` (regresión; flake de "recoger moneda"
  pre-existente) → `<title>OK</title>`.
- Manual en el celular (Pages): Start pausa/resume; en Astral, d-pad/stick navega, A
  negocia, Start reinicia; en Menu, Start/A inicia.

## Commit

Un solo commit: `feat(gamepad): pausa, negociación astral y reinicio con control`.
Archivos: GamepadRig.js, GameScene.js, PauseScene.js, AstralScene.js, MenuScene.js,
hermes/verificar-gamepad.html. NO pushear (lo hace Herminia y verifica Pages).
