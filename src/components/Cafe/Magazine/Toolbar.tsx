'use client';

type TextStyleState = {
  fontFamily: 'handwritten' | 'serif' | 'sans';
  fontSize: number;
  bold: boolean;
  italic: boolean;
};

export function Toolbar({
  onAddText,
  onDelete,
  onImageUpload,
  selectedTextStyle,
  onUpdateTextStyle,
}: {
  onAddText: () => void;
  onDelete: () => void;
  onImageUpload: (file: File) => void;
  selectedTextStyle: TextStyleState | null;
  onUpdateTextStyle: (partial: Partial<TextStyleState>) => void;
}) {
  return (
    <div className="rounded-xl border border-[#dcc9ad] bg-[#fffaf2]/85 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onAddText}
          className="rounded-full border border-[#cfb08a] bg-[#fff0db] px-3 py-1 text-xs text-[#5d4331]"
        >
          Add Text
        </button>

        <label className="cursor-pointer rounded-full border border-[#cfb08a] bg-[#fff0db] px-3 py-1 text-xs text-[#5d4331]">
          Add Image
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImageUpload(file);
              event.target.value = '';
            }}
          />
        </label>

        <button
          type="button"
          onClick={onDelete}
          className="rounded-full border border-[#d2b39f] bg-[#fff6ea] px-3 py-1 text-xs text-[#7a5944]"
        >
          Delete
        </button>

        {selectedTextStyle ? (
          <>
            <select
              value={selectedTextStyle.fontFamily}
              onChange={(event) =>
                onUpdateTextStyle({ fontFamily: event.target.value as 'handwritten' | 'serif' | 'sans' })
              }
              className="rounded-lg border border-[#dac4a2] bg-[#fffdf8] px-2 py-1 text-xs text-[#5f4735]"
            >
              <option value="handwritten">Handwritten</option>
              <option value="serif">Serif</option>
              <option value="sans">Sans</option>
            </select>

            <input
              type="number"
              min={12}
              max={120}
              value={selectedTextStyle.fontSize}
              onChange={(event) => onUpdateTextStyle({ fontSize: Number(event.target.value) || 16 })}
              className="w-16 rounded-lg border border-[#dac4a2] bg-[#fffdf8] px-2 py-1 text-xs text-[#5f4735]"
            />

            <button
              type="button"
              onClick={() => onUpdateTextStyle({ bold: !selectedTextStyle.bold })}
              className={`rounded-lg border px-2 py-1 text-xs ${selectedTextStyle.bold ? 'border-[#b78959] bg-[#f2dcc0] text-[#4d3728]' : 'border-[#dac4a2] bg-[#fffdf8] text-[#6f5642]'}`}
            >
              B
            </button>

            <button
              type="button"
              onClick={() => onUpdateTextStyle({ italic: !selectedTextStyle.italic })}
              className={`rounded-lg border px-2 py-1 text-xs ${selectedTextStyle.italic ? 'border-[#b78959] bg-[#f2dcc0] text-[#4d3728]' : 'border-[#dac4a2] bg-[#fffdf8] text-[#6f5642]'}`}
            >
              I
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
