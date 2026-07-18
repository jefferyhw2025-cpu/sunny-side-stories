export type GameSound =
  | "open"
  | "close"
  | "confirm"
  | "reward"
  | "step"
  | "error";

let audioContext: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor = window.AudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ??= new AudioContextConstructor();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

function note(
  audio: AudioContext,
  frequency: number,
  startsAt: number,
  duration: number,
  gainValue: number,
  wave: OscillatorType = "sine",
): void {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  gain.gain.setValueAtTime(0.0001, startsAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startsAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
  oscillator.connect(gain);
  gain.connect(audio.destination);
  oscillator.start(startsAt);
  oscillator.stop(startsAt + duration + 0.02);
}

export function playGameSound(sound: GameSound, enabled = true): void {
  if (!enabled) return;
  const audio = context();
  if (!audio) return;
  const now = audio.currentTime + 0.006;
  const patterns: Record<GameSound, readonly [number, number, number, OscillatorType][]> = {
    open: [[440, 0, 0.09, "sine"], [587, 0.07, 0.12, "sine"]],
    close: [[520, 0, 0.08, "sine"], [390, 0.06, 0.11, "sine"]],
    confirm: [[523, 0, 0.1, "triangle"], [659, 0.08, 0.12, "triangle"]],
    reward: [[523, 0, 0.12, "sine"], [659, 0.09, 0.14, "sine"], [784, 0.18, 0.2, "sine"]],
    step: [[190, 0, 0.045, "triangle"]],
    error: [[210, 0, 0.12, "square"], [168, 0.09, 0.16, "square"]],
  };
  for (const [frequency, offset, duration, wave] of patterns[sound]) {
    note(audio, frequency, now + offset, duration, sound === "error" ? 0.018 : 0.026, wave);
  }
}
