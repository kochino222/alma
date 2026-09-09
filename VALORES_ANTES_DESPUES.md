# TABLA COMPARATIVA DE VALORES - Paper-Doll Animation

## VALORES MATEMATICOS: ANTES vs DESPUES

### LERP (Suavizado Global)
- ANTES: 70ms
- DESPUES: 45ms
- MEJORA: +35% mas rapido (sedoso pero responsivo)

### RUN (Carrera)
- Frecuencia: 0.010-0.020 => 0.012-0.025 (+20-25%)
- Piernas: ±45° => ±52° (+15%)
- Brazos: ±34° => ±42° (+23%)
- Torso lean: 2-7° => 3-10° (+43% max)
- Bobbing: cos(phase) => sin²(phase) (CUADRATICO)
- Bobbing range: 0.8-2.8px => 1.2-3.8px (+35-50%)
- Squash: 0.012-0.035 => 0.020-0.055 (+57-66%)

### IDLE (Respiracion)
- Frecuencia: 0.0026 => 0.0020 (-23%, mas lento)
- Torso angle: ±1.2° => ±0.7° (-42%)
- Head angle: ±0.8° => ±0.5° (-37%)
- ScaleY: ±0.035 => ±0.022 (-37%)
- Torso Y: ±0.35px => ±0.25px (-28%)
- Head Y: ±0.55px => ±0.40px (-27%)
- Desfase: 0.35 rad => 0.6 rad (+71% asimetria)

### JUMP ASCENT (Subiendo)
- Torso: 7-13° => 8-15° (+1-2°)
- Head: 4-10° => 5-12° (+1-2°)
- Front Arm: -115 a -158° => -120 a -165° (mas dramatico)
- Back Arm: 10-26° => 12-30° (mas compensacion)
- Front Leg: -24 a -48° => -28 a -54° (mas recogida)
- Back Leg: 5-15° => 8-20° (mas extension)
- Squash: 0.95 => 0.96 (mas sutil)

### APEX (NUEVO - Momento Zen)
- Rango: vy ±10 => vy ±20 (ventana +100%)
- Transicion: FIJA => GRADUAL (apexBlend)
- Sin pops visuales!

### FALL (Cayendo)
- Torso: 3 a -2° => 2 a -4° (mas inclinacion atras)
- Head: 2 a -4° => 1 a -6° (mas inclinacion)
- Arms: -115 a -145° => -110 a -152° (resistencia aire)
- Legs: asimetria NUEVA (antes simetricas)
- Stretch: 0.98-1.0 => 0.98-1.02 (stretch +2% nuevo)

## TECNICAS CLAVE APLICADAS
1. Sin² para bobbing (peso realista)
2. Blend gradual en apex (Hollow Knight)
3. Asimetria en extremidades (Rayman)
4. Squash & Stretch visible (Celeste)
5. Lerp 45ms (responsivo)

