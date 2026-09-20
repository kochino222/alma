Alma en Blanco: Leyes del Absurdo
Documento de Diseño de Juego (GDD) & Architecture Spec
Estado del Proyecto: Prototipo V3 en transición a Fase A (Mecánicas de Caverna Densa y Destrucción)
Género: Roguelite Platformer 2D Procedural de Exploración Filosófica
Plataformas Target: Móvil (Táctil / PWA / Web Browser) y PC (Teclado)
1. Visión General y Premisa Narrativa
El jugador encarna a una figura sin nombre y sin rostro (El Alma en Blanco) que despierta en un descenso infinito gobernado por un autor/creador silencioso. A través del movimiento, el peso de la riqueza y el sacrificio físico, el jugador explora dilemas existenciales. La muerte no es la derrota final, sino la frontera necesaria para renegociar las reglas físicas y metafísicas del universo en el Plano Astral.
2. Matriz de Niveles y Estructura de Etapas (8 Subetapas)

Nivel
Entorno
Eje Filosófico
Mantra
Mecánica Asociada
 
L1
Ruinas del Desierto
Economía y Materialismo
"Las monedas pesan."
Masa por Codicia: Cada moneda recolectada incrementa el peso del personaje, reduciendo la velocidad de movimiento y la altura de salto.
L2
Selva Exuberante
Intelecto y Conciencia
"Conocer transforma a quien conoce."
Percepción Invertida: Tocar esporas expande la percepción pero distorsiona la vista e invierte periódicamente los controles.
L3
Núcleo Volcánico
Poder y Ego
"Para romper el mundo, entregá algo de vos."
Destrucción Sacrifical: Gastar 1 HP voluntariamente genera un impulso sísmico que destruye muros y abre atajos.
L4
El Vacío / Mazmorra de Mármol
Dios y el Absurdo
"El creador espera, inmóvil."
Negociación del Creador: Una entidad estática que permite absorber poder inestable a cambio de fragmentos de conciencia.

3. Salas Especiales y Encuentros en el Descenso
La exploración se diversifica mediante encuentros estructurales en subetapas específicas:
Etapas X-1 (Salas Especiales): 60% probabilidad de generación (70% en Ruta Principal, 30% en Vault). Incluyen el Altar del Trueque (conversión de oro a salud o vida a fragmentos) y el Pozo del Riesgo (mejoras temporales con penalización de visión e inversión de controles).
Etapas X-2 (Cueva del Mercader Turbio): 100% presencia fija (85% en Ruta Principal, 15% en Vault). Estructura tallada de 6x4 baldosas con venta de consumibles: Botas Pluma, Daga de Sacrificio, Espejo Guardián y Dinamita, adquiribles mediante monedas o salud.
4. Sistema Económico Tripartito e Inflación
El universo se rige por un intercambio de tres valores fundamentales:
Monedas/Oro: Recurso in-run que aporta masa y peso físico al Alma.
Salud/HP: 5 HP base; funciona como recurso de pago y sacrificio in-run.
Fragmentos de Conciencia: Meta-moneda persistente para el Plano Astral.
Escala de Inflación por Mundo: Mundo 1 (1.0x), Mundo 2 (1.4x), Mundo 3 (1.8x), Mundo 4 (2.2x).
5. Fase A: Generador de Caverna Densa y Mecánicas de Explosivos
Evolución del entorno hacia una densidad de terreno del ~65% (roca sólida perforable) garantizando siempre la transitabilidad de la Ruta Principal.
Mecánica de Dinamita: 2 cargas iniciales, física parabólica con rebote y temporizador de 2.2s. Posee un radio de detonación de 80px que remueve dinámicamente baldosas, daña entidades y libera vetas ocultas de oro o atajos.
6. Bitácora de Desarrollo y Registro de Versiones (Changelog Sintético)

V1 (Fundación): Plataformas base, 4 biomas y canvas multitáctil responsive.
V2 (Física Existencial): Sistema de Masa por Codicia, motor WebAudio procedural y leyes astrales iniciales.
V3 (Estabilidad y Bestiario Simbólico): 4 entidades simbólicas, suite de pruebas (120 semillas) y mitigación de errores al morir.
Fase A (En curso): Niveles dobles (8 etapas), Mercader Turbio, Salas Especiales, caverna densa y dinamita.
3. Arquitectura del Generador Procedimental (Inaccesibilidad Controlada)
Para evitar niveles inviables pero mantener el drama existencial, el mapa divide las plataformas en dos categorías estrictas:
Ruta Principal (Main Path): Garantía de naveganza al 100%. Las plataformas están diseñadas en cascada con superposición de bordes, permitiendo descender hasta la salida sin requerir saltos complejos ni ser bloqueadas por la carga de monedas.
Ruta Dramática / Inaccesible (Vaults): Ledges elevados que contienen Fragmentos de Conciencia. Son físicamente inalcanzables con el salto estándar; requieren sacrificar oro (para reducir peso), usar el super salto de sacrificio o sacrificar salud (HP).
4. Sistema Meta-Progreso: El Plano Astral
Al morir o ascender, el jugador gasta sus Fragmentos de Conciencia acumulados para decretar Leyes Permanentes:
Menor Gravedad: Reduce el peso base del universo (-5.5% por nivel).
Ampliar Percepción: Incrementa el radio de visión en la niebla (+34px por nivel).
Atenuar Dolor: Modera el daño infligido por trampa o lava.
Aligerar Oro: Mitiga la penalización de peso por cada moneda juntada.
5. Entrada y Control Multitáctil en Móviles
El esquema de control táctil resuelve las limitaciones habituales del navegador móvil mediante:
Captura de Eventos Nativa: Listeners sobre el Canvas HTML5 con pointerEvents independientes y setPointerCapture para evitar la pérdida de eventos al deslizar el dedo.
Interrupción de Gestos Nativos: Desactivación total de scroll, zoom y refresco al deslizar mediante touch-action: none y prevención de comportamiento predeterminado.
D-Pad + Botones de Acción independientes: Permitir caminata y salto simultáneos en pantallas multitáctiles.
Reglas de Muerte y Salvaguardas (Edge Cases):

    Animación Estándar: Al morir, se pausan las físicas, se oculta el sprite del jugador, se emite una explosión de partículas (blancas y azules) y se espera 1.5s antes de transicionar a AstralScene.

    Disolución del Ego (Mantener 'E'): Nunca fuerza el cambio de escena directo. Iguala la vida a 0 y llama al flujo de muerte estándar.

    Golpe Sísmico (Abajo + 'E'): Cuesta 1 HP. Incluye una guarda estricta: es imposible ejecutarlo si el jugador ya inició su secuencia de muerte. Si el costo de 1 HP resulta letal, el personaje ejecuta la explosión de roca e inmediatamente invoca la animación de muerte.

    ## 6. Detalles de Gameplay y Arte

### 6.1. Hallazgo Principal (Animación)
**No existe ningún sistema de animación.** Cada entidad tiene UNA sola textura estática, generada una única vez en `ArtData.generateBootTextures(scene)` (llamado en `BootScene.create()`, línea ~430). El jugador (`this.player`, un `physics.add.sprite`) hoy solo se manipula con:
- `setFlipX(facing < 0)` — dirección
- `setScale(scaleX, scaleY)` + tween a `(1,1)` vía `squashPlayer()` — squash/stretch en salto/aterrizaje/dash
- `setTint(0xff5b67)` — flash de daño
Esto es una buena noticia: no hay que migrar nada, solo **agregar** un sistema de variantes de textura y un wiring que las seleccione, sin tocar física ni colisiones.

### 6.2. Roster de Enemigos (`SymbolicEntity`, 8 kinds)
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

**Deuda técnica detectada:** `dogma` y `relativeVoid` caen en el mismo `else` genérico → hoy son visualmente indistinguibles entre sí, y `creditor`/`inflation` comparten forma, igual que `doubt`/`bias` e `impulse`/`guilt`. En la práctica solo hay **4 siluetas para 8 enemigos**. Esto es exactamente lo que pide tu doc original ("el jugador debe poder reconocerlos antes de leer su nombre") — hoy no se cumple. Subtarea clara: una silueta única por kind, idealmente reflejando su mecánica (ej. `bias` con apariencia de espejo/estatua, `impulse` con pose de embestida).

## 7. Mecánicas RPG y Degradación de Objetos
El jugador ahora administra un inventario persistente. Los objetos (como las Botas Pluma o el Espejo) no son solo ventajas pasivas, sino entidades físicas y frágiles, representadas con íconos en el tablero/HUD.
- **Probabilidad de Pérdida por Uso:** Las acciones extremas tienen un costo. Ejecutar habilidades como el *Golpe Sísmico* o recibir daño explosivo tiene un porcentaje de probabilidad de desgastar o destruir los objetos equipados.

## 8. Evolución Narrativa de Escenografía Fixa
La escenografía de las salas especiales evoluciona narrativamente con el descenso:
- **El Mercader Turbio (Evolución):** 
  - *Mundos 1 y 2:* Se presenta como una **Máquina Expendedora** automática (fría, puramente transaccional). 
  - *Mundo 3:* La máquina aparece rota o en cortocircuito, y la "Entidad del Mercader" se revela físicamente intentando repararla.
- **El Altar de Salud:** Se abandona el diseño de bloque rígido para convertirse visualmente en una **Fuente de Salud**, emitiendo partículas orgánicas que se integren de forma natural con los bloques de la cueva.

## 9. Menú de Pausa Extendido (Glosario y Metaprogreso)
- **Glosario Dinámico:** El menú de pausa incluirá una enciclopedia de lore (Enemigos, Biomas, Objetos, Leyes). La información es críptica al principio y se revela o amplía gradualmente a medida que el jugador interactúa con dichos elementos en sus partidas.
- **Persistencia de Semillas:** El menú mostrará la semilla alfanumérica del mapa actual, sentando las bases para un sistema de guardado o para permitir a los jugadores compartir y repetir *runs* específicas.

---

## Dirección de Arte

### 1. Dirección de Arte y El Protagonista (El Alma en Blanco)
El estilo visual adopta un enfoque de "Vector Orgánico" o ilustración digital limpia: bordes suaves y nítidos con sutiles difuminados (glow/bloom), evitando la cuadrícula estricta del pixel-art tradicional. 

El protagonista está diseñado bajo una arquitectura de marioneta (*Paper-Doll Rig*):
- **Anatomía "Cabezona" (Proporciones SD):** Cabeza prominente y redondeada que concentra la expresividad, contrastando con un cuerpo más frágil y ágil.
- **Rostro y Rasgos:** No posee boca. Su rasgo más distintivo son unos ojos vacíos y luminosos (estilo *Hollow Knight*) que actúan como focos de luz. Presenta una textura de piel/superficie pálida y castigada, marcada por una cicatriz profunda (evocando deformidades trágicas, similar a mutaciones forzadas) y coronada por algunos pelos oscuros y canas esporádicas que denotan el paso del tiempo y el desgaste existencial.
- **Vestimenta:** Lleva un taparrabos andrajoso que reacciona a las físicas del viento y la caída, enfatizando la sensación de despojo y vulnerabilidad material.

### 2. Dirección de Entornos e Iluminación (Level Art)
Los escenarios abandonan la abstracción geométrica para convertirse en Cavernas Vivas y Detalladas.
- **Terreno Orgánico:** Los bloques destructibles y plataformas presentan detalles inmersivos pero legibles: parches de musgo, grietas de tensión térmica y calaveras incrustadas en la roca, sirviendo como advertencia de ciclos pasados.
- **Arqueología y Objetos Enterrados:** El terreno oculta objetos usables y recursos bajo la superficie. El jugador debe usar explosivos o mecánicas de minería para desenterrarlos, fomentando la exploración destructiva.
- **Oscuridad Dinámica (Mundos 1 y 2):** Los primeros niveles sufren de una privación de luz casi total. El entorno no está iluminado por defecto; la atmósfera se revela dinámicamente a través de la luz emisiva que proyectan los ojos del jugador, los objetos mágicos, las explosiones y los propios enemigos.

### 3. Bestiario: Entidades de Sombra
Se abandona la representación geométrica básica (círculos/cuadrados). Los enemigos ahora poseen formas literales y anatómicas que reflejan su pecado o concepto filosófico.
- **Contraste de Sustancias:** Mientras el jugador está hecho de una materia pálida y luminosa, los enemigos están compuestos de "Sombras Purificadas" y oscuridad densa. Este contraste de valores (Blanco brillante vs. Negro abisal) asegura que las amenazas sean instantáneamente reconocibles en la penumbra de la cueva.

### 6. Interfaz (HUD) y Experiencia de Usuario (UX)
El diseño de interfaz huye del texto plano para abrazar una iconografía de fantasía oscura y moderna.
- **HUD Minimalista (In-Game):** Inspirado en marcadores gráficos limpios (estilo *Dota 2* o *MU Online*). La salud se representa mediante indicadores cuantizados y estilizados (ej. gemas de sangre o marcas rúnicas) flotando en pantalla sin necesidad de barras de contención intrusivas.
- **Menú de Pausa (Glassmorphism Oscuro):** Diseño moderno, translúcido y críptico. Un panel de cristal oscuro borroso (*background blur*) que desenfoca la acción congelada, con tipografía blanca, delgada y elegante.
- **Transición de Datos (Fake Loading Screen):** Para justificar la adquisición de conocimientos en el Glosario y las Leyes, al cambiar de zona o acceder al menú profundo, el juego introduce una micro-pantalla de "asimilación" (1 a 2 segundos) donde el personaje procesa la información de la divinidad fría y calculadora que rige el abismo.

