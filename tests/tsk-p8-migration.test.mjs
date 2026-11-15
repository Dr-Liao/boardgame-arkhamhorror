// 八循环《绯红密钥》（TSK）P8 发布验收总账本的自检。
//
// 目标：`audit/tsk-migration.json` 必须由 `tools/audit-tsk-migration.mjs` 逐字节复算，
// 复算与签入结果一致，并满足发布账本的最低事实面：439 条记录、10 章、26 遭遇组、
// confirmations 三组、原语裁决证据和发布状态都与实际门禁一致。
//
// 本测试属 slow tier（每次运行会 spawn 账本 --check 子命令），不放进 fast。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MOD = fileURLToPath(new URL('../', import.meta.url))
const REPORT = `${MOD}audit/tsk-migration.json`

test('P8 TSK 发布账本：逐字节复算一致', () => {
  assert.ok(existsSync(REPORT), '缺少 audit/tsk-migration.json：先运行 node tools/audit-tsk-migration.mjs --write')
  const result = spawnSync(process.execPath, ['tools/audit-tsk-migration.mjs', '--check-ledger'], {
    cwd: MOD, env: { ...process.env, NODE_TEST_CONTEXT: undefined }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 900_000,
  })
  assert.equal(result.status, 0, (result.stderr || result.stdout || '').slice(-2000))
})

test('P8 TSK 发布账本：发布状态由门禁推导，439 条记录与十章齐备', () => {
  const report = JSON.parse(readFileSync(REPORT, 'utf8'))
  const failed = Object.keys(report.gate).filter(key => report.gate[key] !== true)
  assert.equal(report.status, failed.length ? 'pending' : 'verified')
  assert.equal(report.playable, report.status === 'verified')
  assert.equal(report.launchEnabled, true)
  assert.equal(report.earlyAccess, false)
  assert.equal(report.equivalenceCertified, failed.length === 0)
  assert.deepEqual(report.counts && {
    total: report.counts.total, campaignCards: report.counts.campaignCards,
    investigatorCards: report.counts.investigatorCards, playerCards: report.counts.playerCards,
    chapters: report.counts.chapters, encounterGroups: report.counts.encounterGroups,
    sharedEncounterGroups: report.counts.sharedEncounterGroups, keys: report.counts.keys,
  }, {
    total: 439, campaignCards: 311, investigatorCards: 20, playerCards: 108,
    chapters: 10, encounterGroups: 26, sharedEncounterGroups: 16, keys: 10,
  })
  // 门禁对象齐全，未通过项必须列入余项。
  const requiredGates = ['registration', 'ledgers', 'allCards', 'campaignE2E', 'releaseBrowser', 'regression',
    'replay', 'guards', 'assets', 'confirmations', 'storyGuides', 'flowDeclared', 'docs', 'scripts', 'lobbyCustomization', 'lobbyEpilogue']
  for (const gate of requiredGates) {
    assert.ok(report.gates?.[gate], `缺少门禁 ${gate}`)
    assert.equal(report.gate?.[gate], report.gates[gate].pass === true, gate)
  }
  assert.deepEqual(report.remaining.find(row => row.kind === 'gate-pending')?.gates ?? [], failed)
})

test('P8 TSK 发布账本：三组确认与证据可追溯，缺失的原语裁决显式披露', () => {
  const report = JSON.parse(readFileSync(REPORT, 'utf8'))
  assert.equal(report.confirmations.scenarios.status, 'verified')
  assert.equal(report.confirmations.scenarios.items.length, 10)
  assert.equal(report.confirmations.keywords.status, 'verified')
  assert.equal(report.confirmations.rulebook.status, 'verified')
  if (report.primitives.ledger.sha256) {
    assert.equal(report.primitives.pendingRequests, 0)
    assert.equal(report.primitives.deferredRequests, 175)
  } else {
    assert.equal(report.primitives.pendingRequests, null)
    assert.equal(report.primitives.deferredRequests, null)
    assert.ok(report.remaining.some(row => row.kind === 'missing-primitive-adjudication'))
    assert.equal(report.gate.ledgers, false)
  }
  assert.equal(report.primitives.nextPhase, 'P9')
  assert.ok((report.sources || []).length >= 20, '来源清单不足')
  for (const source of report.sources) assert.match(source.sha256, /^[0-9a-f]{64}$/)
  assert.ok(report.evidence?.releaseBrowser?.screenshots >= 20, '发布浏览器截图不足 20 张')
  assert.ok(['verified'].includes(report.evidence?.allCards?.summary?.gateComplete === true ? 'verified' : 'x'))
})
