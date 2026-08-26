import assert from 'node:assert/strict';
import test from 'node:test';
import { extractTaskSummary } from './aiSummaryParser.ts';

test('extracts the markdown summary from a prefixed JSON agent response', () => {
  const output = '任务完成\n{"thought":"核查完成","isDone":false,"summary":"## 阶段性汇总报告\\n\\n### 结论\\n未执行清理。"}';

  assert.equal(
    extractTaskSummary(output),
    '## 阶段性汇总报告\n\n### 结论\n未执行清理。',
  );
});

test('keeps an already-renderable markdown summary unchanged', () => {
  const markdown = '## 结论\n\n任务已完成。';

  assert.equal(extractTaskSummary(markdown), markdown);
});

test('hides an incomplete JSON envelope while a summary is streaming', () => {
  assert.equal(extractTaskSummary('任务完成\n{"thought":"正在分析"'), '');
});
