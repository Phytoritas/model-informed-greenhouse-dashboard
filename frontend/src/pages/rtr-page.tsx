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
        description: '\uC624\uB298 \uBAA9\uD45C \uC628\uB3C4\uC640 \uBE44\uAD50\uC548\uC744 \uC815\uB9AC\uD569\uB2C8\uB2E4.',
      }
    : {
        eyebrow: 'RTR',
        title: 'RTR optimization',
        description: 'Compare the recommended lane against the baseline and scenario set.',
      };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <div className="min-w-0">{recommendationSurface}</div>
      {supportSurface ? <div className="min-w-0">{supportSurface}</div> : null}
    </div>
  );
}
