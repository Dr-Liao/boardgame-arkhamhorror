// 万象无终（TCU）第 2 步 P2.9 原语验收：塔罗槽位与开局入场。
//
// 覆盖路线图 §4.1 的必测项：1–4 个槽、超槽、开局入场、构筑/非法投入。
// 三条规则来自真实卡面（05023/05040 等）：默认 1 个塔罗槽；额外槽位走 add:slot；
// 起始手牌里的塔罗可以放置入场；高塔在手牌里时不能投入任何卡牌，且不能被换掉。

import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, move, settle } from './core-fixture.mjs'
import { canEquip, enterOpeningHandCards, legalMoves } from '../src/engine/engine.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import {
  TAROT_SLOT, TAROT_SLOT_BASE, enterOpeningHandCards as enterOpeningHandCardsPure,
  handCommitBlocker, isTarotCard, mulliganCandidates, mulliganProtectedCodes,
  openingHandEntries, tarotSlotCapacity, tarotSlotInfo, tarotSlotUsage,
} from '../src/engine/tarot-slot.js'
import { slotBonus } from '../src/engine/modifiers.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

const aceOfSwords = '05023'
const theTower = '05042'

// 测试用条目：一张额外 +2 塔罗槽的支援、一张开局入场的塔罗、一张手牌封锁卡。
registerCardAbilities([{
  code: '01991',
  modifiers: [{ target: 'add:slot', value: 'tarot', amount: 2 }],
}, {
  code: '01990',
  entersPlayFromOpeningHand: true,
  abilities: [],
}, {
  code: '01989',
  blocksCommitWhileInHand: true,
  cannotMulliganAway: true,
  abilities: [],
}])

test('P2.9 槽位读点：塔罗卡识别 + 默认 1 个槽 + 修正管线加槽', () => {
  assert.equal(TAROT_SLOT, 'tarot')
  assert.equal(TAROT_SLOT_BASE, 1)
  assert.equal(isTarotCard({ slots: ['Tarot'] }), true)
  assert.equal(isTarotCard({ slot: 'Tarot' }), true)
  assert.equal(isTarotCard({ slots: ['Hand'] }), false)

  const inv = { assets: [{ id: 'a', code: aceOfSwords }], threat: [] }
  assert.equal(tarotSlotUsage(inv, ALL_CARDS['05023'] ? code => ALL_CARDS[code] : null), 1)
  assert.equal(tarotSlotCapacity(inv), 1)
  assert.deepEqual(tarotSlotInfo({}, inv, code => ALL_CARDS[code]), { capacity: 1, usage: 1, free: 0 })
  // 测试用支援给 +2 个塔罗槽。
  const withBonus = { assets: [{ id: 'a', code: aceOfSwords }, { id: 'b', code: '01991' }], threat: [] }
  assert.equal(slotBonus(withBonus, 'tarot'), 2)
  assert.equal(tarotSlotCapacity(withBonus), 3)
  assert.deepEqual(tarotSlotInfo({}, withBonus, code => ALL_CARDS[code]), { capacity: 3, usage: 1, free: 2 })
})

test('P2.9 超槽：默认 1 个槽时第二张塔罗不能装备，加槽后可以', () => {
  const inv = { assets: [{ id: 'a', code: aceOfSwords }], threat: [] }
  assert.equal(canEquip(inv, ALL_CARDS[aceOfSwords]), false)
  const withBonus = { assets: [{ id: 'a', code: aceOfSwords }, { id: 'b', code: '01991' }], threat: [] }
  assert.equal(canEquip(withBonus, ALL_CARDS[aceOfSwords]), true)
  // 满 3 槽后第 4 张再次超槽。
  const full = { assets: [
    { id: 'a', code: aceOfSwords }, { id: 'b', code: aceOfSwords }, { id: 'c', code: aceOfSwords }, { id: 'd', code: '01991' },
  ], threat: [] }
  assert.equal(canEquip(full, ALL_CARDS[aceOfSwords]), false)
})

test('P2.9 开局入场：起始手牌里声明过的卡会放置入场（不付费用）', () => {
  const state = fixture('01001', 1)
  const inv = state.investigators[0]
  inv.hand = ['01990', '01088']
  const resourcesBefore = inv.resources
  const placed = enterOpeningHandCards(state, inv, {
    lookup: code => registeredEntry(code),
    createAsset: (target, owner, code) => ({ id: 'placed-' + code, code, exhausted: false }),
  })
  assert.deepEqual(placed, ['01990'])
  const after = state.investigators[0]
  assert.deepEqual(after.hand, ['01088'])
  assert.deepEqual(after.assets.map(asset => asset.code), ['01990'])
  assert.equal(after.resources, resourcesBefore)
  // 不在手牌里时是空操作。
  assert.deepEqual(enterOpeningHandCards(state, after, { lookup: code => registeredEntry(code), createAsset: () => ({}) }), [])
})

test('P2.9 纯读点：哪些卡需要开局入场', () => {
  const inv = { hand: ['01990', '01088', theTower] }
  assert.deepEqual(openingHandEntries(inv, registeredEntry), ['01990'])
  const seen = []
  enterOpeningHandCardsPure({}, inv, {
    lookup: registeredEntry,
    createAsset: (state, owner, code) => { seen.push(code); return { code } },
    info: (state, events, text) => { seen.push(text) },
  })
  assert.deepEqual(seen[0], '01990')
  assert.match(seen[1], /放置入场/)
})

test('P2.9 手牌封锁：高塔（测试卡）在手牌里时不能投入任何卡牌', () => {
  const state = fixture('01001', 1)
  state.investigators[0].hand = ['01088', '01989']
  assert.equal(handCommitBlocker(state.investigators[0], registeredEntry), '01989')
  // 检定时投入窗口只剩「开始检定」，没有可投入的牌。
  const probe = { action: 'investigate' }
  assert.equal(legalMoves(state, 0).some(candidate => candidate.action === probe.action), true)
  move(state, { action: 'investigate' })
  const commit = state.pendingChoice
  assert.ok(commit, '应有投入窗口')
  assert.equal(commit.kind, 'commit')
  assert.deepEqual(commit.options.map(option => option.id), ['done'])
  settle(state)
  assert.equal(handCommitBlocker(state.investigators[0], registeredEntry), '01989')
})

test('P2.9 换牌保护：cannotMulliganAway 的卡不在换牌候选里', () => {
  const inv = { hand: ['01088', '01989'] }
  assert.deepEqual(mulliganCandidates(inv, registeredEntry), [{ code: '01088', index: 0 }])
  assert.deepEqual(mulliganProtectedCodes(inv, registeredEntry), ['01989'])
})

test('P2.9 真实卡面：7 张塔罗都占 Tarot 槽，默认容量 1', () => {
  for (const code of ['05023', '05027', '05031', '05035', '05039', '05040', '05042']) {
    assert.equal(isTarotCard(ALL_CARDS[code]), true)
    // 资产实例只带 code：读点必须回落到卡面定义。
    const state = fixture('01001', 1)
    state.investigators[0].assets.push({ id: 'tarot-' + code, code, exhausted: false })
    assert.equal(tarotSlotUsage(state.investigators[0], c => ALL_CARDS[c]), 1)
  }
})

test('P2.9 存档：槽位读数只依赖资产列表，不写 state', () => {
  const state = fixture('01001', 1)
  state.investigators[0].assets.push({ id: 't1', code: aceOfSwords, exhausted: false })
  const info = tarotSlotInfo(state, state.investigators[0], code => ALL_CARDS[code])
  assert.deepEqual(info, { capacity: 1, usage: 1, free: 0 })
  assert.equal('tarotSlots' in state, false)
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(tarotSlotInfo(restored, restored.investigators[0], code => ALL_CARDS[code]), info)
})
