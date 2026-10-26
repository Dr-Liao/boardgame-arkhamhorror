// 「牌压在卡下面 / 附属在卡上」的展示与打出口径 —— 2026-10-26 修复的回归护栏。
//
// 覆盖三层：
//   1. 卡面表（embeddedCardDefs）：attached / attachedCards / attachments / beneath /
//      hunchDeck / hunchRevealed / 地点附属 / 场外绑定集合 都必须带进 state.cards，
//      否则读档重建后前端只能显示裸卡号；
//   2. 前端合法动作匹配（web/card-interactions.js 的 entityMoves）：宿主支援要能匹配
//      fromPlanAssetId / fromBackpackId / fromAttachedEventOf / channelAssetId，
//      压牌与直觉牌库要能按卡号匹配 fromBeneath / fromHunch；
//   3. 带 cardCode 的选择面板要出卡面（beneath / openingHand / hunchDeck 也画卡图）；
//   4. 免费行动在效果无从执行时不再进合法动作（赛菲娜下方为空、没有可重整的支援）。

import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture } from './core-fixture.mjs'
import { embeddedCardDefs, legalMoves, refreshStateResources } from '../src/engine/engine.js'
import { entityMoves, choicePresentation } from '../web/card-interactions.js'

const has = (object, key) => Object.hasOwn(object, key)

// ---- 1. 卡面表覆盖 ----------------------------------------------------------------

test('卡面表带上所有「离开手牌/牌库但仍在场上某处」的牌', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.assets = [
    { id: 'plan', code: '03264', exhausted: false, attached: ['10026'] },
    { id: 'bag', code: '04037', exhausted: false, attachedCards: ['10027'] },
    { id: 'host', code: '05279', exhausted: false, uses: 3, usesType: 'secrets', attachments: [{ code: '10113' }] },
  ]
  inv.beneath = ['10037']
  inv.hunchDeck = ['10070']
  inv.hunchRevealed = '10114'
  state.playerLocationAttachments = [{ code: '03199', location: inv.location }]
  state.locations[0] = { ...state.locations[0], attachments: [{ code: '01020' }] }
  state.bondedSets = { '05313': { seat: 0, cards: ['05314'], retrieved: true } }
  const campaignId = state.campaign?.id || null

  refreshStateResources(state)
  for (const code of ['10026', '10027', '10113', '10037', '10070', '10114', '03199', '01020', '05314']) {
    assert.ok(has(state.cards, code), '卡面表缺少 ' + code + ' 的定义')
  }

  // 观察者口径：别人的直觉牌库内容不进来，但「已揭示」的那张是公开信息。
  const otherView = embeddedCardDefs(state, campaignId, { observerSeat: 1 })
  assert.equal(has(otherView, '10070'), false, '别人的直觉牌库顺序不应带卡面')
  assert.ok(has(otherView, '10114'), '直觉牌库已揭示的那张是公开信息')
})

// ---- 2. 前端合法动作匹配 ----------------------------------------------------------

test('entityMoves 把「载体支援」与它下面/上附属的打出动作连起来', () => {
  const moves = [
    { action: 'play', cardId: '03189', fromPlanAssetId: 'plan', label: '原定计划打出' },
    { action: 'play', cardId: '03189', fromBackpackId: 'bag', label: '背包打出' },
    { action: 'play', cardId: '03189', fromAttachedEventOf: 'host', label: '宿主附属打出' },
    { action: 'play', cardId: '03189', fromBeneath: true, channelAssetId: 'knife', label: '底下打出' },
    { action: 'play', cardId: '03189', fromHunch: true, label: '直觉牌库打出' },
  ]
  const st = { pendingChoice: null, currentSeat: 0, investigators: [{ seat: 0, hand: [], assets: [] }], legalMoves: moves }
  assert.deepEqual(entityMoves(st, 'asset:plan').map(move => move.fromPlanAssetId), ['plan'])
  assert.deepEqual(entityMoves(st, 'asset:bag').map(move => move.fromBackpackId), ['bag'])
  assert.deepEqual(entityMoves(st, 'asset:host').map(move => move.fromAttachedEventOf), ['host'])
  assert.deepEqual(entityMoves(st, 'asset:knife').map(move => move.channelAssetId), ['knife'])
  assert.deepEqual(entityMoves(st, 'beneath:03189').map(move => move.fromBeneath), [true])
  assert.deepEqual(entityMoves(st, 'hunch:03189').map(move => move.fromHunch), [true])
  assert.deepEqual(entityMoves(st, 'beneath:01020'), [], '不相干的卡号不得匹配到打出动作')
  // 支援自身能力的匹配口径不变。
  const abilitySt = { ...st, legalMoves: [{ action: 'ability', assetId: 'plan', abilityIndex: 0 }] }
  assert.equal(entityMoves(abilitySt, 'asset:plan').length, 1)
})

// ---- 3. 选择面板的卡图 ------------------------------------------------------------

test('带 cardCode 的选择（beneath / openingHand / hunchDeck）会画出候选卡面', () => {
  const cards = { '03189': { code: '03189', name: '“同归于尽！”', nameZh: '“同归于尽！”', type: 'event' } }
  for (const kind of ['beneath', 'openingHand', 'hunchDeck']) {
    const st = {
      currentSeat: 0,
      cards,
      investigators: [{ seat: 0, code: '03003' }],
      pendingChoice: { id: 'q1', kind, seat: 0, prompt: '选择一张', options: [{ id: '0', cardCode: '03189', label: '“同归于尽！”' }] },
      legalMoves: [{ action: 'choose', choiceId: 'q1', optionId: '0', label: '“同归于尽！”' }],
    }
    const items = choicePresentation(st)
    assert.equal(items.length, 1, kind + '：应有一条候选')
    assert.equal(items[0].cards[0]?.code, '03189', kind + '：候选应带卡面')
  }
})

// ---- 4. 免费行动的「预览 = 校验」 --------------------------------------------------

function withInvestigator(code) {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.code = code
  inv.beneath = []
  inv.assets = []
  inv.resources = 10
  state.currentSeat = 0
  return { state, inv }
}

test('赛菲娜下方为空时不再给出「抽取下方事件」的死按钮', () => {
  const { state, inv } = withInvestigator('03003')
  const freeActions = () => legalMoves(state, 0).filter(move => move.action === 'freeAction')
  assert.equal(freeActions().length, 0, '下方没有事件时不应出现免费行动')
  inv.beneath = ['03189']
  assert.equal(freeActions().length, 1, '下方有事件时应恢复免费行动')
})

test('皮特的免费行动要同时有可弃手牌与可重整支援', () => {
  const { state, inv } = withInvestigator('02005')
  const freeActions = () => legalMoves(state, 0).filter(move => move.action === 'freeAction')
  inv.hand = ['01020']
  assert.equal(freeActions().length, 0, '没有横置支援时不应出现免费行动')
  inv.assets = [{ id: 'a1', code: '01018', exhausted: true }]
  assert.equal(freeActions().length, 1, '有横置支援时应恢复免费行动')
  // 手牌为空但支援仍然横置：费用付不出，同样不该出现。
  inv.hand = []
  assert.equal(freeActions().length, 0, '没有可弃手牌时不应出现免费行动')
})

test('无条件的免费行动不受影响（斯基兹仍可用 2 资源换行动）', () => {
  const { state } = withInvestigator('01003')
  assert.equal(legalMoves(state, 0).filter(move => move.action === 'freeAction').length, 1)
})
