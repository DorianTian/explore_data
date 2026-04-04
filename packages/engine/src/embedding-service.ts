import OpenAI from 'openai';

/**
 * Embedding service for NL2SQL schema linking and knowledge retrieval.
 *
 * Uses OpenAI text-embedding-3-small (1536d) — sufficient for schema corpus (<1000 items).
 * Supports bilingual (Chinese + English) text for cross-language matching.
 */
export class EmbeddingService {
  private client: OpenAI;

  constructor(apiKey?: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL ?? process.env.OPENAI_BASE_URL ?? undefined,
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const BATCH_SIZE = 512;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      });
      allEmbeddings.push(...response.data.map((d) => d.embedding));
    }

    return allEmbeddings;
  }

  async embedSingle(text: string): Promise<number[]> {
    const [embedding] = await this.embed([text]);
    return embedding;
  }

  cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  findTopK(
    queryEmbedding: number[],
    items: Array<{ embedding: number[]; index: number }>,
    k: number,
  ): Array<{ index: number; score: number }> {
    const scored = items.map((item) => ({
      index: item.index,
      score: this.cosineSimilarity(queryEmbedding, item.embedding),
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
  }

  /**
   * Build natural-language text representation for a column.
   * Optimized for bilingual (CN+EN) embedding matching.
   *
   * Format:
   *   Table: orders (订单表)
   *   Column: user_id — 下单用户的ID
   *   Type: BIGINT | Examples: 1001, 1002
   */
  static buildColumnText(params: {
    tableName: string;
    tableComment: string | null;
    columnName: string;
    columnComment: string | null;
    dataType: string;
    sampleValues: string[] | null;
    isPrimaryKey: boolean;
  }): string {
    const parts: string[] = [];

    // Table context — bilingual
    let tableLine = `Table: ${params.tableName}`;
    if (params.tableComment) tableLine += ` (${params.tableComment})`;
    parts.push(tableLine);

    // Column description — bilingual
    let colLine = `Column: ${params.columnName}`;
    if (params.columnComment) colLine += ` — ${params.columnComment}`;
    if (params.isPrimaryKey) colLine += ' [PRIMARY KEY]';
    parts.push(colLine);

    // Type + samples
    let typeLine = `Type: ${params.dataType}`;
    if (params.sampleValues && params.sampleValues.length > 0) {
      typeLine += ` | Examples: ${params.sampleValues.slice(0, 5).join(', ')}`;
    }
    parts.push(typeLine);

    return parts.join('\n');
  }

  /**
   * Build augmented text with synthetic questions for better retrieval.
   * Augments the standard column text with common query patterns.
   */
  static buildAugmentedColumnText(params: {
    tableName: string;
    tableComment: string | null;
    columnName: string;
    columnComment: string | null;
    dataType: string;
    sampleValues: string[] | null;
    isPrimaryKey: boolean;
  }): string {
    const base = EmbeddingService.buildColumnText(params);
    const syntheticQuestions: string[] = [];

    const name = params.columnName.toLowerCase();
    const comment = (params.columnComment ?? '').toLowerCase();
    const dtype = params.dataType.toLowerCase();

    // Amount / money related
    if (
      name.includes('amount') ||
      name.includes('price') ||
      name.includes('cost') ||
      comment.includes('金额') ||
      comment.includes('价格') ||
      comment.includes('费用')
    ) {
      syntheticQuestions.push(`查询${params.tableComment ?? params.tableName}的总金额`);
      syntheticQuestions.push(`${params.columnComment ?? params.columnName}是多少`);
    }

    // Count / quantity
    if (
      name.includes('quantity') ||
      name.includes('count') ||
      name.includes('num') ||
      comment.includes('数量') ||
      comment.includes('次数')
    ) {
      syntheticQuestions.push(`统计${params.columnComment ?? params.columnName}`);
      syntheticQuestions.push(`销量是多少`);
    }

    // Date / time
    if (
      dtype.includes('date') ||
      dtype.includes('timestamp') ||
      dtype.includes('time') ||
      comment.includes('日期') ||
      comment.includes('时间')
    ) {
      syntheticQuestions.push(`按时间查看${params.tableComment ?? params.tableName}趋势`);
      syntheticQuestions.push(`最近的${params.tableComment ?? params.tableName}`);
    }

    // Category / type
    if (
      name.includes('category') ||
      name.includes('type') ||
      name.includes('status') ||
      comment.includes('分类') ||
      comment.includes('类型') ||
      comment.includes('状态')
    ) {
      syntheticQuestions.push(`按${params.columnComment ?? params.columnName}分组`);
      syntheticQuestions.push(`各${params.columnComment ?? params.columnName}的分布`);
    }

    // Name / identifier
    if (
      name.includes('name') ||
      name.includes('title') ||
      comment.includes('名称') ||
      comment.includes('名字')
    ) {
      syntheticQuestions.push(`查找${params.columnComment ?? params.columnName}`);
    }

    // Channel / source
    if (
      name.includes('channel') ||
      name.includes('source') ||
      comment.includes('渠道') ||
      comment.includes('来源')
    ) {
      syntheticQuestions.push(`各渠道对比`);
      syntheticQuestions.push(`不同${params.columnComment ?? params.columnName}的数据`);
    }

    // Region / location
    if (
      name.includes('region') ||
      name.includes('city') ||
      name.includes('area') ||
      comment.includes('地区') ||
      comment.includes('城市') ||
      comment.includes('区域')
    ) {
      syntheticQuestions.push(`各地区对比`);
      syntheticQuestions.push(`按${params.columnComment ?? params.columnName}分析`);
    }

    if (syntheticQuestions.length > 0) {
      return `${base}\nQuestions: ${syntheticQuestions.join(' | ')}`;
    }

    return base;
  }

  /**
   * Build natural-language text representation for a table.
   * Used for table-level embedding (coarse recall).
   */
  static buildTableText(params: {
    tableName: string;
    tableComment: string | null;
    columns: Array<{ name: string; comment: string | null; dataType: string }>;
  }): string {
    const parts: string[] = [];

    let header = `Table: ${params.tableName}`;
    if (params.tableComment) header += ` — ${params.tableComment}`;
    parts.push(header);

    // Column summary — just names and comments for table-level overview
    const colSummaries = params.columns
      .slice(0, 15) // Cap at 15 columns for table-level embedding
      .map((c) => {
        let s = c.name;
        if (c.comment) s += `(${c.comment})`;
        return s;
      });
    parts.push(`Columns: ${colSummaries.join(', ')}`);

    return parts.join('\n');
  }
}
