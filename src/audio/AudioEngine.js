// AudioEngine + instancia singleton AUDIO - Alma en Blanco
// Extraído de juego.js (Fase 2 refactor)
// Ajuste: exporta clase Y instancia singleton (usada globalmente como AUDIO.unlock(), AUDIO.jump(), etc.)

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.droneGain = null;
    this.droneOsc = [];
    this.unlocked = false;
    this.themeKey = "";
  }

  ensure() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
  }

  unlock() {
    this.ensure();
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.unlocked = true;
  }

  tone(freq = 440, duration = 0.12, type = "sine", gain = 0.15, glide = 0) {
    if (!this.unlocked) return;
    this.ensure();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const vol = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (glide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + glide), now + duration);
    }
    vol.gain.setValueAtTime(0.0001, now);
    vol.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    vol.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(vol);
    vol.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noise(duration = 0.15, gain = 0.12, tone = 900) {
    if (!this.unlocked) return;
    this.ensure();
    const now = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const source = this.ctx.createBufferSource();
    const filter = this.ctx.createBiquadFilter();
    const vol = this.ctx.createGain();
    filter.type = "bandpass";
    filter.frequency.value = tone;
    filter.Q.value = 4;
    vol.gain.setValueAtTime(gain, now);
    vol.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(vol);
    vol.connect(this.master);
    source.start(now);
  }

  setDrone(levelInfo) {
    if (!this.unlocked) return;
    this.ensure();
    if (this.themeKey === levelInfo.key && this.droneOsc.length) return;
    this.stopDrone();
    this.themeKey = levelInfo.key;
    const now = this.ctx.currentTime;
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.0001, now);
    this.droneGain.gain.linearRampToValueAtTime(0.035, now + 1.2);
    this.droneGain.connect(this.master);
    this.droneOsc = levelInfo.ambient.map((freq, index) => {
      const osc = this.ctx.createOscillator();
      const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      osc.type = index === 0 ? "sine" : "triangle";
      osc.frequency.value = freq;
      if (pan) {
        pan.pan.value = (index - 1) * 0.28;
        osc.connect(pan);
        pan.connect(this.droneGain);
      } else {
        osc.connect(this.droneGain);
      }
      osc.start(now);
      return osc;
    });
  }

  stopDrone() {
    if (!this.ctx || !this.droneOsc.length) return;
    const now = this.ctx.currentTime;
    if (this.droneGain) {
      this.droneGain.gain.cancelScheduledValues(now);
      this.droneGain.gain.setTargetAtTime(0.0001, now, 0.1);
    }
    this.droneOsc.forEach(osc => {
      try { osc.stop(now + 0.25); } catch (error) {}
    });
    this.droneOsc = [];
  }

  jump() { this.tone(240, 0.12, "square", 0.08, 240); }
  coin() { this.tone(620, 0.08, "triangle", 0.12, 280); }
  hurt() { this.noise(0.18, 0.18, 180); this.tone(92, 0.24, "sawtooth", 0.08, -36); }
  fragment() { this.tone(392, 0.12, "sine", 0.08, 392); setTimeout(() => this.tone(784, 0.16, "triangle", 0.07), 80); }
  dash() { this.noise(0.08, 0.10, 1400); this.tone(185, 0.08, "square", 0.07, 210); }
  demolition() { this.noise(0.34, 0.22, 120); this.tone(48, 0.32, "sine", 0.13, -18); }
  altar() { this.tone(110, 0.3, "sine", 0.11, 110); this.tone(329.63, 0.22, "triangle", 0.08, -40); }
  buy() { this.tone(261.63, 0.12, "triangle", 0.09, 261.63); setTimeout(() => this.tone(523.25, 0.16, "triangle", 0.08), 90); }
  reject() { this.tone(90, 0.11, "sawtooth", 0.10, -20); }
}

// Instancia singleton - usada globalmente en el código original
export const AUDIO = new AudioEngine();