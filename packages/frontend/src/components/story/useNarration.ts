import { useEffect, useRef, useState } from 'react';

// Narration with the browser's own voices (Web Speech API): no service, no
// key. macOS ships Montse for Catalan; the Enhanced/Premium download sounds
// far better (System Settings > Accessibility > Spoken Content).
// A step with recorded audio (step.audio, from the package) plays that file
// instead: the cloned voice rides in the .historia.zip.

export const narrationSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

const rank = (v: SpeechSynthesisVoice) => (/premium|enhanced|millorad|neural/i.test(v.name) ? 0 : 1);

function useCatalanVoice(): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (!narrationSupported) return;
    const pick = () => setVoice(
      speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith('ca')).sort((a, b) => rank(a) - rank(b))[0] ?? null,
    );
    pick();
    speechSynthesis.addEventListener('voiceschanged', pick);
    return () => speechSynthesis.removeEventListener('voiceschanged', pick);
  }, []);
  return voice;
}

/** A breath after the last word, so the next step does not trample the ending. */
const BREATH_MS = 1200;

/**
 * Reads `text` aloud while `active`, or plays `audioUrl` when given; `onEnd`
 * fires a breath after the last word. Returns how far it has read, 0..1, for
 * the progress bar.
 */
export function useNarration(text: string, active: boolean, onEnd: () => void, audioUrl?: string): number {
  const voice = useCatalanVoice();
  const [read, setRead] = useState({ text: '', at: 0 });
  const [played, setPlayed] = useState({ url: '', at: 0 });
  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; });

  // Recorded narration: one HTMLAudioElement per active step.
  useEffect(() => {
    if (!active || !audioUrl) return;
    const el = new Audio(audioUrl);
    const onTime = () => setPlayed({ url: audioUrl, at: el.duration ? el.currentTime / el.duration : 0 });
    const onEnded = () => {
      setPlayed({ url: audioUrl, at: 1 });
      window.setTimeout(() => onEndRef.current(), BREATH_MS);
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('ended', onEnded);
    void el.play().catch(() => { /* Autoplay refused; the timer path still paces nothing, so move on */ onEnded(); });
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('ended', onEnded);
      el.pause();
      el.src = '';
    };
  }, [audioUrl, active]);

  // Spoken narration, one utterance per sentence: Chrome cuts long ones off after ~15 s.
  useEffect(() => {
    if (!active || audioUrl || !narrationSupported || !text) return;
    const sentences = text.match(/[^.!?…]+[.!?…]*["»”]?\s*/g) ?? [text];
    let done = 0;
    let timer: number | undefined;
    const utterances = sentences.map((sentence, i) => {
      const u = new SpeechSynthesisUtterance(sentence);
      u.lang = 'ca-ES';
      if (voice) u.voice = voice;
      u.rate = 0.95;
      const offset = done;
      done += sentence.length;
      u.onboundary = (e) => setRead({ text, at: (offset + e.charIndex) / text.length });
      u.onend = () => {
        setRead({ text, at: (offset + sentence.length) / text.length });
        if (i === sentences.length - 1) timer = window.setTimeout(() => onEndRef.current(), BREATH_MS);
      };
      return u;
    });
    speechSynthesis.cancel();
    utterances.forEach(u => speechSynthesis.speak(u));
    return () => {
      window.clearTimeout(timer);
      for (const u of utterances) { u.onend = null; u.onboundary = null; }
      speechSynthesis.cancel();
    };
  }, [text, active, audioUrl, voice]);

  if (audioUrl) return played.url === audioUrl ? played.at : 0;
  return read.text === text ? read.at : 0;
}
