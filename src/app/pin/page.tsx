import { PinUnlockForm } from '../../components/pin/PinUnlockForm';

type PinPageProps = {
  searchParams?: {
    next?: string;
  };
};

export default function PinPage({ searchParams }: PinPageProps) {
  const next = searchParams?.next;
  const nextPath = next && next.startsWith('/') ? next : '/';

  return (
    <main className="grid min-h-screen place-items-center bg-[#0D0A22] p-4 text-[#F8F4FF]">
      <section className="w-full max-w-sm rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.74)] p-4 shadow-[0_0_28px_rgba(255,62,165,0.2)] backdrop-blur-xl">
        <h1 className="font-serif text-3xl">Enter PIN</h1>
        <p className="mt-1 font-sans text-sm text-[#B9B4D9]">Unlock SathiPlays on this device.</p>
        <PinUnlockForm nextPath={nextPath} />
      </section>
    </main>
  );
}
