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

## Arquitectura (Nota Técnica)
Todo el código fuente del juego y la escena principal han sido migrados a una estructura de *ES Modules* dentro de la carpeta `src/`. `GameScene` se compone de múltiples sistemas delegados (ver `hermes/architecture-reference.md`).