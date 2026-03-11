'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GlowBook, GlowRoutine } from '../../lib/glow-types';
import { usePlatformWindowOpen } from '../../lib/use-platform-window-open';

export function ImageUploadModal({
  open,
  routineId,
  books,
  routines = [],
  initialBookId = null,
  onClose,
  onUploaded,
}: {
  open: boolean;
  routineId: number | null;
  books: GlowBook[];
  routines?: GlowRoutine[];
  initialBookId?: number | null;
  onClose: () => void;
  onUploaded: () => Promise<void> | void;
}) {
  const [mounted, setMounted] = useState(false);
  const [caption, setCaption] = useState('');
  const [quote, setQuote] = useState('');
  const [bookId, setBookId] = useState('');
  const [selectedRoutineId, setSelectedRoutineId] = useState('');
  const [saving, setSaving] = useState(false);
  usePlatformWindowOpen(open);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    setBookId(initialBookId ? String(initialBookId) : '');
    setSelectedRoutineId(routineId ? String(routineId) : '');
  }, [open, initialBookId, routineId]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-4 backdrop-blur-xl">
        <h3 className="font-serif text-2xl text-[#F8F4FF]">Save Glow Memory</h3>
        <form
          className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const fileInput = form.elements.namedItem('file') as HTMLInputElement;
            const file = fileInput?.files?.[0];
            const activeRoutineId = routineId ?? Number(selectedRoutineId);
            if (!file) return;
            if (!bookId) return;
            if (!Number.isInteger(activeRoutineId) || activeRoutineId <= 0) return;

            setSaving(true);
            const formData = new FormData();
            formData.set('file', file);
            formData.set('routine_id', String(activeRoutineId));
            formData.set('book_id', bookId);
            if (caption.trim()) formData.set('caption', caption.trim());
            if (quote.trim()) formData.set('quote', quote.trim());

            await fetch('/api/glow/images/upload', { method: 'POST', body: formData });
            setSaving(false);
            setCaption('');
            setQuote('');
            setBookId(initialBookId ? String(initialBookId) : '');
            if (!routineId) setSelectedRoutineId('');
            await onUploaded();
            onClose();
          }}
        >
          <input name="file" type="file" accept="image/*" required className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-sm text-[#F8F4FF]" />
          {!routineId ? (
            <select value={selectedRoutineId} onChange={(e) => setSelectedRoutineId(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-sm text-[#F8F4FF]">
              <option value="">Select routine (required)</option>
              {routines.map((routine) => (
                <option key={routine.id} value={routine.id}>{routine.name}</option>
              ))}
            </select>
          ) : null}
          {!routineId && routines.length === 0 ? (
            <p className="text-xs text-[#B9B4D9]">Create a routine first, then upload polaroids to your books.</p>
          ) : null}
          <select value={bookId} onChange={(e) => setBookId(e.target.value)} className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-sm text-[#F8F4FF]">
            <option value="">Select book (required)</option>
            {books.map((book) => (
              <option key={book.id} value={book.id}>{book.title}</option>
            ))}
          </select>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption" className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-sm text-[#F8F4FF]" />
          <input value={quote} onChange={(e) => setQuote(e.target.value)} placeholder="Quote" className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-sm text-[#F8F4FF]" />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-full border border-[#FF3EA566] bg-[#FF3EA522] px-4 py-1 text-xs text-[#F8F4FF]">{saving ? 'Uploading...' : 'Upload'}</button>
            <button type="button" onClick={onClose} className="rounded-full border border-white/20 px-4 py-1 text-xs text-[#F8F4FF]">Cancel</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
