import type { PropsWithChildren } from 'react';

type BackgroundShellProps = PropsWithChildren<{
  overlayClassName?: string;
  contentClassName?: string;
}>;

export function BackgroundShell({ children, overlayClassName = '', contentClassName = '' }: BackgroundShellProps) {
  return (
    <main
      className="h-screen overflow-x-hidden overflow-y-auto bg-[#0D0A22] bg-cover bg-center bg-no-repeat text-[#F8F4FF]"
      style={{ backgroundImage: "url('/SathiPlays/Images/background.png')", backgroundAttachment: 'fixed' }}
    >
      <div className={`h-full w-full ${overlayClassName}`}>
        <div
          data-platform-shell
          className={`relative z-[20] mt-[84px] h-[calc(100%-84px)] w-full overflow-x-hidden overflow-y-auto ${contentClassName}`}
        >
          {children}
        </div>
      </div>
    </main>
  );
}
