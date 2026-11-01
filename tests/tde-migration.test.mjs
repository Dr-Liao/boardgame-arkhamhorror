// 食梦者（The Dream Eaters）P10 发布回归：范围、三包/8 章生产注册、三组确认与可复算发布账本。
//
// 里程碑口径：P1 锁定范围（388 = 352 主卡 + 36 关联面，三包 283/18/87，20 遭遇组，8 章）；
// P4 关键词 7/7 + 规则书 17 条/6 项；P6 五位调查员；P7 87 张玩家卡；P8 8 章逐章 12 项 +
// 三幕间 + 16 段尾声数据 + 剧情自译；P9 全卡 388/388 + 真实浏览器；P9.5 双线 10 门禁；
// P10 三包 + 战役 + 8 章进 content/registered.js（playable、dualLineGate open、assertLaunchable 通过），
// 发布账本 audit/tde-migration.json 记录 playable + earlyAccess（equivalenceCertified=false）+ 完整 remaining。
//
// 本测试不做字符串猜结论：卡数/包状态/章节状态来自生产注册表与卡池，账本字段与 --check 逐字节复算、
// sources/evidence 哈希与磁盘对账；任何内容或证据变化都必须重新 --write 账本。
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { contentRegistry } from '../content/registered.js'
import { campaignListForUi } from '../content/registry.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CAMPAIGN_CARD_CODES, CAMPAIGN_FACE_CODES } from '../content/packs/tdeCampaign/manifest.js'
import { INVESTIGATOR_CARD_CODES } from '../content/packs/tdeInvestigators/manifest.js'
import { PLAYER_CARD_CODES } from '../content/packs/tdePlayer/manifest.js'
import {
  ENCOUNTER_GROUP_IDS, INVESTIGATOR_CODES, MODES, chapters,
} from '../content/campaigns/theDreamEaters/shared.js'
import { TDE_KEYWORDS, TDE_RULE_IDS } from '../content/campaigns/theDreamEaters/keywords.js'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const SCOPE_PATH = 'artifacts/migration/tde/scope.json'
const AUDIT_PATH = 'audit/tde-migration.json'
const scope = JSON.parse(readFileSync(new URL(`../${SCOPE_PATH}`, import.meta.url), 'utf8'))
const audit = JSON.parse(readFileSync(new URL(`../${AUDIT_PATH}`, import.meta.url), 'utf8'))
const sha256File = path => createHash('sha256').update(readFileSync(new URL(`../${path}`, import.meta.url))).digest('hex')
const exists = path => existsSync(new URL(`../${path}`, import.meta.url))
// 逐章 12 项检查（P8/P9 口径）：每章账本必须 12 项全真，缺一不可。
const SCENARIO_CHECK_KEYS = [
  'sourceLocked', 'identityRegistered', 'setupAndZones', 'actsAndAgendas', 'locationsAndConnections',
  'encounterBehaviors', 'literalCardBehavior', 'chaosEffects', 'resolutionsAndRecords', 'storyText',
  'saveReplay', 'browserAcceptance',
]

function run(script, args = []) {
  // 子进程检查不应继承 node:test 的 worker 标记，确保直接运行与套件内运行口径一致。
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  delete env.NODE_TEST_WORKER_ID
  return spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT, encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024, env,
  })
}

test('P1 范围：352 主卡 + 36 关联面 = 388 条记录，三包 283/18/87 无重叠无遗漏', () => {
  const cards = Object.keys(ALL_CARDS)
  const main = cards.filter(code => /^06\d{3}$/.test(code))
  const faces = cards.filter(code => /^06\d{3}[a-z]$/.test(code))
  assert.equal(main.length, 352)
  assert.equal(faces.length, 36)
  assert.equal(main.length + faces.length, 388)
  // 包分区：战役 249 主 + 34 面 = 283；调查员 16 主 + 2 面 = 18；玩家 87 主 = 87。
  assert.equal(CAMPAIGN_CARD_CODES.length, 249)
  assert.equal(CAMPAIGN_FACE_CODES.length, 34)
  assert.equal(CAMPAIGN_CARD_CODES.length + CAMPAIGN_FACE_CODES.length, 283)
  assert.equal(INVESTIGATOR_CARD_CODES.length, 16)
  assert.equal(PLAYER_CARD_CODES.length, 87)
  const allMain = new Set([...CAMPAIGN_CARD_CODES, ...INVESTIGATOR_CARD_CODES, ...PLAYER_CARD_CODES])
  assert.equal(allMain.size, 352, '三包主卡不得重叠')
  assert.deepEqual([...allMain].sort(), [...main].sort(), '三包主卡覆盖全部 352 张')
  assert.equal(scope.counts.records, 388)
  assert.equal(scope.unassigned.main.length, 0)
  assert.equal(scope.unassigned.faces.length, 0)
  assert.equal(scope.gate.pass, true)
  // P10：scope 的 gate 追加 registration 项（战役已注册进生产组合根、8 章 launchable）。
  assert.equal(scope.gate.registration.pass, true)
  assert.equal(scope.gate.registration.registered, true)
  assert.equal(scope.gate.registration.launchable, 8)
  assert.equal(scope.gate.registration.chapters, 8)
  assert.equal(audit.counts.records, 388)
  assert.equal(audit.counts.main, 352)
  assert.equal(audit.counts.faces, 36)
})

test('P10 生产注册：三包与 8 章 playable、assertLaunchable 通过、大厅可见、gate pass', () => {
  for (const [id, cards, records] of [['tdeCampaign', 249, 283], ['tdeInvestigators', 16, 18], ['tdePlayer', 87, 87]]) {
    const pack = contentRegistry.getPack(id)
    assert.ok(pack, `${id} 应已注册`)
    assert.equal(pack.status, 'playable', `${id} 应为 playable`)
    assert.equal(pack.cards.length, cards)
    assert.equal(pack.cards.filter(card => card.rulesImplemented).length, cards, `${id} 全部卡应有实现声明`)
    const ledgerPack = audit.packs.find(entry => entry.id === id)
    assert.ok(ledgerPack, `账本缺少卡包 ${id}`)
    assert.equal(ledgerPack.status, 'playable')
    assert.equal(ledgerPack.records, records)
  }
  // 20 个遭遇组登记在战役包：8 章节组 + 12 共享组。
  const campaignPack = contentRegistry.getPack('tdeCampaign')
  assert.deepEqual([...campaignPack.encounterGroupIds], [...ENCOUNTER_GROUP_IDS])
  assert.equal(campaignPack.encounterGroupIds.length, 20)

  const campaign = contentRegistry.getCampaign('theDreamEaters')
  assert.equal(campaign.status, 'playable')
  assert.equal(campaign.scenarioIds.length, 8)
  assert.equal(campaign.dualLineGate, 'open')
  assert.deepEqual([...campaign.modes], [...MODES])
  assert.deepEqual(Object.keys(campaign.flows).sort(), [...MODES].sort())
  const knownGroups = new Set([...ENCOUNTER_GROUP_IDS,
    ...contentRegistry.listPacks().flatMap(pack => pack.encounterGroupIds)])
  for (const chapter of chapters) {
    const scenario = contentRegistry.getScenario(chapter.id)
    assert.equal(scenario.status, 'playable', `${chapter.id} 应为 playable`)
    assert.equal(scenario.campaignId, 'theDreamEaters')
    assert.equal(scenario.referenceCode, chapter.code, `${chapter.id} 的参考卡号`)
    assert.ok(scenario.requiredEncounterGroupIds.includes(chapter.id), `${chapter.id} 应引用自己的章节组`)
    const ledgerChapter = audit.chapters.find(entry => entry.id === chapter.id)
    assert.ok(ledgerChapter, `账本缺少章节 ${chapter.id}`)
    assert.equal(ledgerChapter.status, 'playable')
    assert.equal(ledgerChapter.pass, true, `${chapter.id} 逐章事实应通过`)
  }
  // 大厅数据只列可启动战役：TDE 必须出现（含 8 章与战役总览），且 assertLaunchable 通过。
  const hall = campaignListForUi(contentRegistry)
  const tde = hall.find(item => item.id === 'theDreamEaters')
  assert.ok(tde, '大厅必须出现《食梦者》')
  assert.equal(tde.status, 'playable')
  assert.equal(tde.scenarios.length, 8)
  const launched = contentRegistry.assertLaunchable('theDreamEaters')
  assert.equal(launched.id, 'theDreamEaters')
  assert.equal(launched.status, 'playable')
  // 账本里的发布事实必须与实时注册表一致（不是手写冻结）。
  assert.equal(audit.status, 'playable')
  assert.equal(audit.playable, true)
  assert.equal(audit.launchEnabled, true)
  assert.equal(audit.campaign.launchBlocked, false)
  assert.equal(audit.campaign.launchError, null)
  assert.equal(audit.campaign.lobbyVisible, true)
  assert.equal(audit.campaign.chapters, 8)
  assert.equal(audit.campaign.dualLineGate, 'open')
  assert.equal(audit.scenarios.length, 8)
  assert.equal(audit.gate.campaignLaunchable.pass, true)
  assert.equal(audit.gate.launchEnabled.pass, true)
  assert.equal(audit.gate.chaptersLaunchable.pass, true)
  assert.equal(audit.gate.packsByPhase.pass, true)
  assert.equal(audit.gate.pass, true, 'P10 发布 gate 必须整体通过')
})

test('P10 账本：schema/范围/三包/8 章/关键词/规则书/逐卡/并行/浏览器 与真实数据复算一致', () => {
  assert.ok(exists(AUDIT_PATH), '发布账本 audit/tde-migration.json 必须存在')
  assert.equal(audit.schemaVersion, 2)
  assert.equal(audit.cycle, 'tde')
  assert.equal(audit.cycleNameZh, '食梦者')
  assert.equal(audit.campaignId, 'theDreamEaters')
  assert.equal(audit.milestone, 'M5')
  assert.equal(audit.stage, 'P10')
  assert.equal(audit.generatedBy, 'tools/audit-tde.mjs')
  assert.equal(audit.docs, 'docs/tde-migration-roadmap.md')
  // 范围账本与三包账（账本 = 范围，不是另一套数字）。
  assert.equal(audit.scope.path, SCOPE_PATH)
  assert.equal(audit.scope.sha256, sha256File(SCOPE_PATH))
  assert.deepEqual(audit.packs.map(pack => pack.cards), [249, 16, 87])
  assert.deepEqual(audit.packs.map(pack => pack.records), [283, 18, 87])
  assert.deepEqual(audit.packs.map(pack => pack.faces), [34, 2, 0])
  assert.equal(audit.counts.records, 388)
  assert.equal(audit.counts.chapters, 8)
  assert.equal(audit.counts.encounterGroups, 20)
  assert.equal(audit.counts.parts, 2)
  assert.equal(audit.counts.pairs, 4)
  assert.equal(audit.counts.modes, 4)
  assert.equal(Object.keys(audit.recordSchema).length, 55)
  assert.deepEqual(audit.investigatorCodes, [...INVESTIGATOR_CODES])
  assert.equal(audit.encounterGroups.length, ENCOUNTER_GROUP_IDS.length)
  // 关键词 7/7：由卡面来源 + 引擎导出 + 规则书条目 + 卡文直达 + 实跑测试五项计算。
  assert.equal(audit.confirmations.keywords.status, 'verified')
  assert.equal(audit.confirmations.keywords.total, TDE_KEYWORDS.length)
  assert.equal(audit.confirmations.keywords.verified, 7)
  assert.equal(audit.confirmations.keywords.items.length, 7)
  for (const item of audit.confirmations.keywords.items) {
    assert.equal(item.status, 'verified', `${item.id} 应 verified`)
    assert.equal(Object.keys(item.checks).length, 5)
    assert.ok(Object.values(item.checks).every(Boolean), `${item.id} 五项检查应全真`)
  }
  assert.equal(audit.gate.keywordsVerified.verified, 7)
  assert.equal(audit.gate.keywordScanAligned.pass, true)
  // 规则书 17 条 + 6 项检查（含桌面/移动浏览器）。
  assert.equal(audit.confirmations.rulebook.status, 'verified')
  assert.equal(audit.confirmations.rulebook.entries, TDE_RULE_IDS.length)
  assert.deepEqual(audit.confirmations.rulebook.requiredRuleIds, [...TDE_RULE_IDS])
  assert.deepEqual(Object.keys(audit.confirmations.rulebook.checks).sort(), [
    'campaignOverview', 'cardLinks', 'desktopBrowser', 'keywordEntries', 'mobileBrowser', 'scenarioMechanics',
  ])
  assert.ok(Object.values(audit.confirmations.rulebook.checks).every(Boolean))
  assert.equal(audit.gate.rulebookEntries.present, 17)
  assert.equal(audit.gate.rulebookVerified.pass, true)
  // 机制登记：17 条 TDE 规则在 content/mechanics.js 的支持机制集合里。
  assert.equal(audit.gate.mechanicsRegistered.registered, TDE_RULE_IDS.length)
  assert.equal(audit.gate.mechanicsRegistered.mismatches.length, 0)
  // 剧本确认组：8 章 × 12 项全真 + 253/253 章节记录覆盖 + 0 待实现遭遇卡 + 账本 status=verified。
  assert.equal(audit.confirmations.scenarios.status, 'verified')
  assert.equal(audit.confirmations.scenarios.chapters, 8)
  assert.equal(audit.confirmations.scenarios.items.length, 8)
  for (const item of audit.confirmations.scenarios.items) {
    assert.equal(item.status, 'verified', `${item.id} 应 verified`)
    for (const key of SCENARIO_CHECK_KEYS) assert.equal(item.checks[key], true, `${item.id} 的 ${key} 应 true`)
  }
  assert.equal(audit.confirmations.scenarios.checks.ledgerVerified, true)
  assert.equal(audit.confirmations.scenarios.checks.fileHashesFresh, true)
  assert.equal(audit.confirmations.scenarios.checks.recordsCovered, true)
  assert.equal(audit.confirmations.scenarios.checks.nodeAcceptance, true)
  assert.equal(audit.gate.scenariosVerified.total, 8)
  assert.equal(audit.gate.scenariosVerified.verified, 8)
  assert.equal(audit.gate.scenariosVerified.pendingEncounterCards, 0)
  assert.equal(audit.gate.scenariosVerified.chapterRecords, 253)
  assert.equal(audit.gate.scenariosVerified.coveredChapterRecords, 253)
  assert.equal(audit.gate.scenariosVerified.pass, true)
  // 全卡账本：388/388 verified，两套分区守恒，87 条显式简化（P7 57 + P8 30），415 例实跑证据 6 文件。
  assert.equal(audit.gate.allCardsVerified.total, 388)
  assert.equal(audit.gate.allCardsVerified.records, 352)
  assert.equal(audit.gate.allCardsVerified.faces, 36)
  assert.equal(audit.gate.allCardsVerified.verified, 388)
  assert.equal(audit.gate.allCardsVerified.pending, 0)
  assert.deepEqual(audit.gate.allCardsVerified.partitions,
    { campaign: 283, investigator: 18, player: 87, face: 36 })
  assert.equal(audit.gate.allCardsVerified.simplified, 87)
  assert.equal(audit.gate.allCardsVerified.simplifiedPlayer, 57)
  assert.equal(audit.gate.allCardsVerified.simplifiedCampaign, 30)
  assert.equal(audit.gate.allCardsVerified.testFiles, 6)
  assert.equal(audit.gate.allCardsVerified.testsPassed, 415)
  assert.equal(audit.gate.allCardsVerified.testFilesFresh, true)
  assert.equal(audit.gate.allCardsVerified.pass, true)
  // 并行双线：10/10 门禁、46 例 Node 证据、dualLineGate open、开闸证据账本 fresh。
  assert.equal(audit.gate.parallelVerified.status, 'passed')
  assert.equal(audit.gate.parallelVerified.gates, 10)
  assert.equal(audit.gate.parallelVerified.gatesCovered, 10)
  assert.equal(audit.gate.parallelVerified.gatePassCount, 10)
  assert.equal(audit.gate.parallelVerified.tests, 46)
  assert.equal(audit.gate.parallelVerified.dualLineGate, 'open')
  assert.equal(audit.gate.parallelVerified.filesFresh, true)
  assert.equal(audit.gate.parallelVerified.pass, true)
  // 浏览器：7 spec 集合与 playwright.tde.config.mjs 一致；计数从账本现读（不硬编码 54/71）。
  const browser = audit.gate.browserAcceptance
  assert.equal(browser.status, 'passed')
  assert.equal(browser.specs.length, browser.expectedSpecs.length)
  assert.equal(browser.specsComplete, true)
  assert.equal(browser.desktop, true)
  assert.equal(browser.mobile, true)
  assert.equal(browser.release.desktop, true)
  assert.equal(browser.release.mobile, true)
  assert.equal(browser.media.desktop, true)
  assert.equal(browser.media.mobile, true)
  assert.equal(browser.scenariosCovered, 8)
  assert.ok(browser.tests > 0, '浏览器用例数应从账本现读且大于 0')
  assert.ok(browser.screenshots > 0, '浏览器截图数应从账本现读且大于 0')
  assert.equal(browser.tests, audit.evidence.browser.tests)
  assert.equal(browser.screenshots, audit.evidence.browser.screenshots)
  assert.equal(browser.pass, true)
  // 剧情账本：8 章正文 / 16 段尾声 / 3 幕间 / 55 记录键的翻译证据。
  assert.equal(audit.gate.storyVerified.status, 'translated')
  assert.equal(audit.gate.storyVerified.chapters, 8)
  assert.equal(audit.gate.storyVerified.epilogueCells, 16)
  assert.equal(audit.gate.storyVerified.interludes, 3)
  assert.equal(audit.gate.storyVerified.recordLabels, 55)
  assert.equal(audit.gate.storyVerified.pass, true)
  // Node 验收字段：spawnSync 实跑一组 TDE 文件（含 rules/investigators/all-card-ledger）。
  const nodeTests = audit.gate.nodeAcceptance
  assert.equal(nodeTests.command, audit.tests.command)
  assert.equal(nodeTests.tests, audit.tests.tests)
  assert.equal(nodeTests.failed, 0)
  assert.equal(nodeTests.passed, nodeTests.tests)
  assert.equal(nodeTests.missingFiles.length, 0)
  assert.ok(nodeTests.tests >= 600, 'Node 验收应覆盖逐卡/逐章主证据（当前 645 例）')
  assert.equal(nodeTests.files.length, nodeTests.fileCount)
  for (const required of [
    'tests/tde-rules.test.mjs', 'tests/tde-investigators.test.mjs', 'tests/tde-all-card-ledger.test.mjs',
  ]) assert.ok(nodeTests.files.includes(required), `Node 验收应包含 ${required}`)
  for (const [file, counts] of Object.entries(audit.tests.perFile)) {
    assert.equal(counts.failed, 0, `${file} 不应有失败用例`)
    assert.ok(counts.passed > 0, `${file} 应至少运行 1 例`)
  }
  // 原语账本：29/29 done，P7 5 + P8 11 = 16 条原语请求债务（remaining 里逐条口径）。
  assert.equal(audit.gate.primitivesDone.new, 29)
  assert.equal(audit.gate.primitivesDone.done, 29)
  assert.equal(audit.gate.primitivesDone.unfinished.length, 0)
  assert.equal(audit.primitives.outstanding.p7Rejected, 5)
  assert.equal(audit.primitives.outstanding.p8Outstanding, 11)
  assert.equal(audit.primitives.outstanding.total, 16)
  // sources / evidence 哈希与磁盘一致（证据过期即失败）。
  for (const source of audit.sources) {
    assert.match(String(source.sha256), /^[0-9a-f]{64}$/, `${source.path} 缺少 sha256`)
    assert.ok(exists(source.path), `${source.path} 应存在`)
    assert.equal(sha256File(source.path), source.sha256, `${source.path} 哈希与内容不一致`)
  }
  for (const [path, hash] of Object.entries(audit.evidence.files)) {
    assert.match(String(hash), /^[0-9a-f]{64}$/, `${path} 缺少证据 sha256`)
    assert.equal(sha256File(path), hash, `${path} 证据哈希与内容不一致`)
  }
})

test('P10 发布口径：playable + earlyAccess + equivalenceCertified=false，三组 verified，remaining 完整', () => {
  assert.equal(audit.status, 'playable')
  assert.equal(audit.playable, true)
  assert.equal(audit.launchEnabled, true)
  assert.equal(audit.earlyAccess, true)
  assert.equal(audit.equivalenceCertified, false)
  assert.match(audit.earlyAccessReason, /87 条显式简化/)
  assert.match(audit.earlyAccessReason, /equivalenceCertified=false/)
  assert.match(audit.earlyAccessReason, /并行共享幕间/)
  assert.match(audit.earlyAccessReason, /真实联机双真人房间未验收/)
  assert.equal(typeof audit.verifiedScope, 'string')
  assert.match(audit.verifiedScope, /earlyAccess/)
  assert.match(audit.verifiedScope, /不宣称/)
  for (const group of ['scenarios', 'keywords', 'rulebook']) {
    assert.equal(audit.confirmations[group].status, 'verified', `${group} 确认组应 verified`)
  }
  assert.equal(audit.gate.pass, true)
  assert.equal(audit.gate.releaseGate.pass, true)
  // remaining 必须如实列出未完成/边界（不得写成完成）。
  const remainingText = audit.remaining.join('\n')
  assert.match(remainingText, /P7 57 \+ P8 30 = 87 条显式简化/)
  assert.match(remainingText, /原语请求待还账/)
  assert.match(remainingText, /P7 5 条 \+ P8 11 条 rejected 原语请求待还账/)
  assert.match(remainingText, /合计 16 条/)
  assert.match(remainingText, /并行共享幕间 II\/III 与 16 段尾声矩阵未接线/)
  assert.match(remainingText, /真实联机双真人房间未验收/)
  assert.match(remainingText, /B4/)
  assert.match(remainingText, /resolution2/)
  assert.match(remainingText, /银钥匙 06189 是 setAside 剧情资产/)
  assert.match(remainingText, /P10 已重采 baseline/)
  assert.match(remainingText, /后续改内容\/测试需重跑/)
  assert.ok(audit.remaining.length >= 8, 'remaining 应至少覆盖 87 简化/原语债务/并行幕间/联机/B4/银钥匙/baseline/发布口径')
  // baseline 维护口径：只记 retaken/milestone，不记录文件内容哈希或逐 audit status（发布收尾会连写
  // 两次 baseline，记哈希/status 会形成循环依赖或二次漂移；remaining 负责可读的维护口径）。
  assert.equal(audit.baseline.path, 'audit/baseline.json')
  assert.equal(audit.baseline.retaken, true, 'baseline 应已 P10 重采')
  assert.equal(audit.baseline.milestone, 'P10')
  assert.equal(audit.baseline.note, null)
  assert.deepEqual(Object.keys(audit.baseline).sort(), ['milestone', 'note', 'path', 'retaken'],
    'baseline 字段只允许 path/retaken/milestone/note（不得记录哈希或逐项 status）')
  assert.equal(audit.evidence.files['audit/baseline.json'], undefined, 'evidence 不应记录 baseline 文件哈希')
  assert.equal(audit.gate.browserAcceptance.pass, true, '浏览器证据必须真实通过（不手写补）')
})

test('P10 账本 --check 逐字节复算（内容/证据变化即失败）', () => {
  const result = run('tools/audit-tde.mjs', ['--check'])
  assert.equal(result.status, 0, `${result.stdout || ''}\n${result.stderr || ''}`)
  assert.match(String(result.stdout), /audit 复算一致/)
})
