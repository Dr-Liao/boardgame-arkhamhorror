// 万象无终（TCU）P8 逐章账本测试：账本、来源锁与内容结构一致。
//
// 这不是「再跑一遍 12 项验收」（那是 tools/audit-tcu-scenarios.mjs 的职责），而是守住接线：
//   · 账本覆盖 9 章、章节 id 与 shared.js 一致、每章 12 个检查键齐全；
//   · 账本里声明的 testFile 存在、且真的引用该章目录；
//   · 账本 inventory 与动态 import 章节 index.js 的实物一致（防止手改账本或内容漂移）；
//   · status 与 checks 自洽；remaining 由检查项/缺口计算（未 verified 必有 remaining）；
//   · 来源锁登记了 9 章 Scenario 文件 + 参考实现的共享文件。
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

import { chapters } from '../content/campaigns/theCircleUndone/shared.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const ledger = JSON.parse(readFileSync(resolve(root, 'audit/tcu-scenario-acceptance.json'), 'utf8'))
const sourceLock = JSON.parse(readFileSync(resolve(root, 'audit/tcu-scenario-source-lock.json'), 'utf8'))

const CHECK_KEYS = [
  'sourceLocked', 'identityRegistered', 'setupAndZones', 'actsAndAgendas',
  'locationsAndConnections', 'encounterBehaviors', 'literalCardBehavior', 'chaosEffects',
  'resolutionsAndRecords', 'storyText', 'saveReplay', 'browserAcceptance',
]

test('P8 账本覆盖 9 章，章节 id/顺序与 shared.js 一致', () => {
  assert.deepEqual(ledger.items.map(item => item.id), chapters.map(chapter => chapter.id))
  assert.equal(ledger.milestone, 'M3')
  assert.equal(ledger.campaignId, 'theCircleUndone')
  assert.equal(ledger.summary.chapters, 9)
})

test('P8 每章 12 项检查键齐全，且 status 与 checks 自洽', () => {
  for (const item of ledger.items) {
    assert.deepEqual(Object.keys(item.checks), CHECK_KEYS, `${item.id} checks 键`)
    const nodeChecks = CHECK_KEYS.filter(key => key !== 'browserAcceptance')
    const nodePass = nodeChecks.every(key => item.checks[key] === true)
    const allPass = CHECK_KEYS.every(key => item.checks[key] === true)
    if (item.status === 'verified') assert.ok(allPass, `${item.id} verified 必须 12 项全真`)
    else if (item.status === 'development') {
      assert.ok(nodePass, `${item.id} development 必须 11 项 node 检查全真`)
      assert.equal(item.checks.browserAcceptance, false, `${item.id} development 时浏览器证据必须待补`)
    } else {
      assert.fail(`${item.id} status=${item.status}：P8 账本只允许 development/verified`)
    }
  }
})

test('P8 账本 inventory 与章节实物一致（防止手改账本/内容漂移）', async () => {
  for (const item of ledger.items) {
    const module = await import(pathToFileURL(resolve(root,
      `content/campaigns/theCircleUndone/scenarios/${item.id}/index.js`)).href)
    assert.equal(item.inventory.locations, Object.keys(module.scenario.locations).length, `${item.id} 地点数`)
    assert.equal(item.inventory.acts, module.scenario.acts.length, `${item.id} 幕数`)
    assert.equal(item.inventory.agendas, module.scenario.agendas.length, `${item.id} 议程数`)
    assert.equal(item.inventory.enemies, Object.keys(module.scenario.enemies).length, `${item.id} 敌人数`)
    assert.equal(item.inventory.treacheries, Object.keys(module.scenario.treacheries).length, `${item.id} 诡计数`)
    assert.deepEqual(item.inventory.resolutions, Object.keys(module.scenario.resolutions), `${item.id} 结局键`)
    assert.equal(item.code, chapters.find(chapter => chapter.id === item.id).code, `${item.id} 参考卡号`)
    assert.equal(item.pendingEncounterCodes.length, 0, `${item.id} 仍有未实现遭遇卡：${item.pendingEncounterCodes.join(',')}`)
    assert.deepEqual(item.gaps, module.behavior.scenarioGaps || [], `${item.id} 显式简化与行为导出一致`)
  }
})

test('P8 账本声明的章节测试存在且引用本章目录', () => {
  for (const item of ledger.items) {
    assert.ok(item.testFile, `${item.id} 缺少 testFile`)
    const url = resolve(root, item.testFile)
    assert.ok(existsSync(url), `${item.testFile} 不存在`)
    const source = readFileSync(url, 'utf8')
    assert.ok(source.includes(`scenarios/${item.id}/`), `${item.testFile} 没有引用 scenarios/${item.id}/`)
    assert.ok(source.includes('JSON.stringify') && source.includes('deepEqual'), `${item.testFile} 缺少存档往返断言`)
    assert.ok(item.testCases?.passed > 0, `${item.id} 章节测试没有通过的用例`)
    assert.equal(item.testCases.failed, 0, `${item.id} 章节测试有失败用例`)
  }
})

test('P8 来源锁登记 9 章 Scenario 文件 + 参考实现共享文件', () => {
  assert.equal(sourceLock.chapters ? Object.keys(sourceLock.chapters).length : 0, 9)
  for (const chapter of chapters) {
    const files = sourceLock.chapters[chapter.id] || []
    assert.ok(files.length >= 1, `${chapter.id} 没有登记参考实现文件`)
    assert.ok(files.some(entry => entry.path.includes('Scenario/Scenarios/TheCircleUndone/')), `${chapter.id} 缺少 Scenario 文件`)
    for (const entry of files) assert.match(entry.sha256, /^[0-9a-f]{64}$/)
  }
  assert.ok(sourceLock.shared.length >= 5, '参考实现的战役共享文件登记不足')
})

test('P8 remaining 由检查项/缺口计算，不硬编码', () => {
  assert.ok(Array.isArray(ledger.remaining))
  const pending = ledger.items.filter(item => item.status !== 'verified')
  if (pending.length) assert.ok(ledger.remaining.length > 0, '有未 verified 章节时 remaining 不能为空')
  for (const item of ledger.items) {
    for (const gap of item.gaps) {
      assert.ok(ledger.remaining.some(line => line.includes(gap)), `${item.id} 的 gap 没有进 remaining`)
    }
    for (const approximation of item.approximations || []) {
      assert.ok(ledger.remaining.some(line => line.includes(approximation)),
        `${item.id} 的近似实现没有进 remaining`)
    }
    for (const code of item.pendingEncounterCodes) {
      assert.ok(ledger.remaining.some(line => line.includes(code)), `${item.id} 的待实现卡 ${code} 没有进 remaining`)
    }
  }
  // 浏览器证据待补时必须有对应 remaining（P8 的 runner 产物）。
  const browserPending = ledger.items.filter(item => !item.checks.browserAcceptance)
  if (browserPending.length) {
    assert.ok(ledger.remaining.some(line => line.includes('浏览器')), '浏览器证据缺失没有进 remaining')
  }
})
