import type { GlowImage } from '../../lib/glow-types';

function angleFromId(id: number) {
  const value = (id % 5) - 2;
  return value * 1.4;
}

export function PolaroidCard({ image, onOpen }: { image: GlowImage; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group rounded-md bg-white p-2 text-left shadow-[0_12px_22px_rgba(0,0,0,0.28)] transition-all duration-200 hover:-translate-y-[2px]"
      style={{ transform: `rotate(${angleFromId(image.id)}deg)` }}
    >
      <div className="h-32 w-28 overflow-hidden rounded-sm bg-[#ddd]">
        <img src={image.image_path} alt={image.caption ?? 'Glow polaroid'} className="h-full w-full object-cover" />
      </div>
      <p className="mt-2 max-w-28 truncate font-sans text-[11px] text-[#2a213f]">{image.caption ?? 'Glow moment'}</p>
      <p className="font-sans text-[10px] text-[#7e759f]">{new Date(image.created_at).toLocaleDateString('en-GB')}</p>
    </button>
  );
}
