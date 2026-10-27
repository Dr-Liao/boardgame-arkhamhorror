// 万象无终（TCU）P1 骨架 / P10 发布回归：范围、三包、9 章状态、大厅可启动与可复算账本。
//
// 里程碑口径：P1 锁定范围；P6 调查员包 verified；P7 玩家包 verified；P8 战役包升 development、
// 9 章逐章 12 项检查 verified；P9 剧情正文/幕间/结局/flow；P10 三组确认 + 逐卡账本 + 大厅入口，
// 战役/9 章/tcuCampaign 包升 playable，assertLaunchable 必须通过。
// scope.json 与 audit/tcu-migration.json 都能 --check 复算（来源/内容变化即失败）。

import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CAMPAIGN_CARD_CODES } from '../content/packs/tcuCampaign/manifest.js'
import { INVESTIGATOR_CARD_CODES } from '../content/packs/tcuInvestigators/manifest.js'
import { PLAYER_CARD_CODES } from '../content/packs/tcuPlayer/manifest.js'
import { ENCOUNTER_GROUP_IDS, chapters } from '../content/campaigns/theCircleUndone/shared.js'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const scope = JSON.parse(readFileSync(new URL('../artifacts/migration/tcu/scope.json', import.meta.url), 'utf8'))
const audit = JSON.parse(readFileSync(new URL('../audit/tcu-migration.json', import.meta.url), 'utf8'))

function run(script, args = []) {
  // P9 起 audit-tcu --check 会实跑剧情测试（与 P8 的逐章账本同口径），放宽到 300s 防慢机误报。
  return spawnSync(process.execPath, [script, ...args], { cwd: ROOT, encoding: 'utf8', timeout: 300000 })
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

test('P1/P6/P7/P8/P10 卡包：调查员 M1 与玩家包 M2 已验收，战役包 M3 已开放', () => {
  // P6（M1 调查员）：调查员包 19 张全部有单卡行为，6 位调查员进入选人。
  const investigators = contentRegistry.getPack('tcuInvestigators')
  assert.ok(investigators, 'tcuInvestigators 应已注册')
  assert.equal(investigators.status, 'verified')
  assert.equal(investigators.cards.filter(card => card.rulesImplemented).length, 19)
  assert.equal(investigators.cards.filter(card => card.deckbuilding).length, 13, '13 张专属卡作为依赖标记')
  // P8/P10（M3 剧本）：战役包 237 张全部有实现声明；三组确认 + 逐卡账本 + 大厅入口落账后升 playable。
  const campaignPack = contentRegistry.getPack('tcuCampaign')
  assert.equal(campaignPack.status, 'playable')
  assert.equal(campaignPack.cards.length, 237)
  assert.equal(campaignPack.cards.filter(card => card.rulesImplemented).length, 237)
  // P7（M2）：玩家包 87 张玩家卡已全部逐卡验收，85 张可构筑，2 张基础弱点只作依赖。
  const player = contentRegistry.getPack('tcuPlayer')
  assert.equal(player.status, 'verified')
  assert.equal(player.cards.length, 87)
  assert.equal(player.cards.filter(card => card.rulesImplemented).length, 87)
  assert.equal(player.cards.filter(card => card.deckbuilding).length, 85)
  // 21 个遭遇组登记在战役包，且每个章节只引用已登记的组。
  assert.deepEqual([...campaignPack.encounterGroupIds], [...ENCOUNTER_GROUP_IDS])
  assert.equal(campaignPack.encounterGroupIds.length, 21)
})

test('P10 发布：战役 playable、9 章 playable、assertLaunchable 通过且大厅可见', () => {
  const campaign = contentRegistry.getCampaign('theCircleUndone')
  assert.equal(campaign.status, 'playable')
  assert.equal(campaign.scenarioIds.length, 9)
  for (const chapter of chapters) {
    assert.ok(campaign.scenarioIds.includes(chapter.id))
    const scenario = contentRegistry.getScenario(chapter.id)
    assert.equal(scenario.status, 'playable')
    assert.equal(scenario.campaignId, 'theCircleUndone')
    // 每章至少引用自己的章节组；共享组/核心组引用必须登记在某个 required 包内。
    assert.ok(scenario.requiredEncounterGroupIds.includes(chapter.id))
    const knownGroups = new Set([
      ...ENCOUNTER_GROUP_IDS,
      ...contentRegistry.listPacks().flatMap(pack => pack.encounterGroupIds),
    ])
    assert.ok(scenario.requiredEncounterGroupIds.every(group => knownGroups.has(group)))
  }
  const launched = contentRegistry.assertLaunchable('theCircleUndone')
  assert.equal(launched.id, 'theCircleUndone')
  assert.equal(audit.campaign.launchBlocked, false)
  assert.equal(audit.playable, true)
  assert.equal(audit.launchEnabled, true)
  assert.equal(audit.gate.campaignLaunchable.pass, true)
  assert.equal(audit.gate.launchEnabled.pass, true)
  assert.equal(audit.gate.chaptersLaunchable.pass, true)
  // 大厅数据只列可启动战役：TCU 必须出现（含 9 章与战役总览）。
  const hall = campaignListForUi(contentRegistry)
  const tcu = hall.find(item => item.id === 'theCircleUndone')
  assert.ok(tcu, '大厅必须出现《万象无终》')
  assert.equal(tcu.status, 'playable')
  assert.equal(tcu.scenarios.length, 9)
  assert.equal(audit.scenarios.length, 9)
  assert.equal(audit.gate.pass, true)
})

test('P1 账本：scope.json 与 audit/tcu-migration.json 可复算且 gate 一致', () => {
  // P1 的事实（377 条记录、三包、来源哈希）必须在后续每个里程碑都还成立；
  // 账本本身随批次推进（P1 → P4 → P5 → P6 … → P10），这里只断言它没被手写冻结成旧批次。
  assert.equal(audit.milestone, 'P10')
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
  // P7 追加的玩家卡确认组：87 张逐卡验收 + 85 可构筑 + 2 张基础弱点，同样由工具算，不手写。
  assert.equal(audit.verifiedScope.playerCards, true)
  assert.equal(audit.confirmations.playerCards.items.length, 87)
  assert.equal(audit.confirmations.playerCards.status, 'verified')
  assert.equal(audit.gate.playerCardsVerified.total, 87)
  assert.equal(audit.gate.playerCardsVerified.verified, 87)
  assert.equal(audit.gate.playerCardsVerified.buildable, 85)
  assert.equal(audit.gate.playerCardsVerified.basicWeaknesses, 2)
  assert.equal(audit.gate.packsByPhase.player.status, 'verified')
  assert.equal(audit.gate.packsByPhase.player.pass, true)
  // P8 追加的剧本确认组：9 章逐章 12 项检查（含来源锁/逐卡/存档/实机浏览器），由 tool 实跑计算。
  assert.equal(audit.verifiedScope.scenarios, true)
  assert.equal(audit.confirmations.scenarios.items.length, 9)
  assert.equal(audit.confirmations.scenarios.status, 'verified')
  assert.deepEqual(Object.keys(audit.confirmations.scenarios.checks).sort(), [
    'actsAndAgendas', 'browserAcceptance', 'chaosEffects', 'encounterBehaviors',
    'identityRegistered', 'ledgerTest', 'literalCardBehavior', 'locationsAndConnections',
    'nodeAcceptance', 'resolutionsAndRecords', 'saveReplay', 'setupAndZones',
    'sourceLocked', 'storyText',
  ])
  for (const item of audit.confirmations.scenarios.items) {
    assert.equal(item.status, 'verified', `${item.id} 应 verified`)
    assert.equal(Object.keys(item.checks).length, 12)
    assert.ok(Object.values(item.checks).every(value => value === true), `${item.id} 12 项检查应全真`)
  }
  assert.equal(audit.gate.scenariosVerified.total, 9)
  assert.equal(audit.gate.scenariosVerified.verified, 9)
  assert.equal(audit.gate.scenariosVerified.pendingEncounterCards, 0)
  assert.equal(audit.gate.scenariosVerified.gaps, 0)
  assert.equal(audit.gate.scenariosVerified.pass, true)
  assert.equal(audit.gate.packsByPhase.campaign.status, 'playable')
  assert.equal(audit.gate.packsByPhase.campaign.pass, true)
  // P9 追加的剧情确认组：生成器产物/逐章正文/幕间/结局/flow/隐私，由 audit 工具实跑计算。
  assert.equal(audit.verifiedScope.milestone, 'P4–P10')
  assert.equal(audit.verifiedScope.story, true)
  assert.equal(audit.confirmations.story.milestone, 'M3-C')
  assert.equal(audit.confirmations.story.status, 'verified')
  assert.equal(audit.confirmations.story.items.length, 9)
  assert.equal(audit.gate.storyVerified.chapters, 9)
  assert.ok(audit.gate.storyVerified.endings >= 8, '8 个战役结局都要登记并投影正文')
  assert.equal(audit.gate.storyVerified.pass, true)
  const storyTextPath = 'content/campaigns/theCircleUndone/story-text.js'
  const storyTextUrl = new URL(`../${storyTextPath}`, import.meta.url)
  assert.ok(existsSync(storyTextUrl), `${storyTextPath} 应已生成`)
  const storyTextHash = createHash('sha256').update(readFileSync(storyTextUrl)).digest('hex')
  assert.equal(audit.evidence.files[storyTextPath], storyTextHash, '证据哈希必须与生成物一致')
  // P10 追加的发布确认组：逐卡账本、大厅实机浏览器、展示素材、开放玩家池，全部由工具实跑/读盘计算。
  assert.equal(audit.verifiedScope.allCards, true)
  assert.equal(audit.verifiedScope.releaseBrowser, true)
  assert.equal(audit.verifiedScope.presentation, true)
  assert.equal(audit.verifiedScope.launch, true)
  assert.equal(audit.confirmations.release.status, 'verified')
  for (const key of ['launchable', 'lobby', 'releaseDesktopBrowser', 'releaseMobileBrowser',
    'mediaDesktop', 'mediaMobile', 'presentation', 'allCards', 'playerPool']) {
    assert.equal(audit.confirmations.release.checks[key], true, `发布确认缺少 ${key}`)
  }
  // 逐卡账本：377 条记录全覆盖，343 主卡 = 237 战役 + 19 调查员 + 87 玩家，34 关联面，
  // 只有带运行证据的卡才 verified；未验收必须为 0（近似实现另行进 remaining）。
  assert.equal(audit.gate.allCardsVerified.total, 377)
  assert.equal(audit.gate.allCardsVerified.records, 343)
  assert.equal(audit.gate.allCardsVerified.faces, 34)
  assert.equal(audit.gate.allCardsVerified.verified, 377)
  assert.equal(audit.gate.allCardsVerified.pending, 0)
  assert.deepEqual(audit.gate.allCardsVerified.partitions,
    { campaign: 237, investigator: 19, player: 87, face: 34 })
  assert.equal(audit.gate.allCardsVerified.pass, true)
  // P10：发布级浏览器证据由 runner 生成，release/media 各桌面 + 移动。
  assert.equal(audit.gate.releaseBrowser.release.desktop, true)
  assert.equal(audit.gate.releaseBrowser.release.mobile, true)
  assert.equal(audit.gate.releaseBrowser.media.desktop, true)
  assert.equal(audit.gate.releaseBrowser.media.mobile, true)
  assert.equal(audit.gate.releaseBrowser.pass, true)
  // P10：展示素材（9 场景 + 桌面图 + 27 首 BGM）与开放玩家池（83 张 05 可入牌组卡）。
  assert.equal(audit.gate.presentationAssets.pass, true)
  assert.equal(audit.gate.presentationAssets.images >= 10, true)
  assert.equal(audit.gate.presentationAssets.tracks, 27)
  assert.equal(audit.gate.playerPoolOpen.pass, true)
  assert.equal(audit.gate.playerPoolOpen.deckable, 83)
  // P10：逐卡行为审计（印刷描述 vs 实现）——377 条全覆盖；发现 gap/approximation 时按路线图 §8.4
  // 的 earlyAccess 退路发布（playable + earlyAccess + equivalenceCertified=false + 完整 remaining）。
  assert.equal(audit.gate.cardBehaviorAudit.covered, true)
  assert.equal(audit.confirmations.cardBehavior.covered, true)
  const behaviorCounts = audit.confirmations.cardBehavior.counts
  assert.equal(behaviorCounts.total, 377)
  assert.equal(behaviorCounts.mainCards, 343)
  assert.equal(behaviorCounts.faces, 34)
  assert.equal(behaviorCounts.match + behaviorCounts.approximation + behaviorCounts.gap + behaviorCounts.notApplicable, 377)
  assert.ok(behaviorCounts.gap > 0 || behaviorCounts.approximation > 0, '逐卡行为审计应如实记录未实现子句或显式近似（不能写成规则等价）')
  assert.equal(audit.earlyAccess, true)
  assert.equal(audit.equivalenceCertified, false)
  assert.match(String(audit.earlyAccessReason), /gap|approximation/)
  assert.equal(audit.confirmations.cardBehavior.status, behaviorCounts.gap === 0 ? 'verified' : 'pending')
  assert.equal(audit.verifiedScope.cardBehaviorAudit, behaviorCounts.gap === 0)
  assert.equal(audit.gate.releaseGate.pass, true)
  for (const code of audit.confirmations.cardBehavior.gapCodes.slice(0, 12)) {
    assert.ok(audit.remaining.some(line => line.includes(code)), `${code} 的逐卡缺口没有进 remaining`)
  }
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
  // 2026-10-27「议程推进清除场上毁灭」规则修复后重录基线：786 → 782 步（notz-midnight-masks 少 4 步）。
  assert.equal(scope.baseline.goldenReplay.steps, 782)
  // 分片草案覆盖全部三包：调查员 + 4 波玩家卡 + 9 章。
  assert.equal(scope.shards.investigators.formal.length, 6)
  assert.equal(scope.shards.investigators.story.length, 4)
  // 调查员包剩下的 13 张是专属卡（含专属弱点）：6 + 4 + 13 = 23 张调查员侧记录。
  assert.equal(scope.shards.investigators.signature.length, 13)
  // 序章故事调查员带 encounterCode，登记在战役包（P10 起战役已开放，但故事调查员仍不进选人）。
  for (const code of scope.shards.investigators.story) assert.ok(CAMPAIGN_CARD_CODES.includes(code))
  assert.equal(scope.shards.playerWaves.reduce((sum, wave) => sum + wave.codes.length, 0), 87)
  assert.equal(scope.shards.chapters.length, 9)
})
