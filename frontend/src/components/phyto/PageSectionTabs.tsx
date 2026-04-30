import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';

interface PageSectionTab {
    id: string;
    label: string;
}

interface PageSectionTabsProps {
    tabs: PageSectionTab[];
    activeId?: string;
    onSelect?: (id: string) => void;
}

export default function PageSectionTabs({
    tabs,
    activeId,
    onSelect,
}: PageSectionTabsProps) {
    if (tabs.length === 0) {
        return null;
    }

    const ariaLabel = '세부 화면 탭';

    return (
        <Tabs aria-label={ariaLabel}>
            <TabsList role="tablist" aria-label={ariaLabel}>
                {tabs.map((tab) => (
                    <TabsTrigger
                        key={tab.id}
                        role="tab"
                        aria-selected={tab.id === activeId}
                        aria-current={tab.id === activeId ? 'page' : undefined}
                        data-active={tab.id === activeId}
                        onClick={() => onSelect?.(tab.id)}
                    >
                        {tab.label}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}
