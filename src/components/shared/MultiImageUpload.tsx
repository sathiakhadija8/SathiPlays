'use client';

import { useEffect, useRef } from 'react';

export function MultiImageUpload({
  value,
  onChange,
  label = 'Images',
  buttonLabel = '+ Add images',
  maxFiles,
  className = '',
  thumbClassName = 'h-20',
}: {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  buttonLabel?: string;
  maxFiles?: number;
  className?: string;
  thumbClassName?: string;
}) {
  const createdObjectUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const created = createdObjectUrlsRef.current;
    created.forEach((url) => {
      if (!value.includes(url)) {
        URL.revokeObjectURL(url);
        created.delete(url);
      }
    });
  }, [value]);

  useEffect(() => {
    return () => {
      createdObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      createdObjectUrlsRef.current.clear();
    };
  }, []);

  const handleAdd = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const nextUrls: string[] = [];
    for (const file of Array.from(files)) {
      const objectUrl = URL.createObjectURL(file);
      createdObjectUrlsRef.current.add(objectUrl);
      nextUrls.push(objectUrl);
    }

    const merged = [...value, ...nextUrls];
    const limited = typeof maxFiles === 'number' ? merged.slice(0, maxFiles) : merged;
    onChange(limited);
    event.target.value = '';
  };

  const handleRemove = (index: number) => {
    const target = value[index];
    if (target && createdObjectUrlsRef.current.has(target)) {
      URL.revokeObjectURL(target);
      createdObjectUrlsRef.current.delete(target);
    }
    onChange(value.filter((_, i) => i !== index));
  };

  const canAddMore = typeof maxFiles !== 'number' || value.length < maxFiles;

  return (
    <div className={`rounded-2xl border border-[#d8c5a8] bg-[#fff8ef]/70 p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-[#6a5140]">{label}</p>
        {canAddMore ? (
          <label className="cursor-pointer rounded-full border border-[#c9aa80] bg-[#fff3df] px-3 py-1 text-[11px] text-[#6c4f37] hover:border-[#b88f61]">
            {buttonLabel}
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleAdd} />
          </label>
        ) : (
          <span className="text-[10px] text-[#8a715a]">Limit reached</span>
        )}
      </div>

      <div className="grid max-h-[180px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
        {value.map((image, index) => (
          <div key={`${image.slice(0, 18)}-${index}`} className="group relative">
            <img
              src={image}
              alt={`Uploaded ${index + 1}`}
              className={`${thumbClassName} w-full rounded-lg border border-[#d7c0a0] object-cover`}
            />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="absolute right-1 top-1 rounded-full bg-[rgba(48,28,18,0.78)] px-1.5 py-0.5 text-[10px] text-[#fff4ea] opacity-0 transition-opacity group-hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
