import Link from 'next/link';
import { BackgroundShell } from '../layout/BackgroundShell';

type WorldPageProps = {
  title: string;
  sections: Array<{ title: string; body: string }>;
};

export function WorldPage({ title, sections }: WorldPageProps) {
  return (
    <BackgroundShell overlayClassName="bg-[radial-gradient(circle_at_50%_40%,rgba(255,62,165,0.12),rgba(10,8,28,0.72)_56%,rgba(8,6,22,0.86))]">
      <div className="mx-auto flex h-full w-full max-w-[1200px] flex-col gap-4 p-4 md:p-6">
        <div>
          <Link
            href="/"
            className="inline-flex items-center rounded-full border border-white/10 bg-[rgba(18,16,40,0.60)] px-3 py-1 font-sans text-xs text-[#B9B4D9] transition-all duration-300 hover:-translate-y-[1px] hover:text-[#F8F4FF]"
          >
            ← Back
          </Link>
        </div>

        <section className="rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-4 shadow-[0_10px_28px_rgba(8,5,32,0.42)] backdrop-blur-xl">
          <h1 className="font-serif text-3xl text-[#F8F4FF]">{title}</h1>
          <p className="mt-1 font-sans text-sm text-[#B9B4D9]">Your world hub is ready for build-out.</p>
        </section>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <section
              key={section.title}
              className="rounded-2xl border border-white/10 bg-[rgba(18,16,40,0.60)] p-4 shadow-[0_10px_28px_rgba(8,5,32,0.42)] backdrop-blur-xl"
            >
              <h2 className="font-serif text-xl text-[#F8F4FF]">{section.title}</h2>
              <p className="mt-2 font-sans text-sm text-[#B9B4D9]">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </BackgroundShell>
  );
}
