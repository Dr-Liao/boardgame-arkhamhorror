// 万象无终（The Circle Undone）P10：全卡逐卡验收账本守卫。
//
// 账本由 tools/audit-tcu-all-cards.mjs **实跑** 6 个测试文件后生成；本测试不做字符串猜结论，
// 只做「单一事实源」对账：
//   1. 377 条记录全覆盖：343 主卡三包分区唯一（战役 237 / 调查员 19 / 玩家 87）+ 34 关联面记 face；
//   2. 账本 summary 与 entries、原始卡面数据（ALL_CARDS）、包 manifest 的 verified 函数对账；
//   3. testFiles 哈希与磁盘一致（证据过期即失败）；
//   4. 生成模块 src/cards/tcu-campaign-acceptance.js 的 sha256 与 JSON 账本逐字节对账，
//      verified/pending 集合与 entries 一致；
//   5. 逐卡证据形状（实跑测试名/文件/行号）与人工备注注册表一致；
//   6. 不存在未登记卡、越界卡、重复卡。
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { CAMPAIGN_CARD_CODES } from '../content/packs/tcuCampaign/manifest.js'
import {
  tcuInvestigatorCardVerified,
  TCU_INVESTIGATOR_ACCEPTANCE_PROFILE,
} from '../content/packs/tcuInvestigators/manifest.js'
import {
  tcuPlayerCardVerified,
  TCU_PLAYER_ACCEPTANCE_PROFILE,
} from '../src/cards/tcu-player-acceptance.js'
import {
  TCU_PLAYER_BUILDABLE_CODES,
} from '../content/packs/tcuPlayer/manifest.js'
import { TCU_PACKS } from '../content/campaigns/theCircleUndone/card-data.js'
import { TCU_CARD_ACCEPTANCE_NOTES } from '../content/campaigns/theCircleUndone/card-acceptance.js'
import {
  TCU_ALL_CARD_ACCEPTANCE_PROFILE,
  TCU_ALL_CARD_ACCEPTANCE_SHA256,
  TCU_CAMPAIGN_VERIFIED_CODES,
  TCU_CAMPAIGN_PENDING_CODES,
  TCU_ALL_CARD_VERIFIED_CODES,
  tcuAllCardAcceptance,
  tcuCampaignCardVerified,
  tcuCampaignCardPending,
  tcuAllCardVerified,
} from '../src/cards/tcu-campaign-acceptance.js'

const gameRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(gameRoot, '../..')
const ledgerFile = 'audit/tcu-all-card-acceptance.json'
const ledgerBytes = fs.readFileSync(path.join(gameRoot, ledgerFile))
const ledgerText = ledgerBytes.toString('utf8')
const ledger = JSON.parse(ledgerText)
const entries = ledger.entries
const entryByCode = new Map(entries.map(entry => [entry.code, entry]))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

const expectedTestFiles = [
  'games/arkhamhorror/tests/tcu-investigators.test.mjs',
  'games/arkhamhorror/tests/tcu-player-m2-1.test.mjs',
  'games/arkhamhorror/tests/tcu-player-m2-2.test.mjs',
  'games/arkhamhorror/tests/tcu-player-m2-3.test.mjs',
  'games/arkhamhorror/tests/tcu-player-m2-4.test.mjs',
  'games/arkhamhorror/tests/tcu-campaign-card-acceptance.test.mjs',
]

// 377 条记录范围（与账本生成口径一致，但这里从 ALL_CARDS + manifest 独立重算）。
const tcuCards = Object.values(ALL_CARDS)
  .filter(card => TCU_PACKS.has(card.pack) && /^05\d{3}[a-z]?$/.test(card.code))
const mainCards = tcuCards.filter(card => /^05\d{3}$/.test(card.code))
const faceCards = tcuCards.filter(card => /^05\d{3}[a-z]$/.test(card.code))

test('TCU 全卡账本：377 条记录全覆盖且分区唯一（343 主卡三分区 + 34 面归战役关联面）', () => {
  assert.equal(entries.length, 377)
  assert.equal(new Set(entries.map(entry => entry.code)).size, 377, '账本存在重复卡号')
  assert.equal(mainCards.length, 343)
  assert.equal(faceCards.length, 34)
  assert.equal(tcuCards.length, 377)

  const ledgerCodes = new Set(entries.map(entry => entry.code))
  assert.deepEqual([...ledgerCodes].sort(), [...tcuCards.map(card => card.code)].sort(),
    '账本与 ALL_CARDS 的 05 记录不一致（多卡/漏卡）')

  // 主卡三分区唯一，且与 manifest verified 函数口径一致。
  for (const card of mainCards) {
    const entry = entryByCode.get(card.code)
    assert.ok(entry, `缺少主卡记录：${card.code}`)
    const partitions = [
      tcuInvestigatorCardVerified(card.code) ? 'investigator' : null,
      tcuPlayerCardVerified(card.code) ? 'player' : null,
      CAMPAIGN_CARD_CODES.includes(card.code) ? 'campaign' : null,
    ].filter(Boolean)
    assert.equal(partitions.length, 1, `主卡分区不唯一：${card.code}`)
    assert.equal(entry.partition, partitions[0], `${card.code} 分区与包清单不一致`)
  }

  // 34 个关联面不是主卡：partition=face，并归到主卡/成对关联面。
  for (const card of faceCards) {
    const entry = entryByCode.get(card.code)
    assert.ok(entry, `缺少关联面记录：${card.code}`)
    assert.equal(entry.partition, 'face', `${card.code} 关联面分区应为 face`)
    assert.equal(entry.type, card.type)
    const relation = ALL_CARDS[card.code].linkedCardCode || ALL_CARDS[card.code].linkedToCode || null
    const reverse = Object.values(ALL_CARDS).find(other => other.linkedCardCode === card.code)?.code || null
    assert.equal(entry.linkedTo, relation || reverse, `${card.code} 关联面 linkedTo 不一致`)
    // 关联面必须有可读说明：要么写明「关联面/主卡」，要么是 P10 逐卡行为审计的直接结论。
    assert.ok(/关联面|P10 逐卡行为审计/.test(entry.note || ''), `${card.code} 关联面证据说明缺失`)
  }

  // 不存在以关联面冒充主卡、或非 05 记录混入。
  for (const entry of entries) {
    assert.match(entry.code, /^05\d{3}[a-z]?$/, `账本混入非 05 记录：${entry.code}`)
    assert.ok(TCU_PACKS.has(entry.pack), `${entry.code} 的卡包不在万象无终范围内：${entry.pack}`)
  }
  assert.equal(entries.filter(entry => entry.partition === 'investigator').length, 19)
  assert.equal(entries.filter(entry => entry.partition === 'player').length, 87)
  assert.equal(entries.filter(entry => entry.partition === 'campaign').length, 237)
  assert.equal(entries.filter(entry => entry.partition === 'face').length, 34)
})

test('TCU 全卡账本 summary 与 entries / 卡面数据 / 玩家开放口径对账', () => {
  const { summary, profile } = ledger
  assert.equal(profile.id, TCU_ALL_CARD_ACCEPTANCE_PROFILE.id)
  assert.deepEqual(profile.inheritedProfiles,
    [TCU_INVESTIGATOR_ACCEPTANCE_PROFILE.id, TCU_PLAYER_ACCEPTANCE_PROFILE.id])
  assert.equal(summary.total, entries.length)
  assert.equal(summary.verified, entries.filter(entry => entry.status === 'verified').length)
  assert.equal(summary.pending, entries.filter(entry => entry.status === 'pending').length)
  assert.equal(summary.verified + summary.pending, summary.total)
  assert.equal(summary.investigator, entries.filter(entry => entry.partition === 'investigator').length)
  assert.equal(summary.player, entries.filter(entry => entry.partition === 'player').length)
  assert.equal(summary.campaign, entries.filter(entry => entry.partition === 'campaign').length)
  assert.equal(summary.face, entries.filter(entry => entry.partition === 'face').length)
  assert.equal(summary.simplified, entries.filter(entry => entry.noteStatus === 'simplified').length)
  assert.equal(summary.testFiles, expectedTestFiles.length)
  assert.ok(Number.isInteger(summary.testsPassed) && summary.testsPassed > entries.length,
    '实跑用例数必须多于逐卡记录数（每卡至少 1 条证据）')
  assert.deepEqual(tcuAllCardAcceptance, summary)

  // 每条记录都必须在卡面数据里有真实身份，且状态/备注合法。
  for (const entry of entries) {
    const card = ALL_CARDS[entry.code]
    assert.ok(card, `账本记录了不存在的卡：${entry.code}`)
    assert.equal(entry.name, card.nameZh || card.name)
    assert.equal(entry.type, card.type)
    assert.equal(entry.pack, card.pack)
    assert.ok(['verified', 'pending'].includes(entry.status), `${entry.code} 状态非法`)
    assert.ok(['verified', 'simplified'].includes(entry.noteStatus), `${entry.code} noteStatus 非法`)
    if (entry.noteStatus === 'simplified') {
      assert.ok(entry.note, `${entry.code} simplified 必须写明近似说明`)
    }
  }

  // 玩家 87 = 85 constructible（含 2 张 deckLimit=0 的绑定副本）+ 2 基础弱点；deckable=83。
  // 两个数字都从卡面数据独立复算：可构筑 = 已验收 - 基础弱点；入牌组 = 可构筑里 deckLimit>0。
  const deckLimitOf = card => card?.deckLimit ?? 2
  const constructible = TCU_PLAYER_BUILDABLE_CODES.length
  const deckableCodes = TCU_PLAYER_BUILDABLE_CODES.filter(code => deckLimitOf(ALL_CARDS[code]) > 0)
  assert.equal(summary.constructible, constructible)
  assert.equal(summary.deckable, deckableCodes.length)
  assert.equal(constructible, 85)
  assert.equal(deckableCodes.length, 83)
  assert.equal(constructible, summary.player - 2)
  const deckable = new Set(deckableCodes)
  for (const code of ['05314', '05317']) {
    // 绑定副本是逐卡已验收的目录卡，只因为 deckLimit=0 不进起始牌组，不得记 pending。
    const entry = entryByCode.get(code)
    assert.ok(entry, `缺少绑定副本记录：${code}`)
    assert.equal(entry.status, 'verified', `${code} 已验收，不能因为 deckLimit=0 记 pending`)
    assert.equal(TCU_PLAYER_BUILDABLE_CODES.includes(code), true)
    assert.equal(ALL_CARDS[code].deckLimit, 0)
    assert.equal(deckable.has(code), false)
  }
  for (const code of TCU_PLAYER_BUILDABLE_CODES) {
    assert.equal(entryByCode.get(code).partition, 'player', `${code} 可构筑但未归玩家分区`)
  }
})

test('TCU 全卡账本 testFiles 哈希与磁盘一致（证据过期即失败）', () => {
  assert.deepEqual(ledger.testFiles.map(file => file.file), expectedTestFiles)
  for (const testFile of ledger.testFiles) {
    const disk = fs.readFileSync(path.join(repoRoot, testFile.file))
    assert.equal(testFile.sha256, hash(disk), `测试文件哈希过期：${testFile.file}`)
  }
})

test('TCU 全卡账本生成模块与 JSON 对账（sha256 / verified / pending 集合）', () => {
  assert.equal(TCU_ALL_CARD_ACCEPTANCE_SHA256, hash(ledgerBytes))
  assert.deepEqual(TCU_ALL_CARD_ACCEPTANCE_PROFILE, ledger.profile)

  const verified = entries.filter(entry => entry.status === 'verified').map(entry => entry.code)
  const campaignVerified = entries
    .filter(entry => entry.partition === 'campaign' && entry.status === 'verified')
    .map(entry => entry.code)
  const campaignPending = entries
    .filter(entry => entry.partition === 'campaign' && entry.status === 'pending')
    .map(entry => entry.code)
  assert.deepEqual([...TCU_ALL_CARD_VERIFIED_CODES].sort(), [...verified].sort())
  assert.deepEqual([...TCU_CAMPAIGN_VERIFIED_CODES].sort(), [...campaignVerified].sort())
  assert.deepEqual([...TCU_CAMPAIGN_PENDING_CODES].sort(), [...campaignPending].sort())
  assert.equal(TCU_ALL_CARD_VERIFIED_CODES.length, 377)
  assert.equal(TCU_CAMPAIGN_VERIFIED_CODES.length, 237)
  assert.equal(TCU_CAMPAIGN_PENDING_CODES.length, 0, '战役卡全部逐卡验收，不应有 pending')
  assert.equal(ledger.summary.pending, 0)
  assert.equal(ledger.summary.verified, 377)

  for (const entry of entries) {
    assert.equal(tcuAllCardVerified(entry.code), true, `${entry.code} 未进入运行时 verified 集合`)
  }
  for (const code of mainCards.map(card => card.code)) {
    assert.equal(tcuCampaignCardVerified(code), CAMPAIGN_CARD_CODES.includes(code),
      `${code} 的战役 verified 读点与包清单不一致`)
    assert.equal(tcuCampaignCardPending(code), false)
  }
  // 非战役卡的运行时读点必须为 false（防止把调查员/玩家卡误标成战役卡）。
  for (const code of ['05001', '05020', '05041']) {
    assert.equal(tcuCampaignCardVerified(code), false, `${code} 不应被误标为战役主卡`)
  }
})

test('TCU 全卡账本逐卡证据来自实跑测试（test:pass 形状 + 分区口径）', () => {
  const testFileSet = new Set(ledger.testFiles.map(file => file.file))
  for (const entry of entries) {
    assert.ok(Array.isArray(entry.evidence) && entry.evidence.length > 0, `${entry.code} 缺少逐卡证据`)
    for (const evidence of entry.evidence) {
      assert.equal(typeof evidence.file, 'string')
      assert.ok(evidence.file.startsWith('games/arkhamhorror/tests/'), `${entry.code} 证据文件非法`)
      assert.ok(testFileSet.has(evidence.file),
        `${entry.code} 证据文件不在实跑清单里：${evidence.file}`)
      if (evidence.test !== undefined) {
        assert.equal(typeof evidence.test, 'string')
        assert.ok(evidence.test.length > 0)
        if (evidence.line !== null && evidence.line !== undefined) assert.ok(Number.isInteger(evidence.line))
      }
    }
    if (entry.partition === 'investigator') {
      assert.equal(entry.evidence.length, 1)
      assert.equal(entry.evidence[0].file, 'games/arkhamhorror/tests/tcu-investigators.test.mjs')
      assert.equal(entry.evidence[0].profile, TCU_INVESTIGATOR_ACCEPTANCE_PROFILE.id)
      assert.equal(entry.evidence[0].tests, 33)
      assert.equal(entry.status, 'verified')
    }
    if (entry.partition === 'player') {
      for (const evidence of entry.evidence) {
        assert.match(evidence.test, new RegExp(`^TCU ${entry.code}\\b`),
          `${entry.code} 的玩家卡证据不是逐卡测试：${evidence.test}`)
      }
    }
    if (entry.partition === 'campaign' || entry.partition === 'face') {
      assert.equal(entry.evidence.length, 1)
      assert.match(entry.evidence[0].test, new RegExp(`^TCU ${entry.code} (已验收|待实现) · `),
        `${entry.code} 的战役卡证据不是逐卡测试`)
      assert.ok(entry.evidence[0].file.endsWith('tests/tcu-campaign-card-acceptance.test.mjs'))
      const label = entry.evidence[0].test.includes('已验收') ? 'verified' : 'pending'
      assert.equal(entry.status, label, `${entry.code} 状态与测试名标签不一致`)
    }
  }
})

test('TCU 全卡账本人工备注注册表与 entries 一致（未登记默认 verified）', () => {
  const noteCodes = Object.keys(TCU_CARD_ACCEPTANCE_NOTES)
  assert.ok(noteCodes.every(code => entryByCode.has(code)), '备注注册表存在越界卡号')
  for (const code of noteCodes) {
    const registered = TCU_CARD_ACCEPTANCE_NOTES[code]
    const entry = entryByCode.get(code)
    assert.ok(['verified', 'simplified'].includes(registered.status), `${code} 备注状态非法`)
    assert.equal(entry.noteStatus, registered.status, `${code} 账本 noteStatus 与注册表不一致`)
    if (registered.status === 'simplified') {
      assert.ok(registered.note, `${code} simplified 备注必须写明近似口径`)
      assert.equal(entry.note, registered.note)
    }
  }
  const simplifiedCount = Object.values(TCU_CARD_ACCEPTANCE_NOTES)
    .filter(registered => registered.status === 'simplified').length
  assert.equal(ledger.summary.simplified, simplifiedCount)
  assert.equal(ledger.summary.pending, 0)
})
