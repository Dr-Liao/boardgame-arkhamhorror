// node:test 自定义 reporter：只输出每个测试文件的耗时摘要，供 tools/test-timings.mjs 解析。
//
// 内置的 tap/spec reporter 不保留「文件」分组（多文件时所有用例被拍平），
// 但 node:test 的 reporter 事件流里 test:summary 带 file、success 与 duration_ms，正是需要的数据。
//
// 输出格式（每行一个文件）：
//   FILE_TIMING {"file":"tests/foo.test.mjs","durationMs":1234.5,"tests":10,"success":true}
export default async function* fileTimingReporter(source) {
  for await (const event of source) {
    if (event.type === 'test:summary' && event.data?.file) {
      const { file, duration_ms: durationMs, success, counts } = event.data
      yield `FILE_TIMING ${JSON.stringify({ file, durationMs, tests: counts?.tests ?? 0, success: success !== false })}\n`
    } else {
      yield ''
    }
  }
}
