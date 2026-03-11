'use client';

import { useEffect, useRef, useState } from 'react';
import { Image as KonvaImage, Layer, Stage, Text, Transformer } from 'react-konva/lib/ReactKonvaCore';
import type Konva from 'konva';
import 'konva/lib/shapes/Image';
import 'konva/lib/shapes/Text';
import 'konva/lib/shapes/Transformer';

type FontKind = 'handwritten' | 'serif' | 'sans';

type TextElement = {
  id: string;
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontFamily: FontKind;
  fontSize: number;
  bold: boolean;
  italic: boolean;
};

type ImageElement = {
  id: string;
  type: 'image';
  x: number;
  y: number;
  width: number;
  height: number;
  imageSrc: string;
};

export type A4Element = TextElement | ImageElement;

function fontFamilyFor(kind: FontKind) {
  if (kind === 'handwritten') return "Noteworthy, Bradley Hand, Segoe Print, cursive";
  if (kind === 'serif') return "Playfair Display, Georgia, Times New Roman, serif";
  return "Noteworthy, Bradley Hand, Segoe Print, cursive";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function clampRect(el: { x: number; y: number; width: number; height: number }, stageWidth: number, stageHeight: number) {
  const width = Math.max(24, Math.min(el.width, stageWidth));
  const height = Math.max(24, Math.min(el.height, stageHeight));
  return {
    ...el,
    width,
    height,
    x: clamp(el.x, 0, Math.max(0, stageWidth - width)),
    y: clamp(el.y, 0, Math.max(0, stageHeight - height)),
  };
}

function useKonvaImage(src?: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!src) {
      setImage(null);
      return;
    }

    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setImage(img);
    img.src = src;

    return () => {
      img.onload = null;
    };
  }, [src]);

  return image;
}

function CanvasImageNode({
  element,
  selected,
  onSelect,
  onChange,
  stageWidth,
  stageHeight,
}: {
  element: ImageElement;
  selected: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<ImageElement>) => void;
  stageWidth: number;
  stageHeight: number;
}) {
  const image = useKonvaImage(element.imageSrc);

  return (
    <KonvaImage
      id={element.id}
      image={image ?? undefined}
      x={element.x}
      y={element.y}
      width={element.width}
      height={element.height}
      draggable
      onClick={onSelect}
      onTap={onSelect}
      onDragEnd={(event) => {
        const next = clampRect(
          { x: event.target.x(), y: event.target.y(), width: element.width, height: element.height },
          stageWidth,
          stageHeight,
        );
        onChange(next);
      }}
      onTransformEnd={(event) => {
        const node = event.target;
        const scaleX = node.scaleX();
        const scaleY = node.scaleY();
        node.scaleX(1);
        node.scaleY(1);
        const next = clampRect(
          {
            x: node.x(),
            y: node.y(),
            width: Math.max(40, node.width() * scaleX),
            height: Math.max(40, node.height() * scaleY),
          },
          stageWidth,
          stageHeight,
        );
        onChange(next);
      }}
      stroke={selected ? '#ff86c4' : undefined}
      strokeWidth={selected ? 1.5 : 0}
    />
  );
}

export function A4Canvas({
  pageBackground,
  title,
  date,
  width,
  height,
  elements,
  selectedId,
  onSelect,
  onChange,
  onTextDoubleClick,
  onStageReady,
}: {
  pageBackground: string;
  title: string;
  date: string;
  width: number;
  height: number;
  elements: A4Element[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<A4Element>) => void;
  onTextDoubleClick: (id: string) => void;
  onStageReady?: (stage: Konva.Stage | null) => void;
}) {
  const stageRef = useRef<Konva.Stage | null>(null);
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const backgroundImage = useKonvaImage(pageBackground);

  useEffect(() => {
    onStageReady?.(stageRef.current);
    return () => onStageReady?.(null);
  }, [onStageReady]);

  useEffect(() => {
    const stage = stageRef.current;
    const tr = transformerRef.current;
    if (!stage || !tr) return;

    if (!selectedId) {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
      return;
    }

    const node = stage.findOne(`#${selectedId}`);
    if (node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else {
      tr.nodes([]);
      tr.getLayer()?.batchDraw();
    }
  }, [selectedId, elements]);

  return (
    <>
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        className="absolute inset-0 z-10"
        onMouseDown={(event) => {
          if (event.target === event.target.getStage()) onSelect(null);
        }}
        onTouchStart={(event) => {
          if (event.target === event.target.getStage()) onSelect(null);
        }}
      >
        <Layer>
          {backgroundImage ? (
            <KonvaImage image={backgroundImage} x={0} y={0} width={width} height={height} listening={false} />
          ) : null}

          <Text
            x={20}
            y={18}
            width={width - 40}
            align="center"
            text={title}
            fill="#4d3728"
            fontSize={24}
            fontFamily="Playfair Display, Georgia, Times New Roman, serif"
            listening={false}
            fontStyle="italic"
          />
          <Text
            x={width - 160}
            y={22}
            width={140}
            align="right"
            text={date}
            fill="#5f4736"
            fontSize={13}
            fontFamily="Noteworthy, Bradley Hand, Segoe Print, cursive"
            listening={false}
          />

          {elements.map((element) => {
            if (element.type === 'image') {
              return (
                <CanvasImageNode
                  key={element.id}
                  element={element}
                  selected={selectedId === element.id}
                  onSelect={() => onSelect(element.id)}
                  stageWidth={width}
                  stageHeight={height}
                  onChange={(patch) => onChange(element.id, patch)}
                />
              );
            }

            return (
              <Text
                key={element.id}
                id={element.id}
                x={element.x}
                y={element.y}
                width={element.width}
                text={element.text}
                fontSize={element.fontSize}
                fontFamily={fontFamilyFor(element.fontFamily)}
                fontStyle={`${element.bold ? 'bold' : 'normal'} ${element.italic ? 'italic' : 'normal'}`}
                fill="#4b3426"
                draggable
                onClick={() => onSelect(element.id)}
                onTap={() => onSelect(element.id)}
                onDblClick={() => onTextDoubleClick(element.id)}
                onDblTap={() => onTextDoubleClick(element.id)}
                onDragEnd={(event) => {
                  const next = clampRect(
                    { x: event.target.x(), y: event.target.y(), width: element.width, height: element.height },
                    width,
                    height,
                  );
                  onChange(element.id, next);
                }}
                onTransformEnd={(event) => {
                  const node = event.target;
                  const scaleX = node.scaleX();
                  const scaleY = node.scaleY();
                  node.scaleX(1);
                  node.scaleY(1);
                  const next = clampRect(
                    {
                      x: node.x(),
                      y: node.y(),
                      width: Math.max(60, node.width() * scaleX),
                      height: Math.max(24, node.height() * scaleY),
                    },
                    width,
                    height,
                  );
                  onChange(element.id, next);
                }}
                stroke={selectedId === element.id ? '#ff86c4' : undefined}
                strokeWidth={selectedId === element.id ? 0.6 : 0}
              />
            );
          })}

          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            keepRatio={false}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
            boundBoxFunc={(oldBox, newBox) => {
              const minW = 40;
              const minH = 20;
              if (newBox.width < minW || newBox.height < minH) return oldBox;
              if (newBox.x < 0 || newBox.y < 0) return oldBox;
              if (newBox.x + newBox.width > width || newBox.y + newBox.height > height) return oldBox;
              return newBox;
            }}
          />
        </Layer>
      </Stage>

    </>
  );
}
