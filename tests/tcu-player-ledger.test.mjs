// 万象无终（第四循环）M2 玩家卡账本回归 —— P7。
//
// 这份测试守的是「账本与接线」而不是逐卡行为：逐卡证据由 4 个分片测试文件提供，
// tools/audit-tcu-player.mjs 实跑它们后生成 audit/tcu-player-acceptance.json 与
// src/cards/tcu-player-acceptance.js。这里断言：
//   1. 包清单 87/87 逐卡 verified、85 张可构筑、05041/05042 只作基础弱点依赖；
//   2. 生成物与账本逐字节同源（模块里的 sha256 等于账本文件哈希），不手改；
//   3. availability 对 87 张全部 strict、85 张进 ALL_BUILDABLE_CODES、2 张进 ALL_BASIC_WEAKNESS_CODES，
//      且不混入核心+扩张的默认构筑池（PLAYER_CARD_CODES）；
//   4. campaign 的升级池只在 05 调查员记录里可见（不改变既有循环的升级候选）；
//   5. 玩家包没有 catalog-only 残留。

import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { implementation } from '../src/cards/card-implementation.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { replacementOptions } from '../src/campaign/campaign.js'
import {
  ALL_BASIC_WEAKNESS_CODES, ALL_BUILDABLE_CODES, PLAYER_CARD_CODES,
  getAvailability, isCardAvailable,
} from '../src/deck/availability.js'
import {
  PLAYER_CARD_CODES as TCU_PLAYER_CODES, TCU_PLAYER_BUILDABLE_CODES, tcuPlayerBuildable,
  tcuPlayerCardVerified, manifest as playerPack,
} from '../content/packs/tcuPlayer/manifest.js'
import {
  TCU_PLAYER_ACCEPTANCE_PROFILE, TCU_PLAYER_ACCEPTANCE_SHA256, TCU_PLAYER_BASIC_WEAKNESS_CODES,
  TCU_PLAYER_VERIFIED_CODES, tcuPlayerCardVerified as tcuPlayerCardVerifiedGenerated,
} from '../src/cards/tcu-player-acceptance.js'

const ledgerBytes = readFileSync(new URL('../audit/tcu-player-acceptance.json', import.meta.url))
const ledger = JSON.parse(ledgerBytes.toString('utf8'))
const ledgerSha = createHash('sha256').update(ledgerBytes).digest('hex')
const BASIC = ['05041', '05042']

// 05 段「玩家卡」口径（与包清单、审计工具同一过滤）：非战役遭遇、非调查员/专属，资产/事件/技能或弱点。
const scope = Object.values(ALL_CARDS)
  .filter(card => /^05\d{3}$/.test(card.code) && !card.encounterCode && !card.signatureFor
    && card.type !== 'investigator'
    && (['asset', 'event', 'skill'].includes(card.type) || ['weakness', 'basicweakness'].includes(card.subtype)))
  .map(card => card.code)
  .sort()

// 一个足以通过构筑校验的 05 调查员记录：0 XP 自动牌组 + 可升级的经验。
function recordFor(code, xp = 5) {
  const built = buildDeck(INVESTIGATORS[code], { seed: `p7-ledger-${code}` })
  return {
    id: `ledger-${code}`, seat: 0, code, name: INVESTIGATORS[code].name,
    deck: [...built.playerCards].sort(), currentScenarioIndex: 0,
    xp, earnedXp: xp, spentXp: 0, trauma: { physical: 0, mental: 0 },
    status: 'active', purchases: [], removedCards: [],
  }
}

test('P7 玩家包：87 张全部登记并逐卡 verified，85 张可构筑、2 张基础弱点只作依赖', () => {
  assert.equal(TCU_PLAYER_CODES.length, 87, '玩家卡包应登记 87 张')
  assert.deepEqual([...TCU_PLAYER_CODES].sort(), scope, '包清单与 05 段玩家卡口径一致')
  assert.equal(scope.length, 87)
  assert.equal(playerPack.cards.length, 87)
  assert.equal(playerPack.status, 'verified')
  assert.match(playerPack.description, /87 张/)
  assert.match(playerPack.description, /85 张/)
  assert.deepEqual([...playerPack.basicWeaknessCodes].sort(), BASIC)
  assert.deepEqual([...TCU_PLAYER_BASIC_WEAKNESS_CODES].sort(), BASIC)
  for (const card of playerPack.cards) {
    assert.equal(card.cataloged, true, card.code)
    assert.equal(card.rulesImplemented, true, `未实现：${card.code}`)
    assert.equal(tcuPlayerCardVerified(card.code), true, card.code)
    assert.equal(tcuPlayerCardVerifiedGenerated(card.code), true, card.code)
    assert.equal(implementation(card.code).implemented, true, `没有行为通道：${card.code}`)
    assert.equal(tcuPlayerBuildable(card.code), !BASIC.includes(card.code), card.code)
  }
  assert.equal(playerPack.cards.filter(card => card.deckbuilding).length, 85)
  assert.equal(TCU_PLAYER_BUILDABLE_CODES.length, 85)
  for (const code of BASIC) {
    const entry = playerPack.cards.find(card => card.code === code)
    assert.equal(entry.deckbuilding, false, `基础弱点不能构筑：${code}`)
    assert.equal(entry.dependencyOnly, true, `基础弱点只作依赖：${code}`)
    assert.equal(TCU_PLAYER_BUILDABLE_CODES.includes(code), false, code)
  }
  assert.equal(playerPack.behaviorIds.length, 87)
  for (const id of playerPack.behaviorIds) assert.match(id, /^tcuPlayerCard05\d{3}$/)
})

test('P7 验收账本：87 条逐卡证据来自 4 个分片测试，生成模块与账本哈希一致', () => {
  assert.equal(ledger.profile.id, TCU_PLAYER_ACCEPTANCE_PROFILE.id)
  assert.equal(TCU_PLAYER_ACCEPTANCE_SHA256, ledgerSha, '生成模块必须与账本同源：先 --write 再 --check')
  assert.deepEqual(ledger.summary, {
    total: 87, constructible: 85, basicWeaknesses: 2, verified: 87, unverified: 0,
    testsPassed: ledger.summary.testsPassed,
  })
  assert.ok(ledger.summary.testsPassed >= 87, `逐卡测试至少 87 条，实际 ${ledger.summary.testsPassed}`)
  assert.equal(ledger.entries.length, 87)
  assert.deepEqual([...TCU_PLAYER_VERIFIED_CODES].sort(), scope)
  assert.deepEqual(ledger.entries.map(entry => entry.code), scope, '账本按卡号排序且覆盖全部 87 张')
  const shardFiles = new Set(ledger.testFiles.map(file => file.file))
  assert.deepEqual([...shardFiles].sort(), [
    'games/arkhamhorror/tests/tcu-player-m2-1.test.mjs',
    'games/arkhamhorror/tests/tcu-player-m2-2.test.mjs',
    'games/arkhamhorror/tests/tcu-player-m2-3.test.mjs',
    'games/arkhamhorror/tests/tcu-player-m2-4.test.mjs',
  ])
  for (const entry of ledger.entries) {
    const card = ALL_CARDS[entry.code]
    assert.equal(entry.name, card.nameZh || card.name, entry.code)
    assert.equal(entry.type, card.type, entry.code)
    assert.equal(entry.level, card.xp || 0, entry.code)
    assert.equal(entry.basicWeakness, BASIC.includes(entry.code), entry.code)
    assert.equal(entry.status, 'verified')
    assert.ok(entry.evidence.length >= 1, `${entry.code} 缺少逐卡行为证据`)
    for (const evidence of entry.evidence) {
      assert.match(evidence.test, new RegExp(`^TCU ${entry.code}\\b`), evidence.test)
      assert.match(evidence.file, /^games\/arkhamhorror\/tests\/tcu-player-m2-/, evidence.file)
      // 目录级证据判定：去掉卡号前缀与卡名后再看描述（05032「否决存在」的卡名本身含「存在」）。
      const rest = evidence.test.replace(new RegExp(`^TCU ${entry.code}\\b`), '').replace(entry.name, '')
      assert.equal(/目录|存在|已登记|可构筑/.test(rest), false, `目录级证据：${evidence.test}`)
    }
  }
})

test('P7 availability：87 张 strict、85 张可构筑、基础弱点只作依赖，且不污染默认构筑池', () => {
  assert.deepEqual([...ALL_BASIC_WEAKNESS_CODES].filter(code => code.startsWith('05')).sort(), BASIC)
  for (const code of scope) {
    const availability = getAvailability(code)
    assert.equal(availability.availability, 'strict', code)
    assert.equal(availability.strictAccepted, true, code)
    assert.equal(availability.selectable, false, code)
    assert.match(availability.reason, /M2 万象无终玩家卡/, code)
    assert.equal(isCardAvailable(code), true, code)
    assert.equal(availability.deckbuilding, !BASIC.includes(code), code)
    assert.equal(availability.dependencyOnly, ALL_BASIC_WEAKNESS_CODES.includes(code), code)
    if (!BASIC.includes(code)) assert.ok(ALL_BUILDABLE_CODES.includes(code), `${code} 不在可构筑池`)
  }
  for (const code of BASIC) {
    assert.equal(ALL_BUILDABLE_CODES.includes(code), false, `基础弱点不得构筑：${code}`)
    assert.equal(getAvailability(code).dependencyOnly, true, code)
  }
  assert.equal(scope.filter(code => getAvailability(code).availability !== 'strict').length, 0,
    '玩家包没有 catalog-only 残留')
  // 默认构筑池（核心 + 既有扩张）不新增 TCU 卡：新增卡池不改变既有循环的自动牌组产出。
  for (const code of scope) assert.equal(PLAYER_CARD_CODES.includes(code), false, `默认池混入 ${code}`)
})

test('P7 campaign：TCU 升级池只对 05 调查员记录可见，既有循环记录看不到', () => {
  const tcuRecord = recordFor('05001')
  // 05020（拷问）是守护者 0 级事件：05 记录里应能作为升级购入。
  const visible = replacementOptions(tcuRecord, '05020', null)
  assert.ok(visible.length > 0, '05 调查员记录应能看到 TCU 玩家卡的升级候选')
  assert.ok(TCU_PLAYER_BUILDABLE_CODES.includes('05020'))
  // 既有循环（核心 01001）的记录仍然只看得到原有池，TCU 卡不会出现在升级候选里。
  const coreRecord = recordFor('01001')
  assert.deepEqual(replacementOptions(coreRecord, '05020', null), [], '既有循环记录不得看到 TCU 卡')
  assert.deepEqual(replacementOptions(coreRecord, '05109', null), [], '既有循环记录不得看到 TCU 资产')
  // 基础弱点永远不能作为升级目标。
  assert.deepEqual(replacementOptions(tcuRecord, '05041', null), [])
  assert.deepEqual(replacementOptions(tcuRecord, '05042', null), [])
})
