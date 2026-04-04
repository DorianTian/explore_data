import type { DomainDefinition } from './types.js';
import { col, generateSummaryTable } from '../generator.js';

/* ================================================================
 *  CRM & Content Domain — 客服与内容管理
 *  ~100 tables across ODS / DWD / DWS / ADS
 *
 *  Areas: customer service tickets, SLA tracking, satisfaction
 *  surveys (CSAT/NPS), agent performance, escalation, knowledge
 *  base/FAQ, content CMS, article management, comments/moderation,
 *  notification center, live chat, chatbot logs, customer feedback,
 *  complaint resolution.
 * ================================================================ */

export const crmContentDomain: DomainDefinition = {
  name: '客服与内容管理',
  description:
    '客服与内容管理全链路数据，覆盖工单管理、SLA 追踪、满意度调查（CSAT/NPS）、' +
    '坐席绩效、升级管理、知识库/FAQ、内容 CMS、文章管理、评论/审核、通知中心、' +
    '在线客服、聊天机器人日志、客户反馈、投诉处理等场景',
  dialect: 'postgresql',

  /* ──────────────────────────────────────────────────────────── *
   *  TABLES (~100)
   * ──────────────────────────────────────────────────────────── */
  tables: [
    // ===================== ODS Layer (~25) =====================

    // --- Customer Service ---
    {
      name: 'ods_customers',
      comment: '客户主数据（贴源层）',
      layer: 'ods',
      columns: [
        col.id('客户ID'),
        col.varchar('customer_name', 100, '客户姓名', { isPii: true }),
        col.varchar('email', 200, '邮箱', { isPii: true }),
        col.varchar('phone', 30, '手机号', { isPii: true }),
        col.varchar('company', 200, '所属公司'),
        col.varchar('tier', 20, '客户等级: vip/premium/standard', {
          sampleValues: ['vip', 'premium', 'standard'],
        }),
        col.varchar('source', 30, '来源渠道: web/app/phone/email', {
          sampleValues: ['web', 'app', 'phone', 'email'],
        }),
        col.varchar('region', 50, '所属区域', {
          sampleValues: ['华东', '华南', '华北', '西南', '华中'],
        }),
        col.varchar('language', 10, '首选语言', { sampleValues: ['zh', 'en'] }),
        col.status('客户状态', 'active/inactive/churned'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_service_agents',
      comment: '客服坐席信息（贴源层）',
      layer: 'ods',
      columns: [
        col.id('坐席ID'),
        col.varchar('agent_name', 60, '坐席姓名'),
        col.varchar('email', 200, '工作邮箱'),
        col.varchar('department', 60, '所属部门', {
          sampleValues: ['一线客服', '技术支持', '投诉处理', 'VIP客服'],
        }),
        col.varchar('skill_level', 20, '技能等级: junior/senior/expert', {
          sampleValues: ['junior', 'senior', 'expert'],
        }),
        col.int('max_concurrent', '最大并发会话数'),
        col.bool('is_online', '是否在线', 'false'),
        col.varchar('shift', 20, '班次: morning/afternoon/night', {
          sampleValues: ['morning', 'afternoon', 'night'],
        }),
        col.status('状态', 'active/leave/resigned'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_tickets',
      comment: '工单信息（贴源层）',
      layer: 'ods',
      columns: [
        col.id('工单ID'),
        col.varchar('ticket_no', 30, '工单编号', { isNullable: false }),
        col.fk('customer_id', 'ods_customers', '客户ID'),
        col.fk('agent_id', 'ods_service_agents', '分配坐席ID'),
        col.varchar('channel', 30, '进线渠道: phone/email/chat/social/web_form', {
          sampleValues: ['phone', 'email', 'chat', 'social', 'web_form'],
        }),
        col.varchar('category', 50, '工单分类', {
          sampleValues: ['产品咨询', '技术故障', '账户问题', '退款', '投诉'],
        }),
        col.varchar('subcategory', 80, '工单子分类'),
        col.varchar('priority', 20, '优先级: low/medium/high/urgent', {
          sampleValues: ['low', 'medium', 'high', 'urgent'],
        }),
        col.varchar('status', 30, '工单状态: open/in_progress/pending/resolved/closed', {
          sampleValues: ['open', 'in_progress', 'pending', 'resolved', 'closed'],
        }),
        col.text('subject', '工单主题'),
        col.text('description', '工单描述'),
        col.varchar('sla_policy', 50, '适用SLA策略'),
        col.timestamp('first_response_at', '首次响应时间'),
        col.timestamp('resolved_at', '解决时间'),
        col.timestamp('closed_at', '关闭时间'),
        col.int('reopen_count', '重开次数'),
        col.json('tags', '标签列表'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_ticket_messages',
      comment: '工单消息记录（贴源层）',
      layer: 'ods',
      columns: [
        col.id('消息ID'),
        col.fk('ticket_id', 'ods_tickets', '工单ID'),
        col.varchar('sender_type', 20, '发送者类型: customer/agent/system'),
        col.bigint('sender_id', '发送者ID'),
        col.text('content', '消息内容'),
        col.varchar('content_type', 20, '内容类型: text/html/image/attachment'),
        col.bool('is_internal', '是否内部备注', 'false'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_sla_policies',
      comment: 'SLA策略定义（贴源层）',
      layer: 'ods',
      columns: [
        col.id('策略ID'),
        col.varchar('policy_name', 60, '策略名称', {
          sampleValues: ['标准SLA', 'VIP SLA', '紧急SLA'],
        }),
        col.int('first_response_minutes', '首响目标(分钟)'),
        col.int('resolution_minutes', '解决目标(分钟)'),
        col.varchar('priority', 20, '适用优先级'),
        col.varchar('business_hours', 30, '工作时间: 24x7/9x5', {
          sampleValues: ['24x7', '9x5'],
        }),
        col.bool('is_active', '是否生效', 'true'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_sla_breaches',
      comment: 'SLA违约记录（贴源层）',
      layer: 'ods',
      columns: [
        col.id('记录ID'),
        col.fk('ticket_id', 'ods_tickets', '工单ID'),
        col.fk('sla_policy_id', 'ods_sla_policies', 'SLA策略ID'),
        col.varchar('breach_type', 30, '违约类型: first_response/resolution', {
          sampleValues: ['first_response', 'resolution'],
        }),
        col.int('target_minutes', '目标时间(分钟)'),
        col.int('actual_minutes', '实际时间(分钟)'),
        col.timestamp('breached_at', '违约时间'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_escalations',
      comment: '工单升级记录（贴源层）',
      layer: 'ods',
      columns: [
        col.id('升级ID'),
        col.fk('ticket_id', 'ods_tickets', '工单ID'),
        col.fk('from_agent_id', 'ods_service_agents', '原坐席ID'),
        col.fk('to_agent_id', 'ods_service_agents', '目标坐席ID'),
        col.varchar('escalation_level', 10, '升级层级: L1/L2/L3', {
          sampleValues: ['L1', 'L2', 'L3'],
        }),
        col.varchar('reason', 100, '升级原因'),
        col.text('notes', '备注'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_csat_surveys',
      comment: 'CSAT满意度调查（贴源层）',
      layer: 'ods',
      columns: [
        col.id('调查ID'),
        col.fk('ticket_id', 'ods_tickets', '关联工单ID'),
        col.fk('customer_id', 'ods_customers', '客户ID'),
        col.fk('agent_id', 'ods_service_agents', '服务坐席ID'),
        col.int('score', 'CSAT评分(1-5)'),
        col.text('feedback', '文字反馈'),
        col.varchar('survey_channel', 30, '调查渠道: email/sms/in_app'),
        col.timestamp('responded_at', '回复时间'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_nps_surveys',
      comment: 'NPS净推荐值调查（贴源层）',
      layer: 'ods',
      columns: [
        col.id('调查ID'),
        col.fk('customer_id', 'ods_customers', '客户ID'),
        col.int('score', 'NPS评分(0-10)'),
        col.varchar('segment', 20, '分类: promoter/passive/detractor', {
          sampleValues: ['promoter', 'passive', 'detractor'],
        }),
        col.text('reason', '原因说明'),
        col.varchar('campaign', 60, '所属调查批次'),
        col.date('survey_date', '调查日期'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_complaints',
      comment: '客户投诉记录（贴源层）',
      layer: 'ods',
      columns: [
        col.id('投诉ID'),
        col.fk('customer_id', 'ods_customers', '客户ID'),
        col.fk('ticket_id', 'ods_tickets', '关联工单ID'),
        col.varchar('complaint_type', 50, '投诉类型', {
          sampleValues: ['服务态度', '产品质量', '物流延迟', '价格争议', '虚假宣传'],
        }),
        col.varchar('severity', 20, '严重程度: minor/major/critical', {
          sampleValues: ['minor', 'major', 'critical'],
        }),
        col.text('description', '投诉详情'),
        col.text('resolution', '处理结果'),
        col.varchar('status', 30, '投诉状态: pending/investigating/resolved/rejected', {
          sampleValues: ['pending', 'investigating', 'resolved', 'rejected'],
        }),
        col.timestamp('resolved_at', '解决时间'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_live_chat_sessions',
      comment: '在线客服会话（贴源层）',
      layer: 'ods',
      columns: [
        col.id('会话ID'),
        col.fk('customer_id', 'ods_customers', '客户ID'),
        col.fk('agent_id', 'ods_service_agents', '坐席ID'),
        col.varchar('channel', 20, '渠道: web_widget/app/wechat', {
          sampleValues: ['web_widget', 'app', 'wechat'],
        }),
        col.int('message_count', '消息总数'),
        col.int('duration_seconds', '会话时长(秒)'),
        col.int('wait_seconds', '排队等待时长(秒)'),
        col.varchar('status', 20, '状态: active/ended/abandoned', {
          sampleValues: ['active', 'ended', 'abandoned'],
        }),
        col.int('csat_score', '会话满意度(1-5)'),
        col.timestamp('started_at', '开始时间'),
        col.timestamp('ended_at', '结束时间'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_chat_messages',
      comment: '在线客服消息明细（贴源层）',
      layer: 'ods',
      columns: [
        col.id('消息ID'),
        col.fk('session_id', 'ods_live_chat_sessions', '会话ID'),
        col.varchar('sender_type', 20, '发送者: customer/agent/bot'),
        col.text('content', '消息内容'),
        col.varchar('content_type', 20, '类型: text/image/file/card'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_chatbot_logs',
      comment: '聊天机器人对话日志（贴源层）',
      layer: 'ods',
      columns: [
        col.id('日志ID'),
        col.fk('customer_id', 'ods_customers', '客户ID'),
        col.varchar('intent', 80, '识别意图', {
          sampleValues: ['查询订单', '退款申请', '产品咨询', '密码重置', '人工转接'],
        }),
        col.decimal('confidence', '5,4', '意图置信度'),
        col.text('user_input', '用户输入'),
        col.text('bot_response', '机器人回复'),
        col.bool('resolved', '是否解决', 'false'),
        col.bool('transferred_to_agent', '是否转人工', 'false'),
        col.fk('session_id', 'ods_live_chat_sessions', '关联会话ID'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_customer_feedback',
      comment: '客户反馈/建议（贴源层）',
      layer: 'ods',
      columns: [
        col.id('反馈ID'),
        col.fk('customer_id', 'ods_customers', '客户ID'),
        col.varchar('feedback_type', 30, '反馈类型: suggestion/praise/bug_report', {
          sampleValues: ['suggestion', 'praise', 'bug_report'],
        }),
        col.varchar('product_area', 50, '产品区域'),
        col.text('content', '反馈内容'),
        col.varchar('status', 20, '处理状态: new/reviewed/planned/done', {
          sampleValues: ['new', 'reviewed', 'planned', 'done'],
        }),
        col.int('vote_count', '支持票数'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },

    // --- Knowledge Base & FAQ ---
    {
      name: 'ods_kb_categories',
      comment: '知识库分类（贴源层）',
      layer: 'ods',
      columns: [
        col.id('分类ID'),
        col.varchar('category_name', 100, '分类名称'),
        col.bigint('parent_id', '父分类ID'),
        col.int('sort_order', '排序号'),
        col.varchar('icon', 50, '图标标识'),
        col.bool('is_public', '是否对外公开', 'true'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_kb_articles',
      comment: '知识库文章/FAQ（贴源层）',
      layer: 'ods',
      columns: [
        col.id('文章ID'),
        col.fk('category_id', 'ods_kb_categories', '所属分类ID'),
        col.varchar('title', 200, '文章标题'),
        col.text('content', '文章正文(Markdown)'),
        col.varchar('article_type', 20, '类型: faq/guide/troubleshoot', {
          sampleValues: ['faq', 'guide', 'troubleshoot'],
        }),
        col.varchar('status', 20, '状态: draft/published/archived', {
          sampleValues: ['draft', 'published', 'archived'],
        }),
        col.fk('author_id', 'ods_service_agents', '作者坐席ID'),
        col.int('view_count', '浏览次数'),
        col.int('helpful_count', '有用票数'),
        col.int('not_helpful_count', '无用票数'),
        col.json('tags', '标签'),
        col.timestamp('published_at', '发布时间'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },

    // --- Content CMS ---
    {
      name: 'ods_cms_sites',
      comment: 'CMS站点（贴源层）',
      layer: 'ods',
      columns: [
        col.id('站点ID'),
        col.varchar('site_name', 100, '站点名称'),
        col.varchar('domain', 200, '域名'),
        col.varchar('locale', 10, '默认语言', { sampleValues: ['zh-CN', 'en-US'] }),
        col.status('状态', 'active/maintenance/offline'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_cms_categories',
      comment: 'CMS内容分类（贴源层）',
      layer: 'ods',
      columns: [
        col.id('分类ID'),
        col.fk('site_id', 'ods_cms_sites', '站点ID'),
        col.varchar('category_name', 100, '分类名称'),
        col.varchar('slug', 100, 'URL别名'),
        col.bigint('parent_id', '父分类ID'),
        col.int('sort_order', '排序号'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_cms_articles',
      comment: 'CMS文章（贴源层）',
      layer: 'ods',
      columns: [
        col.id('文章ID'),
        col.fk('site_id', 'ods_cms_sites', '站点ID'),
        col.fk('category_id', 'ods_cms_categories', '分类ID'),
        col.varchar('title', 300, '文章标题'),
        col.varchar('slug', 300, 'URL别名'),
        col.text('summary', '摘要'),
        col.text('content', '正文(HTML)'),
        col.varchar('cover_image', 500, '封面图URL'),
        col.varchar('author', 60, '作者'),
        col.varchar('status', 20, '状态: draft/review/published/archived', {
          sampleValues: ['draft', 'review', 'published', 'archived'],
        }),
        col.json('tags', '标签'),
        col.json('seo_meta', 'SEO元数据'),
        col.int('view_count', '阅读数'),
        col.int('like_count', '点赞数'),
        col.int('share_count', '分享数'),
        col.timestamp('published_at', '发布时间'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_cms_comments',
      comment: '文章评论（贴源层）',
      layer: 'ods',
      columns: [
        col.id('评论ID'),
        col.fk('article_id', 'ods_cms_articles', '文章ID'),
        col.fk('customer_id', 'ods_customers', '评论者ID'),
        col.bigint('parent_comment_id', '父评论ID(回复)'),
        col.text('content', '评论内容'),
        col.varchar('status', 20, '审核状态: pending/approved/rejected/spam', {
          sampleValues: ['pending', 'approved', 'rejected', 'spam'],
        }),
        col.int('like_count', '点赞数'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_cms_media',
      comment: '媒体资源库（贴源层）',
      layer: 'ods',
      columns: [
        col.id('资源ID'),
        col.fk('site_id', 'ods_cms_sites', '站点ID'),
        col.varchar('file_name', 200, '文件名'),
        col.varchar('file_url', 500, '文件URL'),
        col.varchar('media_type', 20, '类型: image/video/document/audio', {
          sampleValues: ['image', 'video', 'document', 'audio'],
        }),
        col.bigint('file_size', '文件大小(bytes)'),
        col.varchar('mime_type', 80, 'MIME类型'),
        col.int('width', '宽度(像素)'),
        col.int('height', '高度(像素)'),
        col.varchar('alt_text', 200, '替代文本'),
        col.createdAt(),
      ],
    },

    // --- Notification Center ---
    {
      name: 'ods_notification_templates',
      comment: '通知模板（贴源层）',
      layer: 'ods',
      columns: [
        col.id('模板ID'),
        col.varchar('template_code', 60, '模板编码'),
        col.varchar('template_name', 100, '模板名称'),
        col.varchar('channel', 20, '通知渠道: email/sms/push/in_app', {
          sampleValues: ['email', 'sms', 'push', 'in_app'],
        }),
        col.text('subject_template', '标题模板'),
        col.text('body_template', '正文模板'),
        col.json('variables', '变量定义'),
        col.bool('is_active', '是否启用', 'true'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_notifications',
      comment: '通知发送记录（贴源层）',
      layer: 'ods',
      columns: [
        col.id('通知ID'),
        col.fk('template_id', 'ods_notification_templates', '模板ID'),
        col.fk('customer_id', 'ods_customers', '接收客户ID'),
        col.varchar('channel', 20, '渠道: email/sms/push/in_app'),
        col.varchar('subject', 200, '通知标题'),
        col.text('body', '通知内容'),
        col.varchar('status', 20, '状态: pending/sent/delivered/failed/read', {
          sampleValues: ['pending', 'sent', 'delivered', 'failed', 'read'],
        }),
        col.timestamp('sent_at', '发送时间'),
        col.timestamp('delivered_at', '送达时间'),
        col.timestamp('read_at', '已读时间'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_agent_schedules',
      comment: '坐席排班表（贴源层）',
      layer: 'ods',
      columns: [
        col.id('排班ID'),
        col.fk('agent_id', 'ods_service_agents', '坐席ID'),
        col.date('schedule_date', '排班日期'),
        col.varchar('shift_type', 20, '班次: morning/afternoon/night/rest', {
          sampleValues: ['morning', 'afternoon', 'night', 'rest'],
        }),
        col.timestamp('start_time', '开始时间'),
        col.timestamp('end_time', '结束时间'),
        col.createdAt(),
      ],
    },

    // --- Additional ODS ---
    {
      name: 'ods_agent_skills',
      comment: '坐席技能标签（贴源层）',
      layer: 'ods',
      columns: [
        col.id('记录ID'),
        col.fk('agent_id', 'ods_service_agents', '坐席ID'),
        col.varchar('skill_name', 60, '技能名称', {
          sampleValues: ['退款处理', '技术故障', '账户安全', '多语言-英文', 'VIP服务'],
        }),
        col.int('proficiency', '熟练度(1-5)'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_ticket_attachments',
      comment: '工单附件（贴源层）',
      layer: 'ods',
      columns: [
        col.id('附件ID'),
        col.fk('ticket_id', 'ods_tickets', '工单ID'),
        col.varchar('file_name', 200, '文件名'),
        col.varchar('file_url', 500, '文件URL'),
        col.varchar('mime_type', 80, 'MIME类型'),
        col.bigint('file_size', '文件大小(bytes)'),
        col.fk('uploaded_by', 'ods_service_agents', '上传者ID'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_ticket_tags',
      comment: '工单标签关联（贴源层）',
      layer: 'ods',
      columns: [
        col.id('记录ID'),
        col.fk('ticket_id', 'ods_tickets', '工单ID'),
        col.varchar('tag_name', 50, '标签名称'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_canned_responses',
      comment: '预设回复模板（贴源层）',
      layer: 'ods',
      columns: [
        col.id('模板ID'),
        col.varchar('title', 100, '模板标题'),
        col.text('content', '模板内容'),
        col.varchar('category', 50, '适用分类'),
        col.varchar('language', 10, '语言'),
        col.int('usage_count', '使用次数'),
        col.bool('is_active', '是否启用', 'true'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },

    // ===================== DWD Layer (~25) =====================

    // --- Dimension Tables ---
    {
      name: 'dim_customers',
      comment: '客户维度表',
      layer: 'dwd',
      columns: [
        col.id('客户ID'),
        col.varchar('customer_name', 100, '客户姓名'),
        col.varchar('tier', 20, '客户等级'),
        col.varchar('region', 50, '区域'),
        col.varchar('source', 30, '来源渠道'),
        col.varchar('language', 10, '首选语言'),
        col.varchar('status', 20, '状态'),
        col.date('first_contact_date', '首次联系日期'),
        col.int('lifetime_ticket_count', '历史工单数'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_agents',
      comment: '坐席维度表',
      layer: 'dwd',
      columns: [
        col.id('坐席ID'),
        col.varchar('agent_name', 60, '坐席姓名'),
        col.varchar('department', 60, '部门'),
        col.varchar('skill_level', 20, '技能等级'),
        col.varchar('shift', 20, '班次'),
        col.date('hire_date', '入职日期'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_sla_policies',
      comment: 'SLA策略维度表',
      layer: 'dwd',
      columns: [
        col.id('策略ID'),
        col.varchar('policy_name', 60, '策略名称'),
        col.int('first_response_minutes', '首响目标(分钟)'),
        col.int('resolution_minutes', '解决目标(分钟)'),
        col.varchar('priority', 20, '适用优先级'),
        col.varchar('business_hours', 30, '工作时间模式'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_kb_categories',
      comment: '知识库分类维度表',
      layer: 'dwd',
      columns: [
        col.id('分类ID'),
        col.varchar('category_name', 100, '分类名称'),
        col.varchar('parent_category_name', 100, '父分类'),
        col.int('depth', '层级深度'),
        col.bool('is_public', '是否公开', 'true'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_cms_sites',
      comment: 'CMS站点维度表',
      layer: 'dwd',
      columns: [
        col.id('站点ID'),
        col.varchar('site_name', 100, '站点名称'),
        col.varchar('domain', 200, '域名'),
        col.varchar('locale', 10, '默认语言'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_cms_categories',
      comment: 'CMS分类维度表',
      layer: 'dwd',
      columns: [
        col.id('分类ID'),
        col.fk('site_id', 'dim_cms_sites', '站点ID'),
        col.varchar('category_name', 100, '分类名称'),
        col.varchar('slug', 100, 'URL别名'),
        col.varchar('parent_category_name', 100, '父分类'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_notification_templates',
      comment: '通知模板维度表',
      layer: 'dwd',
      columns: [
        col.id('模板ID'),
        col.varchar('template_code', 60, '模板编码'),
        col.varchar('template_name', 100, '模板名称'),
        col.varchar('channel', 20, '通知渠道'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_date',
      comment: '日期维度表',
      layer: 'dwd',
      columns: [
        col.date('date_key', '日期'),
        col.int('year', '年份'),
        col.int('quarter', '季度'),
        col.int('month', '月份'),
        col.int('week_of_year', '年周数'),
        col.int('day_of_week', '周几(1=周一)'),
        col.bool('is_weekend', '是否周末', 'false'),
        col.bool('is_holiday', '是否假日', 'false'),
        col.varchar('holiday_name', 50, '假日名称'),
      ],
    },

    // --- Fact Tables ---
    {
      name: 'fact_tickets',
      comment: '工单事实表',
      layer: 'dwd',
      columns: [
        col.id('工单ID'),
        col.varchar('ticket_no', 30, '工单编号'),
        col.fk('customer_id', 'dim_customers', '客户ID'),
        col.fk('agent_id', 'dim_agents', '坐席ID'),
        col.fk('sla_policy_id', 'dim_sla_policies', 'SLA策略ID'),
        col.varchar('channel', 30, '进线渠道'),
        col.varchar('category', 50, '工单分类'),
        col.varchar('subcategory', 80, '子分类'),
        col.varchar('priority', 20, '优先级'),
        col.varchar('status', 30, '状态'),
        col.int('first_response_minutes', '首响耗时(分钟)'),
        col.int('resolution_minutes', '解决耗时(分钟)'),
        col.int('message_count', '消息数'),
        col.int('reopen_count', '重开次数'),
        col.bool('sla_first_response_met', '首响SLA是否达标', 'true'),
        col.bool('sla_resolution_met', '解决SLA是否达标', 'true'),
        col.date('created_date', '创建日期'),
        col.timestamp('created_at', '创建时间'),
        col.timestamp('resolved_at', '解决时间'),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_csat_responses',
      comment: 'CSAT回复事实表',
      layer: 'dwd',
      columns: [
        col.id('回复ID'),
        col.fk('ticket_id', 'fact_tickets', '工单ID'),
        col.fk('customer_id', 'dim_customers', '客户ID'),
        col.fk('agent_id', 'dim_agents', '坐席ID'),
        col.int('score', 'CSAT评分(1-5)'),
        col.bool('has_feedback', '是否有文字反馈', 'false'),
        col.varchar('survey_channel', 30, '调查渠道'),
        col.date('response_date', '回复日期'),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_nps_responses',
      comment: 'NPS回复事实表',
      layer: 'dwd',
      columns: [
        col.id('回复ID'),
        col.fk('customer_id', 'dim_customers', '客户ID'),
        col.int('score', 'NPS评分(0-10)'),
        col.varchar('segment', 20, '分类: promoter/passive/detractor'),
        col.varchar('campaign', 60, '调查批次'),
        col.date('survey_date', '调查日期'),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_live_chat_sessions',
      comment: '在线客服会话事实表',
      layer: 'dwd',
      columns: [
        col.id('会话ID'),
        col.fk('customer_id', 'dim_customers', '客户ID'),
        col.fk('agent_id', 'dim_agents', '坐席ID'),
        col.varchar('channel', 20, '渠道'),
        col.int('message_count', '消息数'),
        col.int('duration_seconds', '会话时长(秒)'),
        col.int('wait_seconds', '等待时长(秒)'),
        col.int('csat_score', '满意度(1-5)'),
        col.bool('abandoned', '是否放弃', 'false'),
        col.date('session_date', '会话日期'),
        col.timestamp('started_at', '开始时间'),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_chatbot_interactions',
      comment: '机器人交互事实表',
      layer: 'dwd',
      columns: [
        col.id('交互ID'),
        col.fk('customer_id', 'dim_customers', '客户ID'),
        col.varchar('intent', 80, '识别意图'),
        col.decimal('confidence', '5,4', '置信度'),
        col.bool('resolved', '是否解决', 'false'),
        col.bool('transferred_to_agent', '是否转人工', 'false'),
        col.date('interaction_date', '交互日期'),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_escalations',
      comment: '升级事实表',
      layer: 'dwd',
      columns: [
        col.id('升级ID'),
        col.fk('ticket_id', 'fact_tickets', '工单ID'),
        col.fk('from_agent_id', 'dim_agents', '原坐席ID'),
        col.fk('to_agent_id', 'dim_agents', '目标坐席ID'),
        col.varchar('escalation_level', 10, '升级层级'),
        col.varchar('reason', 100, '升级原因'),
        col.date('escalation_date', '升级日期'),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_complaints',
      comment: '投诉事实表',
      layer: 'dwd',
      columns: [
        col.id('投诉ID'),
        col.fk('customer_id', 'dim_customers', '客户ID'),
        col.fk('ticket_id', 'fact_tickets', '关联工单ID'),
        col.varchar('complaint_type', 50, '投诉类型'),
        col.varchar('severity', 20, '严重程度'),
        col.varchar('status', 30, '状态'),
        col.int('resolution_minutes', '处理耗时(分钟)'),
        col.date('created_date', '创建日期'),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_notifications',
      comment: '通知发送事实表',
      layer: 'dwd',
      columns: [
        col.id('通知ID'),
        col.fk('template_id', 'dim_notification_templates', '模板ID'),
        col.fk('customer_id', 'dim_customers', '客户ID'),
        col.varchar('channel', 20, '渠道'),
        col.varchar('status', 20, '发送状态'),
        col.bool('is_read', '是否已读', 'false'),
        col.date('sent_date', '发送日期'),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_kb_article_views',
      comment: '知识库文章浏览事实表',
      layer: 'dwd',
      columns: [
        col.id('浏览ID'),
        col.fk('article_id', 'ods_kb_articles', '文章ID'),
        col.fk('category_id', 'dim_kb_categories', '分类ID'),
        col.bigint('viewer_id', '浏览者ID'),
        col.varchar('viewer_type', 20, '浏览者类型: customer/agent'),
        col.bool('is_helpful', '是否有用'),
        col.date('view_date', '浏览日期'),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_cms_article_events',
      comment: 'CMS文章行为事实表',
      layer: 'dwd',
      columns: [
        col.id('事件ID'),
        col.fk('article_id', 'ods_cms_articles', '文章ID'),
        col.fk('site_id', 'dim_cms_sites', '站点ID'),
        col.fk('category_id', 'dim_cms_categories', '分类ID'),
        col.varchar('event_type', 20, '事件: view/like/share/bookmark', {
          sampleValues: ['view', 'like', 'share', 'bookmark'],
        }),
        col.bigint('user_id', '用户ID'),
        col.date('event_date', '事件日期'),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_comments',
      comment: '评论事实表',
      layer: 'dwd',
      columns: [
        col.id('评论ID'),
        col.fk('article_id', 'ods_cms_articles', '文章ID'),
        col.fk('customer_id', 'dim_customers', '评论者ID'),
        col.varchar('status', 20, '审核状态'),
        col.int('like_count', '点赞数'),
        col.bool('is_reply', '是否回复', 'false'),
        col.date('comment_date', '评论日期'),
        col.etlTime(),
      ],
    },

    // --- Additional DWD fact/bridge tables ---
    {
      name: 'fact_ticket_messages',
      comment: '工单消息事实表',
      layer: 'dwd',
      columns: [
        col.id('消息ID'),
        col.fk('ticket_id', 'fact_tickets', '工单ID'),
        col.varchar('sender_type', 20, '发送者类型: customer/agent/system'),
        col.bigint('sender_id', '发送者ID'),
        col.varchar('content_type', 20, '内容类型'),
        col.bool('is_internal', '是否内部备注', 'false'),
        col.date('message_date', '消息日期'),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_customer_feedback',
      comment: '客户反馈事实表',
      layer: 'dwd',
      columns: [
        col.id('反馈ID'),
        col.fk('customer_id', 'dim_customers', '客户ID'),
        col.varchar('feedback_type', 30, '反馈类型'),
        col.varchar('product_area', 50, '产品区域'),
        col.varchar('status', 20, '处理状态'),
        col.int('vote_count', '支持票数'),
        col.date('feedback_date', '反馈日期'),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_sla_breaches',
      comment: 'SLA违约事实表',
      layer: 'dwd',
      columns: [
        col.id('记录ID'),
        col.fk('ticket_id', 'fact_tickets', '工单ID'),
        col.fk('sla_policy_id', 'dim_sla_policies', 'SLA策略ID'),
        col.varchar('breach_type', 30, '违约类型: first_response/resolution'),
        col.int('target_minutes', '目标(分钟)'),
        col.int('actual_minutes', '实际(分钟)'),
        col.int('overshoot_minutes', '超时(分钟)'),
        col.date('breach_date', '违约日期'),
        col.etlTime(),
      ],
    },
    {
      name: 'bridge_ticket_agent',
      comment: '工单-坐席关联桥表',
      layer: 'dwd',
      columns: [
        col.id('记录ID'),
        col.fk('ticket_id', 'fact_tickets', '工单ID'),
        col.fk('agent_id', 'dim_agents', '坐席ID'),
        col.varchar('role', 20, '角色: primary/escalated/cc'),
        col.timestamp('assigned_at', '分配时间'),
        col.etlTime(),
      ],
    },
    {
      name: 'bridge_article_tag',
      comment: '文章-标签关联桥表',
      layer: 'dwd',
      columns: [
        col.id('记录ID'),
        col.fk('article_id', 'ods_cms_articles', '文章ID'),
        col.varchar('tag_name', 50, '标签名'),
        col.etlTime(),
      ],
    },

    // ===================== DWS Layer (~25) =====================

    // --- Ticket / Agent aggregations ---
    generateSummaryTable(
      'dws',
      'ticket_daily_stats',
      '工单日统计',
      'dws',
      [
        { name: 'channel', comment: '渠道' },
        { name: 'category', comment: '分类' },
        { name: 'priority', comment: '优先级' },
      ],
      [
        { name: 'ticket_count', type: 'bigint', comment: '工单数' },
        { name: 'resolved_count', type: 'bigint', comment: '已解决数' },
        { name: 'avg_first_response_min', type: 'decimal', comment: '平均首响时间(分钟)' },
        { name: 'avg_resolution_min', type: 'decimal', comment: '平均解决时间(分钟)' },
        { name: 'sla_compliance_rate', type: 'decimal', comment: 'SLA达标率' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'ticket_weekly_stats',
      '工单周统计',
      'dws',
      [
        { name: 'channel', comment: '渠道' },
        { name: 'category', comment: '分类' },
      ],
      [
        { name: 'ticket_count', type: 'bigint', comment: '工单数' },
        { name: 'resolved_count', type: 'bigint', comment: '已解决数' },
        { name: 'reopened_count', type: 'bigint', comment: '重开数' },
        { name: 'avg_resolution_min', type: 'decimal', comment: '平均解决时间(分钟)' },
        { name: 'p95_resolution_min', type: 'decimal', comment: 'P95解决时间(分钟)' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'ticket_monthly_stats',
      '工单月统计',
      'dws',
      [
        { name: 'channel', comment: '渠道' },
        { name: 'category', comment: '分类' },
      ],
      [
        { name: 'ticket_count', type: 'bigint', comment: '工单数' },
        { name: 'resolved_count', type: 'bigint', comment: '已解决数' },
        { name: 'avg_first_response_min', type: 'decimal', comment: '平均首响时间(分钟)' },
        { name: 'avg_resolution_min', type: 'decimal', comment: '平均解决时间(分钟)' },
        { name: 'sla_breach_count', type: 'bigint', comment: 'SLA违约数' },
        { name: 'escalation_count', type: 'bigint', comment: '升级数' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'agent_daily_performance',
      '坐席日绩效',
      'dws',
      [
        { name: 'agent_id', comment: '坐席ID' },
        { name: 'agent_name', comment: '坐席姓名' },
        { name: 'department', comment: '部门' },
      ],
      [
        { name: 'handled_ticket_count', type: 'bigint', comment: '处理工单数' },
        { name: 'resolved_ticket_count', type: 'bigint', comment: '已解决数' },
        { name: 'avg_first_response_min', type: 'decimal', comment: '平均首响(分钟)' },
        { name: 'avg_resolution_min', type: 'decimal', comment: '平均解决(分钟)' },
        { name: 'avg_csat_score', type: 'decimal', comment: '平均CSAT' },
        { name: 'online_minutes', type: 'bigint', comment: '在线时长(分钟)' },
        { name: 'utilization_rate', type: 'decimal', comment: '利用率' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'agent_monthly_performance',
      '坐席月绩效',
      'dws',
      [
        { name: 'agent_id', comment: '坐席ID' },
        { name: 'agent_name', comment: '坐席姓名' },
        { name: 'department', comment: '部门' },
      ],
      [
        { name: 'handled_ticket_count', type: 'bigint', comment: '处理工单数' },
        { name: 'resolved_ticket_count', type: 'bigint', comment: '已解决数' },
        { name: 'sla_compliance_rate', type: 'decimal', comment: 'SLA达标率' },
        { name: 'avg_csat_score', type: 'decimal', comment: '平均CSAT' },
        { name: 'escalation_count', type: 'bigint', comment: '升级数' },
        { name: 'total_online_minutes', type: 'bigint', comment: '在线时长(分钟)' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'sla_daily_compliance',
      'SLA日达标统计',
      'dws',
      [
        { name: 'sla_policy_name', comment: 'SLA策略' },
        { name: 'priority', comment: '优先级' },
      ],
      [
        { name: 'total_tickets', type: 'bigint', comment: '总工单数' },
        { name: 'first_response_met', type: 'bigint', comment: '首响达标数' },
        { name: 'resolution_met', type: 'bigint', comment: '解决达标数' },
        { name: 'first_response_breach', type: 'bigint', comment: '首响违约数' },
        { name: 'resolution_breach', type: 'bigint', comment: '解决违约数' },
        { name: 'compliance_rate', type: 'decimal', comment: '综合达标率' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'csat_daily_stats',
      'CSAT日统计',
      'dws',
      [
        { name: 'channel', comment: '渠道' },
        { name: 'category', comment: '分类' },
      ],
      [
        { name: 'response_count', type: 'bigint', comment: '回复数' },
        { name: 'avg_score', type: 'decimal', comment: '平均分' },
        { name: 'score_1_count', type: 'bigint', comment: '1分数' },
        { name: 'score_2_count', type: 'bigint', comment: '2分数' },
        { name: 'score_3_count', type: 'bigint', comment: '3分数' },
        { name: 'score_4_count', type: 'bigint', comment: '4分数' },
        { name: 'score_5_count', type: 'bigint', comment: '5分数' },
        { name: 'satisfaction_rate', type: 'decimal', comment: '满意率(4+5分占比)' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'csat_monthly_stats',
      'CSAT月统计',
      'dws',
      [{ name: 'channel', comment: '渠道' }],
      [
        { name: 'response_count', type: 'bigint', comment: '回复数' },
        { name: 'avg_score', type: 'decimal', comment: '平均分' },
        { name: 'satisfaction_rate', type: 'decimal', comment: '满意率' },
        { name: 'dissatisfaction_rate', type: 'decimal', comment: '不满意率(1+2分占比)' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'nps_campaign_stats',
      'NPS批次统计',
      'dws',
      [{ name: 'campaign', comment: '调查批次' }],
      [
        { name: 'total_responses', type: 'bigint', comment: '总回复数' },
        { name: 'promoter_count', type: 'bigint', comment: '推荐者数' },
        { name: 'passive_count', type: 'bigint', comment: '被动者数' },
        { name: 'detractor_count', type: 'bigint', comment: '贬损者数' },
        { name: 'nps_score', type: 'decimal', comment: 'NPS得分' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'live_chat_daily_stats',
      '在线客服日统计',
      'dws',
      [{ name: 'channel', comment: '渠道' }],
      [
        { name: 'session_count', type: 'bigint', comment: '会话数' },
        { name: 'avg_wait_seconds', type: 'decimal', comment: '平均等待(秒)' },
        { name: 'avg_duration_seconds', type: 'decimal', comment: '平均时长(秒)' },
        { name: 'abandoned_count', type: 'bigint', comment: '放弃数' },
        { name: 'avg_csat_score', type: 'decimal', comment: '平均满意度' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'chatbot_daily_stats',
      '机器人日统计',
      'dws',
      [{ name: 'intent', comment: '意图' }],
      [
        { name: 'interaction_count', type: 'bigint', comment: '交互数' },
        { name: 'resolved_count', type: 'bigint', comment: '解决数' },
        { name: 'transferred_count', type: 'bigint', comment: '转人工数' },
        { name: 'avg_confidence', type: 'decimal', comment: '平均置信度' },
        { name: 'resolution_rate', type: 'decimal', comment: '自助解决率' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'complaint_daily_stats',
      '投诉日统计',
      'dws',
      [
        { name: 'complaint_type', comment: '投诉类型' },
        { name: 'severity', comment: '严重程度' },
      ],
      [
        { name: 'complaint_count', type: 'bigint', comment: '投诉数' },
        { name: 'resolved_count', type: 'bigint', comment: '已解决数' },
        { name: 'avg_resolution_min', type: 'decimal', comment: '平均处理时长(分钟)' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'escalation_daily_stats',
      '升级日统计',
      'dws',
      [
        { name: 'escalation_level', comment: '升级层级' },
        { name: 'reason', comment: '升级原因' },
      ],
      [
        { name: 'escalation_count', type: 'bigint', comment: '升级数' },
        {
          name: 'avg_resolution_after_escalation_min',
          type: 'decimal',
          comment: '升级后平均解决时长(分钟)',
        },
      ],
    ),
    generateSummaryTable(
      'dws',
      'kb_article_daily_stats',
      '知识库文章日统计',
      'dws',
      [
        { name: 'category_name', comment: '分类' },
        { name: 'article_type', comment: '类型' },
      ],
      [
        { name: 'view_count', type: 'bigint', comment: '浏览数' },
        { name: 'helpful_count', type: 'bigint', comment: '有用票数' },
        { name: 'not_helpful_count', type: 'bigint', comment: '无用票数' },
        { name: 'helpfulness_rate', type: 'decimal', comment: '有用率' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'cms_article_daily_stats',
      'CMS文章日统计',
      'dws',
      [
        { name: 'site_name', comment: '站点' },
        { name: 'category_name', comment: '分类' },
      ],
      [
        { name: 'view_count', type: 'bigint', comment: '浏览数' },
        { name: 'like_count', type: 'bigint', comment: '点赞数' },
        { name: 'share_count', type: 'bigint', comment: '分享数' },
        { name: 'comment_count', type: 'bigint', comment: '评论数' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'cms_article_monthly_stats',
      'CMS文章月统计',
      'dws',
      [
        { name: 'site_name', comment: '站点' },
        { name: 'category_name', comment: '分类' },
      ],
      [
        { name: 'published_count', type: 'bigint', comment: '发布数' },
        { name: 'total_views', type: 'bigint', comment: '总浏览数' },
        { name: 'total_likes', type: 'bigint', comment: '总点赞数' },
        { name: 'total_shares', type: 'bigint', comment: '总分享数' },
        { name: 'total_comments', type: 'bigint', comment: '总评论数' },
        { name: 'avg_views_per_article', type: 'decimal', comment: '篇均浏览' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'comment_moderation_daily',
      '评论审核日统计',
      'dws',
      [{ name: 'site_name', comment: '站点' }],
      [
        { name: 'total_comments', type: 'bigint', comment: '评论总数' },
        { name: 'approved_count', type: 'bigint', comment: '通过数' },
        { name: 'rejected_count', type: 'bigint', comment: '拒绝数' },
        { name: 'spam_count', type: 'bigint', comment: '垃圾评论数' },
        { name: 'pending_count', type: 'bigint', comment: '待审数' },
        { name: 'approval_rate', type: 'decimal', comment: '通过率' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'notification_daily_stats',
      '通知日统计',
      'dws',
      [
        { name: 'channel', comment: '渠道' },
        { name: 'template_name', comment: '模板' },
      ],
      [
        { name: 'sent_count', type: 'bigint', comment: '发送数' },
        { name: 'delivered_count', type: 'bigint', comment: '送达数' },
        { name: 'read_count', type: 'bigint', comment: '已读数' },
        { name: 'failed_count', type: 'bigint', comment: '失败数' },
        { name: 'delivery_rate', type: 'decimal', comment: '送达率' },
        { name: 'read_rate', type: 'decimal', comment: '已读率' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'customer_service_history',
      '客户服务历史汇总',
      'dws',
      [
        { name: 'customer_id', comment: '客户ID' },
        { name: 'tier', comment: '客户等级' },
        { name: 'region', comment: '区域' },
      ],
      [
        { name: 'total_tickets', type: 'bigint', comment: '累计工单数' },
        { name: 'open_tickets', type: 'bigint', comment: '未关闭工单数' },
        { name: 'avg_csat', type: 'decimal', comment: '平均CSAT' },
        { name: 'complaint_count', type: 'bigint', comment: '投诉次数' },
        { name: 'last_contact_days_ago', type: 'bigint', comment: '距上次联系天数' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'feedback_weekly_stats',
      '客户反馈周统计',
      'dws',
      [
        { name: 'feedback_type', comment: '反馈类型' },
        { name: 'product_area', comment: '产品区域' },
      ],
      [
        { name: 'feedback_count', type: 'bigint', comment: '反馈数' },
        { name: 'total_votes', type: 'bigint', comment: '总投票数' },
        { name: 'reviewed_count', type: 'bigint', comment: '已审阅数' },
        { name: 'planned_count', type: 'bigint', comment: '已排期数' },
      ],
    ),

    generateSummaryTable(
      'dws',
      'sla_breach_weekly_stats',
      'SLA违约周统计',
      'dws',
      [
        { name: 'breach_type', comment: '违约类型' },
        { name: 'sla_policy_name', comment: 'SLA策略' },
      ],
      [
        { name: 'breach_count', type: 'bigint', comment: '违约数' },
        { name: 'avg_overshoot_min', type: 'decimal', comment: '平均超时(分钟)' },
        { name: 'max_overshoot_min', type: 'decimal', comment: '最大超时(分钟)' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'ticket_category_trend',
      '工单分类趋势',
      'dws',
      [
        { name: 'category', comment: '分类' },
        { name: 'subcategory', comment: '子分类' },
      ],
      [
        { name: 'ticket_count', type: 'bigint', comment: '工单数' },
        { name: 'avg_resolution_min', type: 'decimal', comment: '平均解决(分钟)' },
        { name: 'pct_of_total', type: 'decimal', comment: '占比(%)' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'canned_response_usage',
      '预设回复使用统计',
      'dws',
      [{ name: 'category', comment: '适用分类' }],
      [
        { name: 'usage_count', type: 'bigint', comment: '使用次数' },
        { name: 'unique_agents', type: 'bigint', comment: '使用坐席数' },
        { name: 'avg_csat_after_use', type: 'decimal', comment: '使用后平均CSAT' },
      ],
    ),

    // ===================== ADS Layer (~25) =====================

    // --- Real-time & Executive Dashboards ---
    {
      name: 'ads_service_realtime_dashboard',
      comment: '客服实时看板',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.timestamp('snapshot_time', '快照时间'),
        col.int('open_tickets', '当前待处理工单数'),
        col.int('in_progress_tickets', '处理中工单数'),
        col.int('active_agents', '在线坐席数'),
        col.int('active_chats', '进行中会话数'),
        col.int('queue_length', '排队等待数'),
        col.decimal('avg_wait_seconds', '10,2', '当前平均等待(秒)'),
        col.decimal('today_csat', '5,2', '今日CSAT均分'),
        col.decimal('today_sla_compliance', '5,2', '今日SLA达标率(%)'),
        col.int('today_ticket_count', '今日工单数'),
        col.int('today_resolved_count', '今日已解决数'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_service_executive_daily',
      comment: '客服管理日报',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.int('total_tickets', '总工单数'),
        col.int('resolved_tickets', '已解决数'),
        col.decimal('resolution_rate', '5,2', '解决率(%)'),
        col.decimal('avg_first_response_min', '10,2', '平均首响(分钟)'),
        col.decimal('avg_resolution_min', '10,2', '平均解决(分钟)'),
        col.decimal('csat_avg', '5,2', 'CSAT均分'),
        col.decimal('sla_compliance_rate', '5,2', 'SLA达标率(%)'),
        col.int('escalation_count', '升级数'),
        col.int('complaint_count', '投诉数'),
        col.decimal('chatbot_resolution_rate', '5,2', '机器人自助解决率(%)'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_service_executive_monthly',
      comment: '客服管理月报',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.int('total_tickets', '总工单数'),
        col.decimal('avg_resolution_min', '10,2', '平均解决(分钟)'),
        col.decimal('csat_avg', '5,2', 'CSAT均分'),
        col.decimal('nps_score', '5,1', 'NPS得分'),
        col.decimal('sla_compliance_rate', '5,2', 'SLA达标率(%)'),
        col.decimal('agent_utilization_rate', '5,2', '坐席利用率(%)'),
        col.int('total_complaints', '投诉总数'),
        col.decimal('complaint_resolution_rate', '5,2', '投诉解决率(%)'),
        col.decimal('chatbot_resolution_rate', '5,2', '机器人自助解决率(%)'),
        col.decimal('cost_per_ticket', '10,2', '单工单成本(元)'),
        col.etlTime(),
      ],
    },

    // --- Agent Performance ---
    {
      name: 'ads_agent_leaderboard',
      comment: '坐席排行榜',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.fk('agent_id', 'dim_agents', '坐席ID'),
        col.varchar('agent_name', 60, '坐席姓名'),
        col.varchar('department', 60, '部门'),
        col.int('rank_overall', '综合排名'),
        col.int('rank_csat', 'CSAT排名'),
        col.int('rank_resolution_speed', '解决速度排名'),
        col.int('resolved_count', '解决工单数'),
        col.decimal('avg_csat', '5,2', '平均CSAT'),
        col.decimal('avg_resolution_min', '10,2', '平均解决(分钟)'),
        col.decimal('sla_compliance_rate', '5,2', 'SLA达标率(%)'),
        col.decimal('utilization_rate', '5,2', '利用率(%)'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_agent_capacity_plan',
      comment: '坐席容量规划',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('department', 60, '部门'),
        col.varchar('shift_type', 20, '班次'),
        col.int('current_agents', '当前坐席数'),
        col.int('predicted_ticket_volume', '预测工单量'),
        col.int('required_agents', '所需坐席数'),
        col.int('gap', '缺口'),
        col.decimal('predicted_wait_seconds', '10,2', '预测等待时长(秒)'),
        col.etlTime(),
      ],
    },

    // --- SLA & Quality ---
    {
      name: 'ads_sla_performance_board',
      comment: 'SLA达标看板',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('sla_policy_name', 60, 'SLA策略'),
        col.varchar('priority', 20, '优先级'),
        col.int('total_tickets', '总工单数'),
        col.decimal('first_response_compliance', '5,2', '首响达标率(%)'),
        col.decimal('resolution_compliance', '5,2', '解决达标率(%)'),
        col.decimal('overall_compliance', '5,2', '综合达标率(%)'),
        col.int('breach_count', '违约数'),
        col.decimal('avg_breach_overshoot_min', '10,2', '平均超时(分钟)'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_csat_trend_analysis',
      comment: 'CSAT趋势分析',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('dimension', 50, '维度: channel/category/agent/tier'),
        col.varchar('dimension_value', 100, '维度值'),
        col.decimal('avg_score', '5,2', '平均分'),
        col.decimal('satisfaction_rate', '5,2', '满意率(%)'),
        col.decimal('score_trend', '5,2', '较上期变化'),
        col.int('response_count', '样本数'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_nps_analysis',
      comment: 'NPS分析报表',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('campaign', 60, '调查批次'),
        col.int('total_responses', '回复数'),
        col.decimal('nps_score', '5,1', 'NPS得分'),
        col.decimal('promoter_pct', '5,2', '推荐者占比(%)'),
        col.decimal('passive_pct', '5,2', '被动者占比(%)'),
        col.decimal('detractor_pct', '5,2', '贬损者占比(%)'),
        col.decimal('nps_trend', '5,1', '较上期变化'),
        col.etlTime(),
      ],
    },

    // --- Complaint & Escalation ---
    {
      name: 'ads_complaint_root_cause',
      comment: '投诉根因分析',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('complaint_type', 50, '投诉类型'),
        col.varchar('root_cause', 100, '根因分类'),
        col.int('complaint_count', '投诉数'),
        col.decimal('pct_of_total', '5,2', '占比(%)'),
        col.decimal('avg_resolution_min', '10,2', '平均处理(分钟)'),
        col.decimal('resolution_rate', '5,2', '解决率(%)'),
        col.decimal('repeat_complaint_rate', '5,2', '重复投诉率(%)'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_escalation_analysis',
      comment: '升级分析报表',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('escalation_level', 10, '升级层级'),
        col.varchar('department', 60, '部门'),
        col.varchar('top_reason', 100, '主要原因'),
        col.int('escalation_count', '升级数'),
        col.decimal('escalation_rate', '5,2', '升级率(%)'),
        col.decimal('avg_time_to_resolve_min', '10,2', '升级后平均解决(分钟)'),
        col.etlTime(),
      ],
    },

    // --- Chatbot & Self-Service ---
    {
      name: 'ads_chatbot_performance',
      comment: '机器人绩效看板',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('intent', 80, '意图'),
        col.int('total_interactions', '总交互数'),
        col.decimal('resolution_rate', '5,2', '自助解决率(%)'),
        col.decimal('transfer_rate', '5,2', '转人工率(%)'),
        col.decimal('avg_confidence', '5,4', '平均置信度'),
        col.decimal('csat_after_bot', '5,2', '机器人服务后CSAT'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_self_service_funnel',
      comment: '自助服务漏斗',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('entry_point', 50, '入口: kb/chatbot/faq'),
        col.int('total_visitors', '访客数'),
        col.int('article_viewed_count', '浏览文章数'),
        col.int('found_helpful_count', '认为有用数'),
        col.int('still_need_help_count', '仍需帮助数'),
        col.int('ticket_created_count', '最终创建工单数'),
        col.decimal('deflection_rate', '5,2', '自助拦截率(%)'),
        col.etlTime(),
      ],
    },

    // --- Content CMS Analytics ---
    {
      name: 'ads_content_performance',
      comment: '内容绩效分析',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.fk('article_id', 'ods_cms_articles', '文章ID'),
        col.varchar('title', 300, '文章标题'),
        col.varchar('site_name', 100, '站点'),
        col.varchar('category_name', 100, '分类'),
        col.int('view_count', '浏览数'),
        col.int('unique_visitors', '独立访客数'),
        col.int('like_count', '点赞数'),
        col.int('share_count', '分享数'),
        col.int('comment_count', '评论数'),
        col.decimal('engagement_rate', '5,2', '互动率(%)'),
        col.decimal('avg_read_seconds', '10,2', '平均阅读时长(秒)'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_content_ranking',
      comment: '内容排行榜',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('ranking_type', 30, '排名维度: views/likes/shares/engagement', {
          sampleValues: ['views', 'likes', 'shares', 'engagement'],
        }),
        col.int('rank', '排名'),
        col.fk('article_id', 'ods_cms_articles', '文章ID'),
        col.varchar('title', 300, '文章标题'),
        col.varchar('site_name', 100, '站点'),
        col.bigint('metric_value', '指标值'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_kb_effectiveness',
      comment: '知识库效果分析',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('category_name', 100, '分类'),
        col.int('total_articles', '文章总数'),
        col.int('total_views', '总浏览数'),
        col.decimal('helpfulness_rate', '5,2', '有用率(%)'),
        col.decimal('deflection_rate', '5,2', '工单拦截率(%)'),
        col.int('stale_articles', '过期文章数'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_notification_effectiveness',
      comment: '通知效果分析',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('channel', 20, '渠道'),
        col.varchar('template_name', 100, '模板'),
        col.int('sent_count', '发送数'),
        col.decimal('delivery_rate', '5,2', '送达率(%)'),
        col.decimal('read_rate', '5,2', '已读率(%)'),
        col.decimal('click_rate', '5,2', '点击率(%)'),
        col.decimal('unsubscribe_rate', '5,2', '退订率(%)'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_comment_moderation_board',
      comment: '评论审核看板',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('site_name', 100, '站点'),
        col.int('pending_count', '待审数'),
        col.int('approved_today', '今日通过数'),
        col.int('rejected_today', '今日拒绝数'),
        col.int('spam_detected', '垃圾检出数'),
        col.decimal('avg_moderation_minutes', '10,2', '平均审核时长(分钟)'),
        col.decimal('spam_rate', '5,2', '垃圾评论率(%)'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_customer_health_score',
      comment: '客户健康度评分',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.fk('customer_id', 'dim_customers', '客户ID'),
        col.varchar('customer_name', 100, '客户姓名'),
        col.varchar('tier', 20, '客户等级'),
        col.decimal('health_score', '5,2', '健康度评分(0-100)'),
        col.decimal('csat_avg', '5,2', '近期CSAT'),
        col.int('open_ticket_count', '未关闭工单数'),
        col.int('complaint_count', '近期投诉数'),
        col.int('days_since_last_contact', '距上次联系天数'),
        col.varchar('risk_level', 20, '风险等级: low/medium/high', {
          sampleValues: ['low', 'medium', 'high'],
        }),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_channel_comparison',
      comment: '渠道对比分析',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('channel', 30, '渠道'),
        col.int('ticket_count', '工单数'),
        col.decimal('avg_first_response_min', '10,2', '平均首响(分钟)'),
        col.decimal('avg_resolution_min', '10,2', '平均解决(分钟)'),
        col.decimal('csat_avg', '5,2', 'CSAT均分'),
        col.decimal('sla_compliance_rate', '5,2', 'SLA达标率(%)'),
        col.decimal('cost_per_ticket', '10,2', '单工单成本(元)'),
        col.decimal('pct_of_total', '5,2', '工单占比(%)'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_customer_journey_touchpoints',
      comment: '客户旅程触点分析',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.fk('customer_id', 'dim_customers', '客户ID'),
        col.varchar('touchpoint_type', 30, '触点: ticket/chat/chatbot/kb/feedback', {
          sampleValues: ['ticket', 'chat', 'chatbot', 'kb', 'feedback'],
        }),
        col.varchar('channel', 30, '渠道'),
        col.varchar('sentiment', 20, '情感: positive/neutral/negative', {
          sampleValues: ['positive', 'neutral', 'negative'],
        }),
        col.int('touchpoint_order', '触点序号'),
        col.timestamp('occurred_at', '发生时间'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_report_weekly_service',
      comment: '客服周报',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.int('total_tickets', '总工单数'),
        col.int('resolved_tickets', '已解决数'),
        col.decimal('avg_resolution_min', '10,2', '平均解决(分钟)'),
        col.decimal('csat_avg', '5,2', 'CSAT均分'),
        col.decimal('nps_score', '5,1', 'NPS得分'),
        col.decimal('sla_compliance', '5,2', 'SLA达标率(%)'),
        col.int('escalations', '升级数'),
        col.int('complaints', '投诉数'),
        col.decimal('chatbot_deflection', '5,2', '机器人拦截率(%)'),
        col.varchar('top_category', 100, '最多工单分类'),
        col.varchar('top_complaint_type', 100, '最多投诉类型'),
        col.json('highlights', '要点摘要'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_ticket_forecast',
      comment: '工单量预测',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.date('forecast_date', '预测日期'),
        col.varchar('channel', 30, '渠道'),
        col.int('predicted_volume', '预测工单量'),
        col.int('actual_volume', '实际工单量'),
        col.decimal('mape', '5,2', '预测误差率(%)'),
        col.varchar('model_version', 30, '模型版本'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_customer_churn_risk',
      comment: '客户流失风险预警',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.fk('customer_id', 'dim_customers', '客户ID'),
        col.varchar('customer_name', 100, '客户姓名'),
        col.varchar('tier', 20, '客户等级'),
        col.decimal('churn_probability', '5,4', '流失概率'),
        col.varchar('risk_level', 20, '风险等级: low/medium/high/critical', {
          sampleValues: ['low', 'medium', 'high', 'critical'],
        }),
        col.json('risk_factors', '风险因子'),
        col.varchar('recommended_action', 200, '建议动作'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_first_contact_resolution',
      comment: '首次解决率分析',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.varchar('channel', 30, '渠道'),
        col.varchar('category', 50, '分类'),
        col.int('total_tickets', '总工单数'),
        col.int('fcr_count', '首次解决数'),
        col.decimal('fcr_rate', '5,2', '首次解决率(%)'),
        col.decimal('avg_resolution_min_fcr', '10,2', 'FCR工单平均解决(分钟)'),
        col.decimal('avg_resolution_min_non_fcr', '10,2', '非FCR工单平均解决(分钟)'),
        col.etlTime(),
      ],
    },
    {
      name: 'ads_peak_hour_analysis',
      comment: '高峰时段分析',
      layer: 'ads',
      columns: [
        col.id('记录ID'),
        col.ds(),
        col.int('hour_of_day', '小时(0-23)'),
        col.int('ticket_count', '工单数'),
        col.int('chat_count', '会话数'),
        col.int('available_agents', '可用坐席数'),
        col.decimal('avg_wait_seconds', '10,2', '平均等待(秒)'),
        col.decimal('utilization_rate', '5,2', '利用率(%)'),
        col.bool('is_peak', '是否高峰', 'false'),
        col.etlTime(),
      ],
    },
  ],

  /* ──────────────────────────────────────────────────────────── *
   *  METRICS (6)
   * ──────────────────────────────────────────────────────────── */
  metrics: [
    {
      name: 'avg_resolution_time',
      displayName: '平均解决时长',
      expression: 'AVG(resolution_minutes)',
      metricType: 'atomic',
      sourceTable: 'fact_tickets',
      filters: [{ column: 'status', op: 'IN', value: "('resolved','closed')" }],
      dimensions: ['channel', 'category', 'priority', 'agent_id'],
      granularity: ['day', 'week', 'month'],
      format: 'number',
      description: '所有已解决/已关闭工单从创建到解决的平均耗时（分钟）',
    },
    {
      name: 'avg_first_response_time',
      displayName: '平均首次响应时间',
      expression: 'AVG(first_response_minutes)',
      metricType: 'atomic',
      sourceTable: 'fact_tickets',
      dimensions: ['channel', 'priority', 'agent_id'],
      granularity: ['day', 'week', 'month'],
      format: 'number',
      description: '工单创建到首次客服回复的平均耗时（分钟）',
    },
    {
      name: 'csat_score',
      displayName: 'CSAT满意度评分',
      expression: 'AVG(score)',
      metricType: 'atomic',
      sourceTable: 'fact_csat_responses',
      dimensions: ['channel', 'agent_id', 'survey_channel'],
      granularity: ['day', 'week', 'month'],
      format: 'number',
      description: '客户满意度平均分（1-5分制，4分以上为满意）',
    },
    {
      name: 'ticket_volume',
      displayName: '工单量',
      expression: 'COUNT(DISTINCT id)',
      metricType: 'atomic',
      sourceTable: 'fact_tickets',
      dimensions: ['channel', 'category', 'priority', 'status', 'created_date'],
      granularity: ['day', 'week', 'month'],
      format: 'number',
      description: '指定时间范围内的工单总数',
    },
    {
      name: 'sla_compliance_rate',
      displayName: 'SLA达标率',
      expression:
        'COUNT(CASE WHEN sla_first_response_met = true AND sla_resolution_met = true THEN 1 END) * 100.0 / COUNT(*)',
      metricType: 'derived',
      sourceTable: 'fact_tickets',
      dimensions: ['priority', 'channel', 'category'],
      granularity: ['day', 'week', 'month'],
      format: 'percentage',
      description: '首响和解决均达标的工单占比（%）',
    },
    {
      name: 'agent_utilization',
      displayName: '坐席利用率',
      expression: 'SUM(online_minutes) * 100.0 / SUM(online_minutes + idle_minutes)',
      metricType: 'derived',
      sourceTable: 'dws_agent_daily_performance',
      dimensions: ['agent_id', 'department'],
      granularity: ['day', 'week', 'month'],
      format: 'percentage',
      description: '坐席有效工作时长占总在线时长的比例（%）',
    },
  ],

  /* ──────────────────────────────────────────────────────────── *
   *  GLOSSARY (6)
   * ──────────────────────────────────────────────────────────── */
  glossary: [
    {
      term: '工单',
      sqlExpression: 'SELECT * FROM fact_tickets',
      description:
        '客户通过各渠道（电话、邮件、在线客服、社交媒体、Web表单）提交的服务请求记录，是客服系统的核心实体',
    },
    {
      term: 'SLA',
      sqlExpression:
        'SELECT policy_name, first_response_minutes, resolution_minutes FROM dim_sla_policies WHERE is_active = true',
      description:
        'Service Level Agreement，服务等级协议。定义了不同优先级工单的首次响应和解决时限目标',
    },
    {
      term: 'CSAT',
      sqlExpression:
        'SELECT AVG(score) AS csat_avg, COUNT(CASE WHEN score >= 4 THEN 1 END) * 100.0 / COUNT(*) AS satisfaction_rate FROM fact_csat_responses',
      description:
        'Customer Satisfaction Score，客户满意度评分。1-5分制，4分及以上为满意。满意率 = (4分+5分) / 总回复数 × 100%',
    },
    {
      term: '首响时间',
      sqlExpression: 'SELECT AVG(first_response_minutes) AS avg_first_response FROM fact_tickets',
      description:
        '首次响应时间（First Response Time），从客户提交工单到客服首次回复的耗时，单位为分钟。是衡量服务及时性的核心指标',
    },
    {
      term: '解决时长',
      sqlExpression:
        "SELECT AVG(resolution_minutes) AS avg_resolution FROM fact_tickets WHERE status IN ('resolved', 'closed')",
      description:
        '从工单创建到标记为已解决的耗时，单位为分钟。不含重开后的额外时长。是衡量服务效率的核心指标',
    },
    {
      term: '满意度',
      sqlExpression:
        "SELECT AVG(score) AS avg_score, COUNT(CASE WHEN score >= 4 THEN 1 END) * 100.0 / COUNT(*) AS satisfaction_pct FROM fact_csat_responses WHERE response_date >= CURRENT_DATE - INTERVAL '30 days'",
      description:
        '综合满意度指标，基于 CSAT 评分计算。满意度 = (4+5分回复数) / 总回复数 × 100%。常用于衡量整体服务质量',
    },
  ],

  /* ──────────────────────────────────────────────────────────── *
   *  KNOWLEDGE DOCS (1)
   * ──────────────────────────────────────────────────────────── */
  knowledgeDocs: [
    {
      title: '客服与内容管理指标口径说明',
      docType: 'document',
      content: `# 客服与内容管理核心指标口径

## 平均解决时长（Avg Resolution Time）
- 定义：已解决/已关闭工单从创建到解决的平均耗时
- 计算：AVG(resolution_minutes) WHERE status IN ('resolved','closed')
- 单位：分钟
- 表：fact_tickets

## 平均首次响应时间（First Response Time）
- 定义：工单创建到客服首次回复的平均耗时
- 计算：AVG(first_response_minutes)
- 单位：分钟
- 目标：根据 SLA 策略不同，标准 SLA 为 60 分钟，VIP SLA 为 15 分钟
- 表：fact_tickets

## CSAT 满意度评分
- 定义：客户满意度调查的平均分
- 计算：AVG(score)，1-5 分制
- 满意率：(4分+5分) / 总回复数 × 100%
- 表：fact_csat_responses

## SLA 达标率
- 定义：首响和解决均在 SLA 目标内的工单占比
- 计算：COUNT(首响达标 AND 解决达标) / COUNT(*) × 100%
- 表：fact_tickets（sla_first_response_met, sla_resolution_met 字段）

## 工单量
- 定义：指定时间范围内创建的工单总数
- 常用维度：渠道、分类、优先级、日期
- 表：fact_tickets

## 坐席利用率
- 定义：坐席有效处理工单时长 / 总在线时长
- 计算：SUM(online_minutes) / SUM(online_minutes + idle_minutes) × 100%
- 目标：70%-85% 为合理区间
- 表：dws_agent_daily_performance

## NPS 净推荐值
- 定义：(推荐者占比 - 贬损者占比) × 100
- 推荐者：评分 9-10 / 被动者：评分 7-8 / 贬损者：评分 0-6
- 表：fact_nps_responses

## 自助解决率（Chatbot Deflection Rate）
- 定义：通过机器人或知识库自助解决、未创建工单的请求占比
- 表：ads_self_service_funnel`,
    },
  ],

  /* ──────────────────────────────────────────────────────────── *
   *  CONVERSATIONS (1)
   * ──────────────────────────────────────────────────────────── */
  conversations: [
    {
      title: '客服工单分析',
      messages: [
        {
          role: 'user',
          content: '上个月各渠道的工单量和平均解决时长分别是多少？',
        },
        {
          role: 'assistant',
          content:
            '根据工单事实表统计，上个月各渠道工单量和平均解决时长如下。电话渠道工单量最大但解决速度最快，在线客服渠道的满意度最高。',
          sql: "SELECT channel, COUNT(*) AS ticket_count, AVG(resolution_minutes) AS avg_resolution_min FROM fact_tickets WHERE created_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND created_date < DATE_TRUNC('month', CURRENT_DATE) GROUP BY channel ORDER BY ticket_count DESC",
          confidence: 0.92,
        },
        {
          role: 'user',
          content: '哪些渠道的 SLA 达标率低于 90%？',
        },
        {
          role: 'assistant',
          content:
            '筛选出 SLA 达标率低于 90% 的渠道。社交媒体渠道达标率最低，主要因为首响时间超标。',
          sql: "SELECT channel, COUNT(*) AS total, COUNT(CASE WHEN sla_first_response_met = true AND sla_resolution_met = true THEN 1 END) * 100.0 / COUNT(*) AS sla_rate FROM fact_tickets WHERE created_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND created_date < DATE_TRUNC('month', CURRENT_DATE) GROUP BY channel HAVING COUNT(CASE WHEN sla_first_response_met = true AND sla_resolution_met = true THEN 1 END) * 100.0 / COUNT(*) < 90 ORDER BY sla_rate ASC",
          confidence: 0.88,
        },
      ],
    },
  ],

  /* ──────────────────────────────────────────────────────────── *
   *  QUERY HISTORY (3)
   * ──────────────────────────────────────────────────────────── */
  queryHistory: [
    {
      naturalLanguage: '上个月平均工单解决时长',
      generatedSql:
        "SELECT AVG(resolution_minutes) AS avg_resolution_min FROM fact_tickets WHERE status IN ('resolved', 'closed') AND created_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND created_date < DATE_TRUNC('month', CURRENT_DATE)",
      status: 'accepted',
      isGolden: true,
      tablesUsed: ['fact_tickets'],
    },
    {
      naturalLanguage: '各坐席的CSAT评分排名',
      generatedSql:
        'SELECT a.agent_name, AVG(c.score) AS avg_csat, COUNT(*) AS response_count FROM fact_csat_responses c JOIN dim_agents a ON c.agent_id = a.id GROUP BY a.agent_name ORDER BY avg_csat DESC',
      status: 'accepted',
      isGolden: true,
      tablesUsed: ['fact_csat_responses', 'dim_agents'],
    },
    {
      naturalLanguage: '机器人自助解决率趋势',
      generatedSql:
        "SELECT ds, resolution_rate FROM dws_chatbot_daily_stats WHERE ds >= CURRENT_DATE - INTERVAL '30 days' ORDER BY ds",
      status: 'accepted',
      isGolden: false,
      tablesUsed: ['dws_chatbot_daily_stats'],
    },
  ],
};
