import type { ReactNode } from 'react';
import MainDashboard from '../layout/MainDashboard';

interface AskRouteProps {
  overview: ReactNode;
  askSurface: ReactNode;
  rightSidebar: ReactNode;
}

export default function AskRoute({
  overview,
  askSurface,
  rightSidebar,
}: AskRouteProps) {
  return (
    <MainDashboard
      overview={overview}
      leftColumn={askSurface}
      rightSidebar={rightSidebar}
      lowerFold={null}
      bottomRow={null}
    />
  );
}
