'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type Konva from 'konva';
import type { MagazineGridEntry } from './MagazineCard';
import { A4TemplatePicker } from './A4TemplatePicker';
import { Toolbar } from './Toolbar';
import { A4Canvas, type A4Element } from './A4Canvas';
import { SaveLabelModal } from './SaveLabelModal';
import { toPersistableImageUrl } from '../../../utils/imageUrls';

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

export function A4Editor({
  entry,
  onBack,
  onSave,
  onDelete,
}: {
  entry: MagazineGridEntry;
  onBack: () => void;
  onSave: (next: MagazineGridEntry) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
}) {
  const [title, setTitle] = useState(entry.title || 'Untitled Magazine');
  const [label, setLabel] = useState(entry.label || '');
  const [date, setDate] = useState(entry.date || todayYmd());
  const [pageBackground, setPageBackground] = useState(entry.cover_preview_image || '/Images/A4Templates/a4_1.svg');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSaveLabelModal, setShowSaveLabelModal] = useState(false);
  const [elements, setElements] = useState<A4Element[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 396, height: 560 });
  const pageSurfaceRef = useRef<HTMLDivElement | null>(null);
  const uploadedObjectUrlRef = useRef<string | null>(null);
  const uploadedElementUrlsRef = useRef<string[]>([]);
  const [stageRefForExport, setStageRefForExport] = useState<Konva.Stage | null>(null);

  useEffect(() => {
    setTitle(entry.title || 'Untitled Magazine');
    setLabel(entry.label || '');
    setDate(entry.date || todayYmd());
    setPageBackground(entry.a4_template_src || entry.cover_preview_image || '/Images/A4Templates/a4_1.svg');
    setElements(
      (entry.elements ?? []).map((el) =>
        el.type === 'text'
          ? {
              id: `txt_${Math.random().toString(36).slice(2, 9)}`,
              type: 'text',
              x: el.x,
              y: el.y,
              width: el.w,
              height: el.h,
              text: el.text,
              fontFamily: el.fontFamily,
              fontSize: el.fontSize,
              bold: el.fontWeight === 'bold',
              italic: el.fontStyle === 'italic',
            }
          : {
              id: `img_${Math.random().toString(36).slice(2, 9)}`,
              type: 'image',
              x: el.x,
              y: el.y,
              width: el.w,
              height: el.h,
              imageSrc: el.src,
            },
      ),
    );
    setSelectedId(null);
    setEditingTextId(null);
  }, [entry.id, entry.title, entry.label, entry.date, entry.a4_template_src, entry.cover_preview_image, entry.elements]);

  useEffect(() => {
    return () => {
      if (uploadedObjectUrlRef.current) {
        URL.revokeObjectURL(uploadedObjectUrlRef.current);
        uploadedObjectUrlRef.current = null;
      }
      uploadedElementUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      uploadedElementUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const el = pageSurfaceRef.current;
    if (!el) return;

    const update = () => {
      setCanvasSize({ width: el.clientWidth, height: el.clientHeight });
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleUploadTemplate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (uploadedObjectUrlRef.current) {
      URL.revokeObjectURL(uploadedObjectUrlRef.current);
      uploadedObjectUrlRef.current = null;
    }

    const objectUrl = URL.createObjectURL(file);
    uploadedObjectUrlRef.current = objectUrl;
    setPageBackground(objectUrl);

    event.target.value = '';
  };

  const openSaveModal = () => setShowSaveLabelModal(true);

  const confirmSave = async (nextLabel: string) => {
    if (editingTextId) {
      setElements((current) =>
        current.map((el) => (el.id === editingTextId && el.type === 'text' ? { ...el, text: editingTextValue || ' ' } : el)),
      );
      setEditingTextId(null);
    }

    const normalizedTemplateSrc = await toPersistableImageUrl(pageBackground);
    const serializedElements = await Promise.all(elements.map(async (el) =>
      el.type === 'text'
        ? {
            type: 'text' as const,
            x: el.x,
            y: el.y,
            w: el.width,
            h: el.height,
            text: el.text,
            fontFamily: el.fontFamily,
            fontSize: el.fontSize,
            fontWeight: el.bold ? ('bold' as const) : ('normal' as const),
            fontStyle: el.italic ? ('italic' as const) : ('normal' as const),
          }
        : {
            type: 'image' as const,
            x: el.x,
            y: el.y,
            w: el.width,
            h: el.height,
            src: await toPersistableImageUrl(el.imageSrc),
          },
    ));

    const previewImage =
      stageRefForExport?.toDataURL({
        mimeType: 'image/png',
        pixelRatio: 2,
      }) ?? pageBackground;

    await onSave({
      ...entry,
      label: nextLabel,
      title: title.trim() || 'Untitled Magazine',
      date,
      a4_template_src: normalizedTemplateSrc,
      elements: serializedElements,
      cover_preview_image: previewImage,
    });
    setLabel(nextLabel);
    setShowSaveLabelModal(false);
    onBack();
  };

  const selectedTextElement = useMemo(() => {
    const el = elements.find((item) => item.id === selectedId && item.type === 'text');
    if (!el || el.type !== 'text') return null;
    return el;
  }, [elements, selectedId]);

  const addTextElement = () => {
    const nextId = `txt_${Date.now()}`;
    setElements((current) => [
      ...current,
      {
        id: nextId,
        type: 'text',
        x: Math.max(20, canvasSize.width * 0.28),
        y: Math.max(90, canvasSize.height * 0.28),
        width: Math.min(240, canvasSize.width - 40),
        height: 48,
        text: 'Double-click to edit',
        fontFamily: 'handwritten',
        fontSize: 28,
        bold: false,
        italic: false,
      },
    ]);
    setSelectedId(nextId);
  };

  const addImageElement = (file: File) => {
    const objectUrl = URL.createObjectURL(file);
    uploadedElementUrlsRef.current.push(objectUrl);
    const nextId = `img_${Date.now()}`;
    const width = Math.min(220, canvasSize.width * 0.46);
    const height = width * 0.66;
    setElements((current) => [
      ...current,
      {
        id: nextId,
        type: 'image',
        x: Math.max(20, (canvasSize.width - width) / 2),
        y: Math.max(110, (canvasSize.height - height) / 2),
        width,
        height,
        imageSrc: objectUrl,
      },
    ]);
    setSelectedId(nextId);
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((current) => {
      const target = current.find((el) => el.id === selectedId);
      if (target && target.type === 'image' && target.imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(target.imageSrc);
        uploadedElementUrlsRef.current = uploadedElementUrlsRef.current.filter((url) => url !== target.imageSrc);
      }
      return current.filter((el) => el.id !== selectedId);
    });
    setSelectedId(null);
    setEditingTextId(null);
  };

  const updateSelectedTextStyle = (patch: Partial<{ fontFamily: 'handwritten' | 'serif' | 'sans'; fontSize: number; bold: boolean; italic: boolean }>) => {
    if (!selectedTextElement) return;
    setElements((current) =>
      current.map((el) => (el.id === selectedTextElement.id && el.type === 'text' ? { ...el, ...patch } : el)),
    );
  };

  const handleElementChange = (id: string, patch: Partial<A4Element>) => {
    setElements((current) => current.map((el) => (el.id === id ? ({ ...el, ...patch } as A4Element) : el)));
  };

  const startEditingText = (id: string) => {
    const target = elements.find((el) => el.id === id && el.type === 'text');
    if (!target || target.type !== 'text') return;
    setEditingTextId(id);
    setEditingTextValue(target.text);
  };

  const commitTextEdit = () => {
    if (!editingTextId) return;
    setElements((current) =>
      current.map((el) => (el.id === editingTextId && el.type === 'text' ? { ...el, text: editingTextValue || ' ' } : el)),
    );
    setEditingTextId(null);
  };

  const editingTextElement = useMemo(() => {
    const target = elements.find((el) => el.id === editingTextId && el.type === 'text');
    if (!target || target.type !== 'text') return null;
    return target;
  }, [elements, editingTextId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTemplates((v) => !v)}
            className="rounded-full border border-[#d2bb99] bg-[#fff4e3] px-3 py-1 text-xs text-[#604736]"
          >
            Templates
          </button>

          <label className="cursor-pointer rounded-full border border-[#d2bb99] bg-[#fff4e3] px-3 py-1 text-xs text-[#604736]">
            Upload A4
            <input type="file" accept="image/*" className="hidden" onChange={handleUploadTemplate} />
          </label>

          <A4TemplatePicker
            open={showTemplates}
            selected={pageBackground}
            onSelect={setPageBackground}
            onClose={() => setShowTemplates(false)}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void onDelete(entry.id);
            }}
            className="rounded-full border border-[#d6c2a5] bg-[#fff4e7] px-3 py-1 text-xs text-[#7a5f49]"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-full border border-[#d7c0a0] bg-[#fff5e7] px-3 py-1 text-xs text-[#6a5140]"
          >
            Back
          </button>
          <button
            type="button"
            onClick={openSaveModal}
            className="rounded-full border border-[#b78959] bg-[#f3dcc0] px-3 py-1 text-xs text-[#4f3728]"
          >
            Save
          </button>
        </div>
      </div>

      <div className="mb-2">
        <Toolbar
          onAddText={addTextElement}
          onDelete={deleteSelected}
          onImageUpload={addImageElement}
          selectedTextStyle={
            selectedTextElement
              ? {
                  fontFamily: selectedTextElement.fontFamily,
                  fontSize: selectedTextElement.fontSize,
                  bold: selectedTextElement.bold,
                  italic: selectedTextElement.italic,
                }
              : null
          }
          onUpdateTextStyle={updateSelectedTextStyle}
        />
      </div>

      <div className="grid min-h-0 flex-1 place-items-center rounded-2xl border border-[#ddc9aa] bg-[#fffdf8]/90 p-4">
        <div
          ref={pageSurfaceRef}
          className="relative aspect-[210/297] h-full max-h-[560px] w-full max-w-[396px] overflow-hidden rounded-lg border border-[#d8c3a2] bg-[#fffaf0] shadow-[0_8px_24px_rgba(55,39,24,0.14)]"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_14%,rgba(255,255,255,0.22),transparent_46%)]" />

          <div className="absolute left-4 right-4 top-4 z-20 flex items-start justify-between gap-3">
            <div className="flex-1 text-center">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full bg-transparent text-center text-[20px] text-[#4d3728] outline-none"
                style={{ fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif", fontStyle: 'italic', fontWeight: 700 }}
                placeholder="Magazine title"
              />
            </div>

            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className="w-[124px] rounded-md border border-[#d9c4a5]/70 bg-[rgba(255,248,235,0.62)] px-2 py-1 text-right text-xs text-[#5f4736] outline-none"
              style={{ fontFamily: "Noteworthy, 'Bradley Hand', 'Segoe Print', cursive" }}
            />
          </div>

          <A4Canvas
            width={canvasSize.width}
            height={canvasSize.height}
            pageBackground={pageBackground}
            title={title}
            date={date}
            elements={elements}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onChange={handleElementChange}
            onTextDoubleClick={startEditingText}
            onStageReady={setStageRefForExport}
          />

          {editingTextElement ? (
            <textarea
              autoFocus
              value={editingTextValue}
              onChange={(event) => setEditingTextValue(event.target.value)}
              onBlur={commitTextEdit}
              onKeyDown={(event) => {
                if (event.key === 'Escape') setEditingTextId(null);
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) commitTextEdit();
              }}
              className="absolute z-30 resize-none rounded border border-[#c8a883] bg-[rgba(255,250,240,0.94)] px-2 py-1 text-[#4b3426] outline-none"
              style={{
                left: editingTextElement.x,
                top: editingTextElement.y,
                width: editingTextElement.width,
                minHeight: editingTextElement.height,
                fontFamily:
                  editingTextElement.fontFamily === 'handwritten'
                    ? "Noteworthy, Bradley Hand, Segoe Print, cursive"
                    : editingTextElement.fontFamily === 'serif'
                      ? "Playfair Display, Georgia, Times New Roman, serif"
                      : "Noteworthy, Bradley Hand, Segoe Print, cursive",
                fontSize: editingTextElement.fontSize,
                fontWeight: editingTextElement.bold ? 700 : 400,
                fontStyle: editingTextElement.italic ? 'italic' : 'normal',
              }}
            />
          ) : null}
        </div>
      </div>

      <SaveLabelModal
        open={showSaveLabelModal}
        initialLabel={label}
        onCancel={() => setShowSaveLabelModal(false)}
        onConfirm={confirmSave}
      />
    </div>
  );
}
