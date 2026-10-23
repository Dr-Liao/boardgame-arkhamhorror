// 万象无终（TCU）P1 骨架回归：范围、三包、9 章占位、不可启动与可复算账本。
//
// 这一轮的门禁是「锁定范围 + 证明不可启动」，不是「已可玩」：
//   · 377 条印刷记录（343 主卡 + 34 关联面）全部有归属，三包无重叠；
//   · 三个卡包与战役、9 章全部 catalog-only，rulesImplemented/deckbuilding 都是 0；
//   · assertLaunchableCampaign 必须失败；
//   · scope.json 与 audit/tcu-migration.json 都能 --check 复算（来源/内容变化即失败）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { contentRegistry } from '../content/registered.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CAMPAIGN_CARD_CODES } from '../content/packs/tcuCampaign/manifest.js'
import { INVESTIGATOR_CARD_CODES } from '../content/packs/tcuInvestigators/manifest.js'
import { PLAYER_CARD_CODES } from '../content/packs/tcuPlayer/manifest.js'
import { ENCOUNTER_GROUP_IDS, chapters } from '../content/campaigns/theCircleUndone/shared.js'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const scope = JSON.parse(readFileSync(new URL('../artifacts/migration/tcu/scope.json', import.meta.url), 'utf8'))
const audit = JSON.parse(readFileSync(new URL('../audit/tcu-migration.json', import.meta.url), 'utf8'))

function run(script, args = []) {
  return spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120000 })
}

test('P1 范围：343 主卡 + 34 关联面 = 377 条记录，三包 237/19/87 无重叠无遗漏', () => {
  const main = Object.keys(ALL_CARDS).filter(code => /^05\d{3}$/.test(code))
  const faces = Object.keys(ALL_CARDS).filter(code => /^05\d{3}[a-z]$/.test(code))
  assert.equal(main.length, 343)
  assert.equal(faces.length, 34)
  assert.equal(main.length + faces.length, 377)
  assert.equal(CAMPAIGN_CARD_CODES.length, 237)
  assert.equal(INVESTIGATOR_CARD_CODES.length, 19)
  assert.equal(PLAYER_CARD_CODES.length, 87)
  const all = new Set([...CAMPAIGN_CARD_CODES, ...INVESTIGATOR_CARD_CODES, ...PLAYER_CARD_CODES])
  assert.equal(all.size, 343, '三包主卡不得重叠')
  assert.deepEqual([...all].sort(), [...main].sort(), '三包主卡覆盖全部 343 张')
  assert.equal(scope.counts.records, 377)
  assert.equal(scope.unassigned.main.length, 0)
  assert.equal(scope.unassigned.faces.length, 0)
  assert.equal(scope.gate.pass, true)
})

test('P1/P6 卡包：调查员包 M1 已验收，战役包与玩家包仍 catalog-only', () => {
  // P6（M1 调查员）：调查员包 19 张全部有单卡行为，6 位调查员进入选人。
  const investigators = contentRegistry.getPack('tcuInvestigators')
  assert.ok(investigators, 'tcuInvestigators 应已注册')
  assert.equal(investigators.status, 'verified')
  assert.equal(investigators.cards.filter(card => card.rulesImplemented).length, 19)
  assert.equal(investigators.cards.filter(card => card.deckbuilding).length, 13, '13 张专属卡作为依赖标记')
  // 战役包仍 catalog-only，但序章 4 位故事调查员的卡面能力已随调查员批次实现。
  const campaignPack = contentRegistry.getPack('tcuCampaign')
  assert.equal(campaignPack.status, 'catalog-only')
  const campaignImplemented = campaignPack.cards.filter(card => card.rulesImplemented).map(card => card.code).sort()
  assert.deepEqual(campaignImplemented, ['05046', '05047', '05048', '05049'])
  // 玩家包（M2/P7）一张都没实现。
  const player = contentRegistry.getPack('tcuPlayer')
  assert.equal(player.status, 'catalog-only')
  assert.equal(player.cards.filter(card => card.rulesImplemented).length, 0)
  assert.equal(player.cards.filter(card => card.deckbuilding).length, 0)
  // 21 个遭遇组登记在战役包，且与章节占位一一对应。
  assert.deepEqual([...campaignPack.encounterGroupIds], [...ENCOUNTER_GROUP_IDS])
  assert.equal(campaignPack.encounterGroupIds.length, 21)
})

test('P1 战役与 9 章：全部 catalog-only，且 assertLaunchable 必须失败', () => {
  const campaign = contentRegistry.getCampaign('theCircleUndone')
  assert.equal(campaign.status, 'catalog-only')
  assert.equal(campaign.scenarioIds.length, 9)
  for (const chapter of chapters) {
    assert.ok(campaign.scenarioIds.includes(chapter.id))
    const scenario = contentRegistry.getScenario(chapter.id)
    assert.equal(scenario.status, 'catalog-only')
    assert.equal(scenario.campaignId, 'theCircleUndone')
    assert.deepEqual(scenario.requiredEncounterGroupIds, [chapter.id])
  }
  assert.throws(() => contentRegistry.assertLaunchable('theCircleUndone'), /不可启动|发布状态/)
  assert.equal(audit.campaign.launchBlocked, true)
  assert.equal(audit.scenarios.length, 9)
  assert.equal(audit.gate.pass, true)
})

test('P1 账本：scope.json 与 audit/tcu-migration.json 可复算且 gate 一致', () => {
  // P1 的事实（377 条记录、三包、不可启动）必须在后续每个里程碑都还成立；
  // 账本本身随批次推进（P1 → P4 → P5 → P6 …），这里只断言它没被手写冻结成旧批次。
  assert.equal(audit.milestone, 'P6')
  assert.equal(audit.counts.records, 377)
  assert.deepEqual(audit.packs.map(pack => pack.cards), [237, 19, 87])
  assert.deepEqual(audit.scope.path, 'artifacts/migration/tcu/scope.json')
  // P4 追加的确认组必须在账本里，且不是靠手写「全真」。
  assert.equal(audit.confirmations.keywords.items.length, 16)
  assert.deepEqual(audit.confirmations.rulebook.requiredRuleIds.length, 16)
  assert.deepEqual(Object.keys(audit.confirmations.rulebook.checks).sort(),
    ['campaignOverview', 'cardLinks', 'desktopBrowser', 'keywordEntries', 'mobileBrowser', 'scenarioMechanics'])
  // P5 追加的交互确认组：11 条交互各自五项检查。
  assert.equal(audit.confirmations.interactions.items.length, 11)
  for (const item of audit.confirmations.interactions.items) {
    assert.deepEqual(Object.keys(item.checks).sort(),
      ['desktopBrowser', 'engineReadPoint', 'mobileBrowser', 'model', 'nodeAcceptance'], item.id)
  }
  // P6 追加的调查员确认组：6 位正式 + 4 位故事 + 13 张专属卡的逐人检查（同样由工具算，不手写）。
  assert.equal(audit.confirmations.investigators.items.length, 6)
  assert.equal(audit.confirmations.investigators.storyItems.length, 4)
  assert.equal(audit.confirmations.investigators.status, 'verified')
  assert.deepEqual(Object.keys(audit.confirmations.investigators.checks).sort(), [
    'deckContracts', 'deckbuildingOpen', 'entriesRegistered', 'formalSelectable',
    'nodeAcceptance', 'ruleDataValid', 'signaturesImplemented', 'storyInvestigators',
  ])
  assert.equal(audit.verifiedScope.investigators, true)
  const scopeCheck = run('tools/scan-tcu-scope.mjs', ['--check'])
  assert.equal(scopeCheck.status, 0, scopeCheck.stdout || scopeCheck.stderr)
  const auditCheck = run('tools/audit-tcu.mjs', ['--check'])
  assert.equal(auditCheck.status, 0, auditCheck.stdout || auditCheck.stderr)
})

test('P1 基线：scope 记录来源哈希、规则版本与 golden replay 计数', () => {
  assert.ok(scope.sources.length >= 4)
  for (const source of scope.sources) assert.match(source.sha256, /^[0-9a-f]{64}$/)
  assert.equal(scope.baseline.rulesVersion, 'n6.0')
  assert.equal(scope.baseline.goldenReplay.fixtures, 13)
  assert.equal(scope.baseline.goldenReplay.steps, 786)
  // 分片草案覆盖全部三包：调查员 + 4 波玩家卡 + 9 章。
  assert.equal(scope.shards.investigators.formal.length, 6)
  assert.equal(scope.shards.investigators.story.length, 4)
  // 调查员包剩下的 13 张是专属卡（含专属弱点）：6 + 4 + 13 = 23 张调查员侧记录。
  assert.equal(scope.shards.investigators.signature.length, 13)
  // 序章故事调查员带 encounterCode，登记在战役包（仍是 catalog-only，不进选人）。
  for (const code of scope.shards.investigators.story) assert.ok(CAMPAIGN_CARD_CODES.includes(code))
  assert.equal(scope.shards.playerWaves.reduce((sum, wave) => sum + wave.codes.length, 0), 87)
  assert.equal(scope.shards.chapters.length, 9)
})
