// 食梦者（The Dream Eaters）P9：全卡逐卡验收账本守卫。
//
// 账本由 tools/audit-tde-all-cards.mjs **实跑** 6 个测试文件后生成；本测试不做字符串猜结论，
// 只做「单一事实源」对账：
//   1. 388 条记录全覆盖：包分区 campaign 283 / investigator 18 / player 87 与形态分区 main 352 + face 36
//      两套各自守恒；34 战役面 + 2 调查员面（06015a/b）；10 条 noEntry 逐条有理由；
//   2. 账本 summary 与 entries、原始卡面数据（ALL_CARDS）、包 manifest 的 verified 函数对账；
//   3. testFiles 哈希与磁盘一致（证据过期即失败）、证据文件真实存在；
//   4. 生成模块 src/cards/tde-campaign-acceptance.js 的 sha256 与 JSON 账本逐字节对账，
//      verified/pending/simplified 集合与 entries 一致；
//   5. 逐卡证据形状（实跑测试名/文件/行号）与人工备注注册表一致；
//   6. simplified 83 = P7 53 + P8 单卡 22 + P8 章节 gap 12→8 锚点；12 条 gap 全部由
//      audit/tde-scenario-gap-triage.json 登记（gap 原文 = 各章 behavior.scenarioGaps[index]）；
//   7. 运行时 availability 分层（玩家/调查员 strict、战役 catalog-only）与账本一致；
//   8. 不存在未登记卡、越界卡、重复卡。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { NON_PLAYER_ABILITY_ENTRIES } from '../src/cards/encounter-abilities.js'
import { implementedFor } from '../src/cards/card-rules.js'
import { getAvailability, isCardAvailable } from '../src/deck/availability.js'
import {
  CAMPAIGN_CARD_CODES, CAMPAIGN_FACE_CODES, manifest as tdeCampaignManifest,
} from '../content/packs/tdeCampaign/manifest.js'
import {
  INVESTIGATOR_CARD_CODES, UNOWNED_FACE_OVERRIDES,
  TDE_INVESTIGATOR_ACCEPTANCE_PROFILE, tdeInvestigatorCardVerified,
} from '../content/packs/tdeInvestigators/manifest.js'
import {
  PLAYER_CARD_CODES, TDE_PLAYER_BUILDABLE_CODES, TDE_PLAYER_DEPENDENCY_CODES,
  TDE_PLAYER_BASIC_WEAKNESS_CODES,
} from '../content/packs/tdePlayer/manifest.js'
import {
  tdePlayerCardVerified, TDE_PLAYER_ACCEPTANCE_PROFILE,
} from '../src/cards/tde-player-acceptance.js'
import { TDE_PACKS, tdeCards } from '../content/campaigns/theDreamEaters/card-data.js'
import { chapters } from '../content/campaigns/theDreamEaters/shared.js'
import {
  TDE_CARD_ACCEPTANCE_NOTES, TDE_SCENARIO_GAP_CARDS, TDE_SCENARIO_GAP_TRIAGE_FILE,
  TDE_P6_SIMPLIFICATION_CODES, TDE_NO_ENTRY_CODES, TDE_NO_ENTRY_REASONS,
} from '../content/campaigns/theDreamEaters/card-acceptance.js'
import {
  TDE_ALL_CARD_ACCEPTANCE_PROFILE,
  TDE_ALL_CARD_ACCEPTANCE_SHA256,
  TDE_CAMPAIGN_VERIFIED_CODES,
  TDE_CAMPAIGN_PENDING_CODES,
  TDE_CAMPAIGN_MAIN_VERIFIED_CODES,
  TDE_CAMPAIGN_FACE_VERIFIED_CODES,
  TDE_CAMPAIGN_SIMPLIFIED_CODES,
  TDE_INVESTIGATOR_RECORD_VERIFIED_CODES,
  TDE_ALL_CARD_VERIFIED_CODES,
  TDE_ALL_CARD_SIMPLIFIED_CODES,
  tdeAllCardAcceptance,
  tdeCampaignCardVerified,
  tdeCampaignCardPending,
  tdeCampaignMainVerified,
  tdeCampaignFaceVerified,
  tdeCampaignCardAcceptanceSimplified,
  tdeInvestigatorRecordVerified,
  tdeAllCardVerified,
} from '../src/cards/tde-campaign-acceptance.js'

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(gameRoot, '../..')
const ledgerFile = 'audit/tde-all-card-acceptance.json'
const ledgerBytes = fs.readFileSync(path.join(gameRoot, ledgerFile))
const ledger = JSON.parse(ledgerBytes.toString('utf8'))
const entries = ledger.entries
const entryByCode = new Map(entries.map(entry => [entry.code, entry]))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const sorted = values => [...values].sort()

const expectedTestFiles = [
  'games/arkhamhorror/tests/tde-investigators.test.mjs',
  'games/arkhamhorror/tests/tde-player-m2-1.test.mjs',
  'games/arkhamhorror/tests/tde-player-m2-2.test.mjs',
  'games/arkhamhorror/tests/tde-player-m2-3.test.mjs',
  'games/arkhamhorror/tests/tde-player-m2-4.test.mjs',
  'games/arkhamhorror/tests/tde-campaign-card-acceptance.test.mjs',
]
const campaignCodes = new Set(CAMPAIGN_CARD_CODES)
const campaignFaceCodes = new Set(CAMPAIGN_FACE_CODES)
const investigatorCodes = new Set(INVESTIGATOR_CARD_CODES)
const playerCodes = new Set(PLAYER_CARD_CODES)
const investigatorFaceCodes = new Set(['06015a', '06015b'])
const noEntryCodes = new Set(TDE_NO_ENTRY_CODES)
const scenarioReferenceCodes = new Set(chapters.map(chapter => chapter.code))
const tde = tdeCards()

test('TDE 全卡账本：388 条记录全覆盖且包分区/形态分区两套守恒', () => {
  assert.equal(entries.length, 388)
  assert.equal(new Set(entries.map(entry => entry.code)).size, 388, '账本存在重复卡号')
  assert.equal(tde.length, 388)
  assert.deepEqual(sorted(entries.map(entry => entry.code)), sorted(tde.map(card => card.code)),
    '账本与 TDE_PACKS 的 06 记录不一致（多卡/漏卡）')

  // 包分区：283 + 18 + 87 = 388（面随包）。
  const { summary } = ledger
  assert.equal(summary.campaign, 283)
  assert.equal(summary.investigator, 18)
  assert.equal(summary.player, 87)
  assert.equal(summary.campaign + summary.investigator + summary.player, 388, '包分区不守恒')
  assert.equal(entries.filter(entry => entry.pack === 'tdeCampaign').length, 283)
  assert.equal(entries.filter(entry => entry.pack === 'tdeInvestigators').length, 18)
  assert.equal(entries.filter(entry => entry.pack === 'tdePlayer').length, 87)

  // 形态分区：main 352 + face 36 = 388。
  assert.equal(summary.main, 352)
  assert.equal(summary.face, 36)
  assert.equal(summary.main + summary.face, 388, '形态分区不守恒')
  assert.equal(summary.campaignMain, 249)
  assert.equal(summary.campaignFaces, 34)
  assert.equal(summary.investigatorMain, 16)
  assert.equal(summary.investigatorFaces, 2)
  assert.equal(summary.playerMain, 87)
  assert.equal(summary.campaignMain + summary.campaignFaces, summary.campaign)
  assert.equal(summary.investigatorMain + summary.investigatorFaces, summary.investigator)

  for (const entry of entries) {
    const card = ALL_CARDS[entry.code]
    assert.ok(card, `账本记录了不存在的卡：${entry.code}`)
    assert.match(entry.code, /^06\d{3}[a-z]?$/, `账本混入非 06 记录：${entry.code}`)
    assert.ok(['tdeCampaign', 'tdeInvestigators', 'tdePlayer'].includes(entry.pack),
      `${entry.code} 的包分区非法：${entry.pack}`)
    assert.ok(['main', 'face'].includes(entry.kind), `${entry.code} 的形态分区非法：${entry.kind}`)
    assert.ok(TDE_PACKS.has(entry.printPack), `${entry.code} 的印刷包不在食梦者 7 包内：${entry.printPack}`)
    assert.equal(entry.kind, /^06\d{3}$/.test(entry.code) ? 'main' : 'face')
    assert.equal(entry.pack, campaignCodes.has(entry.code) || campaignFaceCodes.has(entry.code)
      ? 'tdeCampaign'
      : investigatorCodes.has(entry.code) || investigatorFaceCodes.has(entry.code)
        ? 'tdeInvestigators' : 'tdePlayer', `${entry.code} 包分区与包清单不一致`)
    assert.equal(entry.noEntry, noEntryCodes.has(entry.code), `${entry.code} noEntry 标记不一致`)
  }
  // 34 战役面 + 2 调查员面：06015a/b 归调查员包，06169a/b 归战役包。
  assert.deepEqual(sorted(entries.filter(entry => entry.kind === 'face').map(entry => entry.code)),
    sorted([...campaignFaceCodes, '06015a', '06015b']))
  for (const code of ['06015a', '06015b']) {
    assert.equal(entryByCode.get(code).pack, 'tdeInvestigators')
    assert.equal(UNOWNED_FACE_OVERRIDES[code].pack, 'tdeInvestigators')
  }
  for (const code of ['06169a', '06169b']) {
    assert.equal(entryByCode.get(code).pack, 'tdeCampaign')
    assert.equal(UNOWNED_FACE_OVERRIDES[code].pack, 'tdeCampaign')
  }
  // 8 张剧本参考卡的回指章节。
  assert.equal(summary.scenarioReferenceCards, 8)
  for (const chapter of chapters) {
    assert.equal(entryByCode.get(chapter.code).chapterId, chapter.id,
      `${chapter.code} 的 chapterId 与章节不一致`)
    assert.equal(entryByCode.get(chapter.code).noEntry, true)
  }
})

test('TDE 全卡账本 summary 与 entries / 卡面数据 / 玩家开放口径对账', () => {
  const { summary, profile } = ledger
  assert.equal(profile.id, TDE_ALL_CARD_ACCEPTANCE_PROFILE.id)
  assert.deepEqual(profile.inheritedProfiles,
    [TDE_INVESTIGATOR_ACCEPTANCE_PROFILE.id, TDE_PLAYER_ACCEPTANCE_PROFILE.id])
  assert.equal(summary.total, entries.length)
  assert.equal(summary.verified, entries.filter(entry => entry.status === 'verified').length)
  assert.equal(summary.pending, entries.filter(entry => entry.status === 'pending').length)
  assert.equal(summary.verified + summary.pending, summary.total)
  assert.equal(summary.verified, 388)
  assert.equal(summary.pending, 0)
  assert.equal(summary.simplified, entries.filter(entry => entry.noteStatus === 'simplified').length)
  assert.equal(summary.testFiles, expectedTestFiles.length)
  assert.ok(Number.isInteger(summary.testsPassed) && summary.testsPassed > entries.length,
    '实跑用例数必须多于逐卡记录数（每卡至少 1 条证据）')
  assert.deepEqual(tdeAllCardAcceptance, summary)

  // 每条记录都必须在卡面数据里有真实身份，且状态/备注合法。
  for (const entry of entries) {
    const card = ALL_CARDS[entry.code]
    assert.equal(entry.name, card.nameZh || card.name, `${entry.code} 名称与卡面数据不一致`)
    assert.equal(entry.type, card.type, `${entry.code} 类型与卡面数据不一致`)
    assert.equal(entry.printPack, card.pack, `${entry.code} 印刷包与卡面数据不一致`)
    assert.equal(card.dataStatus, 'validated', `${entry.code} 卡面数据不是 validated`)
    assert.ok(['verified', 'pending'].includes(entry.status), `${entry.code} 状态非法`)
    assert.ok(['verified', 'simplified'].includes(entry.noteStatus), `${entry.code} noteStatus 非法`)
    if (entry.noteStatus === 'simplified') assert.ok(entry.note?.trim(), `${entry.code} simplified 必须写明近似说明`)
    if (entry.status === 'pending') {
      assert.fail(`${entry.code} 不应有 pending（P9 验收应为 0 pending）`)
    }
  }

  // 玩家 87 = buildable 72 + dependencyOnly 15（11 张 deckLimit=0 + 4 张基础弱点）；
  // 两个数字都从包 manifest/卡面数据独立复算。
  assert.equal(summary.buildable, TDE_PLAYER_BUILDABLE_CODES.length)
  assert.equal(summary.buildable, 72)
  assert.equal(summary.dependencyOnly, TDE_PLAYER_DEPENDENCY_CODES.length)
  assert.equal(summary.dependencyOnly, 15)
  assert.equal(summary.basicWeaknesses, TDE_PLAYER_BASIC_WEAKNESS_CODES.length)
  assert.equal(summary.basicWeaknesses, 4)
  assert.equal(summary.buildable + summary.dependencyOnly, summary.player)
  for (const code of TDE_PLAYER_BUILDABLE_CODES) {
    assert.equal(entryByCode.get(code).pack, 'tdePlayer', `${code} 可构筑但未归玩家分区`)
    assert.equal(entryByCode.get(code).status, 'verified')
  }
  for (const code of TDE_PLAYER_DEPENDENCY_CODES) {
    assert.equal(entryByCode.get(code).pack, 'tdePlayer', `${code} 依赖卡未归玩家分区`)
    assert.equal(entryByCode.get(code).status, 'verified')
  }

  // noEntry / 单卡条目 / 通道口径。
  assert.equal(summary.noEntry, 10)
  assert.equal(entries.filter(entry => entry.noEntry).length, 10)
  assert.equal(summary.recordsWithEntry, 273)
  assert.equal(entries.filter(entry => entry.pack === 'tdeCampaign' && !entry.noEntry).length, 273)
  assert.equal(summary.scenarioGaps, 0)
  const channels = entries.reduce((result, entry) => {
    result[entry.channel] = (result[entry.channel] || 0) + 1
    return result
  }, {})
  assert.deepEqual(channels, {
    descriptor: 103, 'encounter-entry': 273, 'scenario-definition': 8, 'linked-face': 2, engine: 2,
  })
})

test('TDE 全卡账本 testFiles 哈希与磁盘一致（证据过期即失败）+ 证据文件存在', () => {
  assert.deepEqual(ledger.testFiles.map(file => file.file), expectedTestFiles)
  for (const testFile of ledger.testFiles) {
    const disk = fs.readFileSync(path.join(repoRoot, testFile.file))
    assert.equal(testFile.sha256, hash(disk), `测试文件哈希过期：${testFile.file}`)
  }
  const testFileSet = new Set(ledger.testFiles.map(file => file.file))
  for (const entry of entries) {
    assert.ok(Array.isArray(entry.evidence) && entry.evidence.length > 0, `${entry.code} 缺少逐卡证据`)
    for (const evidence of entry.evidence) {
      assert.equal(typeof evidence.file, 'string')
      assert.ok(evidence.file.startsWith('games/arkhamhorror/tests/'), `${entry.code} 证据文件非法`)
      assert.ok(testFileSet.has(evidence.file), `${entry.code} 证据文件不在实跑清单里：${evidence.file}`)
      assert.ok(fs.existsSync(path.join(repoRoot, evidence.file)), `${entry.code} 证据文件不存在：${evidence.file}`)
    }
  }
})

test('TDE 全卡账本生成模块与 JSON 对账（sha256 / verified / pending / simplified 集合）', () => {
  assert.equal(TDE_ALL_CARD_ACCEPTANCE_SHA256, hash(ledgerBytes))
  assert.deepEqual(TDE_ALL_CARD_ACCEPTANCE_PROFILE, ledger.profile)

  const campaignVerified = entries
    .filter(entry => entry.pack === 'tdeCampaign' && entry.status === 'verified')
    .map(entry => entry.code)
  const campaignMainVerified = entries
    .filter(entry => entry.pack === 'tdeCampaign' && entry.kind === 'main' && entry.status === 'verified')
    .map(entry => entry.code)
  const campaignFaceVerified = entries
    .filter(entry => entry.pack === 'tdeCampaign' && entry.kind === 'face' && entry.status === 'verified')
    .map(entry => entry.code)
  const campaignPending = entries
    .filter(entry => entry.pack === 'tdeCampaign' && entry.status === 'pending')
    .map(entry => entry.code)
  const investigatorVerified = entries
    .filter(entry => entry.pack === 'tdeInvestigators' && entry.status === 'verified')
    .map(entry => entry.code)
  const allVerified = entries.filter(entry => entry.status === 'verified').map(entry => entry.code)
  const campaignSimplified = entries
    .filter(entry => entry.pack === 'tdeCampaign' && entry.noteStatus === 'simplified')
    .map(entry => entry.code)
  const allSimplified = entries.filter(entry => entry.noteStatus === 'simplified').map(entry => entry.code)

  assert.deepEqual(sorted(TDE_CAMPAIGN_VERIFIED_CODES), sorted(campaignVerified))
  assert.deepEqual(sorted(TDE_CAMPAIGN_MAIN_VERIFIED_CODES), sorted(campaignMainVerified))
  assert.deepEqual(sorted(TDE_CAMPAIGN_FACE_VERIFIED_CODES), sorted(campaignFaceVerified))
  assert.deepEqual(sorted(TDE_CAMPAIGN_PENDING_CODES), sorted(campaignPending))
  assert.deepEqual(sorted(TDE_INVESTIGATOR_RECORD_VERIFIED_CODES), sorted(investigatorVerified))
  assert.deepEqual(sorted(TDE_ALL_CARD_VERIFIED_CODES), sorted(allVerified))
  assert.deepEqual(sorted(TDE_CAMPAIGN_SIMPLIFIED_CODES), sorted(campaignSimplified))
  assert.deepEqual(sorted(TDE_ALL_CARD_SIMPLIFIED_CODES), sorted(allSimplified))
  assert.equal(TDE_CAMPAIGN_VERIFIED_CODES.length, 283)
  assert.equal(TDE_CAMPAIGN_MAIN_VERIFIED_CODES.length, 249)
  assert.equal(TDE_CAMPAIGN_FACE_VERIFIED_CODES.length, 34)
  assert.equal(TDE_CAMPAIGN_PENDING_CODES.length, 0)
  assert.equal(TDE_INVESTIGATOR_RECORD_VERIFIED_CODES.length, 18)
  assert.equal(TDE_ALL_CARD_VERIFIED_CODES.length, 388)
  assert.equal(TDE_ALL_CARD_SIMPLIFIED_CODES.length, 0)
  assert.equal(TDE_CAMPAIGN_SIMPLIFIED_CODES.length, 0)

  // 运行期读点与 entries 一致；非战役卡必须为 false。
  for (const entry of entries) {
    assert.equal(tdeAllCardVerified(entry.code), entry.status === 'verified', `${entry.code} allCardVerified`)
    assert.equal(tdeCampaignCardVerified(entry.code),
      entry.pack === 'tdeCampaign' && entry.status === 'verified', `${entry.code} campaignVerified`)
    assert.equal(tdeCampaignCardAcceptanceSimplified(entry.code),
      entry.pack === 'tdeCampaign' && entry.noteStatus === 'simplified', `${entry.code} campaignSimplified`)
    if (entry.kind === 'face') {
      assert.equal(tdeCampaignFaceVerified(entry.code), entry.pack === 'tdeCampaign'
        && entry.status === 'verified', `${entry.code} campaignFaceVerified`)
    }
    if (entry.pack === 'tdeInvestigators') {
      assert.equal(tdeInvestigatorRecordVerified(entry.code), entry.status === 'verified',
        `${entry.code} investigatorRecordVerified`)
    }
  }
  for (const code of ['06018', '06001', '06015a', '01001', '05001']) {
    assert.equal(tdeCampaignCardVerified(code), false, `${code} 不应被误标为战役记录`)
    assert.equal(tdeCampaignCardPending(code), false, `${code} 不应在战役 pending 集合`)
  }
  for (const code of ['06039', '06063', '06057b']) {
    assert.equal(tdeCampaignMainVerified(code), campaignCodes.has(code), `${code} campaignMainVerified`)
  }
  assert.equal(tdeAllCardVerified('01001'), false)
  assert.equal(tdeAllCardVerified('06018'), true)
})

test('TDE 全卡账本逐卡证据来自实跑测试（test:pass 形状 + 分区口径）', () => {
  for (const entry of entries) {
    if (entry.pack === 'tdeCampaign') {
      assert.equal(entry.evidence.length, 1, `${entry.code} 战役记录应恰有 1 条逐卡证据`)
      const evidence = entry.evidence[0]
      assert.match(evidence.test, new RegExp(`^TDE ${entry.code} (已验收|待实现) · `),
        `${entry.code} 的战役卡证据不是逐卡测试：${evidence.test}`)
      assert.ok(evidence.file.endsWith('tests/tde-campaign-card-acceptance.test.mjs'),
        `${entry.code} 的战役卡证据文件不对`)
      const label = evidence.test.includes('已验收') ? 'verified' : 'pending'
      assert.equal(entry.status, label, `${entry.code} 状态与测试名标签不一致`)
      assert.ok(Number.isInteger(evidence.line) && evidence.line > 0, `${entry.code} 证据缺少行号`)
    }
    if (entry.pack === 'tdePlayer') {
      assert.ok(entry.evidence.length >= 1)
      for (const evidence of entry.evidence) {
        assert.match(evidence.test, new RegExp(`^TDE ${entry.code} `),
          `${entry.code} 的玩家卡证据不是逐卡测试：${evidence.test}`)
        assert.ok(evidence.file.includes('tests/tde-player-m2-'))
        assert.equal(entry.status, tdePlayerCardVerified(entry.code) ? 'verified' : 'pending')
      }
    }
    if (entry.pack === 'tdeInvestigators') {
      assert.equal(entry.evidence.length, 1)
      const evidence = entry.evidence[0]
      assert.equal(evidence.file, 'games/arkhamhorror/tests/tde-investigators.test.mjs')
      assert.equal(evidence.profile, TDE_INVESTIGATOR_ACCEPTANCE_PROFILE.id)
      assert.ok(evidence.tests >= 25)
      assert.equal(entry.status, 'verified')
      if (investigatorCodes.has(entry.code)) {
        assert.equal(tdeInvestigatorCardVerified(entry.code), true)
      }
    }
  }
})

test('TDE 全卡账本完成验收：无简化、无未解决缺口，历史缺口保留修复证据', () => {
  const noteCodes = Object.keys(TDE_CARD_ACCEPTANCE_NOTES)
  assert.ok(noteCodes.every(code => entryByCode.has(code)), '备注注册表存在越界卡号')
  assert.equal(noteCodes.length, 0)
  for (const code of noteCodes) {
    const registered = TDE_CARD_ACCEPTANCE_NOTES[code]
    const entry = entryByCode.get(code)
    assert.equal(registered.status, 'simplified', `${code} 备注注册表应为 simplified`)
    assert.ok(registered.note?.trim(), `${code} simplified 备注必须写明近似口径`)
    assert.ok((registered.sources || []).length > 0, `${code} simplified 备注缺少来源`)
    assert.equal(entry.noteStatus, registered.status, `${code} 账本 noteStatus 与注册表不一致`)
    assert.equal(entry.note, registered.note, `${code} 账本 note 与注册表不一致`)
    assert.deepEqual(entry.noteSources, registered.sources)
  }
  assert.equal(ledger.summary.simplified, noteCodes.length)
  assert.equal(ledger.summary.simplified, 0)
  assert.equal(ledger.summary.simplifiedPlayer, 0)
  assert.equal(ledger.summary.simplifiedCampaign, 0)
  assert.equal(ledger.summary.simplifiedInvestigator, 0)
  assert.equal(ledger.summary.pending, 0)

  // P7 玩家 57 张与 audit/tde-player-acceptance.json 逐码、逐 note 一致。
  const playerLedger = JSON.parse(fs.readFileSync(
    path.join(gameRoot, 'audit/tde-player-acceptance.json'), 'utf8'))
  const playerSimplified = new Map(playerLedger.entries
    .filter(entry => entry.simplified).map(entry => [entry.code, entry.note]))
  assert.equal(playerSimplified.size, 0)
  const registeredPlayerSimplified = noteCodes.filter(code => playerCodes.has(code))
  assert.deepEqual(sorted(registeredPlayerSimplified), sorted(playerSimplified.keys()))
  for (const [code, note] of playerSimplified) {
    assert.equal(TDE_CARD_ACCEPTANCE_NOTES[code].note, note, `${code} 玩家 simplified note 漂移`)
    assert.ok(TDE_CARD_ACCEPTANCE_NOTES[code].sources.includes('P7'))
  }

  // P8 单卡条目 22 张 simplified===true 全部在注册表，note 与条目一致。
  const p8CardSimplified = NON_PLAYER_ABILITY_ENTRIES
    .filter(entry => (campaignCodes.has(entry.code) || campaignFaceCodes.has(entry.code))
      && entry.simplified === true)
    .map(entry => entry.code)
    .sort()
  assert.equal(p8CardSimplified.length, 0)
  for (const code of p8CardSimplified) {
    assert.equal(TDE_CARD_ACCEPTANCE_NOTES[code]?.status, 'simplified', `${code} P8 单卡简化未登记`)
    assert.equal(TDE_CARD_ACCEPTANCE_NOTES[code].note, entryByCode.get(code) && ALL_CARDS[code]
      && NON_PLAYER_ABILITY_ENTRIES.find(entry => entry.code === code).note)
    assert.ok(TDE_CARD_ACCEPTANCE_NOTES[code].sources.includes('P8-card'))
  }
  // P6 调查员简化 = 0（历史简化已在 P6/P8 还账）。
  assert.deepEqual(TDE_P6_SIMPLIFICATION_CODES, [])
  assert.deepEqual(playerLedger.summary.simplified, 0)

  // P8 章节 gap 12 条 → triage 逐条登记；锚点 8 个 code 全部 simplified，且与 TDE_SCENARIO_GAP_CARDS 一致。
  const triage = JSON.parse(fs.readFileSync(path.join(gameRoot, TDE_SCENARIO_GAP_TRIAGE_FILE), 'utf8'))
  assert.equal(triage.gaps.length, 0)
  assert.equal(triage.totalGaps, 0)
  assert.equal(triage.resolvedGaps.length,12)
  for (const gap of triage.resolvedGaps) {
    assert.equal(gap.status,'resolved')
    assert.ok(gap.evidence.length>0)
    for (const file of gap.evidence) assert.ok(fs.existsSync(path.join(gameRoot,file)),file)
  }
  const derivedGapCards = Object.fromEntries(chapters.map(chapter => [chapter.id, []]))
  const anchorCodes = new Set()
  const triageIds = new Set()
  for (const gap of triage.gaps) {
    const chapter = chapters.find(candidate => candidate.id === gap.chapterId)
    assert.ok(chapter, `triage gap 章节不存在：${gap.chapterId}`)
    assert.ok(!triageIds.has(gap.id), `triage gap id 重复：${gap.id}`)
    triageIds.add(gap.id)
    assert.ok(gap.codes.length > 0, `${gap.id} 没有锚点卡`)
    for (const code of gap.codes) {
      assert.equal(TDE_CARD_ACCEPTANCE_NOTES[code]?.status, 'simplified',
        `${gap.id} 锚点 ${code} 未登记 simplified`)
      assert.ok(TDE_CARD_ACCEPTANCE_NOTES[code].gaps.includes(gap.id),
        `${gap.id} 锚点 ${code} 缺少 gapRef`)
      assert.ok(entryByCode.get(code).chapters.includes(gap.chapterId),
        `${gap.id} 锚点 ${code} 不属于 ${gap.chapterId}`)
      assert.ok(entryByCode.get(code).gapRefs.includes(gap.id), `${code} 账本 gapRefs 缺 ${gap.id}`)
      derivedGapCards[gap.chapterId].push(code)
      anchorCodes.add(code)
    }
  }
  assert.equal(triageIds.size, 0)
  for (const chapter of chapters) {
    assert.deepEqual(sorted([...new Set(derivedGapCards[chapter.id])]),
      sorted(TDE_SCENARIO_GAP_CARDS[chapter.id] || []),
      `${chapter.id} 的 gap 落卡映射与 triage 不一致`)
  }
  assert.equal(anchorCodes.size, 0)
  const expectedCampaignSimplified = sorted([...p8CardSimplified, ...anchorCodes])
  assert.deepEqual(sorted(noteCodes.filter(code => campaignCodes.has(code) || campaignFaceCodes.has(code))),
    expectedCampaignSimplified)
  assert.equal(expectedCampaignSimplified.length, 0)
})

test('TDE 全卡账本运行时 availability 分层与账本一致（玩家/调查员 strict、战役 catalog-only）', () => {
  const campaignStatus = tdeCampaignManifest.status
  assert.ok(['development', 'playable'].includes(campaignStatus))
  for (const code of TDE_PLAYER_BUILDABLE_CODES) {
    const availability = getAvailability(code)
    assert.equal(availability.availability, 'strict', `${code} 可入牌组但 availability 非 strict`)
    assert.equal(availability.strictAccepted, true)
    assert.equal(availability.deckbuilding, true)
    assert.equal(availability.dependencyOnly, false)
    assert.equal(isCardAvailable(code), true)
    assert.match(availability.reason, /M2 食梦者玩家卡/, `${code} 的可用性原因口径不符`)
    assert.equal(entryByCode.get(code).status, 'verified')
  }
  for (const code of TDE_PLAYER_DEPENDENCY_CODES) {
    const availability = getAvailability(code)
    assert.equal(availability.strictAccepted, true, `${code} 依赖卡应 strict`)
    assert.equal(availability.dependencyOnly, true, `${code} 依赖卡 dependencyOnly 不为 true`)
    assert.equal(availability.deckbuilding, false, `${code} 依赖卡不应进构筑池`)
  }
  for (const code of INVESTIGATOR_CARD_CODES) {
    const availability = getAvailability(code)
    assert.equal(availability.strictAccepted, true, `${code} 调查员记录应 strict`)
    assert.match(availability.reason, /M1 食梦者/, `${code} 的可用性原因口径不符`)
    if (ALL_CARDS[code].type === 'investigator') assert.equal(availability.selectable, true)
  }
  for (const code of ['06015a', '06015b']) {
    const availability = getAvailability(code)
    assert.equal(availability.strictAccepted, true, `${code} 绑定地点应 strict`)
    assert.equal(availability.dependencyOnly, true, `${code} 绑定地点应 dependencyOnly`)
    assert.match(availability.reason, /M1 食梦者/)
  }
  // 战役包开发期：283 条战役记录全部 catalog-only（禁止半开半关）；P10 升 playable 后全部 strict。
  for (const code of [...campaignCodes, ...campaignFaceCodes]) {
    const availability = getAvailability(code)
    const available = isCardAvailable(code)
    if (campaignStatus === 'development') {
      assert.equal(availability.availability, 'catalog-only', `${code} 战役开发期应 catalog-only`)
      assert.equal(available, false, `${code} 战役开发期不应可构筑/选人`)
    } else {
      assert.equal(availability.availability, 'strict', `${code} 战役 playable 后应 strict`)
    }
  }
})

test('TDE 全卡账本 noEntry / 通道 / 证据完备', () => {
  const noEntryEntries = entries.filter(entry => entry.noEntry)
  assert.equal(noEntryEntries.length, 10)
  assert.deepEqual(sorted(noEntryEntries.map(entry => entry.code)), sorted(TDE_NO_ENTRY_CODES))
  for (const entry of noEntryEntries) {
    assert.ok(entry.note?.trim(), `${entry.code} noEntry 缺少理由`)
    assert.ok(TDE_NO_ENTRY_REASONS[entry.code], `${entry.code} 缺少 noEntry 理由常量`)
    if (scenarioReferenceCodes.has(entry.code)) {
      assert.equal(entry.channel, 'scenario-definition')
      assert.equal(entry.chapterId, chapters.find(chapter => chapter.code === entry.code).id)
      assert.equal(implementedFor(entry.code), false)
    } else {
      assert.equal(entry.channel, 'linked-face', `${entry.code} 应走 linked-face 通道`)
      assert.ok(['06057', '06058'].includes(entry.faceOf), `${entry.code} 的 faceOf 应为正面敌人`)
      assert.equal(implementedFor(entry.code), false)
      assert.equal(implementedFor(entry.faceOf), true)
      assert.equal(entryByCode.get(entry.faceOf).status, 'verified')
    }
  }
  // 273 条 noEntry=false 的战役记录必须命中单卡条目/implementedFor（2 条调查员面走 engine 通道）。
  for (const entry of entries) {
    if (entry.pack !== 'tdeCampaign' || entry.noEntry) continue
    assert.equal(implementedFor(entry.code), true, `${entry.code} 缺少 implementedFor 行为入口`)
    assert.equal(entry.channel, 'encounter-entry')
  }
  for (const code of [...campaignFaceCodes].filter(code => !noEntryCodes.has(code))) {
    assert.equal(implementedFor(code), true, `${code} 战役面缺少 implementedFor`)
  }
  // 34 面都有唯一 faceOf。
  for (const entry of entries.filter(candidate => candidate.kind === 'face')) {
    assert.ok(entry.faceOf, `${entry.code} 缺少 faceOf`)
    assert.ok(ALL_CARDS[entry.code].linkedCardCode === entry.faceOf
      || ALL_CARDS[entry.faceOf].linkedCardCode === entry.code
      || ALL_CARDS[entry.code].linkedToCode === entry.faceOf
      || ALL_CARDS[entry.faceOf].linkedToCode === entry.code,
    `${entry.code} 与 faceOf ${entry.faceOf} 没有双向/正向链接`)
  }
})
