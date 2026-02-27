'use client'
import { useEffect, useRef, useState } from 'react';

/**
 * Smoothly displays text character-by-character at ~60fps via requestAnimationFrame.
 * Decouples render rate from SSE chunk arrival, eliminating burst rendering.
 * Adaptive speed: catches up faster when falling far behind the incoming target.
 * Resets automatically when target shrinks (new stream starting).
 */
export function useTypewriter(target: string, charsPerFrame = 4): string {
  const [displayed, setDisplayed] = useState('');
  const ref = useRef({ pos: 0, target: '', raf: null as number | null });

  useEffect(() => {
    const s = ref.current;

    // New stream started — target reset to shorter than our position
    if (target.length < s.pos) {
      s.pos = 0;
      setDisplayed('');
    }
    s.target = target;

    if (s.raf !== null) return; // already animating — tick will pick up updated target

    const tick = () => {
      const behind = s.target.length - s.pos;
      if (behind <= 0) {
        s.raf = null;
        return;
      }
      // Adaptive: go faster when far behind so we never lag visibly
      const step = behind > 120 ? Math.ceil(behind / 5) : charsPerFrame;
      s.pos = Math.min(s.pos + step, s.target.length);
      setDisplayed(s.target.slice(0, s.pos));
      s.raf = requestAnimationFrame(tick);
    };

    s.raf = requestAnimationFrame(tick);
  }, [target]);

  useEffect(() => {
    return () => {
      if (ref.current.raf !== null) {
        cancelAnimationFrame(ref.current.raf);
        ref.current.raf = null;
      }
    };
  }, []);

  return displayed;
}
