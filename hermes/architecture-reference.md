# Architecture Reference — Alma en Blanco

> Fuente: gitingest del repositorio (kochino222/alma). Actualizar con `gitingest https://github.com/kochino222/alma` cuando haya cambios estructurales.

---

## Contenido

Este archivo consolida los documentos clave de arquitectura para consultas rápidas sin tener que leer múltiples archivos.

### 1. ART_BIBLE.md — Contrato técnico real
- Separación gameplay/render confirmada
- Tabla de texturas (key → generador → consumidores)
- Paletas por mundo
- Roster de enemigos (8 kinds, 4 siluetas reales — deuda técnica)
- Ganchos de animación disponibles en GameScene
- Arquitectura recomendada: texturas cacheadas por pose + wiring en update()

### 2. ANIMATION_POLISH_SUMMARY.md — Pulido paper-doll
- RUN: sin² en bobbing, frecuencias/amplitudes actualizadas
- IDLE: respiración 0.0020 Hz, asimetría +0.6 rad
- APEX: blend gradual ±20 (nuevo estado zen)
- FALL: inclinación hacia atrás, stretch sutil
- Lerp general: 45ms

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
| `ART_BIBLE.md` | 1 | 2026-09-09 |
| `ANIMATION_POLISH_SUMMARY.md` | 2 | 2026-09-09 |
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