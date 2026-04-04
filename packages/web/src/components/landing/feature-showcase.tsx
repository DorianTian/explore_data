'use client';

import { Icon, type IconName } from '@/components/shared/icon';

interface Feature {
  icon: IconName;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: 'message',
    title: '自然语言对话',
    description: '多轮对话式查询，AI 理解上下文，支持追问和修改。不需要写一行 SQL。',
  },
  {
    icon: 'database',
    title: '智能 Schema 理解',
    description: '自动解析 DDL，向量化匹配表结构，精准关联用户问题与数据模型。',
  },
  {
    icon: 'chart',
    title: '指标体系',
    description: '定义原子/派生/复合指标，AI 优先匹配指标口径，确保数据一致性。',
  },
  {
    icon: 'book',
    title: '业务知识库',
    description: '上传业务术语和文档，RAG 检索增强生成，让 AI 真正理解你的业务语言。',
  },
  {
    icon: 'shield',
    title: 'SQL 安全校验',
    description: 'ANTLR4 语法验证 + 危险模式检测 + 只读执行沙箱，从生成到执行全链路安全。',
  },
  {
    icon: 'star',
    title: '数据飞轮',
    description: '每次反馈自动优化：Golden SQL 训练、Few-shot 检索、持续提升准确率。',
  },
  {
    icon: 'layout',
    title: 'BI 看板市场',
    description: '一键保存查询为可视化 Widget，组装 Dashboard，团队共享分析成果。',
  },
  {
    icon: 'table',
    title: '多方言支持',
    description: 'PostgreSQL、MySQL、Hive、SparkSQL、FlinkSQL，一套平台覆盖全场景。',
  },
];

export function FeatureShowcase() {
  return (
    <section id="features" className="py-20 px-6 bg-surface/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-3">
            企业级 Text-to-SQL 平台
          </h2>
          <p className="text-muted text-lg max-w-2xl mx-auto">
            不止是 Chat-to-SQL，更是完整的数据分析工作台
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="p-5 rounded-[var(--radius-lg)] bg-background border border-border hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
            >
              <div className="w-10 h-10 rounded-[var(--radius-md)] bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <Icon name={f.icon} size={20} className="text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
