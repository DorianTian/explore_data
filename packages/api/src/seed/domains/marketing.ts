import type { DomainDefinition } from './types.js';
import { col, generateSummaryTable } from '../generator.js';

/* =======================================================================
 * Marketing Domain — 营销投放分析
 * ~150 tables across ODS / DWD / DWS / ADS
 * Covers: campaign management, channel attribution (multi-touch),
 *   DMP/audience segments, creative assets, conversion tracking,
 *   ROI analysis, A/B testing, content marketing, SEO/SEM,
 *   social media, email marketing, push notifications,
 *   affiliate programs, coupon management, landing pages.
 * ======================================================================= */

export const marketingDomain: DomainDefinition = {
  name: '营销投放分析',
  description:
    '全渠道营销投放数据，覆盖广告投放、渠道归因、DMP 人群圈选、素材管理、转化追踪、' +
    'ROI 分析、A/B 测试、内容营销、SEO/SEM、社媒运营、邮件营销、Push 推送、' +
    '联盟分销、优惠券管理、落地页等营销全链路，支持 CPA/ROAS/CTR 等核心指标分析',
  dialect: 'postgresql',

  /* ===================================================================
   *  ODS Layer (~40 tables) — 贴源层
   * =================================================================== */
  tables: [
    // ─── Campaign management ───
    {
      name: 'ods_campaigns',
      comment: '营销活动主表（贴源层）',
      layer: 'ods',
      columns: [
        col.id('活动ID'),
        col.varchar('campaign_name', 200, '活动名称'),
        col.varchar('campaign_type', 50, '活动类型: brand/performance/retargeting/awareness', {
          sampleValues: ['brand', 'performance', 'retargeting', 'awareness'],
        }),
        col.varchar('objective', 50, '活动目标: awareness/consideration/conversion', {
          sampleValues: ['awareness', 'consideration', 'conversion'],
        }),
        col.decimal('budget', '18,2', '总预算（元）'),
        col.decimal('daily_budget', '18,2', '日预算（元）'),
        col.varchar('currency', 10, '币种'),
        col.date('start_date', '活动开始日期'),
        col.date('end_date', '活动结束日期'),
        col.status('活动状态', 'draft/active/paused/completed/archived'),
        col.fk('owner_id', 'ods_marketing_users', '活动负责人'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_campaign_groups',
      comment: '活动分组（贴源层）',
      layer: 'ods',
      columns: [
        col.id('分组ID'),
        col.varchar('group_name', 200, '分组名称'),
        col.text('description', '分组描述'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_campaign_group_rel',
      comment: '活动-分组关联（贴源层）',
      layer: 'ods',
      columns: [
        col.id('关联ID'),
        col.fk('campaign_id', 'ods_campaigns', '活动ID'),
        col.fk('group_id', 'ods_campaign_groups', '分组ID'),
      ],
    },
    {
      name: 'ods_ad_groups',
      comment: '广告组（贴源层）',
      layer: 'ods',
      columns: [
        col.id('广告组ID'),
        col.fk('campaign_id', 'ods_campaigns', '所属活动ID'),
        col.varchar('ad_group_name', 200, '广告组名称'),
        col.varchar('targeting_type', 50, '定向类型: interest/behavior/lookalike/retarget', {
          sampleValues: ['interest', 'behavior', 'lookalike', 'retarget'],
        }),
        col.decimal('bid_amount', '12,4', '出价金额'),
        col.varchar('bid_strategy', 30, '出价策略: cpc/cpm/cpa/ocpc', {
          sampleValues: ['cpc', 'cpm', 'cpa', 'ocpc'],
        }),
        col.status('广告组状态', 'active/paused/deleted'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_ads',
      comment: '广告创意单元（贴源层）',
      layer: 'ods',
      columns: [
        col.id('广告ID'),
        col.fk('ad_group_id', 'ods_ad_groups', '所属广告组ID'),
        col.fk('creative_id', 'ods_creatives', '关联素材ID'),
        col.varchar('ad_name', 200, '广告名称'),
        col.varchar('ad_format', 30, '广告形式: image/video/carousel/native/text', {
          sampleValues: ['image', 'video', 'carousel', 'native', 'text'],
        }),
        col.varchar('landing_url', 500, '落地页链接'),
        col.status('广告状态', 'active/paused/rejected/deleted'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },

    // ─── Channel & platform ───
    {
      name: 'ods_channels',
      comment: '投放渠道（贴源层）',
      layer: 'ods',
      columns: [
        col.id('渠道ID'),
        col.varchar('channel_name', 100, '渠道名称', {
          sampleValues: ['微信', '抖音', '百度', 'Google Ads', 'Facebook'],
        }),
        col.varchar('channel_type', 50, '渠道类型: search/social/display/video/email/sms/push', {
          sampleValues: ['search', 'social', 'display', 'video', 'email'],
        }),
        col.varchar('platform', 50, '平台标识'),
        col.bool('is_active', '是否启用'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_channel_accounts',
      comment: '渠道投放账户（贴源层）',
      layer: 'ods',
      columns: [
        col.id('账户ID'),
        col.fk('channel_id', 'ods_channels', '所属渠道ID'),
        col.varchar('account_name', 200, '账户名称'),
        col.varchar('account_id_ext', 100, '外部账户标识'),
        col.decimal('balance', '18,2', '账户余额'),
        col.status('账户状态', 'active/suspended/closed'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },

    // ─── Creative assets ───
    {
      name: 'ods_creatives',
      comment: '广告素材库（贴源层）',
      layer: 'ods',
      columns: [
        col.id('素材ID'),
        col.varchar('creative_name', 200, '素材名称'),
        col.varchar('creative_type', 30, '素材类型: image/video/html5/text/rich_media', {
          sampleValues: ['image', 'video', 'html5', 'text', 'rich_media'],
        }),
        col.varchar('file_url', 500, '素材文件地址'),
        col.int('width', '宽度(px)'),
        col.int('height', '高度(px)'),
        col.int('duration_seconds', '视频时长(秒)'),
        col.bigint('file_size', '文件大小(bytes)'),
        col.varchar('thumbnail_url', 500, '缩略图地址'),
        col.status('审核状态', 'pending/approved/rejected'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_creative_tags',
      comment: '素材标签（贴源层）',
      layer: 'ods',
      columns: [
        col.id('标签ID'),
        col.fk('creative_id', 'ods_creatives', '素材ID'),
        col.varchar('tag_name', 50, '标签名'),
      ],
    },
    {
      name: 'ods_creative_versions',
      comment: '素材版本历史（贴源层）',
      layer: 'ods',
      columns: [
        col.id('版本ID'),
        col.fk('creative_id', 'ods_creatives', '素材ID'),
        col.int('version_number', '版本号'),
        col.varchar('file_url', 500, '版本文件地址'),
        col.varchar('change_note', 500, '变更说明'),
        col.createdAt(),
      ],
    },

    // ─── DMP / Audience segments ───
    {
      name: 'ods_audience_segments',
      comment: 'DMP 人群包定义（贴源层）',
      layer: 'ods',
      columns: [
        col.id('人群包ID'),
        col.varchar('segment_name', 200, '人群包名称'),
        col.varchar('segment_type', 50, '类型: rule_based/lookalike/upload/realtime', {
          sampleValues: ['rule_based', 'lookalike', 'upload', 'realtime'],
        }),
        col.json('rules', '圈选规则(JSON)'),
        col.bigint('estimated_size', '预估人群数'),
        col.bigint('actual_size', '实际人群数'),
        col.date('refresh_date', '最近更新日期'),
        col.status('人群包状态', 'building/ready/expired/archived'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_audience_segment_tags',
      comment: '人群包标签（贴源层）',
      layer: 'ods',
      columns: [
        col.id('标签关联ID'),
        col.fk('segment_id', 'ods_audience_segments', '人群包ID'),
        col.varchar('tag_key', 100, '标签键'),
        col.varchar('tag_value', 200, '标签值'),
      ],
    },
    {
      name: 'ods_audience_uploads',
      comment: '人群包上传记录（贴源层）',
      layer: 'ods',
      columns: [
        col.id('上传ID'),
        col.fk('segment_id', 'ods_audience_segments', '人群包ID'),
        col.varchar('file_name', 200, '上传文件名'),
        col.bigint('row_count', '行数'),
        col.bigint('match_count', '匹配数'),
        col.decimal('match_rate', '5,2', '匹配率(%)'),
        col.status('状态', 'processing/completed/failed'),
        col.createdAt(),
      ],
    },

    // ─── Conversion tracking ───
    {
      name: 'ods_conversion_events',
      comment: '转化事件流水（贴源层）',
      layer: 'ods',
      columns: [
        col.id('事件ID'),
        col.varchar('event_type', 50, '事件类型: view/click/add_cart/purchase/register/subscribe', {
          sampleValues: ['view', 'click', 'add_cart', 'purchase', 'register'],
        }),
        col.bigint('user_id', '用户ID'),
        col.varchar('device_id', 100, '设备ID'),
        col.fk('campaign_id', 'ods_campaigns', '关联活动ID'),
        col.fk('ad_id', 'ods_ads', '关联广告ID'),
        col.fk('channel_id', 'ods_channels', '关联渠道ID'),
        col.varchar('session_id', 100, '会话标识'),
        col.decimal('event_value', '18,2', '事件价值（元）'),
        col.timestamp('event_time', '事件发生时间'),
        col.varchar('page_url', 500, '页面URL'),
        col.varchar('referrer_url', 500, '来源URL'),
        col.json('event_properties', '事件扩展属性'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_conversion_goals',
      comment: '转化目标定义（贴源层）',
      layer: 'ods',
      columns: [
        col.id('目标ID'),
        col.varchar('goal_name', 200, '目标名称'),
        col.varchar('goal_type', 50, '目标类型: purchase/register/form_submit/pageview/custom'),
        col.varchar('goal_event', 50, '触发事件'),
        col.json('conditions', '触发条件(JSON)'),
        col.int('attribution_window_days', '归因窗口(天)'),
        col.bool('is_active', '是否启用'),
        col.createdAt(),
      ],
    },

    // ─── Attribution ───
    {
      name: 'ods_attribution_touchpoints',
      comment: '归因触点记录（贴源层）',
      layer: 'ods',
      columns: [
        col.id('触点ID'),
        col.bigint('user_id', '用户ID'),
        col.fk('channel_id', 'ods_channels', '触点渠道ID'),
        col.fk('campaign_id', 'ods_campaigns', '触点活动ID'),
        col.fk('ad_id', 'ods_ads', '触点广告ID'),
        col.varchar('touchpoint_type', 30, '触点类型: impression/click/visit/engage'),
        col.timestamp('touch_time', '触点时间'),
        col.int('sequence_number', '触点序号'),
        col.createdAt(),
      ],
    },

    // ─── A/B Testing ───
    {
      name: 'ods_ab_experiments',
      comment: 'A/B 实验主表（贴源层）',
      layer: 'ods',
      columns: [
        col.id('实验ID'),
        col.varchar('experiment_name', 200, '实验名称'),
        col.varchar('hypothesis', 500, '实验假设'),
        col.varchar('experiment_type', 50, '类型: ab/multivariate/bandit', {
          sampleValues: ['ab', 'multivariate', 'bandit'],
        }),
        col.decimal('traffic_percentage', '5,2', '流量占比(%)'),
        col.date('start_date', '开始日期'),
        col.date('end_date', '结束日期'),
        col.status('实验状态', 'draft/running/paused/completed/cancelled'),
        col.varchar('primary_metric', 100, '主要观测指标'),
        col.decimal('min_detectable_effect', '8,4', '最小可检测效应'),
        col.int('min_sample_size', '最小样本量'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_ab_variants',
      comment: 'A/B 实验变体（贴源层）',
      layer: 'ods',
      columns: [
        col.id('变体ID'),
        col.fk('experiment_id', 'ods_ab_experiments', '所属实验ID'),
        col.varchar('variant_name', 100, '变体名称: control/treatment_a/treatment_b', {
          sampleValues: ['control', 'treatment_a', 'treatment_b'],
        }),
        col.decimal('traffic_split', '5,2', '流量分配比例(%)'),
        col.json('variant_config', '变体配置(JSON)'),
        col.bool('is_control', '是否为对照组'),
      ],
    },
    {
      name: 'ods_ab_assignments',
      comment: 'A/B 实验分组记录（贴源层）',
      layer: 'ods',
      columns: [
        col.id('分组记录ID'),
        col.fk('experiment_id', 'ods_ab_experiments', '实验ID'),
        col.fk('variant_id', 'ods_ab_variants', '变体ID'),
        col.bigint('user_id', '用户ID'),
        col.timestamp('assigned_at', '分组时间'),
      ],
    },

    // ─── Email marketing ───
    {
      name: 'ods_email_campaigns',
      comment: '邮件营销活动（贴源层）',
      layer: 'ods',
      columns: [
        col.id('邮件活动ID'),
        col.fk('campaign_id', 'ods_campaigns', '关联营销活动ID'),
        col.varchar('subject_line', 500, '邮件主题'),
        col.varchar('sender_name', 100, '发件人名称'),
        col.varchar('sender_email', 200, '发件人邮箱'),
        col.text('html_content', '邮件HTML内容'),
        col.varchar('template_id', 50, '模板ID'),
        col.fk('segment_id', 'ods_audience_segments', '目标人群包ID'),
        col.timestamp('scheduled_time', '计划发送时间'),
        col.timestamp('sent_time', '实际发送时间'),
        col.bigint('total_recipients', '收件人数'),
        col.status('状态', 'draft/scheduled/sending/sent/cancelled'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_email_events',
      comment: '邮件事件日志（贴源层）',
      layer: 'ods',
      columns: [
        col.id('事件ID'),
        col.fk('email_campaign_id', 'ods_email_campaigns', '邮件活动ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar(
          'event_type',
          30,
          '事件类型: delivered/opened/clicked/bounced/unsubscribed/spam',
          {
            sampleValues: ['delivered', 'opened', 'clicked', 'bounced', 'unsubscribed'],
          },
        ),
        col.varchar('link_url', 500, '点击链接'),
        col.varchar('device_type', 30, '设备类型'),
        col.varchar('email_client', 100, '邮件客户端'),
        col.timestamp('event_time', '事件时间'),
      ],
    },

    // ─── Push notifications ───
    {
      name: 'ods_push_campaigns',
      comment: 'Push 推送活动（贴源层）',
      layer: 'ods',
      columns: [
        col.id('推送活动ID'),
        col.fk('campaign_id', 'ods_campaigns', '关联营销活动ID'),
        col.varchar('push_title', 200, '推送标题'),
        col.varchar('push_body', 500, '推送内容'),
        col.varchar('push_type', 30, '推送类型: broadcast/segment/individual', {
          sampleValues: ['broadcast', 'segment', 'individual'],
        }),
        col.varchar('deep_link', 500, '深度链接'),
        col.fk('segment_id', 'ods_audience_segments', '目标人群包ID'),
        col.timestamp('scheduled_time', '计划推送时间'),
        col.bigint('total_targets', '目标推送数'),
        col.status('状态', 'draft/scheduled/sending/sent/cancelled'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_push_events',
      comment: 'Push 事件日志（贴源层）',
      layer: 'ods',
      columns: [
        col.id('事件ID'),
        col.fk('push_campaign_id', 'ods_push_campaigns', '推送活动ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('device_token', 200, '设备Token'),
        col.varchar('event_type', 30, '事件类型: sent/delivered/opened/dismissed', {
          sampleValues: ['sent', 'delivered', 'opened', 'dismissed'],
        }),
        col.varchar('platform', 20, '平台: ios/android/web', {
          sampleValues: ['ios', 'android', 'web'],
        }),
        col.timestamp('event_time', '事件时间'),
      ],
    },

    // ─── SMS marketing ───
    {
      name: 'ods_sms_campaigns',
      comment: '短信营销活动（贴源层）',
      layer: 'ods',
      columns: [
        col.id('短信活动ID'),
        col.fk('campaign_id', 'ods_campaigns', '关联营销活动ID'),
        col.text('sms_content', '短信内容'),
        col.varchar('sms_sign', 50, '短信签名'),
        col.fk('segment_id', 'ods_audience_segments', '目标人群包ID'),
        col.bigint('total_targets', '目标发送数'),
        col.timestamp('scheduled_time', '计划发送时间'),
        col.status('状态', 'draft/scheduled/sending/sent'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_sms_events',
      comment: '短信发送事件日志（贴源层）',
      layer: 'ods',
      columns: [
        col.id('事件ID'),
        col.fk('sms_campaign_id', 'ods_sms_campaigns', '短信活动ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('phone', 20, '手机号', { isPii: true }),
        col.varchar('event_type', 30, '事件类型: sent/delivered/failed/clicked', {
          sampleValues: ['sent', 'delivered', 'failed', 'clicked'],
        }),
        col.varchar('fail_reason', 200, '失败原因'),
        col.timestamp('event_time', '事件时间'),
      ],
    },

    // ─── Social media ───
    {
      name: 'ods_social_accounts',
      comment: '社媒账号（贴源层）',
      layer: 'ods',
      columns: [
        col.id('账号ID'),
        col.varchar('platform', 50, '平台: wechat/weibo/douyin/xiaohongshu/bilibili/twitter', {
          sampleValues: ['wechat', 'weibo', 'douyin', 'xiaohongshu', 'bilibili'],
        }),
        col.varchar('account_name', 200, '账号名称'),
        col.varchar('account_id_ext', 200, '平台账号标识'),
        col.bigint('followers_count', '粉丝数'),
        col.status('账号状态', 'active/suspended/archived'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_social_posts',
      comment: '社媒发布内容（贴源层）',
      layer: 'ods',
      columns: [
        col.id('内容ID'),
        col.fk('account_id', 'ods_social_accounts', '发布账号ID'),
        col.text('content_text', '文本内容'),
        col.varchar('content_type', 30, '内容类型: text/image/video/article/live', {
          sampleValues: ['text', 'image', 'video', 'article'],
        }),
        col.json('media_urls', '媒体文件URL列表'),
        col.varchar('post_url', 500, '内容链接'),
        col.timestamp('published_at', '发布时间'),
        col.timestamp('scheduled_at', '定时发布时间'),
        col.fk('campaign_id', 'ods_campaigns', '关联活动ID'),
        col.status('状态', 'draft/scheduled/published/deleted'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_social_interactions',
      comment: '社媒互动数据（贴源层）',
      layer: 'ods',
      columns: [
        col.id('互动ID'),
        col.fk('post_id', 'ods_social_posts', '内容ID'),
        col.varchar('interaction_type', 30, '互动类型: like/comment/share/save/click', {
          sampleValues: ['like', 'comment', 'share', 'save', 'click'],
        }),
        col.bigint('user_id_ext', '平台用户标识'),
        col.text('comment_text', '评论内容'),
        col.timestamp('interaction_time', '互动时间'),
      ],
    },

    // ─── SEO/SEM ───
    {
      name: 'ods_sem_keywords',
      comment: 'SEM 关键词（贴源层）',
      layer: 'ods',
      columns: [
        col.id('关键词ID'),
        col.fk('ad_group_id', 'ods_ad_groups', '所属广告组ID'),
        col.varchar('keyword', 200, '关键词'),
        col.varchar('match_type', 20, '匹配模式: exact/phrase/broad', {
          sampleValues: ['exact', 'phrase', 'broad'],
        }),
        col.decimal('max_bid', '12,4', '最高出价'),
        col.decimal('quality_score', '3,1', '质量分(1-10)'),
        col.status('状态', 'active/paused/deleted'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_sem_keyword_daily',
      comment: 'SEM 关键词每日投放数据（贴源层）',
      layer: 'ods',
      columns: [
        col.id('记录ID'),
        col.fk('keyword_id', 'ods_sem_keywords', '关键词ID'),
        col.date('report_date', '报告日期'),
        col.bigint('impressions', '展示次数'),
        col.bigint('clicks', '点击次数'),
        col.decimal('cost', '18,2', '花费（元）'),
        col.bigint('conversions', '转化次数'),
        col.decimal('avg_position', '5,2', '平均排名'),
        col.decimal('avg_cpc', '12,4', '平均点击单价'),
      ],
    },
    {
      name: 'ods_seo_rankings',
      comment: 'SEO 关键词排名（贴源层）',
      layer: 'ods',
      columns: [
        col.id('记录ID'),
        col.varchar('keyword', 200, '关键词'),
        col.varchar('search_engine', 30, '搜索引擎: baidu/google/bing/sogou', {
          sampleValues: ['baidu', 'google', 'bing'],
        }),
        col.varchar('page_url', 500, '排名页面URL'),
        col.int('ranking_position', '排名位置'),
        col.bigint('search_volume', '月搜索量'),
        col.date('check_date', '检测日期'),
      ],
    },
    {
      name: 'ods_seo_page_metrics',
      comment: 'SEO 页面指标（贴源层）',
      layer: 'ods',
      columns: [
        col.id('记录ID'),
        col.varchar('page_url', 500, '页面URL'),
        col.bigint('organic_sessions', '自然搜索会话数'),
        col.bigint('organic_pageviews', '自然搜索PV'),
        col.decimal('bounce_rate', '5,2', '跳出率(%)'),
        col.decimal('avg_time_on_page', '8,2', '平均停留时长(秒)'),
        col.int('backlink_count', '反向链接数'),
        col.int('domain_authority', '域名权重(0-100)'),
        col.date('report_date', '报告日期'),
      ],
    },

    // ─── Content marketing ───
    {
      name: 'ods_content_articles',
      comment: '内容营销文章（贴源层）',
      layer: 'ods',
      columns: [
        col.id('文章ID'),
        col.varchar('title', 300, '文章标题'),
        col.text('body', '文章正文'),
        col.varchar('author', 100, '作者'),
        col.varchar('category', 50, '文章分类'),
        col.json('tags', '标签列表'),
        col.varchar('content_format', 30, '格式: blog/whitepaper/case_study/infographic/ebook', {
          sampleValues: ['blog', 'whitepaper', 'case_study', 'infographic'],
        }),
        col.varchar('publish_url', 500, '发布URL'),
        col.timestamp('published_at', '发布时间'),
        col.fk('campaign_id', 'ods_campaigns', '关联活动ID'),
        col.status('状态', 'draft/published/archived'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_content_interactions',
      comment: '内容互动数据（贴源层）',
      layer: 'ods',
      columns: [
        col.id('互动ID'),
        col.fk('article_id', 'ods_content_articles', '文章ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('interaction_type', 30, '互动类型: view/read/share/comment/download'),
        col.int('read_progress', '阅读进度(%)'),
        col.int('read_duration_seconds', '阅读时长(秒)'),
        col.timestamp('interaction_time', '互动时间'),
      ],
    },

    // ─── Affiliate programs ───
    {
      name: 'ods_affiliates',
      comment: '联盟分销商（贴源层）',
      layer: 'ods',
      columns: [
        col.id('分销商ID'),
        col.varchar('affiliate_name', 200, '分销商名称'),
        col.varchar('contact_email', 200, '联系邮箱', { isPii: true }),
        col.varchar('affiliate_type', 30, '类型: individual/company/influencer', {
          sampleValues: ['individual', 'company', 'influencer'],
        }),
        col.decimal('commission_rate', '5,2', '佣金比例(%)'),
        col.varchar('payout_method', 30, '结算方式: bank/alipay/paypal'),
        col.status('状态', 'pending/approved/suspended/terminated'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_affiliate_links',
      comment: '分销推广链接（贴源层）',
      layer: 'ods',
      columns: [
        col.id('链接ID'),
        col.fk('affiliate_id', 'ods_affiliates', '分销商ID'),
        col.fk('campaign_id', 'ods_campaigns', '关联活动ID'),
        col.varchar('tracking_code', 100, '追踪码'),
        col.varchar('destination_url', 500, '目标链接'),
        col.varchar('short_url', 200, '短链接'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_affiliate_conversions',
      comment: '分销转化记录（贴源层）',
      layer: 'ods',
      columns: [
        col.id('记录ID'),
        col.fk('affiliate_id', 'ods_affiliates', '分销商ID'),
        col.fk('link_id', 'ods_affiliate_links', '推广链接ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('order_id', 50, '订单号'),
        col.decimal('order_amount', '18,2', '订单金额'),
        col.decimal('commission_amount', '18,2', '佣金金额'),
        col.status('状态', 'pending/approved/rejected/paid'),
        col.timestamp('conversion_time', '转化时间'),
        col.createdAt(),
      ],
    },

    // ─── Coupon management ───
    {
      name: 'ods_coupons',
      comment: '优惠券定义（贴源层）',
      layer: 'ods',
      columns: [
        col.id('优惠券ID'),
        col.varchar('coupon_name', 200, '优惠券名称'),
        col.varchar('coupon_code', 50, '优惠码'),
        col.varchar('coupon_type', 30, '类型: fixed/percentage/free_shipping/buy_x_get_y', {
          sampleValues: ['fixed', 'percentage', 'free_shipping', 'buy_x_get_y'],
        }),
        col.decimal('discount_value', '12,2', '折扣值'),
        col.decimal('min_purchase_amount', '12,2', '最低消费门槛'),
        col.decimal('max_discount_amount', '12,2', '最大优惠金额'),
        col.int('total_quantity', '总发行量'),
        col.int('used_quantity', '已使用量'),
        col.int('per_user_limit', '每人限领数'),
        col.date('valid_from', '有效期开始'),
        col.date('valid_to', '有效期结束'),
        col.fk('campaign_id', 'ods_campaigns', '关联活动ID'),
        col.status('状态', 'active/exhausted/expired/disabled'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_coupon_distributions',
      comment: '优惠券发放记录（贴源层）',
      layer: 'ods',
      columns: [
        col.id('发放ID'),
        col.fk('coupon_id', 'ods_coupons', '优惠券ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('distribution_channel', 50, '发放渠道: system/manual/campaign/register/share'),
        col.timestamp('distributed_at', '发放时间'),
        col.timestamp('used_at', '使用时间'),
        col.varchar('order_id', 50, '关联订单号'),
        col.status('状态', 'unused/used/expired'),
      ],
    },

    // ─── Landing pages ───
    {
      name: 'ods_landing_pages',
      comment: '落地页配置（贴源层）',
      layer: 'ods',
      columns: [
        col.id('落地页ID'),
        col.varchar('page_name', 200, '落地页名称'),
        col.varchar('page_url', 500, '落地页URL'),
        col.varchar('page_type', 30, '类型: product/event/form/download/video', {
          sampleValues: ['product', 'event', 'form', 'download'],
        }),
        col.fk('campaign_id', 'ods_campaigns', '关联活动ID'),
        col.varchar('template_id', 50, '模板ID'),
        col.json('page_config', '页面配置(JSON)'),
        col.bool('is_published', '是否已发布'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_landing_page_visits',
      comment: '落地页访问日志（贴源层）',
      layer: 'ods',
      columns: [
        col.id('访问ID'),
        col.fk('page_id', 'ods_landing_pages', '落地页ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('session_id', 100, '会话标识'),
        col.varchar('referrer_url', 500, '来源URL'),
        col.fk('channel_id', 'ods_channels', '来源渠道ID'),
        col.fk('campaign_id', 'ods_campaigns', '关联活动ID'),
        col.varchar('utm_source', 100, 'UTM Source'),
        col.varchar('utm_medium', 100, 'UTM Medium'),
        col.varchar('utm_campaign', 200, 'UTM Campaign'),
        col.varchar('utm_term', 200, 'UTM Term'),
        col.varchar('utm_content', 200, 'UTM Content'),
        col.varchar('device_type', 30, '设备类型: desktop/mobile/tablet'),
        col.varchar('browser', 50, '浏览器'),
        col.varchar('os', 50, '操作系统'),
        col.int('time_on_page_seconds', '停留时长(秒)'),
        col.bool('has_conversion', '是否发生转化'),
        col.timestamp('visit_time', '访问时间'),
      ],
    },

    // ─── Marketing team / users ───
    {
      name: 'ods_marketing_users',
      comment: '营销团队成员（贴源层）',
      layer: 'ods',
      columns: [
        col.id('成员ID'),
        col.varchar('user_name', 100, '姓名'),
        col.varchar('email', 200, '邮箱', { isPii: true }),
        col.varchar('role', 50, '角色: admin/manager/operator/analyst', {
          sampleValues: ['admin', 'manager', 'operator', 'analyst'],
        }),
        col.varchar('department', 100, '部门'),
        col.status('状态', 'active/inactive'),
        col.createdAt(),
      ],
    },

    // ─── Budget & spend ───
    {
      name: 'ods_budget_plans',
      comment: '预算计划（贴源层）',
      layer: 'ods',
      columns: [
        col.id('预算ID'),
        col.varchar('plan_name', 200, '计划名称'),
        col.varchar('period_type', 20, '周期: monthly/quarterly/yearly'),
        col.date('period_start', '周期开始'),
        col.date('period_end', '周期结束'),
        col.decimal('planned_budget', '18,2', '计划预算（元）'),
        col.decimal('actual_spend', '18,2', '实际花费（元）'),
        col.fk('channel_id', 'ods_channels', '渠道ID'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_ad_spend_daily',
      comment: '每日广告花费流水（贴源层）',
      layer: 'ods',
      columns: [
        col.id('记录ID'),
        col.fk('campaign_id', 'ods_campaigns', '活动ID'),
        col.fk('ad_group_id', 'ods_ad_groups', '广告组ID'),
        col.fk('ad_id', 'ods_ads', '广告ID'),
        col.fk('channel_id', 'ods_channels', '渠道ID'),
        col.date('spend_date', '花费日期'),
        col.decimal('spend_amount', '18,2', '花费金额（元）'),
        col.bigint('impressions', '展示次数'),
        col.bigint('clicks', '点击次数'),
        col.bigint('conversions', '转化次数'),
        col.decimal('revenue', '18,2', '带来收入（元）'),
      ],
    },

    // ─── UTM tracking ───
    {
      name: 'ods_utm_tracking_rules',
      comment: 'UTM 追踪规则配置（贴源层）',
      layer: 'ods',
      columns: [
        col.id('规则ID'),
        col.fk('campaign_id', 'ods_campaigns', '活动ID'),
        col.varchar('utm_source', 100, 'UTM Source'),
        col.varchar('utm_medium', 100, 'UTM Medium'),
        col.varchar('utm_campaign', 200, 'UTM Campaign'),
        col.varchar('utm_term', 200, 'UTM Term'),
        col.varchar('utm_content', 200, 'UTM Content'),
        col.varchar('generated_url', 500, '生成的追踪链接'),
        col.createdAt(),
      ],
    },

    // ─── Marketing automation ───
    {
      name: 'ods_automation_workflows',
      comment: '营销自动化工作流（贴源层）',
      layer: 'ods',
      columns: [
        col.id('工作流ID'),
        col.varchar('workflow_name', 200, '工作流名称'),
        col.varchar('trigger_type', 50, '触发类型: event/schedule/segment_entry/manual', {
          sampleValues: ['event', 'schedule', 'segment_entry', 'manual'],
        }),
        col.json('trigger_conditions', '触发条件(JSON)'),
        col.json('action_steps', '执行步骤(JSON)'),
        col.status('状态', 'draft/active/paused/archived'),
        col.fk('campaign_id', 'ods_campaigns', '关联活动ID'),
        col.createdAt(),
        col.updatedAt(),
      ],
    },
    {
      name: 'ods_automation_executions',
      comment: '自动化执行记录（贴源层）',
      layer: 'ods',
      columns: [
        col.id('执行ID'),
        col.fk('workflow_id', 'ods_automation_workflows', '工作流ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('current_step', 50, '当前步骤'),
        col.status('状态', 'running/completed/failed/cancelled'),
        col.timestamp('started_at', '开始时间'),
        col.timestamp('completed_at', '完成时间'),
      ],
    },

    // ─── Campaign scheduling & approval ───
    {
      name: 'ods_campaign_approvals',
      comment: '活动审批记录（贴源层）',
      layer: 'ods',
      columns: [
        col.id('审批ID'),
        col.fk('campaign_id', 'ods_campaigns', '活动ID'),
        col.fk('approver_id', 'ods_marketing_users', '审批人ID'),
        col.varchar('approval_action', 30, '审批动作: approved/rejected/revision_requested'),
        col.text('comment', '审批意见'),
        col.timestamp('approval_time', '审批时间'),
      ],
    },
    {
      name: 'ods_campaign_schedules',
      comment: '活动排期计划（贴源层）',
      layer: 'ods',
      columns: [
        col.id('排期ID'),
        col.fk('campaign_id', 'ods_campaigns', '活动ID'),
        col.fk('channel_id', 'ods_channels', '渠道ID'),
        col.timestamp('planned_start', '计划开始时间'),
        col.timestamp('planned_end', '计划结束时间'),
        col.timestamp('actual_start', '实际开始时间'),
        col.timestamp('actual_end', '实际结束时间'),
        col.status('状态', 'planned/in_progress/completed/cancelled'),
      ],
    },

    // ─── Negative keywords & brand safety ───
    {
      name: 'ods_negative_keywords',
      comment: 'SEM 否定关键词（贴源层）',
      layer: 'ods',
      columns: [
        col.id('否定关键词ID'),
        col.fk('ad_group_id', 'ods_ad_groups', '广告组ID'),
        col.varchar('keyword', 200, '否定关键词'),
        col.varchar('match_type', 20, '匹配模式: exact/phrase'),
        col.createdAt(),
      ],
    },
    {
      name: 'ods_brand_safety_rules',
      comment: '品牌安全规则（贴源层）',
      layer: 'ods',
      columns: [
        col.id('规则ID'),
        col.varchar('rule_name', 200, '规则名称'),
        col.varchar('rule_type', 30, '类型: blocklist/allowlist/category'),
        col.json('rule_config', '规则配置(JSON)'),
        col.bool('is_active', '是否启用'),
        col.createdAt(),
      ],
    },

    /* ===================================================================
     *  DWD Layer (~35 tables) — 明细层 (star schema)
     * =================================================================== */

    // ─── Dimension tables ───
    {
      name: 'dim_channel',
      comment: '渠道维度表',
      layer: 'dwd',
      columns: [
        col.id('渠道ID'),
        col.varchar('channel_name', 100, '渠道名称'),
        col.varchar('channel_type', 50, '渠道类型'),
        col.varchar('platform', 50, '平台标识'),
        col.varchar('channel_group', 50, '渠道分组: paid/organic/direct/referral', {
          sampleValues: ['paid', 'organic', 'direct', 'referral'],
        }),
        col.bool('is_active', '是否启用'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_campaign',
      comment: '活动维度表',
      layer: 'dwd',
      columns: [
        col.id('活动ID'),
        col.varchar('campaign_name', 200, '活动名称'),
        col.varchar('campaign_type', 50, '活动类型'),
        col.varchar('objective', 50, '活动目标'),
        col.decimal('budget', '18,2', '总预算'),
        col.date('start_date', '开始日期'),
        col.date('end_date', '结束日期'),
        col.varchar('status', 30, '活动状态'),
        col.varchar('owner_name', 100, '负责人姓名'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_creative',
      comment: '素材维度表',
      layer: 'dwd',
      columns: [
        col.id('素材ID'),
        col.varchar('creative_name', 200, '素材名称'),
        col.varchar('creative_type', 30, '素材类型'),
        col.int('width', '宽度(px)'),
        col.int('height', '高度(px)'),
        col.int('duration_seconds', '时长(秒)'),
        col.varchar('approval_status', 20, '审核状态'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_audience_segment',
      comment: '人群包维度表',
      layer: 'dwd',
      columns: [
        col.id('人群包ID'),
        col.varchar('segment_name', 200, '人群包名称'),
        col.varchar('segment_type', 50, '人群包类型'),
        col.bigint('segment_size', '人群数'),
        col.date('refresh_date', '最近更新日期'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_ad',
      comment: '广告维度表',
      layer: 'dwd',
      columns: [
        col.id('广告ID'),
        col.varchar('ad_name', 200, '广告名称'),
        col.varchar('ad_format', 30, '广告形式'),
        col.fk('ad_group_id', 'dim_ad_group', '广告组ID'),
        col.fk('campaign_id', 'dim_campaign', '活动ID'),
        col.fk('creative_id', 'dim_creative', '素材ID'),
        col.fk('channel_id', 'dim_channel', '渠道ID'),
        col.varchar('status', 30, '广告状态'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_ad_group',
      comment: '广告组维度表',
      layer: 'dwd',
      columns: [
        col.id('广告组ID'),
        col.varchar('ad_group_name', 200, '广告组名称'),
        col.fk('campaign_id', 'dim_campaign', '活动ID'),
        col.varchar('targeting_type', 50, '定向类型'),
        col.varchar('bid_strategy', 30, '出价策略'),
        col.decimal('bid_amount', '12,4', '出价金额'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_conversion_goal',
      comment: '转化目标维度表',
      layer: 'dwd',
      columns: [
        col.id('目标ID'),
        col.varchar('goal_name', 200, '目标名称'),
        col.varchar('goal_type', 50, '目标类型'),
        col.varchar('goal_event', 50, '触发事件'),
        col.int('attribution_window_days', '归因窗口(天)'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_affiliate',
      comment: '联盟分销商维度表',
      layer: 'dwd',
      columns: [
        col.id('分销商ID'),
        col.varchar('affiliate_name', 200, '分销商名称'),
        col.varchar('affiliate_type', 30, '分销商类型'),
        col.decimal('commission_rate', '5,2', '佣金比例(%)'),
        col.varchar('status', 20, '状态'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_coupon',
      comment: '优惠券维度表',
      layer: 'dwd',
      columns: [
        col.id('优惠券ID'),
        col.varchar('coupon_name', 200, '优惠券名称'),
        col.varchar('coupon_type', 30, '优惠券类型'),
        col.decimal('discount_value', '12,2', '折扣值'),
        col.decimal('min_purchase_amount', '12,2', '最低消费门槛'),
        col.date('valid_from', '有效期开始'),
        col.date('valid_to', '有效期结束'),
        col.varchar('status', 20, '状态'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_landing_page',
      comment: '落地页维度表',
      layer: 'dwd',
      columns: [
        col.id('落地页ID'),
        col.varchar('page_name', 200, '落地页名称'),
        col.varchar('page_url', 500, '落地页URL'),
        col.varchar('page_type', 30, '类型'),
        col.fk('campaign_id', 'dim_campaign', '关联活动ID'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_ab_experiment',
      comment: 'A/B实验维度表',
      layer: 'dwd',
      columns: [
        col.id('实验ID'),
        col.varchar('experiment_name', 200, '实验名称'),
        col.varchar('experiment_type', 50, '实验类型'),
        col.date('start_date', '开始日期'),
        col.date('end_date', '结束日期'),
        col.varchar('status', 30, '实验状态'),
        col.varchar('primary_metric', 100, '主要观测指标'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_social_account',
      comment: '社媒账号维度表',
      layer: 'dwd',
      columns: [
        col.id('账号ID'),
        col.varchar('platform', 50, '平台'),
        col.varchar('account_name', 200, '账号名称'),
        col.bigint('followers_count', '粉丝数'),
        col.etlTime(),
      ],
    },
    {
      name: 'dim_date',
      comment: '日期维度表',
      layer: 'dwd',
      columns: [
        col.id('日期ID'),
        col.date('full_date', '完整日期'),
        col.int('year', '年'),
        col.int('quarter', '季度'),
        col.int('month', '月'),
        col.int('week_of_year', '年第几周'),
        col.int('day_of_month', '月第几天'),
        col.int('day_of_week', '周几(1=周一)'),
        col.bool('is_weekend', '是否周末'),
        col.bool('is_holiday', '是否节假日'),
        col.varchar('holiday_name', 50, '节假日名称'),
        col.etlTime(),
      ],
    },

    // ─── Fact tables ───
    {
      name: 'fact_ad_impressions',
      comment: '广告展示明细事实表',
      layer: 'dwd',
      columns: [
        col.id('展示ID'),
        col.fk('ad_id', 'dim_ad', '广告ID'),
        col.fk('campaign_id', 'dim_campaign', '活动ID'),
        col.fk('channel_id', 'dim_channel', '渠道ID'),
        col.fk('creative_id', 'dim_creative', '素材ID'),
        col.fk('segment_id', 'dim_audience_segment', '人群包ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('device_type', 30, '设备类型'),
        col.varchar('position', 50, '广告位'),
        col.decimal('bid_price', '12,4', '出价'),
        col.decimal('win_price', '12,4', '成交价'),
        col.timestamp('impression_time', '展示时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_ad_clicks',
      comment: '广告点击明细事实表',
      layer: 'dwd',
      columns: [
        col.id('点击ID'),
        col.fk('ad_id', 'dim_ad', '广告ID'),
        col.fk('campaign_id', 'dim_campaign', '活动ID'),
        col.fk('channel_id', 'dim_channel', '渠道ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('click_url', 500, '点击链接'),
        col.decimal('click_cost', '12,4', '点击花费'),
        col.timestamp('click_time', '点击时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_conversions',
      comment: '转化明细事实表',
      layer: 'dwd',
      columns: [
        col.id('转化ID'),
        col.fk('campaign_id', 'dim_campaign', '活动ID'),
        col.fk('channel_id', 'dim_channel', '渠道ID'),
        col.fk('ad_id', 'dim_ad', '广告ID'),
        col.fk('goal_id', 'dim_conversion_goal', '转化目标ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('event_type', 50, '事件类型'),
        col.decimal('conversion_value', '18,2', '转化价值（元）'),
        col.varchar(
          'attribution_model',
          30,
          '归因模型: last_click/first_click/linear/time_decay/position',
          {
            sampleValues: ['last_click', 'first_click', 'linear', 'time_decay'],
          },
        ),
        col.decimal('attribution_weight', '5,4', '归因权重'),
        col.timestamp('conversion_time', '转化时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_attribution_paths',
      comment: '多触点归因路径事实表',
      layer: 'dwd',
      columns: [
        col.id('路径ID'),
        col.bigint('user_id', '用户ID'),
        col.fk('conversion_id', 'fact_conversions', '转化ID'),
        col.json('touchpoint_sequence', '触点序列(JSON)'),
        col.int('path_length', '路径长度'),
        col.int('days_to_convert', '转化天数'),
        col.fk('first_touch_channel_id', 'dim_channel', '首次触点渠道ID'),
        col.fk('last_touch_channel_id', 'dim_channel', '末次触点渠道ID'),
        col.decimal('conversion_value', '18,2', '转化价值'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_email_sends',
      comment: '邮件发送明细事实表',
      layer: 'dwd',
      columns: [
        col.id('发送ID'),
        col.fk('email_campaign_id', 'ods_email_campaigns', '邮件活动ID'),
        col.fk('campaign_id', 'dim_campaign', '关联活动ID'),
        col.bigint('user_id', '用户ID'),
        col.bool('is_delivered', '是否送达'),
        col.bool('is_opened', '是否打开'),
        col.bool('is_clicked', '是否点击'),
        col.bool('is_bounced', '是否退回'),
        col.bool('is_unsubscribed', '是否退订'),
        col.timestamp('sent_at', '发送时间'),
        col.timestamp('opened_at', '打开时间'),
        col.timestamp('clicked_at', '点击时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_push_sends',
      comment: 'Push推送明细事实表',
      layer: 'dwd',
      columns: [
        col.id('推送ID'),
        col.fk('push_campaign_id', 'ods_push_campaigns', '推送活动ID'),
        col.fk('campaign_id', 'dim_campaign', '关联活动ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('platform', 20, '平台: ios/android/web'),
        col.bool('is_delivered', '是否送达'),
        col.bool('is_opened', '是否打开'),
        col.bool('is_dismissed', '是否忽略'),
        col.timestamp('sent_at', '发送时间'),
        col.timestamp('opened_at', '打开时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_sms_sends',
      comment: '短信发送明细事实表',
      layer: 'dwd',
      columns: [
        col.id('发送ID'),
        col.fk('sms_campaign_id', 'ods_sms_campaigns', '短信活动ID'),
        col.fk('campaign_id', 'dim_campaign', '关联活动ID'),
        col.bigint('user_id', '用户ID'),
        col.bool('is_delivered', '是否送达'),
        col.bool('is_clicked', '是否点击短链'),
        col.varchar('fail_reason', 200, '失败原因'),
        col.timestamp('sent_at', '发送时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_social_posts',
      comment: '社媒发布明细事实表',
      layer: 'dwd',
      columns: [
        col.id('发布ID'),
        col.fk('account_id', 'dim_social_account', '账号ID'),
        col.fk('campaign_id', 'dim_campaign', '关联活动ID'),
        col.varchar('content_type', 30, '内容类型'),
        col.bigint('likes', '点赞数'),
        col.bigint('comments', '评论数'),
        col.bigint('shares', '转发数'),
        col.bigint('saves', '收藏数'),
        col.bigint('views', '浏览数'),
        col.bigint('reach', '触达人数'),
        col.timestamp('published_at', '发布时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_landing_page_visits',
      comment: '落地页访问明细事实表',
      layer: 'dwd',
      columns: [
        col.id('访问ID'),
        col.fk('page_id', 'dim_landing_page', '落地页ID'),
        col.fk('channel_id', 'dim_channel', '渠道ID'),
        col.fk('campaign_id', 'dim_campaign', '活动ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('utm_source', 100, 'UTM Source'),
        col.varchar('utm_medium', 100, 'UTM Medium'),
        col.varchar('device_type', 30, '设备类型'),
        col.int('time_on_page_seconds', '停留时长(秒)'),
        col.bool('has_conversion', '是否转化'),
        col.decimal('bounce_rate', '5,2', '跳出标记(0/1)'),
        col.timestamp('visit_time', '访问时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_coupon_usage',
      comment: '优惠券使用明细事实表',
      layer: 'dwd',
      columns: [
        col.id('记录ID'),
        col.fk('coupon_id', 'dim_coupon', '优惠券ID'),
        col.fk('campaign_id', 'dim_campaign', '关联活动ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('order_id', 50, '订单号'),
        col.decimal('order_amount', '18,2', '订单金额'),
        col.decimal('discount_amount', '18,2', '优惠金额'),
        col.varchar('distribution_channel', 50, '发放渠道'),
        col.timestamp('used_at', '使用时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_affiliate_conversions',
      comment: '联盟分销转化明细事实表',
      layer: 'dwd',
      columns: [
        col.id('记录ID'),
        col.fk('affiliate_id', 'dim_affiliate', '分销商ID'),
        col.fk('campaign_id', 'dim_campaign', '活动ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('order_id', 50, '订单号'),
        col.decimal('order_amount', '18,2', '订单金额'),
        col.decimal('commission_amount', '18,2', '佣金金额'),
        col.varchar('status', 20, '状态'),
        col.timestamp('conversion_time', '转化时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_ab_experiment_events',
      comment: 'A/B实验事件明细事实表',
      layer: 'dwd',
      columns: [
        col.id('事件ID'),
        col.fk('experiment_id', 'dim_ab_experiment', '实验ID'),
        col.bigint('variant_id', '变体ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('event_type', 50, '事件类型'),
        col.decimal('metric_value', '18,4', '指标值'),
        col.timestamp('event_time', '事件时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_content_engagement',
      comment: '内容互动明细事实表',
      layer: 'dwd',
      columns: [
        col.id('互动ID'),
        col.bigint('article_id', '文章ID'),
        col.fk('campaign_id', 'dim_campaign', '关联活动ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('interaction_type', 30, '互动类型'),
        col.int('read_duration_seconds', '阅读时长(秒)'),
        col.int('read_progress', '阅读进度(%)'),
        col.timestamp('interaction_time', '互动时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_sem_clicks',
      comment: 'SEM 搜索点击明细事实表',
      layer: 'dwd',
      columns: [
        col.id('点击ID'),
        col.fk('keyword_id', 'ods_sem_keywords', '关键词ID'),
        col.fk('ad_group_id', 'dim_ad_group', '广告组ID'),
        col.fk('campaign_id', 'dim_campaign', '活动ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('search_query', 300, '搜索词'),
        col.decimal('click_cost', '12,4', '点击花费'),
        col.int('ad_position', '广告位置'),
        col.timestamp('click_time', '点击时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'fact_automation_events',
      comment: '自动化触发事件明细事实表',
      layer: 'dwd',
      columns: [
        col.id('事件ID'),
        col.bigint('workflow_id', '工作流ID'),
        col.fk('campaign_id', 'dim_campaign', '活动ID'),
        col.bigint('user_id', '用户ID'),
        col.varchar('step_name', 100, '步骤名称'),
        col.varchar('action_type', 50, '动作类型: send_email/send_push/send_sms/wait/condition'),
        col.varchar('outcome', 30, '结果: success/skip/fail'),
        col.timestamp('event_time', '事件时间'),
        col.ds(),
        col.etlTime(),
      ],
    },
    {
      name: 'bridge_campaign_channel',
      comment: '活动-渠道桥接表',
      layer: 'dwd',
      columns: [
        col.id('桥接ID'),
        col.fk('campaign_id', 'dim_campaign', '活动ID'),
        col.fk('channel_id', 'dim_channel', '渠道ID'),
        col.decimal('allocated_budget', '18,2', '分配预算'),
        col.etlTime(),
      ],
    },
    {
      name: 'bridge_campaign_segment',
      comment: '活动-人群包桥接表',
      layer: 'dwd',
      columns: [
        col.id('桥接ID'),
        col.fk('campaign_id', 'dim_campaign', '活动ID'),
        col.fk('segment_id', 'dim_audience_segment', '人群包ID'),
        col.etlTime(),
      ],
    },

    /* ===================================================================
     *  DWS Layer (~40 tables) — 汇总层
     * =================================================================== */

    // ─── Campaign-level aggregations ───
    generateSummaryTable(
      'dws',
      'campaign_daily_stats',
      '活动维度每日投放汇总',
      'dws',
      [
        { name: 'campaign_id', comment: '活动ID' },
        { name: 'campaign_name', comment: '活动名称' },
        { name: 'campaign_type', comment: '活动类型' },
      ],
      [
        { name: 'impressions', type: 'bigint', comment: '展示数' },
        { name: 'clicks', type: 'bigint', comment: '点击数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'spend_amount', type: 'decimal', comment: '花费金额' },
        { name: 'revenue', type: 'decimal', comment: '收入' },
        { name: 'ctr', type: 'decimal', comment: '点击率(%)' },
        { name: 'cvr', type: 'decimal', comment: '转化率(%)' },
        { name: 'cpa', type: 'decimal', comment: '单次转化成本' },
        { name: 'roas', type: 'decimal', comment: '广告回报率' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'campaign_weekly_stats',
      '活动维度每周投放汇总',
      'dws',
      [
        { name: 'campaign_id', comment: '活动ID' },
        { name: 'campaign_name', comment: '活动名称' },
        { name: 'week_start', comment: '周开始日期' },
      ],
      [
        { name: 'impressions', type: 'bigint', comment: '展示数' },
        { name: 'clicks', type: 'bigint', comment: '点击数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'spend_amount', type: 'decimal', comment: '花费金额' },
        { name: 'revenue', type: 'decimal', comment: '收入' },
        { name: 'roas', type: 'decimal', comment: '广告回报率' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'campaign_monthly_stats',
      '活动维度每月投放汇总',
      'dws',
      [
        { name: 'campaign_id', comment: '活动ID' },
        { name: 'campaign_name', comment: '活动名称' },
        { name: 'month', comment: '月份' },
      ],
      [
        { name: 'impressions', type: 'bigint', comment: '展示数' },
        { name: 'clicks', type: 'bigint', comment: '点击数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'spend_amount', type: 'decimal', comment: '花费金额' },
        { name: 'revenue', type: 'decimal', comment: '收入' },
        { name: 'roas', type: 'decimal', comment: '广告回报率' },
        { name: 'unique_reach', type: 'bigint', comment: '去重触达人数' },
      ],
    ),

    // ─── Channel-level aggregations ───
    generateSummaryTable(
      'dws',
      'channel_daily_stats',
      '渠道维度每日投放汇总',
      'dws',
      [
        { name: 'channel_id', comment: '渠道ID' },
        { name: 'channel_name', comment: '渠道名称' },
        { name: 'channel_type', comment: '渠道类型' },
      ],
      [
        { name: 'impressions', type: 'bigint', comment: '展示数' },
        { name: 'clicks', type: 'bigint', comment: '点击数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'spend_amount', type: 'decimal', comment: '花费金额' },
        { name: 'revenue', type: 'decimal', comment: '收入' },
        { name: 'ctr', type: 'decimal', comment: '点击率(%)' },
        { name: 'cpa', type: 'decimal', comment: '单次转化成本' },
        { name: 'roas', type: 'decimal', comment: '广告回报率' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'channel_monthly_stats',
      '渠道维度每月投放汇总',
      'dws',
      [
        { name: 'channel_id', comment: '渠道ID' },
        { name: 'channel_name', comment: '渠道名称' },
        { name: 'month', comment: '月份' },
      ],
      [
        { name: 'impressions', type: 'bigint', comment: '展示数' },
        { name: 'clicks', type: 'bigint', comment: '点击数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'spend_amount', type: 'decimal', comment: '花费金额' },
        { name: 'revenue', type: 'decimal', comment: '收入' },
        { name: 'roas', type: 'decimal', comment: '广告回报率' },
        { name: 'unique_reach', type: 'bigint', comment: '去重触达人数' },
      ],
    ),

    // ─── Ad-level aggregations ───
    generateSummaryTable(
      'dws',
      'ad_daily_performance',
      '广告维度每日效果汇总',
      'dws',
      [
        { name: 'ad_id', comment: '广告ID' },
        { name: 'ad_name', comment: '广告名称' },
        { name: 'campaign_id', comment: '活动ID' },
        { name: 'channel_id', comment: '渠道ID' },
      ],
      [
        { name: 'impressions', type: 'bigint', comment: '展示数' },
        { name: 'clicks', type: 'bigint', comment: '点击数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'spend_amount', type: 'decimal', comment: '花费金额' },
        { name: 'ctr', type: 'decimal', comment: '点击率(%)' },
        { name: 'cvr', type: 'decimal', comment: '转化率(%)' },
        { name: 'cpc', type: 'decimal', comment: '单次点击成本' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'ad_group_daily_performance',
      '广告组维度每日效果汇总',
      'dws',
      [
        { name: 'ad_group_id', comment: '广告组ID' },
        { name: 'ad_group_name', comment: '广告组名称' },
        { name: 'campaign_id', comment: '活动ID' },
      ],
      [
        { name: 'impressions', type: 'bigint', comment: '展示数' },
        { name: 'clicks', type: 'bigint', comment: '点击数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'spend_amount', type: 'decimal', comment: '花费金额' },
        { name: 'ctr', type: 'decimal', comment: '点击率(%)' },
        { name: 'cpa', type: 'decimal', comment: '单次转化成本' },
      ],
    ),

    // ─── Creative performance ───
    generateSummaryTable(
      'dws',
      'creative_daily_performance',
      '素材维度每日效果汇总',
      'dws',
      [
        { name: 'creative_id', comment: '素材ID' },
        { name: 'creative_type', comment: '素材类型' },
        { name: 'campaign_id', comment: '活动ID' },
      ],
      [
        { name: 'impressions', type: 'bigint', comment: '展示数' },
        { name: 'clicks', type: 'bigint', comment: '点击数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'ctr', type: 'decimal', comment: '点击率(%)' },
        { name: 'cvr', type: 'decimal', comment: '转化率(%)' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'creative_format_stats',
      '素材类型效果汇总',
      'dws',
      [
        { name: 'creative_type', comment: '素材类型' },
        { name: 'ad_format', comment: '广告形式' },
      ],
      [
        { name: 'total_impressions', type: 'bigint', comment: '总展示数' },
        { name: 'total_clicks', type: 'bigint', comment: '总点击数' },
        { name: 'avg_ctr', type: 'decimal', comment: '平均点击率(%)' },
        { name: 'avg_cvr', type: 'decimal', comment: '平均转化率(%)' },
      ],
    ),

    // ─── Attribution aggregations ───
    generateSummaryTable(
      'dws',
      'attribution_channel_daily',
      '多触点归因渠道每日汇总',
      'dws',
      [
        { name: 'channel_id', comment: '渠道ID' },
        { name: 'channel_name', comment: '渠道名称' },
        { name: 'attribution_model', comment: '归因模型' },
      ],
      [
        { name: 'attributed_conversions', type: 'decimal', comment: '归因转化数' },
        { name: 'attributed_revenue', type: 'decimal', comment: '归因收入' },
        { name: 'first_touch_conversions', type: 'bigint', comment: '首次触点转化数' },
        { name: 'last_touch_conversions', type: 'bigint', comment: '末次触点转化数' },
        { name: 'assist_conversions', type: 'decimal', comment: '助攻转化数' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'attribution_path_analysis',
      '归因路径分析汇总',
      'dws',
      [
        { name: 'path_pattern', comment: '路径模式' },
        { name: 'path_length', comment: '路径长度' },
      ],
      [
        { name: 'path_count', type: 'bigint', comment: '路径出现次数' },
        { name: 'total_conversions', type: 'bigint', comment: '转化数' },
        { name: 'total_revenue', type: 'decimal', comment: '转化收入' },
        { name: 'avg_days_to_convert', type: 'decimal', comment: '平均转化天数' },
      ],
    ),

    // ─── Audience / segment performance ───
    generateSummaryTable(
      'dws',
      'segment_campaign_stats',
      '人群包-活动交叉效果汇总',
      'dws',
      [
        { name: 'segment_id', comment: '人群包ID' },
        { name: 'segment_name', comment: '人群包名称' },
        { name: 'campaign_id', comment: '活动ID' },
      ],
      [
        { name: 'targeted_users', type: 'bigint', comment: '圈选人数' },
        { name: 'reached_users', type: 'bigint', comment: '实际触达人数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'revenue', type: 'decimal', comment: '收入' },
        { name: 'reach_rate', type: 'decimal', comment: '触达率(%)' },
        { name: 'cvr', type: 'decimal', comment: '转化率(%)' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'segment_overlap_analysis',
      '人群包重叠分析',
      'dws',
      [
        { name: 'segment_a_id', comment: '人群包A ID' },
        { name: 'segment_b_id', comment: '人群包B ID' },
      ],
      [
        { name: 'overlap_count', type: 'bigint', comment: '重叠人数' },
        { name: 'overlap_rate', type: 'decimal', comment: '重叠率(%)' },
        { name: 'segment_a_size', type: 'bigint', comment: '人群包A大小' },
        { name: 'segment_b_size', type: 'bigint', comment: '人群包B大小' },
      ],
    ),

    // ─── Email marketing aggregations ───
    generateSummaryTable(
      'dws',
      'email_campaign_stats',
      '邮件活动效果汇总',
      'dws',
      [
        { name: 'email_campaign_id', comment: '邮件活动ID' },
        { name: 'campaign_id', comment: '关联活动ID' },
      ],
      [
        { name: 'total_sent', type: 'bigint', comment: '发送数' },
        { name: 'delivered', type: 'bigint', comment: '送达数' },
        { name: 'opened', type: 'bigint', comment: '打开数' },
        { name: 'clicked', type: 'bigint', comment: '点击数' },
        { name: 'bounced', type: 'bigint', comment: '退回数' },
        { name: 'unsubscribed', type: 'bigint', comment: '退订数' },
        { name: 'open_rate', type: 'decimal', comment: '打开率(%)' },
        { name: 'click_rate', type: 'decimal', comment: '点击率(%)' },
        { name: 'bounce_rate', type: 'decimal', comment: '退回率(%)' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'email_daily_stats',
      '邮件每日汇总统计',
      'dws',
      [{ name: 'campaign_id', comment: '关联活动ID' }],
      [
        { name: 'total_sent', type: 'bigint', comment: '发送数' },
        { name: 'delivered', type: 'bigint', comment: '送达数' },
        { name: 'opened', type: 'bigint', comment: '打开数' },
        { name: 'clicked', type: 'bigint', comment: '点击数' },
        { name: 'open_rate', type: 'decimal', comment: '打开率(%)' },
        { name: 'click_rate', type: 'decimal', comment: '点击率(%)' },
      ],
    ),

    // ─── Push notification aggregations ───
    generateSummaryTable(
      'dws',
      'push_campaign_stats',
      'Push推送活动效果汇总',
      'dws',
      [
        { name: 'push_campaign_id', comment: '推送活动ID' },
        { name: 'platform', comment: '平台' },
      ],
      [
        { name: 'total_sent', type: 'bigint', comment: '发送数' },
        { name: 'delivered', type: 'bigint', comment: '送达数' },
        { name: 'opened', type: 'bigint', comment: '打开数' },
        { name: 'dismissed', type: 'bigint', comment: '忽略数' },
        { name: 'delivery_rate', type: 'decimal', comment: '送达率(%)' },
        { name: 'open_rate', type: 'decimal', comment: '打开率(%)' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'push_daily_stats',
      'Push每日汇总统计',
      'dws',
      [{ name: 'platform', comment: '平台' }],
      [
        { name: 'total_sent', type: 'bigint', comment: '发送数' },
        { name: 'delivered', type: 'bigint', comment: '送达数' },
        { name: 'opened', type: 'bigint', comment: '打开数' },
        { name: 'open_rate', type: 'decimal', comment: '打开率(%)' },
      ],
    ),

    // ─── SMS aggregations ───
    generateSummaryTable(
      'dws',
      'sms_campaign_stats',
      '短信活动效果汇总',
      'dws',
      [{ name: 'sms_campaign_id', comment: '短信活动ID' }],
      [
        { name: 'total_sent', type: 'bigint', comment: '发送数' },
        { name: 'delivered', type: 'bigint', comment: '送达数' },
        { name: 'failed', type: 'bigint', comment: '失败数' },
        { name: 'clicked', type: 'bigint', comment: '点击数' },
        { name: 'delivery_rate', type: 'decimal', comment: '送达率(%)' },
        { name: 'click_rate', type: 'decimal', comment: '点击率(%)' },
      ],
    ),

    // ─── Social media aggregations ───
    generateSummaryTable(
      'dws',
      'social_account_daily_stats',
      '社媒账号每日汇总',
      'dws',
      [
        { name: 'account_id', comment: '账号ID' },
        { name: 'platform', comment: '平台' },
      ],
      [
        { name: 'posts_count', type: 'bigint', comment: '发布数' },
        { name: 'total_likes', type: 'bigint', comment: '点赞总数' },
        { name: 'total_comments', type: 'bigint', comment: '评论总数' },
        { name: 'total_shares', type: 'bigint', comment: '转发总数' },
        { name: 'total_views', type: 'bigint', comment: '浏览总数' },
        { name: 'total_reach', type: 'bigint', comment: '触达总数' },
        { name: 'engagement_rate', type: 'decimal', comment: '互动率(%)' },
        { name: 'followers_growth', type: 'bigint', comment: '粉丝增长数' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'social_post_stats',
      '社媒内容效果汇总',
      'dws',
      [
        { name: 'post_id', comment: '内容ID' },
        { name: 'account_id', comment: '账号ID' },
        { name: 'content_type', comment: '内容类型' },
      ],
      [
        { name: 'total_likes', type: 'bigint', comment: '点赞数' },
        { name: 'total_comments', type: 'bigint', comment: '评论数' },
        { name: 'total_shares', type: 'bigint', comment: '转发数' },
        { name: 'total_views', type: 'bigint', comment: '浏览数' },
        { name: 'engagement_rate', type: 'decimal', comment: '互动率(%)' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'social_platform_monthly_stats',
      '社媒平台月度汇总',
      'dws',
      [
        { name: 'platform', comment: '平台' },
        { name: 'month', comment: '月份' },
      ],
      [
        { name: 'posts_count', type: 'bigint', comment: '发布数' },
        { name: 'total_engagement', type: 'bigint', comment: '总互动数' },
        { name: 'total_reach', type: 'bigint', comment: '总触达数' },
        { name: 'avg_engagement_rate', type: 'decimal', comment: '平均互动率(%)' },
        { name: 'followers_total', type: 'bigint', comment: '总粉丝数' },
      ],
    ),

    // ─── SEO/SEM aggregations ───
    generateSummaryTable(
      'dws',
      'sem_keyword_daily_stats',
      'SEM关键词每日效果汇总',
      'dws',
      [
        { name: 'keyword_id', comment: '关键词ID' },
        { name: 'keyword', comment: '关键词' },
        { name: 'match_type', comment: '匹配模式' },
      ],
      [
        { name: 'impressions', type: 'bigint', comment: '展示数' },
        { name: 'clicks', type: 'bigint', comment: '点击数' },
        { name: 'cost', type: 'decimal', comment: '花费' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'ctr', type: 'decimal', comment: '点击率(%)' },
        { name: 'avg_cpc', type: 'decimal', comment: '平均CPC' },
        { name: 'quality_score', type: 'decimal', comment: '质量分' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'seo_keyword_weekly_ranking',
      'SEO关键词每周排名汇总',
      'dws',
      [
        { name: 'keyword', comment: '关键词' },
        { name: 'search_engine', comment: '搜索引擎' },
        { name: 'page_url', comment: '排名页面URL' },
      ],
      [
        { name: 'avg_position', type: 'decimal', comment: '平均排名' },
        { name: 'best_position', type: 'bigint', comment: '最佳排名' },
        { name: 'search_volume', type: 'bigint', comment: '搜索量' },
        { name: 'organic_clicks', type: 'bigint', comment: '自然点击数' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'seo_page_monthly_stats',
      'SEO页面月度流量汇总',
      'dws',
      [{ name: 'page_url', comment: '页面URL' }],
      [
        { name: 'organic_sessions', type: 'bigint', comment: '自然搜索会话数' },
        { name: 'organic_pageviews', type: 'bigint', comment: '自然搜索PV' },
        { name: 'avg_bounce_rate', type: 'decimal', comment: '平均跳出率(%)' },
        { name: 'avg_time_on_page', type: 'decimal', comment: '平均停留时长(秒)' },
        { name: 'backlink_count', type: 'bigint', comment: '反向链接数' },
      ],
    ),

    // ─── Landing page aggregations ───
    generateSummaryTable(
      'dws',
      'landing_page_daily_stats',
      '落地页每日效果汇总',
      'dws',
      [
        { name: 'page_id', comment: '落地页ID' },
        { name: 'page_name', comment: '落地页名称' },
      ],
      [
        { name: 'visits', type: 'bigint', comment: '访问数' },
        { name: 'unique_visitors', type: 'bigint', comment: '独立访客数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'bounce_count', type: 'bigint', comment: '跳出数' },
        { name: 'avg_time_on_page', type: 'decimal', comment: '平均停留时长(秒)' },
        { name: 'conversion_rate', type: 'decimal', comment: '转化率(%)' },
        { name: 'bounce_rate', type: 'decimal', comment: '跳出率(%)' },
      ],
    ),

    // ─── Coupon aggregations ───
    generateSummaryTable(
      'dws',
      'coupon_effectiveness',
      '优惠券效果汇总',
      'dws',
      [
        { name: 'coupon_id', comment: '优惠券ID' },
        { name: 'coupon_name', comment: '优惠券名称' },
        { name: 'coupon_type', comment: '优惠券类型' },
      ],
      [
        { name: 'distributed_count', type: 'bigint', comment: '发放数' },
        { name: 'used_count', type: 'bigint', comment: '使用数' },
        { name: 'total_discount', type: 'decimal', comment: '总优惠金额' },
        { name: 'total_order_amount', type: 'decimal', comment: '带来订单总额' },
        { name: 'usage_rate', type: 'decimal', comment: '核销率(%)' },
        { name: 'roi', type: 'decimal', comment: '优惠券ROI' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'coupon_daily_stats',
      '优惠券每日汇总',
      'dws',
      [{ name: 'coupon_id', comment: '优惠券ID' }],
      [
        { name: 'distributed_count', type: 'bigint', comment: '发放数' },
        { name: 'used_count', type: 'bigint', comment: '使用数' },
        { name: 'total_discount', type: 'decimal', comment: '优惠金额' },
        { name: 'total_order_amount', type: 'decimal', comment: '订单金额' },
      ],
    ),

    // ─── Affiliate aggregations ───
    generateSummaryTable(
      'dws',
      'affiliate_monthly_stats',
      '联盟分销商月度汇总',
      'dws',
      [
        { name: 'affiliate_id', comment: '分销商ID' },
        { name: 'affiliate_name', comment: '分销商名称' },
        { name: 'month', comment: '月份' },
      ],
      [
        { name: 'clicks', type: 'bigint', comment: '推广点击数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'order_amount', type: 'decimal', comment: '订单金额' },
        { name: 'commission_amount', type: 'decimal', comment: '佣金金额' },
        { name: 'conversion_rate', type: 'decimal', comment: '转化率(%)' },
      ],
    ),

    // ─── A/B test aggregations ───
    generateSummaryTable(
      'dws',
      'ab_experiment_variant_stats',
      'A/B实验变体效果汇总',
      'dws',
      [
        { name: 'experiment_id', comment: '实验ID' },
        { name: 'variant_id', comment: '变体ID' },
        { name: 'variant_name', comment: '变体名称' },
      ],
      [
        { name: 'sample_size', type: 'bigint', comment: '样本量' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'conversion_rate', type: 'decimal', comment: '转化率(%)' },
        { name: 'avg_metric_value', type: 'decimal', comment: '平均指标值' },
        { name: 'p_value', type: 'decimal', comment: 'P值' },
        { name: 'confidence_level', type: 'decimal', comment: '置信度(%)' },
        { name: 'lift', type: 'decimal', comment: '提升幅度(%)' },
      ],
    ),
    generateSummaryTable(
      'dws',
      'ab_experiment_daily_stats',
      'A/B实验每日汇总',
      'dws',
      [
        { name: 'experiment_id', comment: '实验ID' },
        { name: 'variant_id', comment: '变体ID' },
      ],
      [
        { name: 'new_assignments', type: 'bigint', comment: '新分组用户数' },
        { name: 'events_count', type: 'bigint', comment: '事件数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'metric_sum', type: 'decimal', comment: '指标累计值' },
      ],
    ),

    // ─── Content marketing aggregations ───
    generateSummaryTable(
      'dws',
      'content_daily_stats',
      '内容营销每日汇总',
      'dws',
      [
        { name: 'article_id', comment: '文章ID' },
        { name: 'content_format', comment: '内容格式' },
      ],
      [
        { name: 'views', type: 'bigint', comment: '浏览数' },
        { name: 'reads', type: 'bigint', comment: '阅读数' },
        { name: 'shares', type: 'bigint', comment: '分享数' },
        { name: 'comments', type: 'bigint', comment: '评论数' },
        { name: 'downloads', type: 'bigint', comment: '下载数' },
        { name: 'avg_read_duration', type: 'decimal', comment: '平均阅读时长(秒)' },
        { name: 'avg_read_progress', type: 'decimal', comment: '平均阅读进度(%)' },
      ],
    ),

    // ─── Budget tracking ───
    generateSummaryTable(
      'dws',
      'budget_utilization_monthly',
      '月度预算执行汇总',
      'dws',
      [
        { name: 'channel_id', comment: '渠道ID' },
        { name: 'channel_name', comment: '渠道名称' },
        { name: 'month', comment: '月份' },
      ],
      [
        { name: 'planned_budget', type: 'decimal', comment: '计划预算' },
        { name: 'actual_spend', type: 'decimal', comment: '实际花费' },
        { name: 'utilization_rate', type: 'decimal', comment: '预算执行率(%)' },
        { name: 'remaining_budget', type: 'decimal', comment: '剩余预算' },
      ],
    ),

    // ─── Cross-channel funnel ───
    generateSummaryTable(
      'dws',
      'funnel_conversion_daily',
      '转化漏斗每日汇总',
      'dws',
      [
        { name: 'campaign_id', comment: '活动ID' },
        { name: 'channel_id', comment: '渠道ID' },
      ],
      [
        { name: 'impressions', type: 'bigint', comment: '曝光数' },
        { name: 'clicks', type: 'bigint', comment: '点击数' },
        { name: 'landing_visits', type: 'bigint', comment: '落地页访问数' },
        { name: 'leads', type: 'bigint', comment: '线索数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'impression_to_click_rate', type: 'decimal', comment: '曝光→点击率(%)' },
        { name: 'click_to_visit_rate', type: 'decimal', comment: '点击→访问率(%)' },
        { name: 'visit_to_lead_rate', type: 'decimal', comment: '访问→线索率(%)' },
        { name: 'lead_to_conversion_rate', type: 'decimal', comment: '线索→转化率(%)' },
      ],
    ),

    // ─── Automation aggregations ───
    generateSummaryTable(
      'dws', 'automation_workflow_stats', '自动化工作流效果汇总', 'dws',
      [
        { name: 'workflow_id', comment: '工作流ID' },
        { name: 'workflow_name', comment: '工作流名称' },
      ],
      [
        { name: 'total_triggered', type: 'bigint', comment: '触发次数' },
        { name: 'completed', type: 'bigint', comment: '完成次数' },
        { name: 'failed', type: 'bigint', comment: '失败次数' },
        { name: 'completion_rate', type: 'decimal', comment: '完成率(%)' },
        { name: 'avg_completion_time_hours', type: 'decimal', comment: '平均完成时长(小时)' },
      ],
    ),
    generateSummaryTable(
      'dws', 'spend_daily_by_objective', '投放目标维度每日花费汇总', 'dws',
      [
        { name: 'objective', comment: '活动目标' },
        { name: 'channel_type', comment: '渠道类型' },
      ],
      [
        { name: 'spend_amount', type: 'decimal', comment: '花费金额' },
        { name: 'impressions', type: 'bigint', comment: '展示数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'revenue', type: 'decimal', comment: '收入' },
        { name: 'roas', type: 'decimal', comment: 'ROAS' },
      ],
    ),
    generateSummaryTable(
      'dws', 'device_targeting_stats', '设备定向投放效果汇总', 'dws',
      [
        { name: 'device_type', comment: '设备类型' },
        { name: 'os', comment: '操作系统' },
      ],
      [
        { name: 'impressions', type: 'bigint', comment: '展示数' },
        { name: 'clicks', type: 'bigint', comment: '点击数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'ctr', type: 'decimal', comment: '点击率(%)' },
        { name: 'cvr', type: 'decimal', comment: '转化率(%)' },
        { name: 'cpa', type: 'decimal', comment: 'CPA' },
      ],
    ),
    generateSummaryTable(
      'dws', 'hourly_performance_stats', '分时段投放效果汇总', 'dws',
      [
        { name: 'hour_of_day', comment: '小时(0-23)' },
        { name: 'day_of_week', comment: '周几(1-7)' },
      ],
      [
        { name: 'impressions', type: 'bigint', comment: '展示数' },
        { name: 'clicks', type: 'bigint', comment: '点击数' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'spend_amount', type: 'decimal', comment: '花费金额' },
        { name: 'ctr', type: 'decimal', comment: '点击率(%)' },
        { name: 'cpa', type: 'decimal', comment: 'CPA' },
      ],
    ),

    /* ===================================================================
     *  ADS Layer (~35 tables) — 应用层
     * =================================================================== */

    // ─── Executive dashboards ───
    generateSummaryTable(
      'ads',
      'realtime_marketing_dashboard',
      '营销实时看板',
      'ads',
      [
        { name: 'channel_name', comment: '渠道名称' },
        { name: 'campaign_name', comment: '活动名称' },
      ],
      [
        { name: 'impressions_today', type: 'bigint', comment: '今日展示数' },
        { name: 'clicks_today', type: 'bigint', comment: '今日点击数' },
        { name: 'conversions_today', type: 'bigint', comment: '今日转化数' },
        { name: 'spend_today', type: 'decimal', comment: '今日花费' },
        { name: 'revenue_today', type: 'decimal', comment: '今日收入' },
        { name: 'ctr_today', type: 'decimal', comment: '今日CTR(%)' },
        { name: 'roas_today', type: 'decimal', comment: '今日ROAS' },
      ],
    ),
    generateSummaryTable(
      'ads',
      'marketing_overview_monthly',
      '营销月度总览报表',
      'ads',
      [{ name: 'month', comment: '月份' }],
      [
        { name: 'total_spend', type: 'decimal', comment: '总花费' },
        { name: 'total_revenue', type: 'decimal', comment: '总收入' },
        { name: 'total_conversions', type: 'bigint', comment: '总转化数' },
        { name: 'overall_roas', type: 'decimal', comment: '整体ROAS' },
        { name: 'overall_cpa', type: 'decimal', comment: '整体CPA' },
        { name: 'overall_ctr', type: 'decimal', comment: '整体CTR(%)' },
        { name: 'new_customers', type: 'bigint', comment: '新客户数' },
        { name: 'customer_acquisition_cost', type: 'decimal', comment: '获客成本' },
      ],
    ),

    // ─── ROI analysis ───
    generateSummaryTable(
      'ads',
      'campaign_roi_analysis',
      '活动ROI分析',
      'ads',
      [
        { name: 'campaign_id', comment: '活动ID' },
        { name: 'campaign_name', comment: '活动名称' },
        { name: 'campaign_type', comment: '活动类型' },
      ],
      [
        { name: 'total_spend', type: 'decimal', comment: '总花费' },
        { name: 'total_revenue', type: 'decimal', comment: '总收入' },
        { name: 'net_profit', type: 'decimal', comment: '净利润' },
        { name: 'roi', type: 'decimal', comment: 'ROI(%)' },
        { name: 'roas', type: 'decimal', comment: 'ROAS' },
        { name: 'payback_days', type: 'bigint', comment: '回本天数' },
      ],
    ),
    generateSummaryTable(
      'ads',
      'channel_roi_comparison',
      '渠道ROI对比',
      'ads',
      [
        { name: 'channel_id', comment: '渠道ID' },
        { name: 'channel_name', comment: '渠道名称' },
        { name: 'channel_type', comment: '渠道类型' },
      ],
      [
        { name: 'total_spend', type: 'decimal', comment: '总花费' },
        { name: 'total_revenue', type: 'decimal', comment: '总收入' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'cpa', type: 'decimal', comment: 'CPA' },
        { name: 'roas', type: 'decimal', comment: 'ROAS' },
        { name: 'contribution_rate', type: 'decimal', comment: '收入贡献占比(%)' },
      ],
    ),

    // ─── Attribution models ───
    generateSummaryTable(
      'ads',
      'channel_attribution_model',
      '渠道多触点归因模型',
      'ads',
      [
        { name: 'channel_id', comment: '渠道ID' },
        { name: 'channel_name', comment: '渠道名称' },
      ],
      [
        { name: 'first_touch_revenue', type: 'decimal', comment: '首次触点归因收入' },
        { name: 'last_touch_revenue', type: 'decimal', comment: '末次触点归因收入' },
        { name: 'linear_revenue', type: 'decimal', comment: '线性归因收入' },
        { name: 'time_decay_revenue', type: 'decimal', comment: '时间衰减归因收入' },
        { name: 'position_based_revenue', type: 'decimal', comment: '位置归因收入' },
        { name: 'data_driven_revenue', type: 'decimal', comment: '数据驱动归因收入' },
      ],
    ),
    generateSummaryTable(
      'ads',
      'attribution_model_comparison',
      '归因模型对比分析',
      'ads',
      [
        { name: 'attribution_model', comment: '归因模型' },
        { name: 'channel_name', comment: '渠道名称' },
      ],
      [
        { name: 'attributed_conversions', type: 'decimal', comment: '归因转化数' },
        { name: 'attributed_revenue', type: 'decimal', comment: '归因收入' },
        { name: 'share_of_credit', type: 'decimal', comment: '贡献占比(%)' },
      ],
    ),

    // ─── Audience insights ───
    generateSummaryTable(
      'ads',
      'audience_insight_report',
      '人群洞察报告',
      'ads',
      [
        { name: 'segment_id', comment: '人群包ID' },
        { name: 'segment_name', comment: '人群包名称' },
      ],
      [
        { name: 'segment_size', type: 'bigint', comment: '人群规模' },
        { name: 'avg_conversion_rate', type: 'decimal', comment: '平均转化率(%)' },
        { name: 'avg_order_value', type: 'decimal', comment: '平均客单价' },
        { name: 'ltv_estimate', type: 'decimal', comment: '预估LTV' },
        { name: 'best_channel', type: 'bigint', comment: '最佳渠道ID' },
        { name: 'best_time_slot', type: 'bigint', comment: '最佳时段' },
      ],
    ),
    generateSummaryTable(
      'ads',
      'audience_expansion_recommendation',
      '人群扩展推荐',
      'ads',
      [
        { name: 'source_segment_id', comment: '源人群包ID' },
        { name: 'recommended_segment_id', comment: '推荐人群包ID' },
      ],
      [
        { name: 'similarity_score', type: 'decimal', comment: '相似度分数' },
        { name: 'expected_cvr_lift', type: 'decimal', comment: '预期转化提升(%)' },
        { name: 'incremental_reach', type: 'bigint', comment: '增量触达人数' },
      ],
    ),

    // ─── A/B test results ───
    generateSummaryTable(
      'ads',
      'ab_test_results',
      'A/B测试结果报告',
      'ads',
      [
        { name: 'experiment_id', comment: '实验ID' },
        { name: 'experiment_name', comment: '实验名称' },
        { name: 'winner_variant', comment: '胜出变体' },
      ],
      [
        { name: 'control_conversion_rate', type: 'decimal', comment: '对照组转化率(%)' },
        { name: 'treatment_conversion_rate', type: 'decimal', comment: '实验组转化率(%)' },
        { name: 'absolute_lift', type: 'decimal', comment: '绝对提升(%)' },
        { name: 'relative_lift', type: 'decimal', comment: '相对提升(%)' },
        { name: 'p_value', type: 'decimal', comment: 'P值' },
        { name: 'is_significant', type: 'bigint', comment: '是否统计显著(0/1)' },
        { name: 'estimated_annual_impact', type: 'decimal', comment: '预估年度影响(元)' },
      ],
    ),

    // ─── Email analytics ───
    generateSummaryTable(
      'ads',
      'email_performance_report',
      '邮件营销效果报告',
      'ads',
      [
        { name: 'campaign_id', comment: '活动ID' },
        { name: 'campaign_name', comment: '活动名称' },
      ],
      [
        { name: 'total_sent', type: 'bigint', comment: '发送总数' },
        { name: 'open_rate', type: 'decimal', comment: '打开率(%)' },
        { name: 'click_rate', type: 'decimal', comment: '点击率(%)' },
        { name: 'conversion_rate', type: 'decimal', comment: '转化率(%)' },
        { name: 'revenue_per_email', type: 'decimal', comment: '每封邮件收入' },
        { name: 'unsubscribe_rate', type: 'decimal', comment: '退订率(%)' },
        { name: 'spam_rate', type: 'decimal', comment: '垃圾邮件率(%)' },
      ],
    ),

    // ─── Social media analytics ───
    generateSummaryTable(
      'ads',
      'social_media_overview',
      '社媒运营总览',
      'ads',
      [
        { name: 'platform', comment: '平台' },
        { name: 'account_name', comment: '账号名称' },
      ],
      [
        { name: 'followers_count', type: 'bigint', comment: '粉丝数' },
        { name: 'followers_growth_rate', type: 'decimal', comment: '粉丝增长率(%)' },
        { name: 'avg_engagement_rate', type: 'decimal', comment: '平均互动率(%)' },
        { name: 'top_post_views', type: 'bigint', comment: '最热帖子浏览数' },
        { name: 'total_reach_30d', type: 'bigint', comment: '近30日总触达' },
        { name: 'content_count_30d', type: 'bigint', comment: '近30日发布数' },
      ],
    ),
    generateSummaryTable(
      'ads',
      'social_content_ranking',
      '社媒内容排行榜',
      'ads',
      [
        { name: 'post_id', comment: '内容ID' },
        { name: 'platform', comment: '平台' },
        { name: 'content_type', comment: '内容类型' },
      ],
      [
        { name: 'views', type: 'bigint', comment: '浏览数' },
        { name: 'engagement_score', type: 'decimal', comment: '互动得分' },
        { name: 'shares', type: 'bigint', comment: '转发数' },
        { name: 'ranking', type: 'bigint', comment: '排名' },
      ],
    ),

    // ─── SEO/SEM analytics ───
    generateSummaryTable(
      'ads',
      'sem_performance_report',
      'SEM投放效果报告',
      'ads',
      [
        { name: 'campaign_id', comment: '活动ID' },
        { name: 'channel_name', comment: '搜索引擎' },
      ],
      [
        { name: 'total_impressions', type: 'bigint', comment: '总展示数' },
        { name: 'total_clicks', type: 'bigint', comment: '总点击数' },
        { name: 'total_cost', type: 'decimal', comment: '总花费' },
        { name: 'total_conversions', type: 'bigint', comment: '总转化数' },
        { name: 'avg_cpc', type: 'decimal', comment: '平均CPC' },
        { name: 'avg_ctr', type: 'decimal', comment: '平均CTR(%)' },
        { name: 'roas', type: 'decimal', comment: 'ROAS' },
      ],
    ),
    generateSummaryTable(
      'ads',
      'seo_health_report',
      'SEO健康度报告',
      'ads',
      [{ name: 'domain', comment: '域名' }],
      [
        { name: 'total_keywords_ranked', type: 'bigint', comment: '排名关键词数' },
        { name: 'top10_keywords', type: 'bigint', comment: 'Top10关键词数' },
        { name: 'organic_traffic', type: 'bigint', comment: '自然搜索流量' },
        { name: 'avg_bounce_rate', type: 'decimal', comment: '平均跳出率(%)' },
        { name: 'domain_authority', type: 'bigint', comment: '域名权重' },
        { name: 'total_backlinks', type: 'bigint', comment: '总反向链接数' },
      ],
    ),

    // ─── Landing page analytics ───
    generateSummaryTable(
      'ads',
      'landing_page_performance',
      '落地页效果报告',
      'ads',
      [
        { name: 'page_id', comment: '落地页ID' },
        { name: 'page_name', comment: '落地页名称' },
        { name: 'campaign_name', comment: '活动名称' },
      ],
      [
        { name: 'total_visits', type: 'bigint', comment: '总访问数' },
        { name: 'unique_visitors', type: 'bigint', comment: '独立访客数' },
        { name: 'conversion_rate', type: 'decimal', comment: '转化率(%)' },
        { name: 'bounce_rate', type: 'decimal', comment: '跳出率(%)' },
        { name: 'avg_time_on_page', type: 'decimal', comment: '平均停留时长(秒)' },
        { name: 'cost_per_visit', type: 'decimal', comment: '单次访问成本' },
      ],
    ),

    // ─── Coupon analytics ───
    generateSummaryTable(
      'ads',
      'coupon_roi_report',
      '优惠券ROI报告',
      'ads',
      [
        { name: 'coupon_id', comment: '优惠券ID' },
        { name: 'coupon_name', comment: '优惠券名称' },
        { name: 'coupon_type', comment: '优惠券类型' },
      ],
      [
        { name: 'distributed_count', type: 'bigint', comment: '发放数' },
        { name: 'used_count', type: 'bigint', comment: '使用数' },
        { name: 'usage_rate', type: 'decimal', comment: '核销率(%)' },
        { name: 'total_discount', type: 'decimal', comment: '总优惠金额' },
        { name: 'incremental_revenue', type: 'decimal', comment: '增量收入' },
        { name: 'roi', type: 'decimal', comment: 'ROI' },
      ],
    ),

    // ─── Affiliate analytics ───
    generateSummaryTable(
      'ads',
      'affiliate_performance_ranking',
      '联盟分销商排行榜',
      'ads',
      [
        { name: 'affiliate_id', comment: '分销商ID' },
        { name: 'affiliate_name', comment: '分销商名称' },
      ],
      [
        { name: 'total_clicks', type: 'bigint', comment: '总点击数' },
        { name: 'total_conversions', type: 'bigint', comment: '总转化数' },
        { name: 'total_revenue', type: 'decimal', comment: '总收入' },
        { name: 'total_commission', type: 'decimal', comment: '总佣金' },
        { name: 'conversion_rate', type: 'decimal', comment: '转化率(%)' },
        { name: 'ranking', type: 'bigint', comment: '排名' },
      ],
    ),

    // ─── Customer acquisition ───
    generateSummaryTable(
      'ads',
      'customer_acquisition_analysis',
      '获客分析',
      'ads',
      [
        { name: 'channel_id', comment: '渠道ID' },
        { name: 'channel_name', comment: '渠道名称' },
        { name: 'month', comment: '月份' },
      ],
      [
        { name: 'new_customers', type: 'bigint', comment: '新客户数' },
        { name: 'acquisition_cost', type: 'decimal', comment: '获客成本' },
        { name: 'first_purchase_revenue', type: 'decimal', comment: '首购收入' },
        { name: 'ltv_30d', type: 'decimal', comment: '30天LTV' },
        { name: 'ltv_90d', type: 'decimal', comment: '90天LTV' },
        { name: 'payback_period_days', type: 'bigint', comment: '回本周期(天)' },
      ],
    ),

    // ─── Cross-channel reports ───
    generateSummaryTable(
      'ads',
      'cross_channel_journey',
      '跨渠道用户旅程',
      'ads',
      [
        { name: 'journey_pattern', comment: '旅程模式' },
        { name: 'channel_sequence', comment: '渠道序列' },
      ],
      [
        { name: 'journey_count', type: 'bigint', comment: '旅程数' },
        { name: 'conversion_count', type: 'bigint', comment: '转化数' },
        { name: 'avg_touchpoints', type: 'decimal', comment: '平均触点数' },
        { name: 'avg_days_to_convert', type: 'decimal', comment: '平均转化天数' },
        { name: 'total_revenue', type: 'decimal', comment: '总收入' },
      ],
    ),
    generateSummaryTable(
      'ads',
      'marketing_mix_model',
      '营销组合模型(MMM)',
      'ads',
      [
        { name: 'channel_name', comment: '渠道名称' },
        { name: 'period', comment: '分析周期' },
      ],
      [
        { name: 'spend_share', type: 'decimal', comment: '花费占比(%)' },
        { name: 'revenue_share', type: 'decimal', comment: '收入占比(%)' },
        { name: 'marginal_roas', type: 'decimal', comment: '边际ROAS' },
        { name: 'saturation_point', type: 'decimal', comment: '饱和点(元)' },
        { name: 'recommended_budget', type: 'decimal', comment: '建议预算(元)' },
      ],
    ),

    // ─── Content marketing analytics ───
    generateSummaryTable(
      'ads',
      'content_performance_report',
      '内容营销效果报告',
      'ads',
      [
        { name: 'article_id', comment: '文章ID' },
        { name: 'title', comment: '文章标题' },
        { name: 'content_format', comment: '内容格式' },
      ],
      [
        { name: 'total_views', type: 'bigint', comment: '总浏览数' },
        { name: 'total_reads', type: 'bigint', comment: '总阅读数' },
        { name: 'avg_read_progress', type: 'decimal', comment: '平均阅读完成率(%)' },
        { name: 'total_shares', type: 'bigint', comment: '总分享数' },
        { name: 'lead_conversions', type: 'bigint', comment: '线索转化数' },
      ],
    ),

    // ─── Push analytics ───
    generateSummaryTable(
      'ads',
      'push_effectiveness_report',
      'Push推送效果报告',
      'ads',
      [
        { name: 'push_campaign_id', comment: '推送活动ID' },
        { name: 'platform', comment: '平台' },
      ],
      [
        { name: 'total_sent', type: 'bigint', comment: '发送数' },
        { name: 'delivery_rate', type: 'decimal', comment: '送达率(%)' },
        { name: 'open_rate', type: 'decimal', comment: '打开率(%)' },
        { name: 'conversion_rate', type: 'decimal', comment: '转化率(%)' },
        { name: 'revenue_per_push', type: 'decimal', comment: '每次推送收入' },
      ],
    ),

    // ─── Budget optimization ───
    generateSummaryTable(
      'ads',
      'budget_optimization_suggestion',
      '预算优化建议',
      'ads',
      [
        { name: 'channel_id', comment: '渠道ID' },
        { name: 'channel_name', comment: '渠道名称' },
      ],
      [
        { name: 'current_budget', type: 'decimal', comment: '当前预算' },
        { name: 'current_roas', type: 'decimal', comment: '当前ROAS' },
        { name: 'suggested_budget', type: 'decimal', comment: '建议预算' },
        { name: 'expected_roas', type: 'decimal', comment: '预期ROAS' },
        { name: 'expected_incremental_revenue', type: 'decimal', comment: '预期增量收入' },
      ],
    ),

    // ─── Executive summary reports ───
    generateSummaryTable(
      'ads',
      'daily_marketing_report',
      '营销日报',
      'ads',
      [{ name: 'report_date', comment: '报告日期' }],
      [
        { name: 'total_spend', type: 'decimal', comment: '总花费' },
        { name: 'total_impressions', type: 'bigint', comment: '总展示数' },
        { name: 'total_clicks', type: 'bigint', comment: '总点击数' },
        { name: 'total_conversions', type: 'bigint', comment: '总转化数' },
        { name: 'total_revenue', type: 'decimal', comment: '总收入' },
        { name: 'overall_ctr', type: 'decimal', comment: '整体CTR(%)' },
        { name: 'overall_cvr', type: 'decimal', comment: '整体CVR(%)' },
        { name: 'overall_roas', type: 'decimal', comment: '整体ROAS' },
        { name: 'overall_cpa', type: 'decimal', comment: '整体CPA' },
      ],
    ),
    generateSummaryTable(
      'ads',
      'weekly_marketing_report',
      '营销周报',
      'ads',
      [{ name: 'week_start', comment: '周开始日期' }],
      [
        { name: 'total_spend', type: 'decimal', comment: '总花费' },
        { name: 'total_revenue', type: 'decimal', comment: '总收入' },
        { name: 'total_conversions', type: 'bigint', comment: '总转化数' },
        { name: 'overall_roas', type: 'decimal', comment: '整体ROAS' },
        { name: 'top_campaign', type: 'bigint', comment: '最佳活动ID' },
        { name: 'top_channel', type: 'bigint', comment: '最佳渠道ID' },
        { name: 'wow_spend_change', type: 'decimal', comment: '花费周环比(%)' },
        { name: 'wow_revenue_change', type: 'decimal', comment: '收入周环比(%)' },
      ],
    ),

    // ─── Automation analytics ───
    generateSummaryTable(
      'ads', 'automation_effectiveness_report', '自动化营销效果报告', 'ads',
      [
        { name: 'workflow_id', comment: '工作流ID' },
        { name: 'workflow_name', comment: '工作流名称' },
      ],
      [
        { name: 'total_triggered', type: 'bigint', comment: '触发次数' },
        { name: 'completion_rate', type: 'decimal', comment: '完成率(%)' },
        { name: 'conversions', type: 'bigint', comment: '转化数' },
        { name: 'revenue', type: 'decimal', comment: '产生收入' },
        { name: 'cost_per_conversion', type: 'decimal', comment: '单次转化成本' },
      ],
    ),

    // ─── Competitive benchmarking ───
    generateSummaryTable(
      'ads', 'channel_benchmark_report', '渠道效果基准对比', 'ads',
      [
        { name: 'channel_name', comment: '渠道名称' },
        { name: 'metric_name', comment: '指标名称' },
      ],
      [
        { name: 'our_value', type: 'decimal', comment: '我方数值' },
        { name: 'industry_avg', type: 'decimal', comment: '行业平均值' },
        { name: 'industry_p75', type: 'decimal', comment: '行业75分位' },
        { name: 'gap_to_avg', type: 'decimal', comment: '与均值差距(%)' },
      ],
    ),

    // ─── Incrementality testing ───
    generateSummaryTable(
      'ads', 'incrementality_test_results', '增量测试结果', 'ads',
      [
        { name: 'test_id', comment: '测试ID' },
        { name: 'channel_name', comment: '渠道名称' },
      ],
      [
        { name: 'control_conversions', type: 'bigint', comment: '对照组转化数' },
        { name: 'treatment_conversions', type: 'bigint', comment: '实验组转化数' },
        { name: 'incremental_conversions', type: 'bigint', comment: '增量转化数' },
        { name: 'incrementality_rate', type: 'decimal', comment: '增量率(%)' },
        { name: 'true_roas', type: 'decimal', comment: '真实ROAS' },
      ],
    ),

    // ─── Frequency capping ───
    generateSummaryTable(
      'ads', 'frequency_impact_analysis', '广告频次影响分析', 'ads',
      [
        { name: 'frequency_bucket', comment: '频次区间' },
        { name: 'channel_name', comment: '渠道名称' },
      ],
      [
        { name: 'user_count', type: 'bigint', comment: '用户数' },
        { name: 'conversion_rate', type: 'decimal', comment: '转化率(%)' },
        { name: 'avg_cpa', type: 'decimal', comment: '平均CPA' },
        { name: 'fatigue_score', type: 'decimal', comment: '疲劳度评分' },
      ],
    ),

    // ─── SMS analytics ───
    generateSummaryTable(
      'ads', 'sms_effectiveness_report', '短信营销效果报告', 'ads',
      [{ name: 'sms_campaign_id', comment: '短信活动ID' }],
      [
        { name: 'total_sent', type: 'bigint', comment: '发送数' },
        { name: 'delivery_rate', type: 'decimal', comment: '送达率(%)' },
        { name: 'click_rate', type: 'decimal', comment: '点击率(%)' },
        { name: 'conversion_rate', type: 'decimal', comment: '转化率(%)' },
        { name: 'cost_per_send', type: 'decimal', comment: '单条成本' },
        { name: 'revenue_per_send', type: 'decimal', comment: '单条收入' },
      ],
    ),

    // ─── Keyword analytics ───
    generateSummaryTable(
      'ads', 'keyword_opportunity_report', '关键词机会分析', 'ads',
      [
        { name: 'keyword', comment: '关键词' },
        { name: 'source', comment: '来源: seo/sem' },
      ],
      [
        { name: 'search_volume', type: 'bigint', comment: '搜索量' },
        { name: 'current_position', type: 'bigint', comment: '当前排名' },
        { name: 'estimated_traffic', type: 'bigint', comment: '预估流量' },
        { name: 'competition_level', type: 'decimal', comment: '竞争程度' },
        { name: 'opportunity_score', type: 'decimal', comment: '机会评分' },
      ],
    ),

    // ─── Creative insights ───
    generateSummaryTable(
      'ads', 'creative_fatigue_monitor', '素材疲劳度监控', 'ads',
      [
        { name: 'creative_id', comment: '素材ID' },
        { name: 'creative_name', comment: '素材名称' },
        { name: 'days_active', comment: '投放天数' },
      ],
      [
        { name: 'initial_ctr', type: 'decimal', comment: '初始CTR(%)' },
        { name: 'current_ctr', type: 'decimal', comment: '当前CTR(%)' },
        { name: 'ctr_decay_rate', type: 'decimal', comment: 'CTR衰减率(%)' },
        { name: 'recommended_action', type: 'bigint', comment: '建议动作(1=继续/2=优化/3=下线)' },
      ],
    ),
  ],

  /* ===================================================================
   *  Metrics (8)
   * =================================================================== */
  metrics: [
    {
      name: 'cpa',
      displayName: 'CPA（单次转化成本）',
      expression: 'SUM(spend_amount) / NULLIF(SUM(conversions), 0)',
      metricType: 'derived',
      sourceTable: 'dws_campaign_daily_stats',
      dimensions: ['campaign_id', 'channel_id', 'ds'],
      granularity: ['day', 'week', 'month'],
      format: 'currency',
      description: '获取一次转化所需的平均花费',
    },
    {
      name: 'roas',
      displayName: 'ROAS（广告回报率）',
      expression: 'SUM(revenue) / NULLIF(SUM(spend_amount), 0)',
      metricType: 'derived',
      sourceTable: 'dws_campaign_daily_stats',
      dimensions: ['campaign_id', 'channel_id', 'ds'],
      granularity: ['day', 'week', 'month'],
      format: 'number',
      description: '每投入1元广告费带来的收入',
    },
    {
      name: 'ctr',
      displayName: 'CTR（点击率）',
      expression: 'SUM(clicks) * 100.0 / NULLIF(SUM(impressions), 0)',
      metricType: 'derived',
      sourceTable: 'dws_campaign_daily_stats',
      dimensions: ['campaign_id', 'channel_id', 'creative_type'],
      granularity: ['day', 'week', 'month'],
      format: 'percentage',
      description: '广告被点击次数占展示次数的比例',
    },
    {
      name: 'conversion_rate',
      displayName: '转化率',
      expression: 'SUM(conversions) * 100.0 / NULLIF(SUM(clicks), 0)',
      metricType: 'derived',
      sourceTable: 'dws_campaign_daily_stats',
      dimensions: ['campaign_id', 'channel_id'],
      granularity: ['day', 'week', 'month'],
      format: 'percentage',
      description: '点击后发生转化行为的比例',
    },
    {
      name: 'customer_acquisition_cost',
      displayName: '获客成本（CAC）',
      expression: 'SUM(total_spend) / NULLIF(SUM(new_customers), 0)',
      metricType: 'derived',
      sourceTable: 'ads_marketing_overview_monthly',
      dimensions: ['month'],
      granularity: ['month', 'quarter'],
      format: 'currency',
      description: '获取一个新客户所需的平均营销成本',
    },
    {
      name: 'campaign_roi',
      displayName: '活动ROI',
      expression: '(SUM(total_revenue) - SUM(total_spend)) * 100.0 / NULLIF(SUM(total_spend), 0)',
      metricType: 'derived',
      sourceTable: 'ads_campaign_roi_analysis',
      dimensions: ['campaign_id', 'campaign_type'],
      format: 'percentage',
      description: '活动净利润占总投入的百分比',
    },
    {
      name: 'email_open_rate',
      displayName: '邮件打开率',
      expression: 'SUM(opened) * 100.0 / NULLIF(SUM(delivered), 0)',
      metricType: 'derived',
      sourceTable: 'dws_email_campaign_stats',
      dimensions: ['email_campaign_id', 'campaign_id'],
      granularity: ['day', 'week'],
      format: 'percentage',
      description: '邮件被打开次数占成功投递数的比例',
    },
    {
      name: 'social_engagement_rate',
      displayName: '社媒互动率',
      expression:
        '(SUM(total_likes) + SUM(total_comments) + SUM(total_shares)) * 100.0 / NULLIF(SUM(total_reach), 0)',
      metricType: 'composite',
      sourceTable: 'dws_social_account_daily_stats',
      dimensions: ['account_id', 'platform'],
      granularity: ['day', 'week', 'month'],
      format: 'percentage',
      description: '社媒内容互动（点赞+评论+转发）占触达人数的比例',
    },
  ],

  /* ===================================================================
   *  Glossary (8)
   * =================================================================== */
  glossary: [
    {
      term: 'CPA',
      sqlExpression: 'SUM(spend_amount) / NULLIF(SUM(conversions), 0)',
      description: 'Cost Per Action，单次转化成本，总花费除以转化次数',
    },
    {
      term: 'ROAS',
      sqlExpression: 'SUM(revenue) / NULLIF(SUM(spend_amount), 0)',
      description: 'Return On Ad Spend，广告回报率，广告带来的收入除以广告花费',
    },
    {
      term: 'CTR',
      sqlExpression: 'SUM(clicks) * 100.0 / NULLIF(SUM(impressions), 0)',
      description: 'Click-Through Rate，点击率，点击次数除以展示次数的百分比',
    },
    {
      term: '转化率',
      sqlExpression: 'SUM(conversions) * 100.0 / NULLIF(SUM(clicks), 0)',
      description: '从点击到完成目标行为（如购买、注册）的比率',
    },
    {
      term: '获客成本',
      sqlExpression: 'SUM(spend_amount) / NULLIF(SUM(new_customers), 0)',
      description: 'Customer Acquisition Cost（CAC），获取一个新客户所需的平均营销成本',
    },
    {
      term: '归因模型',
      sqlExpression:
        "CASE attribution_model WHEN 'last_click' THEN '末次点击' WHEN 'first_click' THEN '首次点击' WHEN 'linear' THEN '线性' WHEN 'time_decay' THEN '时间衰减' WHEN 'position' THEN '位置' END",
      description:
        '将转化功劳分配给各触点的规则，常见模型：末次点击、首次点击、线性、时间衰减、位置归因',
    },
    {
      term: '人群包',
      sqlExpression:
        "SELECT segment_name, segment_type, actual_size FROM dim_audience_segment WHERE status = 'ready'",
      description:
        'DMP 中按规则或算法圈选的用户集合，用于精准投放定向。类型包括规则圈选、Lookalike、上传、实时人群',
    },
    {
      term: '触达率',
      sqlExpression: 'SUM(reached_users) * 100.0 / NULLIF(SUM(targeted_users), 0)',
      description: '实际触达人数占目标人群总数的百分比，衡量投放覆盖效果',
    },
  ],

  /* ===================================================================
   *  Knowledge Docs (1)
   * =================================================================== */
  knowledgeDocs: [
    {
      title: '营销投放核心指标口径说明',
      docType: 'document',
      content: `# 营销投放核心指标口径

## CPA（单次转化成本）
- 定义：总广告花费 / 转化次数
- 注意：分母为 0 时返回 NULL（NULLIF 处理）
- 表：dws_campaign_daily_stats
- 字段：spend_amount, conversions

## ROAS（广告回报率）
- 定义：广告带来的收入 / 广告花费
- ROAS > 1 表示收入大于投入，业界基准约 3-5
- 表：dws_campaign_daily_stats
- 字段：revenue, spend_amount

## CTR（点击率）
- 定义：点击次数 / 展示次数 × 100%
- 搜索广告基准 2-5%，展示广告基准 0.3-0.8%
- 表：dws_campaign_daily_stats
- 字段：clicks, impressions

## 多触点归因模型
- 末次点击（Last Click）：100% 归因给最后一个触点
- 首次点击（First Click）：100% 归因给第一个触点
- 线性归因（Linear）：平均分配给所有触点
- 时间衰减（Time Decay）：越靠近转化的触点权重越高
- 位置归因（Position Based）：首末各 40%，中间均分 20%
- 数据驱动（Data Driven）：基于算法自动分配权重
- 表：fact_conversions, fact_attribution_paths
- 字段：attribution_model, attribution_weight

## 转化漏斗
- 曝光 → 点击 → 落地页访问 → 线索 → 转化
- 各环节转化率 = 下一环节数 / 当前环节数 × 100%
- 表：dws_funnel_conversion_daily

## 邮件营销指标
- 打开率 = 打开数 / 送达数 × 100%（行业基准 15-25%）
- 点击率 = 点击数 / 送达数 × 100%（行业基准 2-5%）
- 退订率 < 0.5% 为健康水平
- 表：dws_email_campaign_stats

## 人群包相关
- 人群包大小：实际圈选到的用户数
- 触达率：实际触达人数 / 目标人群数 × 100%
- 人群重叠率：两个人群包交集 / 并集 × 100%
- 表：dim_audience_segment, dws_segment_campaign_stats`,
    },
  ],

  /* ===================================================================
   *  Conversations (2)
   * =================================================================== */
  conversations: [
    {
      title: '营销活动 ROI 分析',
      messages: [
        { role: 'user', content: '上个月各活动的 ROAS 排名是怎样的？' },
        {
          role: 'assistant',
          content:
            '根据上月投放数据，按 ROAS 降序排列各活动。ROAS 大于 3 的活动有 5 个，表现最好的是品牌促销活动。',
          sql: "SELECT campaign_name, campaign_type, SUM(spend_amount) AS total_spend, SUM(revenue) AS total_revenue, SUM(revenue) / NULLIF(SUM(spend_amount), 0) AS roas FROM dws_campaign_daily_stats WHERE ds >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND ds < DATE_TRUNC('month', CURRENT_DATE) GROUP BY campaign_name, campaign_type ORDER BY roas DESC",
          confidence: 0.91,
        },
        { role: 'user', content: '按渠道拆分看看各渠道的 CPA' },
        {
          role: 'assistant',
          content: '增加渠道维度拆分。搜索渠道 CPA 最低，社媒渠道 CPA 相对较高但触达量大。',
          sql: "SELECT c.channel_name, c.channel_type, SUM(s.spend_amount) AS total_spend, SUM(s.conversions) AS total_conversions, SUM(s.spend_amount) / NULLIF(SUM(s.conversions), 0) AS cpa FROM dws_channel_daily_stats s JOIN dim_channel c ON s.channel_id = c.id WHERE s.ds >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND s.ds < DATE_TRUNC('month', CURRENT_DATE) GROUP BY c.channel_name, c.channel_type ORDER BY cpa ASC",
          confidence: 0.88,
        },
      ],
    },
    {
      title: '多触点归因分析',
      messages: [
        { role: 'user', content: '不同归因模型下各渠道的转化贡献差异大吗？' },
        {
          role: 'assistant',
          content:
            '对比了首次触点、末次触点、线性和时间衰减四种归因模型。展示广告在首次触点模型下贡献最高，搜索广告在末次触点模型下占优。',
          sql: 'SELECT channel_name, first_touch_revenue, last_touch_revenue, linear_revenue, time_decay_revenue FROM ads_channel_attribution_model ORDER BY last_touch_revenue DESC',
          confidence: 0.85,
        },
        { role: 'user', content: '典型的转化路径长度分布是怎样的？' },
        {
          role: 'assistant',
          content:
            '大部分转化路径在 2-4 个触点之间，平均转化天数约 5.8 天。单触点直接转化占 25%，3 触点以上的占 40%。',
          sql: 'SELECT path_length, COUNT(*) AS path_count, SUM(total_conversions) AS conversions, AVG(avg_days_to_convert) AS avg_days FROM dws_attribution_path_analysis GROUP BY path_length ORDER BY path_length',
          confidence: 0.82,
        },
      ],
    },
  ],

  /* ===================================================================
   *  Query History (4)
   * =================================================================== */
  queryHistory: [
    {
      naturalLanguage: '上个月各渠道的 ROAS 是多少',
      generatedSql:
        "SELECT channel_name, SUM(revenue) / NULLIF(SUM(spend_amount), 0) AS roas FROM dws_channel_daily_stats WHERE ds >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND ds < DATE_TRUNC('month', CURRENT_DATE) GROUP BY channel_name ORDER BY roas DESC",
      status: 'accepted',
      isGolden: true,
      tablesUsed: ['dws_channel_daily_stats'],
    },
    {
      naturalLanguage: '最近 7 天 CPA 变化趋势',
      generatedSql:
        "SELECT ds, SUM(spend_amount) / NULLIF(SUM(conversions), 0) AS cpa FROM dws_campaign_daily_stats WHERE ds >= CURRENT_DATE - INTERVAL '7 days' GROUP BY ds ORDER BY ds",
      status: 'accepted',
      isGolden: true,
      tablesUsed: ['dws_campaign_daily_stats'],
    },
    {
      naturalLanguage: '邮件营销打开率最高的前 5 个活动',
      generatedSql:
        'SELECT email_campaign_id, open_rate FROM dws_email_campaign_stats ORDER BY open_rate DESC LIMIT 5',
      status: 'accepted',
      isGolden: false,
      tablesUsed: ['dws_email_campaign_stats'],
    },
    {
      naturalLanguage: '各人群包的触达率和转化率对比',
      generatedSql:
        'SELECT segment_name, SUM(reached_users) * 100.0 / NULLIF(SUM(targeted_users), 0) AS reach_rate, SUM(conversions) * 100.0 / NULLIF(SUM(reached_users), 0) AS cvr FROM dws_segment_campaign_stats GROUP BY segment_name ORDER BY cvr DESC',
      status: 'accepted',
      isGolden: true,
      tablesUsed: ['dws_segment_campaign_stats'],
    },
  ],
};
