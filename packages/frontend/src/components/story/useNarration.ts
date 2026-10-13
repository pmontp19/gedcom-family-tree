import { useEffect, useRef, useState } from 'react';

// Narration with the browser's own voices (Web Speech API): no service, no
// key. macOS ships Montse for Catalan; the Enhanced/Premium download sounds
// far better (System Settings > Accessibility > Spoken Content).

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

/**
 * Reads `text` aloud while `active`; `onEnd` fires a breath after the last
 * word. Returns how far it has read, 0..1, for the progress bar.
 */
export function useNarration(text: string, active: boolean, onEnd: () => void): number {
  const voice = useCatalanVoice();
  const [read, setRead] = useState({ text: '', at: 0 });
  const onEndRef = useRef(onEnd);
  useEffect(() => { onEndRef.current = onEnd; });

  useEffect(() => {
    if (!active || !narrationSupported || !text) return;
    // One utterance per sentence: Chrome cuts long ones off after ~15 s.
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
        if (i === sentences.length - 1) timer = window.setTimeout(() => onEndRef.current(), 1200);
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
  }, [text, active, voice]);

  return read.text === text ? read.at : 0;
}
