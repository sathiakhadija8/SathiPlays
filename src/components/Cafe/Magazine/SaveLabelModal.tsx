'use client';

import { useEffect, useState } from 'react';

export function SaveLabelModal({
  open,
  initialLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  initialLabel: string;
  onCancel: () => void;
  onConfirm: (label: string) => Promise<void> | void;
}) {
  const [label, setLabel] = useState(initialLabel);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setLabel(initialLabel || '');
    setError('');
  }, [open, initialLabel]);

  if (!open) return null;

  const confirm = async () => {
    const clean = label.trim();
    if (!clean) {
      setError('Label is required.');
      return;
    }
    await onConfirm(clean);
  };

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-[rgba(25,16,10,0.38)] backdrop-blur-[1px]">
      <div className="w-[min(92vw,360px)] rounded-xl border border-[#d7c3a5] bg-[#fff7ea] p-4 shadow-[0_10px_24px_rgba(44,30,19,0.18)]">
        <h4 className="cafe-heading text-2xl text-[#4b3426]">Save Magazine</h4>
        <p className="mt-1 text-xs text-[#7a624d]">Add a label before saving this A4 entry.</p>

        <label className="mt-3 block text-xs text-[#6a5140]">
          Label
          <input
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
              if (error) setError('');
            }}
            className="mt-1 w-full rounded-lg border border-[#d5bf9f] bg-[#fffdf8] px-3 py-2 text-sm text-[#4b3426] outline-none focus:border-[#b88f61]"
            placeholder="Issue 03"
          />
        </label>

        {error ? <p className="mt-1 text-[11px] text-[#b44b4b]">{error}</p> : null}

        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[#d2bc9b] bg-[#fff4e4] px-3 py-1 text-xs text-[#6f5742]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            className="rounded-full border border-[#b78959] bg-[#f3dcc0] px-3 py-1 text-xs text-[#4f3728]"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
