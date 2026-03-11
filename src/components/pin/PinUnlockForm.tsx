'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type PinUnlockFormProps = {
  nextPath: string;
};

export function PinUnlockForm({ nextPath }: PinUnlockFormProps) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message ?? 'Unable to unlock.');
      }
      router.replace(nextPath);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to unlock.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="mt-4 space-y-3" onSubmit={onSubmit}>
      <input
        type="password"
        inputMode="numeric"
        autoFocus
        value={pin}
        onChange={(event) => setPin(event.target.value)}
        placeholder="PIN"
        className="h-11 w-full rounded-xl border border-white/15 bg-black/25 px-3 font-sans text-sm text-[#F8F4FF] outline-none placeholder:text-[#B9B4D9]"
      />
      <button
        type="submit"
        disabled={submitting || pin.length === 0}
        className="w-full rounded-xl border border-[#FF3EA560] bg-[#FF3EA522] py-2 font-sans text-sm text-[#F8F4FF] transition-all duration-200 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Unlocking...' : 'Unlock'}
      </button>
      {error ? <p className="font-sans text-xs text-[#FF86C8]">{error}</p> : null}
    </form>
  );
}
