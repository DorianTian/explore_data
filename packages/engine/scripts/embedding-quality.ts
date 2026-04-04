/**
 * Embedding quality validation script.
 * Run with: DATABASE_URL=... OPENAI_API_KEY=... OPENAI_BASE_URL=... npx tsx packages/engine/src/tests/embedding-quality.test.ts
 */
import { createDbClient } from '@nl2sql/db';
import { columnEmbeddings } from '@nl2sql/db';
import { EmbeddingService } from '../embedding-service.js';

const DB_URL = process.env.DATABASE_URL ?? 'postgresql://tianqiyin:@localhost:5432/nl2sql';

async function main() {
  const db = createDbClient(DB_URL);
  const emb = new EmbeddingService(
    process.env.OPENAI_API_KEY,
    process.env.OPENAI_BASE_URL,
  );

  const allEmb = await db.select().from(columnEmbeddings);
  const items = allEmb
    .filter((e) => e.embedding !== null)
    .map((e, i) => ({
      embedding: e.embedding as number[],
      index: i,
      text: e.textRepresentation,
    }));

  console.log(`Loaded ${items.length} column embeddings\n`);

  const testCases = [
    {
      query: '查询各渠道的GMV',
      expectedColumns: ['channel', 'total_amount', 'payment_amount'],
    },
    {
      query: '最近注册的新用户',
      expectedColumns: ['register_date', 'username'],
    },
    {
      query: '销量最高的商品',
      expectedColumns: ['product_id', 'quantity', 'name'],
    },
    {
      query: '每日订单数趋势',
      expectedColumns: ['order_date', 'id'],
    },
    {
      query: '用户的手机号和邮箱',
      expectedColumns: ['phone', 'email'],
    },
    {
      query: '商品的品牌和分类',
      expectedColumns: ['brand', 'category'],
    },
  ];

  let totalHits = 0;
  let totalExpected = 0;

  for (const tc of testCases) {
    const qEmb = await emb.embedSingle(tc.query);
    const topK = emb.findTopK(qEmb, items, 8);

    const retrievedColumns = topK.map((match) => {
      const text = items[match.index].text;
      const colMatch = text.match(/Column:\s*(\S+)/);
      return colMatch ? colMatch[1] : '';
    });

    const hits = tc.expectedColumns.filter((col) =>
      retrievedColumns.some((rc) => rc.toLowerCase().includes(col.toLowerCase())),
    );

    totalHits += hits.length;
    totalExpected += tc.expectedColumns.length;

    const hitRate = (hits.length / tc.expectedColumns.length * 100).toFixed(0);
    const status = hits.length === tc.expectedColumns.length ? '✅' : hits.length > 0 ? '⚠️' : '❌';

    console.log(`${status} Query: "${tc.query}" (${hitRate}% hit)`);
    console.log(`   Expected: [${tc.expectedColumns.join(', ')}]`);
    console.log(`   Got top-8: [${retrievedColumns.join(', ')}]`);
    console.log(`   Hits: [${hits.join(', ')}]`);

    // Show scores
    for (const match of topK.slice(0, 5)) {
      const text = items[match.index].text.split('\n')[1];
      console.log(`     ${match.score.toFixed(4)} | ${text}`);
    }
    console.log('');
  }

  const overallRate = (totalHits / totalExpected * 100).toFixed(1);
  console.log(`\n=== Overall Recall: ${totalHits}/${totalExpected} (${overallRate}%) ===`);
  console.log(overallRate >= '70' ? '✅ PASS' : '❌ NEEDS IMPROVEMENT');

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
