import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { FAST_TESTS, SLOW_TESTS, ASSET_TESTS } from './suites.mjs'

const testsDir = new URL('./', import.meta.url)

// 这个文件本身是分层守卫，不属于任何 tier，也不进 node-suite。
const META = new Set(['suite-manifest.test.mjs'])

test('分层清单与 node-suite 一致，且磁盘上每个用例都归属唯一的 tier', () => {
  const suite = readFileSync(new URL('./node-suite.mjs', import.meta.url), 'utf8')
  const registered = [...suite.matchAll(/^import '\.\/(.+?\.test\.mjs)'/gm)].map(match => match[1])
  assert.ok(registered.length > 50, `node-suite.mjs 解析异常，只读到 ${registered.length} 个用例文件`)

  const tiered = [...FAST_TESTS, ...SLOW_TESTS, ...ASSET_TESTS]
  assert.equal(new Set(tiered).size, tiered.length, '同一个用例文件不能出现在多个 tier')

  // 新加的用例必须声明分层，否则重跑全量时才发现它没进快测就太晚了。
  const onDisk = readdirSync(testsDir)
    .filter(name => name.endsWith('.test.mjs') && !META.has(name))
  assert.deepEqual(tiered.slice().sort(), registered.slice().sort(), '分层清单与 node-suite 的用例集合不一致')
  assert.deepEqual(onDisk.slice().sort(), registered.slice().sort(), 'tests/ 里有未登记进 node-suite 的用例文件')

  for (const file of tiered) {
    assert.ok(existsSync(fileURLToPath(new URL(`./${file}`, import.meta.url))), `分层清单里的文件不存在：${file}`)
  }
  assert.ok(FAST_TESTS.includes('ai-dialogue.test.mjs'), 'AI 对话回归必须留在快测里')
  assert.ok(!SLOW_TESTS.includes('ai-dialogue.test.mjs'), 'AI 对话回归不应落到慢速 tier')
})
