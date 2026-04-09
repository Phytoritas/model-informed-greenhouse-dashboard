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

    return (
        <Tabs>
            <TabsList>
                {tabs.map((tab) => (
                    <TabsTrigger
                        key={tab.id}
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
