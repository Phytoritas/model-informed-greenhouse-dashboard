import type { ReactNode } from 'react';
import MainDashboard from '../layout/MainDashboard';

export interface SectionRouteFrameProps {
  overview: ReactNode;
  leftColumn: ReactNode;
  rightSidebar: ReactNode;
  lowerFold?: ReactNode;
  bottomRow?: ReactNode;
}

export default function SectionRouteFrame({
  overview,
  leftColumn,
  rightSidebar,
  lowerFold = null,
  bottomRow = null,
}: SectionRouteFrameProps) {
  return (
    <MainDashboard
      overview={overview}
      leftColumn={leftColumn}
      rightSidebar={rightSidebar}
      lowerFold={lowerFold}
      bottomRow={bottomRow}
    />
  );
}
