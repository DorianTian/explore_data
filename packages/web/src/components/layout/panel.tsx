'use client';

import { usePanelStore } from '@/stores/panel-store';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui';
import { Icon } from '@/components/shared/icon';

export function Panel() {
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
          <div className="text-sm text-muted text-center py-8">
            点击消息查看详情
          </div>
        </TabsContent>

        <TabsContent value="schema" className="flex-1 overflow-y-auto p-4">
          <div className="text-sm text-muted text-center py-8">
            选择数据源查看 Schema
          </div>
        </TabsContent>

        <TabsContent value="history" className="flex-1 overflow-y-auto p-4">
          <div className="text-sm text-muted text-center py-8">
            查询历史
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
