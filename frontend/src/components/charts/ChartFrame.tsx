import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface ChartFrameProps {
    children: ReactNode | ((size: { width: number; height: number }) => ReactNode);
    className?: string;
    style?: CSSProperties;
    minHeight?: number;
}

export default function ChartFrame({
    children,
    className,
    style,
    minHeight = 160,
}: ChartFrameProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [size, setSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        const node = containerRef.current;
        if (!node) {
            return;
        }

        const updateReadiness = (width: number, height: number) => {
            setSize({ width, height });
            setIsReady(width > 0 && height > 0);
        };

        updateReadiness(node.clientWidth, node.clientHeight);

        if (typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) {
                return;
            }
            updateReadiness(entry.contentRect.width, entry.contentRect.height);
        });

        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={containerRef}
            className={cn('w-full', className)}
            style={{ minHeight, ...style }}
        >
            {isReady ? (
                typeof children === 'function' ? children(size) : children
            ) : (
                <div className="h-full w-full rounded-[18px] bg-[color:var(--sg-surface-muted)]/80" />
            )}
        </div>
    );
}
