let ambientAudio = null;
let ambientVolume = 0.3;
let sourceCheckPromise = null;

async function hasAmbientSource() {
  if (typeof window === 'undefined') return false;
  if (!sourceCheckPromise) {
    sourceCheckPromise = (async () => {
      try {
        const response = await fetch('/audio/ambient.mp3', { method: 'HEAD', cache: 'no-store' });
        if (!response.ok) return false;
        const contentLength = Number(response.headers.get('content-length') ?? '0');
        return Number.isFinite(contentLength) && contentLength > 0;
      } catch {
        return false;
      }
    })();
  }
  return sourceCheckPromise;
}

async function getAudio() {
  if (typeof window === 'undefined') return null;
  if (!ambientAudio) {
    const hasSource = await hasAmbientSource();
    if (!hasSource) return null;
    ambientAudio = new Audio('/audio/ambient.mp3');
    ambientAudio.loop = true;
    ambientAudio.volume = ambientVolume;
    ambientAudio.preload = 'metadata';
  }
  return ambientAudio;
}

export async function playAmbient() {
  const audio = await getAudio();
  if (!audio) throw new Error('Ambient audio unavailable.');
  await audio.play();
}

export function pauseAmbient() {
  const audio = ambientAudio;
  if (!audio) return;
  audio.pause();
}

export function setAmbientVolume(v) {
  const clamped = Math.max(0, Math.min(1, Number(v)));
  ambientVolume = Number.isFinite(clamped) ? clamped : 0.3;
  if (ambientAudio) ambientAudio.volume = ambientVolume;
}
