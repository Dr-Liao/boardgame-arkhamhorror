// 九循环《铁杉谷盛宴》（FHV）P4 交互审计账本与浏览器验收复算。
//
// 覆盖：
//   · audit/fhv-interactions.json 由 buildInteractionAudit() 逐字节复算，门禁全真、status=verified；
//   · 7 组交互 × 桌面/移动覆盖矩阵、交付原语与浏览器用例/截图；
//   · 回归账本 audit/fhv-regression.json：P4 基线（P3 收口的既有失败）之外无新增失败，replay 精确一致；
//   · 浏览器账本三份 spec 齐全（FHV 交互 + scriptCard 归属 + 关卡设置指南）。
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildInteractionAudit } from '../tools/audit-fhv-interactions.mjs'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const readText = path => readFileSync(join(MOD, path), 'utf8').replace(/^\uFEFF/, '')
const readJson = path => JSON.parse(readText(path))

test('P4 交互审计账本：门禁全真、覆盖矩阵完整且可逐字节复算', () => {
  const report = buildInteractionAudit()
  const failed = Object.entries(report.gates).filter(([, value]) => value !== true).map(([key]) => key)
  assert.deepEqual(failed, [], `交互审计门禁失败：${failed.join(', ')}`)
  assert.equal(JSON.stringify(report, null, 2) + '\n', readText('audit/fhv-interactions.json'),
    '交互审计账本必须由 buildInteractionAudit() 逐字节复算（--check 口径）')
  assert.equal(report.milestone, 'P4')
  assert.equal(report.status, 'verified')
  assert.deepEqual(Object.keys(report.coverage.desktop),
    ['codex', 'evolution', 'survey', 'grid', 'rail', 'enemyLocation', 'investigatorState'])
  assert.deepEqual(Object.keys(report.coverage.mobile), Object.keys(report.coverage.desktop))
  for (const groups of Object.values(report.coverage)) assert.ok(Object.values(groups).every(Boolean))
  // 交付原语 = P2 已交付；两视口 7 组全真才声明。
  assert.ok(report.deliveredPrimitives.length > 0)
  assert.ok(report.deliveredPrimitives.includes('campaign.codex'))
  assert.ok(report.deliveredPrimitives.includes('locations.grid'))
  assert.ok(report.deliveredPrimitives.includes('investigators.harmAndForm'))
  // 指纹与状态派生：重复构建逐字节一致（确定性）。
  assert.equal(JSON.stringify(buildInteractionAudit()), JSON.stringify(report))
})

test('P4 浏览器账本：3 份证据 spec、7 组 × 2 视口用例全过、截图存在', () => {
  const browser = readJson('audit/fhv-interactions-browser.json')
  assert.equal(browser.status, 'passed')
  assert.deepEqual(browser.specs, [
    'tests/fhv-interactions.browser.mjs',
    'tests/scenario-guides.browser.mjs',
    'tests/script-actions-tfa.browser.mjs',
  ])
  assert.ok(browser.tests.length >= 18, `浏览器用例数不足：${browser.tests.length}`)
  assert.ok(browser.tests.every(entry => entry.status === 'passed'), '浏览器用例必须全部通过')
  // 7 组 × 2 视口：标题前缀与中文标记覆盖。
  const markers = ['法典', '演进', '序曲整备', '网格', '矿车', '敌人-地点', '坚毅形态']
  for (const viewport of ['desktop', 'mobile']) {
    for (const marker of markers) {
      assert.ok(browser.tests.some(entry => entry.title.startsWith(`P4 ${viewport} `) && entry.title.includes(marker)),
        `缺少 ${viewport} ${marker} 用例`)
    }
  }
  // 两条通用证据 spec 的桌面/移动都跑到。
  for (const file of ['tests/script-actions-tfa.browser.mjs', 'tests/scenario-guides.browser.mjs']) {
    const titles = browser.tests.filter(entry => entry.file === file)
    assert.ok(titles.length >= 2, `${file} 至少桌面与移动各一条`)
  }
  assert.ok(browser.screenshots.length >= 14)
  for (const screenshot of browser.screenshots) {
    assert.match(screenshot, /^artifacts\/migration\/fhv\/p4\/screenshots\/(desktop|mobile)-[^/]+\.png$/)
  }
})

test('P4 回归账本：P4 基线之外无新增失败，replay 基线稳定且精确一致', () => {
  const regression = readJson('audit/fhv-regression.json')
  assert.equal(regression.status, 'passed')
  assert.deepEqual(regression.gates, { fastNoNewFailures: true, replayNoDrift: true })
  assert.deepEqual(regression.fast.newFailures, [])
  for (const row of regression.knownFailures) {
    assert.ok(row.title && row.reason, '既有失败必须登记原因')
  }
  assert.ok(regression.fast.titles.every(title => regression.knownFailures.some(row => row.title === title)))
  assert.equal(regression.replay.exitCode, 0)
  assert.equal(regression.replay.matches, true)
  assert.equal(regression.replay.baseline, 'tests/fixtures/replay/golden-replays.json')
})
