import { useEffect } from 'react';

export function useEscapeKey(params: { active: boolean; onEscape: () => void }) {
  const { active, onEscape } = params;

  useEffect(() => {
    if (!active) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEscape();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, onEscape]);
}

