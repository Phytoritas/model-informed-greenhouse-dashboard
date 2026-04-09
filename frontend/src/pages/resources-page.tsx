import type { ReactNode } from 'react';
import PageHeader from '../components/common/PageHeader';

interface ResourcesPageProps {
  locale: 'ko' | 'en';
  surface: ReactNode;
}

export default function ResourcesPage({ locale, surface }: ResourcesPageProps) {
  const copy = locale === 'ko'
    ? {
        eyebrow: 'Resources',
        title: '\uC790\uC6D0 \uAD00\uB9AC',
        description: '\uC591\uC561, \uC5D0\uB108\uC9C0, \uAC00\uACA9 \uD750\uB984\uC744 overview\uC640 \uBD84\uB9AC\uD574\uC11C \uBD05\uB2C8\uB2E4.',
      }
    : {
        eyebrow: 'Resources',
        title: 'Resources',
        description: 'Review nutrient, energy, and market signals in a separate lane.',
      };

  return (
    <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-8">
      <PageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} />
      <div className="min-w-0">{surface}</div>
    </div>
  );
}
