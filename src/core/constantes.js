// Constantes del juego - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)

export const VIEW_W = 960;
export const VIEW_H = 540;
export const TILE = 32;
export const BASE_GRAVITY = 800;
export const JUMP_SPEED = 382;
export const SACRIFICE_JUMP_SPEED = 700;
export const ROUTE_MAIN = "main";
export const ROUTE_DRAMATIC = "dramatic";
export const TOTAL_STAGES = 8;
export const MAX_LAW_TIER = 1;
export const SAVE_KEY = "blank-soul-save-v4";
export const RUN_FRAGMENT_KEY = "blank-soul-run-fragments-v3";

export const LEVELS = [
  {
    id: 1,
    key: "desert",
    name: "Ruinas del Desierto",
    concept: "Economía y materialismo",
    mantra: "Las monedas pesan.",
    tile: "tile-desert",
    bgTop: 0x261b1d,
    bgMid: 0x7b4630,
    bgLow: 0xd6964b,
    accent: 0xffce66,
    hazard: 0xcf4242,
    darkness: 0.18,
    ambient: [73.42, 110, 146.83]
  },
  {
    id: 2,
    key: "jungle",
    name: "Selva Exuberante",
    concept: "Intelecto y conciencia",
    mantra: "Conocer transforma a quien conoce.",
    tile: "tile-jungle",
    bgTop: 0x081b18,
    bgMid: 0x124933,
    bgLow: 0x2f7545,
    accent: 0x75f1b4,
    hazard: 0xb97aff,
    darkness: 0.42,
    ambient: [82.41, 164.81, 247.94]
  },
  {
    id: 3,
    key: "volcano",
    name: "Núcleo Volcánico",
    concept: "Poder y ego",
    mantra: "Para romper el mundo, entregá algo de vos.",
    tile: "tile-volcano",
    bgTop: 0x18080b,
    bgMid: 0x5e1618,
    bgLow: 0xff6b2a,
    accent: 0xffb14a,
    hazard: 0xff3f2e,
    darkness: 0.26,
    ambient: [55, 82.41, 130.81]
  },
  {
    id: 4,
    key: "void",
    name: "El Vacío / Mazmorra de Mármol",
    concept: "Dios y el absurdo",
    mantra: "El creador espera, inmóvil.",
    tile: "tile-void",
    bgTop: 0x04050a,
    bgMid: 0x131827,
    bgLow: 0x282b38,
    accent: 0xf4f0e2,
    hazard: 0x7df7ff,
    darkness: 0.55,
    ambient: [41.2, 92.5, 185]
  }
];

export const LAW_DEFS = [
  { key: "economyGrace", tier: 1, title: "Aligerar Oro", short: "Oro", cost: 10,
    body: "Mitiga el peso de cada moneda.", value: owned => owned ? "Peso del oro al 72%" : "Sin aprender" },
  { key: "willInertia", tier: 1, title: "Fluidez Existencial", short: "Fluidez", cost: 15,
    body: "El salto tras un dash o una caída rápida conserva toda la velocidad aérea.", value: owned => owned ? "Disponible" : "Sin aprender" },
  { key: "doubleJump", tier: 2, title: "Doble Salto Sacramental", short: "2º salto", cost: 25,
    body: "Concede un segundo salto a cambio de 1 moneda.", value: owned => owned ? "Activo" : "Sin aprender" },
  { key: "etherealBond", tier: 2, title: "Vínculo Etéreo", short: "Vínculo", cost: 35,
    body: "Al morir, conserva 15% del oro como fragmentos.", value: owned => owned ? "Activo" : "Sin aprender" },
  { key: "selectiveAmnesia", tier: 3, title: "Amnesia Selectiva", short: "Amnesia", cost: 50,
    body: "Anula el primer golpe de cada nivel, pero pierde 50% de fragmentos de zona.", value: owned => owned ? "Activa" : "Sin aprender" },
  { key: "greedTransmutation", tier: 3, title: "Transmutación de la Codicia", short: "Codicia", cost: 70,
    body: "Las caídas generan ondas según la masa acumulada.", value: owned => owned ? "Activa" : "Sin aprender" }
];

export const DEFAULT_META = Object.freeze({
  fragments: 0,
  economyGrace: 0,
  willInertia: 0,
  doubleJump: 0,
  etherealBond: 0,
  selectiveAmnesia: 0,
  greedTransmutation: 0,
  activeEconomyGrace: 1,
  activeWillInertia: 1,
  activeDoubleJump: 1,
  activeEtherealBond: 1,
  activeSelectiveAmnesia: 1,
  activeGreedTransmutation: 1,
  ascensions: 0,
  medallas: []
});