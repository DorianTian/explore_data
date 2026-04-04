'use client';

import { usePanelStore } from '@/stores/panel-store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Icon } from '@/components/shared/icon';
import { DetailTab } from '@/components/panel/detail-tab';
import { SchemaTab } from '@/components/panel/schema-tab';
import { HistoryTab } from '@/components/panel/history-tab';

interface PanelProps {
  onSelectQuery?: (query: string) => void;
}

export function Panel({ onSelectQuery }: PanelProps) {
  const { activeTab, setActiveTab } = usePanelStore();

  return (
    <div className="flex flex-col h-full">
      <Tabs
        value={activeTab}
        onChange={(v) => setActiveTab(v as 'detail' | 'schema' | 'history')}
        className="flex flex-col h-full"
      >
        <TabsList className="px-2 shrink-0">
          <TabsTrigger value="detail">
            <span className="flex items-center gap-1.5">
              <Icon name="table" size={14} />
              详情
            </span>
          </TabsTrigger>
          <TabsTrigger value="schema">
            <span className="flex items-center gap-1.5">
              <Icon name="database" size={14} />
              Schema
            </span>
          </TabsTrigger>
          <TabsTrigger value="history">
            <span className="flex items-center gap-1.5">
              <Icon name="clock" size={14} />
              历史
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detail" className="flex-1 overflow-y-auto p-4">
          <DetailTab />
        </TabsContent>

        <TabsContent value="schema" className="flex-1 overflow-y-auto p-4">
          <SchemaTab />
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-y-auto p-4">
          <HistoryTab onSelectQuery={onSelectQuery} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
