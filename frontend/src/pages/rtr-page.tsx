import type { ReactNode } from 'react';
import PageHeader from '../components/common/PageHeader';

interface RtrPageProps {
  locale: 'ko' | 'en';
  recommendationSurface: ReactNode;
  supportSurface?: ReactNode;
}

export default function RtrPage({
  locale,
  recommendationSurface,
  supportSurface = null,
}: RtrPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'RTR',
        title: 'RTR \uCD5C\uC801\uD654',
        description: 'RTR\uC740 \uC8FC\uAC04\u00B7\uC57C\uAC04 \uD3C9\uADE0\uC628\uB3C4 \uC804\uB7B5\uC785\uB2C8\uB2E4. \uC624\uB298 \uBAA9\uD45C \uC628\uB3C4 \uAE30\uC900\uC548\uACFC \uBE44\uAD50\uC548\uC744 \uD55C\uACF3\uC5D0\uC11C \uBD05\uB2C8\uB2E4.',
      }
    : {
        eyebrow: 'RTR',
        title: 'RTR optimization',
        description: 'RTR is the day/night mean temperature strategy. Compare the recommended setting against the baseline in one place.',
      };

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1280px] flex-col gap-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <div className="min-w-0">{recommendationSurface}</div>
      {supportSurface ? <div className="min-w-0">{supportSurface}</div> : null}
    </div>
  );
}
