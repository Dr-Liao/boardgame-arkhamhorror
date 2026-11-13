// 2026-11-11「原语收口」：战役发放的剧情资产可以在战役牌组中打出。
//
// 规则只有两个读点：
//   1. 声明：卡条目 `scenarioPlayable: true`（`src/cards/card-rules.js#scenarioPlayableFor`）；
//   2. 引擎唯一读点：`src/engine/stats.js#runtimeCardAvailable`；授予事实源是战役调查员记录的
//      牌组（`campaignCardChange` / 战役奖励写入 record.deck）。
//
// 这条规则原来由《敦威治遗产》在战役 behavior 里单独写 `canPlayScenarioCard` 钩子实现，其它循环
// 的剧情资产（04051 亚历山卓等）被战役发到牌组后永远打不出。本用例锁住统一后的行为：
//   · 已声明的剧情资产在「战役牌组里有这张卡」时可以打出；
//   · 没获得、没声明、不是剧情资产的卡仍然被现有可用性门槛拦下；
//   · 旧存档的数组形态战役记录同样成立。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, legalMoves, validateMove } from './core-fixture.mjs'
import { runtimeCardAvailable } from '../src/engine/engine.js'
import { registeredEntry } from '../src/engine/ability.js'
import { isCardAvailable } from '../src/deck/availability.js'
import { scenarioPlayableFor } from '../src/cards/card-rules.js'

// 已验收、允许由战役效果加入牌组并在牌组中打出的剧情资产（新增循环时把卡号补进这里）。
const DECLARED_STORY_ASSETS = Object.freeze([
  '02040', '02061', '02080', '02140', '02217', '02218', '02219', // 敦威治
  '03143',                                                       // 卡尔克萨
  '04051', '04061', '04147', '04148', '04191', '04303',          // 失落的时代
  '05150', '05228', '05258', '05259', '05260', '05261',          // 万象无终
  '07083',                                                       // 印斯茅斯
])

const seatInv = (seat = 0) => ({ seat, code: '01001' })
const campaignState = deck => ({ campaign: { investigators: { 0: { seat: 0, deck } } } })

test('声明即接线：每张故事资产都声明 scenarioPlayable，且不在常规卡池里', () => {
  for (const code of DECLARED_STORY_ASSETS) {
    assert.equal(registeredEntry(code)?.scenarioPlayable, true, `${code} 条目必须声明 scenarioPlayable`)
    assert.equal(scenarioPlayableFor(code), true, `${code} 的声明读点必须一致`)
    assert.equal(isCardAvailable(code), false, `${code} 必须保持 catalog-only（不能用可用性冒充授权）`)
  }
})

test('引擎读点只认「已声明 + 战役牌组里有」两个条件', () => {
  const inv = seatInv()
  // 已声明 + 战役牌组里有 → 运行时可用
  assert.equal(runtimeCardAvailable(campaignState(['04051']), inv, '04051'), true)
  // 已声明但还没被战役加入牌组 → 不可用（没获得的剧情资产不能打）
  assert.equal(runtimeCardAvailable(campaignState([]), inv, '04051'), false)
  assert.equal(runtimeCardAvailable({}, inv, '04051'), false)
  // 未声明的剧情资产即使被写进记录也不放行（声明是逐卡验收入口，不是白名单）
  assert.equal(runtimeCardAvailable(campaignState(['07082']), inv, '07082'), false)
  // 旧存档形态：campaign.investigators 是数组
  assert.equal(runtimeCardAvailable({ campaign: {
    investigators: [{ seat: 0, deck: ['04051'] }, { seat: 1, deck: [] }],
  } }, inv, '04051'), true)
  // 记录属于其他座位时不算（牌不在当前调查员的战役牌组里）
  assert.equal(runtimeCardAvailable({ campaign: {
    investigators: { 1: { seat: 1, deck: ['04051'] } },
  } }, inv, '04051'), false)
})

test('各循环代表卡：获得后 legalMoves / validateMove 放行', () => {
  // 覆盖玩家通道（entries/）与非玩家通道（encounter-entries/ 的 scope:'storyAsset'）。
  for (const code of ['02061', '03143', '04051', '04061', '05150', '05228', '07083']) {
    const state = fixture('01001')
    const inv = state.investigators[0]
    inv.hand = [code]
    inv.resources = 30
    inv.actionsLeft = 3
    state.campaign.investigators[0].deck.push(code)
    assert.equal(validateMove(state, 0, { action: 'play', cardId: code }), null, `${code} 应可打出`)
    assert.ok(legalMoves(state, 0).some(move => move.action === 'play' && move.cardId === code),
      `${code} 应出现在 legalMoves`)
  }
})

test('没获得 / 费用不足时仍然不能打出', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['04051']
  inv.resources = 30
  inv.actionsLeft = 3

  assert.equal(validateMove(state, 0, { action: 'play', cardId: '04051' }), '该卡牌未获运行时许可')
  assert.equal(legalMoves(state, 0).some(move => move.action === 'play' && move.cardId === '04051'), false)

  state.campaign.investigators[0].deck.push('04051')
  assert.equal(validateMove(state, 0, { action: 'play', cardId: '04051' }), null)

  inv.resources = 0
  assert.equal(validateMove(state, 0, { action: 'play', cardId: '04051' }), '资源不足')
})

test('存档往返后结论一致', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['05150']
  inv.resources = 30
  inv.actionsLeft = 3
  state.campaign.investigators[0].deck.push('05150')

  const restored = JSON.parse(JSON.stringify(state))
  assert.equal(validateMove(restored, 0, { action: 'play', cardId: '05150' }), null)
  assert.ok(legalMoves(restored, 0).some(move => move.action === 'play' && move.cardId === '05150'))
})
