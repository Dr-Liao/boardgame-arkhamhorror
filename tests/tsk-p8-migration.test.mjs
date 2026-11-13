// 八循环《绯红密钥》（TSK）P8 发布验收总账本的自检。
//
// 目标：`audit/tsk-migration.json` 必须由 `tools/audit-tsk-migration.mjs` 逐字节复算（--check），
// 两次独立运行结论一致（确定性），并满足发布账本的最低事实面：439 条记录、10 章、26 遭遇组、
// confirmations 三组 verified、原语请求全部裁决、无 earlyAccess。
//
// 本测试属 slow tier（每次运行会 spawn 账本 --check 子命令），不放进 fast。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const REPORT = `${MOD}audit/tsk-migration.json`

function runTool() {
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const result = spawnSync(process.execPath, ['tools/audit-tsk-migration.mjs'], {
    cwd: MOD, env, encoding: 'utf8', maxBuffer: 128 * 1024 * 1024, timeout: 900_000,
  })
  assert.equal(result.status, 0, (result.stderr || result.stdout || '').slice(-2000))
  const text = `${result.stdout || ''}`.trim()
  const start = text.indexOf('{')
  assert.ok(start >= 0, '聚合工具未输出 JSON')
  return text.slice(start)
}

test('P8 TSK 发布账本：--check 复算一致，且两次独立运行逐字节一致（确定性）', () => {
  assert.ok(existsSync(REPORT), '缺少 audit/tsk-migration.json：先运行 node tools/audit-tsk-migration.mjs --write')
  const first = runTool()
  const second = runTool()
  assert.equal(first, second, '两次独立运行的发布账本不一致（存在时间戳/顺序/随机等不确定性）')
  const result = spawnSync(process.execPath, ['tools/audit-tsk-migration.mjs', '--check'], {
    cwd: MOD, env: { ...process.env, NODE_TEST_CONTEXT: undefined }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900_000,
  })
  assert.equal(result.status, 0, (result.stderr || result.stdout || '').slice(-2000))
})

test('P8 TSK 发布账本：状态 verified、无 earlyAccess、439 条记录与十章齐备', () => {
  const report = JSON.parse(readFileSync(REPORT, 'utf8'))
  assert.equal(report.status, 'verified')
  assert.equal(report.playable, true)
  assert.equal(report.launchEnabled, true)
  assert.equal(report.earlyAccess, false)
  assert.equal(report.equivalenceCertified, true)
  assert.deepEqual(report.counts && {
    total: report.counts.total, campaignCards: report.counts.campaignCards,
    investigatorCards: report.counts.investigatorCards, playerCards: report.counts.playerCards,
    chapters: report.counts.chapters, encounterGroups: report.counts.encounterGroups,
    sharedEncounterGroups: report.counts.sharedEncounterGroups, keys: report.counts.keys,
  }, {
    total: 439, campaignCards: 311, investigatorCards: 20, playerCards: 108,
    chapters: 10, encounterGroups: 26, sharedEncounterGroups: 16, keys: 10,
  })
  // 门禁对象齐全且全真。
  const requiredGates = ['registration', 'ledgers', 'allCards', 'campaignE2E', 'releaseBrowser', 'regression',
    'replay', 'guards', 'assets', 'confirmations', 'storyGuides', 'flowDeclared', 'docs', 'scripts', 'lobbyCustomization', 'lobbyEpilogue']
  for (const gate of requiredGates) {
    assert.ok(report.gates?.[gate], `缺少门禁 ${gate}`)
    assert.equal(report.gate?.[gate], true, `门禁 ${gate} 未通过`)
  }
})

test('P8 TSK 发布账本：confirmations 三组 verified、原语请求无 pending、来源与证据可追溯', () => {
  const report = JSON.parse(readFileSync(REPORT, 'utf8'))
  assert.equal(report.confirmations.scenarios.status, 'verified')
  assert.equal(report.confirmations.scenarios.items.length, 10)
  assert.equal(report.confirmations.keywords.status, 'verified')
  assert.equal(report.confirmations.rulebook.status, 'verified')
  assert.equal(report.primitives.pendingRequests, 0)
  assert.equal(report.primitives.deferredRequests, 175)
  assert.equal(report.primitives.nextPhase, 'P9')
  assert.ok((report.sources || []).length >= 20, '来源清单不足')
  for (const source of report.sources) assert.match(source.sha256, /^[0-9a-f]{64}$/)
  assert.ok(report.evidence?.releaseBrowser?.screenshots >= 20, '发布浏览器截图不足 20 张')
  assert.ok(['verified'].includes(report.evidence?.allCards?.summary?.gateComplete === true ? 'verified' : 'x'))
})
