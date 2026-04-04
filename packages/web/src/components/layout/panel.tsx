'use client';

import { Icon } from '@/components/shared/icon';
import { AccordionRoot, AccordionItem } from '@/components/ui/accordion';
import { SchemaBrowser } from '@/components/panel/schema-browser';
import { QueryHistory } from '@/components/panel/query-history';
import { ExecutionDetail } from '@/components/panel/execution-detail';
import { useSchemaStore } from '@/stores/schema-store';
import { Badge } from '@/components/ui';

interface PanelProps {
  onSelectQuery?: (query: string) => void;
}

export function Panel({ onSelectQuery }: PanelProps) {
  const tableCount = useSchemaStore((s) => s.tables.length);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-3">
      <AccordionRoot>
        <AccordionItem
          title="Schema 浏览器"
          icon={<Icon name="database" size={14} className="text-primary" />}
          defaultOpen
          extra={
            tableCount > 0 ? (
              <Badge variant="default" className="text-[10px]">
                {tableCount}
              </Badge>
            ) : undefined
          }
        >
          <SchemaBrowser />
        </AccordionItem>

        <AccordionItem
          title="查询历史"
          icon={<Icon name="clock" size={14} className="text-secondary" />}
        >
          <QueryHistory />
        </AccordionItem>

        <AccordionItem
          title="执行详情"
          icon={<Icon name="table" size={14} className="text-muted" />}
        >
          <ExecutionDetail />
        </AccordionItem>
      </AccordionRoot>
    </div>
  );
}
