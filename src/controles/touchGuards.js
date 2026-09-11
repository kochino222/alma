// Touch guards nativos - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)
// Ajuste: extraído antes que BootScene/ControlRig porque ambos lo usan

export function installNativeTouchGuards(game) {
  const canvas = game && game.canvas;
  if (!canvas || canvas.__blankSoulTouchGuardsInstalled) return;
  const preventNativeGesture = event => {
    if (event.cancelable) event.preventDefault();
  };
  ["touchstart", "touchmove", "touchend", "touchcancel", "gesturestart"].forEach(type => {
    canvas.addEventListener(type, preventNativeGesture, { passive: false });
  });
  canvas.style.touchAction = "none";
  canvas.style.webkitUserSelect = "none";
  canvas.__blankSoulTouchGuardsInstalled = true;
}