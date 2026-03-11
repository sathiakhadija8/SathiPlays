'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { MagazineEntry } from './MagazineList';
import { MultiImageUpload } from '../shared/MultiImageUpload';
import { toPersistableImageUrl } from '../../utils/imageUrls';

const FONT_OPTIONS = [
  { label: 'Primary heading', value: "'Playfair Display', Georgia, serif" },
  { label: 'Sub handwritten', value: "Noteworthy, 'Bradley Hand', cursive" },
  { label: 'Soft fallback', value: "'Playfair Display', Georgia, serif" },
];

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function MagazineEditor({
  entry,
  onCancel,
  onSave,
}: {
  entry: MagazineEntry | null;
  onCancel: () => void;
  onSave: (entry: MagazineEntry) => void;
}) {
  const editableRef = useRef<HTMLDivElement | null>(null);

  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [coverUploadImages, setCoverUploadImages] = useState<string[]>([]);
  const [inlineUploadImages, setInlineUploadImages] = useState<string[]>([]);
  const [contentHtml, setContentHtml] = useState('<p>Start writing your story...</p>');
  const [fontFamily, setFontFamily] = useState(FONT_OPTIONS[0].value);
  const [error, setError] = useState('');

  useEffect(() => {
    if (entry) {
      setTitle(entry.title);
      setCoverImage(entry.cover_image);
      setCoverUploadImages(entry.cover_image ? [entry.cover_image] : []);
      setInlineUploadImages([]);
      setContentHtml(entry.content_html || '<p></p>');
    } else {
      setTitle('');
      setCoverImage('');
      setCoverUploadImages([]);
      setInlineUploadImages([]);
      setContentHtml('<p>Start writing your story...</p>');
    }
    setError('');
  }, [entry]);

  useEffect(() => {
    if (editableRef.current && editableRef.current.innerHTML !== contentHtml) {
      editableRef.current.innerHTML = contentHtml;
    }
  }, [contentHtml]);

  const modeTitle = useMemo(() => (entry ? 'Edit Magazine Entry' : 'New Magazine Entry'), [entry]);

  const runCommand = (command: string, value?: string) => {
    editableRef.current?.focus();
    document.execCommand(command, false, value);
    setContentHtml(editableRef.current?.innerHTML ?? '');
  };

  const handleQuote = () => {
    editableRef.current?.focus();
    const selected = window.getSelection()?.toString().trim();
    if (selected) {
      runCommand('insertHTML', `<blockquote style="border-left:3px solid #c9a678;padding-left:10px;color:#6f5846;margin:8px 0;">${selected}</blockquote>`);
      return;
    }
    runCommand('insertHTML', '<blockquote style="border-left:3px solid #c9a678;padding-left:10px;color:#6f5846;margin:8px 0;">Quote...</blockquote>');
  };

  const handleDivider = () => {
    runCommand('insertHTML', '<hr style="border:none;border-top:1px solid #d7c2a4;margin:14px 0;" />');
  };

  const handleInsertInlineImage = async (imageUrl: string) => {
    const persistableUrl = await toPersistableImageUrl(imageUrl);
    runCommand(
      'insertHTML',
      `<div style="margin:12px 0;"><img src="${persistableUrl}" alt="Inserted" style="max-width:100%;border-radius:12px;border:1px solid #ddc8ab;" /></div>`,
    );
  };

  const handleSave = async () => {
    const cleanTitle = title.trim();
    const textContent = stripHtml(contentHtml);

    if (!cleanTitle) {
      setError('Title is required.');
      return;
    }

    if (!coverImage.trim()) {
      setError('Cover image is required.');
      return;
    }

    if (!textContent) {
      setError('Content cannot be empty.');
      return;
    }

    const finalCover = await toPersistableImageUrl(coverImage.trim());
    const now = Date.now();
    const payload: MagazineEntry = {
      id: entry?.id ?? `mag_${now}`,
      title: cleanTitle,
      cover_image: finalCover,
      content_html: contentHtml,
      created_at: entry?.created_at ?? now,
    };

    onSave(payload);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#e2d1b8]/85 bg-[#fffdf8]/90 p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3
          className="cafe-heading text-[28px] text-[#4b3426]"
        >
          {modeTitle}
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-[#d7c0a0] bg-[#fff5e7] px-3 py-1 text-xs text-[#6a5140]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="rounded-full border border-[#b78959] bg-[#f3dcc0] px-3 py-1 text-xs text-[#4f3728] shadow-[0_0_10px_rgba(183,137,89,0.3)]"
          >
            Save
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Entry title"
          className="rounded-xl border border-[#dac7aa] bg-[#fffaf2] px-3 py-2 text-sm text-[#4b3426] outline-none focus:border-[#bb9464]"
        />
        <div className="flex items-center gap-2">
          <input
            value={coverImage}
            onChange={(event) => {
              setCoverImage(event.target.value);
              setCoverUploadImages(event.target.value ? [event.target.value] : []);
            }}
            placeholder="Cover image URL"
            className="min-w-0 flex-1 rounded-xl border border-[#dac7aa] bg-[#fffaf2] px-3 py-2 text-sm text-[#4b3426] outline-none focus:border-[#bb9464]"
          />
        </div>
      </div>

      <MultiImageUpload
        value={coverUploadImages}
        onChange={(next) => {
          setCoverUploadImages(next);
          setCoverImage(next[0] ?? '');
        }}
        label="Cover image upload"
        buttonLabel="Upload cover"
        maxFiles={1}
      />

      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-xl border border-[#dec9ad] bg-[#fff8ee]/75 p-2">
        <select
          value={fontFamily}
          onChange={(event) => setFontFamily(event.target.value)}
          className="rounded-lg border border-[#d7bf9d] bg-[#fffdf8] px-2 py-1 text-xs text-[#594334] outline-none"
        >
          {FONT_OPTIONS.map((font) => (
            <option key={font.label} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        <button type="button" onClick={() => runCommand('bold')} className="rounded-lg border border-[#d7bf9d] px-2 py-1 text-xs font-semibold text-[#5d4534]">
          B
        </button>
        <button type="button" onClick={() => runCommand('italic')} className="rounded-lg border border-[#d7bf9d] px-2 py-1 text-xs italic text-[#5d4534]">
          I
        </button>
        <button type="button" onClick={handleQuote} className="rounded-lg border border-[#d7bf9d] px-2 py-1 text-xs text-[#5d4534]">
          Quote
        </button>
        <button type="button" onClick={handleDivider} className="rounded-lg border border-[#d7bf9d] px-2 py-1 text-xs text-[#5d4534]">
          Divider
        </button>
      </div>

      {coverImage ? (
        <div className="mb-2 overflow-hidden rounded-xl border border-[#dfccb0] bg-[#fff7ea]">
          <img src={coverImage} alt="Cover preview" className="h-28 w-full object-cover" />
        </div>
      ) : null}

      <div className="mb-2 rounded-xl border border-[#dfccb0] bg-[#fff8ee]/70 p-2">
        <MultiImageUpload
          value={inlineUploadImages}
          onChange={setInlineUploadImages}
          label="Inline images"
          buttonLabel="+ Add inline images"
          thumbClassName="h-16"
        />
        {inlineUploadImages.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {inlineUploadImages.map((image, index) => (
              <button
                key={`${image.slice(0, 18)}-${index}`}
                type="button"
                onClick={() => handleInsertInlineImage(image)}
                className="rounded-full border border-[#ccb391] bg-[#fff3de] px-2.5 py-1 text-[10px] text-[#6f5642]"
              >
                Insert #{index + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-[#dfccb0] bg-[linear-gradient(180deg,#fffdf9,#fff9ee)] p-3">
        <div className="h-full overflow-y-auto rounded-lg border border-[#e9dbc6] bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.94)_0px,rgba(255,255,255,0.94)_28px,rgba(236,218,194,0.2)_29px)] p-4">
          <div
            ref={editableRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(event) => setContentHtml((event.target as HTMLDivElement).innerHTML)}
            className="cafe-editor-body min-h-[320px] text-[15px] leading-8 text-[#4a3528] outline-none"
            style={{ fontFamily }}
          />
        </div>
      </div>

      {error ? <p className="mt-2 text-xs text-[#b44b4b]">{error}</p> : null}
    </div>
  );
}
