'use client';

import { useEffect, useState } from 'react';

const DEFAULT_AFFIRMATION = "You're building quietly.";
const AVATAR_SRC = '/SathiPlays/Images/avatar.png?v=20260301';
const FADE_MS = 170;

export function AvatarPanel() {
  const [text, setText] = useState(DEFAULT_AFFIRMATION);
  const [avatarError, setAvatarError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [faded, setFaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let fadeTimer: number | undefined;

    const applyText = (nextText: string) => {
      setFaded(true);
      fadeTimer = window.setTimeout(() => {
        if (!isMounted) return;
        setText(nextText);
        setLoading(false);
        setFaded(false);
      }, FADE_MS);
    };

    const loadAffirmation = async () => {
      let nextText = DEFAULT_AFFIRMATION;
      try {
        const response = await fetch('/api/affirmations/random', { cache: 'no-store' });
        const data = (await response.json()) as { text?: string };
        if (data.text) nextText = data.text;
      } catch {
        // Keep current affirmation on failure.
      }

      if (isMounted) applyText(nextText);
    };

    loadAffirmation();
    const intervalId = window.setInterval(loadAffirmation, 12000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  }, []);

  return (
    <div className="flex h-[100px] items-center gap-3 px-1">
      <div className="animate-avatar-halo h-16 w-16 overflow-hidden rounded-full border border-[#FF3EA580] shadow-[0_0_16px_rgba(255,62,165,0.18)]">
        {avatarError ? (
          <div className="h-full w-full bg-[radial-gradient(circle_at_30%_25%,rgba(255,62,165,0.4),rgba(63,91,255,0.2)_55%,rgba(18,16,40,0.8))]" />
        ) : (
          <img
            src={AVATAR_SRC}
            alt="Avatar"
            className="h-full w-full object-cover"
            onError={() => setAvatarError(true)}
          />
        )}
      </div>
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(28,20,58,0.72)] px-3 py-2">
        {loading ? (
          <div className="shimmer h-7 w-56 rounded-lg bg-white/10" />
        ) : (
          <p className={`font-serif text-sm text-[#F8F4FF] transition-opacity duration-200 ${faded ? 'opacity-35' : 'opacity-100'}`}>
            {text}
          </p>
        )}
      </div>
    </div>
  );
}
