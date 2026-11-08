// P2-F 七循环《地球边缘》调查员/玩家侧原语回归。
//
// 覆盖：
//   · investigator.deckTop（eote-deck-top.js）：常驻揭示、隐私、每轮一次折扣、弱点强制抽取；
//   · investigator.roundDistance（eote-round-distance.js）：本轮起始地点与当前地点距离；
//   · investigator.discipline（eote-disciplines.js）：Unbroken/Broken 翻面、命运重担、确定性选择；
//   · physical.faces（physical-faces.js#planAssetFaceFlip）：支援双面翻面保留实例身份；
//   · investigator.crossSeatPlay（play-channels.js#otherHand）：跨座位代打 Item 的枚举与门禁；
//   · 既有 7 个如同手牌通道顺序/行为不变、新通道只在 EotE 状态下出现。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, settle } from './core-fixture.mjs'
import { applyMove, legalMoves, validateMove } from '../src/engine/engine.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import * as deckTop from '../src/engine/eote-deck-top.js'
import * as roundDistance from '../src/engine/eote-round-distance.js'
import * as disciplines from '../src/engine/eote-disciplines.js'
import { applyPhysicalFace, planAssetFaceFlip, planPhysicalFace } from '../src/engine/physical-faces.js'
import {
  LEGACY_PLAY_CHANNELS, PLAY_CHANNEL_ORDER, WINDOW_PLAY_CHANNEL_ORDER, validateEoteCrossSeat,
} from '../src/engine/play-channels.js'
import { eoteScenarioState } from '../src/engine/eote-state.js'

const ITEM_ASSET = '01006' // 罗兰的 .38 特制手枪：asset + Item
const EVENT = '01088' // 应急物品：event，费用 0，结算无目标
const FILLER = '01039' // 推理：skill，仅占牌库
const BASIC_WEAKNESS = Object.values(ALL_CARDS).find(card => card.subtype === 'basicweakness')?.code
const clone = value => JSON.parse(JSON.stringify(value))

function stateWithDeck(codes) {
  const state = fixture('01001')
  state.investigators[0].deck = [...codes]
  return state
}

function deckTopMoves(state) {
  return legalMoves(state).filter(move => move.fromDeckTop)
}

function otherHandMoves(state) {
  return legalMoves(state).filter(move => move.fromOtherHand)
}

function itemMoves(state) {
  return legalMoves(state).filter(move => move.fromOtherHand && move.cardId === ITEM_ASSET)
}

// ---------------------------------------------------------------------------
// 通道表：既有通道顺序不变，新通道只追加
// ---------------------------------------------------------------------------
test('通道表：既有 7 个如同手牌通道顺序不变，deckTop/otherHand 追加在末尾', () => {
  assert.deepEqual([...LEGACY_PLAY_CHANNELS],
    ['attached', 'hunch', 'threat', 'beneath', 'backpack', 'discard', 'plan'])
  assert.deepEqual([...PLAY_CHANNEL_ORDER], [...LEGACY_PLAY_CHANNELS, 'deckTop', 'otherHand'])
  assert.deepEqual([...WINDOW_PLAY_CHANNEL_ORDER],
    ['plan', 'attached', 'beneath', 'hunch', 'discard', 'backpack', 'threat', 'deckTop', 'otherHand'])
})

test('通道表：没有 EotE 状态时 legalMoves 不出现新通道（既有 8 通道行为零变化）', () => {
  const state = fixture('01001')
  const plan = asset(state, '03264')
  plan.attached = ['01036']
  const moves = legalMoves(state)
  assert.equal(moves.some(move => move.fromDeckTop || move.fromOtherHand), false)
  // 既有唯一通道样例（原定计划）仍照常出现，说明枚举顺序未被新通道打乱。
  const planMove = moves.find(move => move.fromPlanAssetId)
  assert.ok(planMove, '既有原定计划通道候选仍应存在')
  assert.equal(planMove.label.includes('原定计划'), true)
})

// ---------------------------------------------------------------------------
// investigator.deckTop
// ---------------------------------------------------------------------------
test('deckTop：默认私密揭示、牌库不移动、JSON 往返保持', () => {
  const state = stateWithDeck([FILLER, EVENT])
  const revealed = deckTop.revealDeckTop(state, 0)
  assert.deepEqual(revealed, { seat: 0, code: EVENT, public: false, discount: 0 })
  assert.deepEqual(state.investigators[0].deck, [FILLER, EVENT], '揭示不移动牌库')
  assert.deepEqual(deckTop.deckTopCard(state, 0), { seat: 0, code: EVENT, public: false, discount: 0 })

  const roundTripped = clone(state)
  assert.deepEqual(deckTop.deckTopCard(roundTripped, 0), { seat: 0, code: EVENT, public: false, discount: 0 })
  assert.equal(deckTop.validateEoteDeckTop(roundTripped), true)

  assert.equal(deckTop.revealDeckTop(state, 0, { public: true })?.public, true, '可声明公开揭示')
  assert.equal(deckTop.revealDeckTop(stateWithDeck([]), 0), false, '空牌库不能揭示')
})

test('deckTop：非法参数/状态抛错，validateEoteDeckTop 拒绝坏存档', () => {
  const state = stateWithDeck([EVENT])
  assert.throws(() => deckTop.revealDeckTop(state, 9), /无效调查员座位/)
  assert.throws(() => deckTop.revealDeckTop(state, 0, { discount: -1 }), /折扣/)
  assert.throws(() => deckTop.deckTopCard(state, 9), /无效调查员座位/)
  assert.throws(() => deckTop.revealDeckTop(state, 0, { public: 'yes' }), /可见性/)
  deckTop.revealDeckTop(state, 0)
  for (const mutate of [
    value => { value.deckTop.extra = true },
    value => { value.deckTop.seats['0'].public = 'yes' },
    value => { value.deckTop.seats['0'].code = 'no-such-card' },
    value => { value.deckTop.seats['0'].discount = -2 },
    value => { value.deckTop.played['9'] = 1 },
  ]) {
    const value = clone(state.scenarioFlags.mechanics.eote)
    mutate(value)
    assert.throws(() => deckTop.validateEoteDeckTop(state, value.deckTop), TypeError)
  }
})

test('deckTop：每轮一次折扣，打出后门禁关闭，牌库顶回滚可还原', () => {
  const state = stateWithDeck([FILLER, EVENT])
  assert.equal(deckTop.playDeckTop(state, 0, { discount: 1, cost: 2 }), false, '未揭示不能读取打出信息')
  deckTop.revealDeckTop(state, 0, { discount: 1 })
  assert.deepEqual(deckTop.playDeckTop(state, 0, { discount: 1, cost: 2 }),
    { seat: 0, code: EVENT, public: false, discount: 1, cost: 2, effectiveCost: 1 })
  assert.equal(deckTop.deckTopDiscountUsed(state, 0, state.round), false)
  assert.equal(deckTopMoves(state).length, 1, '揭示后进入 legalMoves')
  const [move] = deckTopMoves(state)
  assert.equal(move.uiKey, `deckTop:${EVENT}`)
  assert.match(move.label, /牌库顶/)

  // 回滚：取到手里后放回，揭示与使用记录都还原。
  const consumed = deckTop.consumeDeckTop(state, 0)
  assert.equal(consumed.code, EVENT)
  assert.deepEqual(state.investigators[0].hand, [EVENT])
  assert.equal(deckTop.deckTopDiscountUsed(state, 0, state.round), true)
  deckTop.restoreDeckTop(state, 0, consumed)
  assert.deepEqual(state.investigators[0].deck, [FILLER, EVENT])
  assert.equal(deckTop.deckTopCard(state, 0)?.code, EVENT)
  assert.equal(deckTop.deckTopDiscountUsed(state, 0, state.round), false)

  // 真正打出：事件进弃牌堆，牌库少一张，本轮机会用掉。
  deckTop.revealDeckTop(state, 0, { discount: 1 })
  const [playMove] = deckTopMoves(state)
  assert.equal(validateMove(state, 0, playMove), null)
  applyMove(state, 0, playMove)
  const inv = state.investigators[0]
  assert.deepEqual(inv.deck, [FILLER])
  assert.deepEqual(inv.discard, [EVENT])
  assert.equal(deckTop.deckTopCard(state, 0), null)
  assert.equal(deckTop.deckTopDiscountUsed(state, 0, state.round), true)
  assert.equal(deckTop.playDeckTop(state, 0, { discount: 1, cost: 0 }), false, '本轮折扣机会已用完')

  // 下一轮重新开放（揭示新顶牌）。
  state.round += 1
  state.investigators[0].deck = [FILLER, EVENT]
  deckTop.revealDeckTop(state, 0, { discount: 1 })
  assert.equal(deckTop.deckTopDiscountUsed(state, 0, state.round), false)
  assert.equal(deckTopMoves(state).length, 1)
})

test('deckTop：牌库顶是弱点时强制抽取并清掉揭示', () => {
  assert.ok(BASIC_WEAKNESS, '核心包应存在基础弱点')
  const state = stateWithDeck([FILLER, BASIC_WEAKNESS])
  deckTop.revealDeckTop(state, 0)
  assert.equal(deckTop.deckTopWeaknessDraw(state, 0)?.drawn, true)
  const inv = state.investigators[0]
  assert.deepEqual(inv.hand, [BASIC_WEAKNESS])
  assert.deepEqual(inv.deck, [FILLER])
  assert.equal(deckTop.deckTopCard(state, 0), null)
  assert.equal(deckTop.deckTopWeaknessDraw(state, 0), false, '没有揭示时不再抽取')

  deckTop.revealDeckTop(state, 0)
  assert.equal(deckTop.deckTopWeaknessDraw(state, 0), false, '非弱点不强制抽取')
})

// ---------------------------------------------------------------------------
// investigator.roundDistance
// ---------------------------------------------------------------------------
function distanceState() {
  return {
    campaign: {},
    investigators: [{ seat: 0, location: 'c', hand: [], deck: [], assets: [] }],
    locations: [
      { id: 'a', connections: ['b'] },
      { id: 'b', connections: ['a', 'c'] },
      { id: 'c', connections: ['b'] },
      { id: 'island', connections: [] },
    ],
    scenarioFlags: {},
  }
}

test('roundDistance：本轮起始地点到当前地点的连接距离与奖励', () => {
  const state = distanceState()
  assert.equal(roundDistance.roundStartLocation(state, 0), null)
  assert.equal(roundDistance.travelDistance(state, 0), null, '未记录起始地点时不可猜距离')
  assert.equal(roundDistance.roundDistanceReward(state, 0, { perDistance: 2 }), 0)

  roundDistance.noteRoundStartLocation(state, 0, 'a')
  assert.equal(roundDistance.roundStartLocation(state, 0), 'a')
  assert.equal(roundDistance.travelDistance(state, 0), 2)
  assert.equal(roundDistance.roundDistanceReward(state, 0, { perDistance: 2 }), 4)

  state.investigators[0].location = 'a'
  assert.equal(roundDistance.travelDistance(state, 0), 0, '回到起始地点距离为 0')
  state.investigators[0].location = 'island'
  assert.equal(roundDistance.travelDistance(state, 0), null, '不连通返回 null，不猜距离')

  const roundTripped = clone(state)
  assert.equal(roundDistance.validateEoteRoundDistance(roundTripped), true)
  roundDistance.noteRoundStartLocation(roundTripped, 0, 'b')
  assert.equal(roundDistance.roundStartLocation(roundTripped, 0), 'b')
})

test('roundDistance：非法参数/状态抛错', () => {
  const state = distanceState()
  assert.throws(() => roundDistance.roundStartLocation(state, 9), /无效调查员座位/)
  assert.throws(() => roundDistance.noteRoundStartLocation(state, 0, 'missing'), /未知地点/)
  assert.throws(() => roundDistance.noteRoundStartLocation(state, 0, ''), TypeError)
  assert.throws(() => roundDistance.roundDistanceReward(state, 0, { perDistance: -1 }), TypeError)
  const bad = clone(state)
  bad.scenarioFlags.mechanics = { version: 1, eote: { version: 1, roundDistance: { 0: 'missing' } } }
  assert.throws(() => roundDistance.validateEoteRoundDistance(bad), /本轮起始地点/)
})

// ---------------------------------------------------------------------------
// investigator.discipline
// ---------------------------------------------------------------------------
const DISCIPLINE_SETS = Object.freeze([
  { unbrokenCode: '08011a', brokenCode: '08011b', burdenCode: '08015' },
  { unbrokenCode: '08012a', brokenCode: '08012b', burdenCode: '08015' },
])
const campaignState = () => ({ campaign: {}, investigators: [], locations: [], scenarioFlags: {} })

test('disciplines：初始化两面状态、翻面与命运重担配对', () => {
  const state = campaignState()
  assert.deepEqual(disciplines.selectDisciplines === undefined, false)
  disciplines.initializeDisciplines(state, { sets: DISCIPLINE_SETS })
  assert.equal(disciplines.disciplineFace(state, '08011a'), 'unbroken')
  assert.equal(disciplines.disciplineFace(state, '08011b'), 'unbroken', '两面卡号都指向当前面')
  assert.equal(disciplines.disciplineFaceCode(state, '08011b'), '08011a')
  assert.equal(disciplines.disciplineBurden(state, '08011b'), '08015')
  assert.deepEqual(disciplines.bondsOfDiscipline(state),
    [{ discipline: '08011a', burden: '08015' }, { discipline: '08012a', burden: '08015' }])

  assert.deepEqual(disciplines.flipDiscipline(state, '08011a'),
    { code: '08011b', from: 'unbroken', to: 'broken', changed: true })
  assert.equal(disciplines.disciplineFace(state, '08011a'), 'broken')
  assert.equal(disciplines.disciplineFaceCode(state, '08011a'), '08011b')
  assert.equal(disciplines.flipDiscipline(state, '08011b', { to: 'unbroken' }).changed, true)
  assert.equal(disciplines.flipDiscipline(state, '08011a', { to: 'unbroken' }).changed, false, '同面翻面无变化')

  const roundTripped = clone(state)
  assert.equal(disciplines.validateEoteDisciplines(roundTripped), true)
  assert.equal(disciplines.disciplineFace(roundTripped, '08012a'), 'unbroken')
})

test('disciplines：确定性选择、非法声明/状态抛错', () => {
  const state = campaignState()
  assert.throws(() => disciplines.selectDisciplines(state, { available: ['08011a'], count: 1, random: () => 0 }),
    /演武尚未初始化/)
  disciplines.initializeDisciplines(state, { sets: DISCIPLINE_SETS })
  const picked = disciplines.selectDisciplines(state, { available: ['08011a', '08012a'], count: 1, random: () => 0.1 })
  assert.equal(picked.length, 1)
  assert.ok(['08011a', '08012a'].includes(picked[0]))
  assert.deepEqual(state.campaign.eote.disciplines.selected, picked)
  assert.deepEqual(disciplines.selectDisciplines(state, { available: ['08011a', '08012a'], count: 2, random: () => 0.1 }).sort(),
    ['08011a', '08012a'])
  assert.deepEqual(state.campaign.eote.disciplines.selected.slice().sort(), ['08011a', '08012a'])

  assert.throws(() => disciplines.initializeDisciplines(state, { sets: DISCIPLINE_SETS }), /已经初始化/)
  assert.throws(() => disciplines.flipDiscipline(state, '99999'), RangeError)
  assert.throws(() => disciplines.flipDiscipline(state, '08011a', { to: 'sideways' }), /非法演武面/)
  assert.throws(() => disciplines.selectDisciplines(state, { available: ['08011a'], count: 1 }), /random/)
  assert.throws(() => disciplines.selectDisciplines(state, { available: ['08011a'], count: 2, random: () => 0 }), /数量/)
  assert.throws(() => disciplines.initializeDisciplines(campaignState(), { sets: [] }), TypeError)
  assert.throws(() => disciplines.initializeDisciplines(campaignState(), {
    sets: [{ unbrokenCode: '08011a', brokenCode: '08011a', burdenCode: '08015' }],
  }), /同一卡号/)

  const bad = clone(state)
  bad.campaign.eote.disciplines.faces['08011a'] = 'sideways'
  assert.throws(() => disciplines.validateEoteDisciplines(bad), TypeError)
  const badSelected = clone(state)
  badSelected.campaign.eote.disciplines.selected = ['99999']
  assert.throws(() => disciplines.validateEoteDisciplines(badSelected), TypeError)
})

// ---------------------------------------------------------------------------
// physical.faces：支援双面翻面
// ---------------------------------------------------------------------------
const ASSET_DEFINITIONS = Object.freeze({
  A: Object.freeze({ code: 'A', type: 'asset', name: 'Unbroken Face', traits: ['Talent', 'Unbroken'], slots: ['Hand'], health: 2, sanity: 2, unique: false, permanent: true }),
  B: Object.freeze({ code: 'B', type: 'asset', name: 'Broken Face', traits: ['Talent', 'Broken'], slots: ['Hand'], health: 3, sanity: 3, unique: false, permanent: true }),
})
const ASSET_DEFINITIONS_LINKED = Object.freeze({
  A: Object.freeze({ ...ASSET_DEFINITIONS.A, linkedToCode: 'B' }),
  B: Object.freeze({ ...ASSET_DEFINITIONS.B, linkedToCode: 'A' }),
})
const faceState = () => {
  const entity = { id: 'asset:1', code: 'A', originalCode: 'A', name: 'Unbroken Face', exhausted: true, uses: 2, usesType: 'charges' }
  const state = { enemies: [], storyAssets: [], investigators: [{ assets: [entity] }] }
  return { state, entity }
}

test('physical.faces：支援双面翻面保留实例 id/横置/使用次数，敌人换面行为不变', () => {
  const { state, entity } = faceState()
  const plan = planAssetFaceFlip(entity, 'B', { definitionFor: code => ASSET_DEFINITIONS[code], pairs: [['A', 'B']] })
  assert.equal(plan.kind, 'asset')
  assert.deepEqual({ from: plan.from, to: plan.to }, { from: 'A', to: 'B' })
  assert.equal(plan.set.code, 'B')
  assert.equal(plan.set.name, 'Broken Face')

  applyPhysicalFace(state, entity, 'B', { definitionFor: code => ASSET_DEFINITIONS_LINKED[code] })
  assert.equal(entity.id, 'asset:1')
  assert.equal(entity.code, 'B')
  assert.equal(entity.name, 'Broken Face')
  assert.deepEqual(entity.traits, ['Talent', 'Broken'])
  assert.equal(entity.exhausted, true)
  assert.equal(entity.uses, 2)
  assert.equal(entity.usesType, 'charges')

  assert.throws(() => planAssetFaceFlip(faceState().entity, 'C', { definitionFor: code => ASSET_DEFINITIONS[code], pairs: [['A', 'B']] }),
    /not a declared pair/)
  assert.throws(() => planAssetFaceFlip(faceState().entity, 'B', { definitionFor: code => ASSET_DEFINITIONS[code] }),
    /Unrelated or cross-kind face replacement/)
  assert.throws(() => planAssetFaceFlip(faceState().entity, 'B'), /definitionFor/)

  // 既有敌人物理换面路径不受影响。
  const enemy = { code: 'E1', originalCode: 'E1', fight: 2, evade: 2, health: 3 }
  const enemyPlan = planPhysicalFace(enemy, 'E2', {
    kind: 'enemy',
    definitionFor: code => ({
      E1: { code: 'E1', type: 'enemy', fight: 2, evade: 2, health: 3, linkedToCode: 'E2', traits: [] },
      E2: { code: 'E2', type: 'enemy', fight: 3, evade: 3, health: 4, traits: [] },
    })[code],
  })
  assert.equal(enemyPlan.kind, 'enemy')
  assert.deepEqual({ from: enemyPlan.from, to: enemyPlan.to }, { from: 'E1', to: 'E2' })
})

// ---------------------------------------------------------------------------
// investigator.crossSeatPlay（play-channels#otherHand）
// ---------------------------------------------------------------------------
function crossSeatState() {
  const state = fixture('01001', 2)
  const [actor, owner] = state.investigators
  owner.location = actor.location
  owner.hand = [ITEM_ASSET, EVENT]
  actor.resources = 30
  eoteScenarioState(state, true).crossSeat = {
    grants: { 0: { fromSeat: 1, codes: [ITEM_ASSET, EVENT, FILLER], costSplit: { self: 1, owner: 2 } } },
  }
  return state
}

test('crossSeat：同地点队友手牌 Item 可代打，事件/不同地点/无授权被拒绝', () => {
  const state = crossSeatState()
  const moves = itemMoves(state)
  assert.equal(moves.length, 1)
  assert.equal(moves[0].fromOtherHand, true)
  assert.equal(moves[0].ownerSeat, 1)
  assert.deepEqual(moves[0].crossSeatCostSplit, { self: 1, owner: 2 })
  assert.equal(moves[0].uiKey, `otherHand:1:${ITEM_ASSET}`)
  assert.match(moves[0].label, /代打/)
  assert.equal(validateMove(state, 0, moves[0]), null)
  assert.equal(otherHandMoves(state).some(move => move.cardId === EVENT), false, '事件不能代打')
  assert.equal(otherHandMoves(state).some(move => move.cardId === FILLER), false, '非 Item/不在对方手中不能代打')

  const roundTripped = clone(state)
  assert.equal(itemMoves(roundTripped).length, 1, 'JSON 往返后仍可枚举')
  assert.equal(validateEoteCrossSeat(roundTripped), true)

  // 不同地点：枚举为空，伪造 move 被 validateMove 拒绝。
  const moved = state.investigators[1]
  moved.location = 'some-other-location'
  assert.equal(itemMoves(state).length, 0)
  assert.match(validateMove(state, 0, moves[0]), /同地点/)
  moved.location = state.investigators[0].location

  // 授权不存在/卡号不在授权内：不枚举。
  delete state.scenarioFlags.mechanics.eote.crossSeat
  assert.equal(itemMoves(state).length, 0)
  assert.match(validateMove(state, 0, moves[0]), /对方手牌|如同手牌|代打/)
})

test('crossSeat：validateEoteCrossSeat 拒绝坏存档与非法授权', () => {
  const state = crossSeatState()
  assert.equal(validateEoteCrossSeat(state), true)
  const mutations = [
    value => { value.crossSeat.extra = true },
    value => { value.crossSeat.grants['0'].fromSeat = 0 },
    value => { value.crossSeat.grants['0'].codes = [] },
    value => { value.crossSeat.grants['0'].codes = [ITEM_ASSET, ITEM_ASSET] },
    value => { value.crossSeat.grants['0'].costSplit = { self: -1 } },
    value => { value.crossSeat.grants['9'] = { fromSeat: 1, codes: [ITEM_ASSET] } },
  ]
  for (const mutate of mutations) {
    const copy = clone(state.scenarioFlags.mechanics.eote)
    mutate(copy)
    assert.throws(() => validateEoteCrossSeat(state, copy.crossSeat), TypeError)
  }
})

test('crossSeat：代打行动走既有打出管线，牌主手牌移出且不残留上下文标记', () => {
  const state = crossSeatState()
  const move = itemMoves(state)[0]
  applyMove(state, 0, move)
  settle(state)
  const [actor, owner] = state.investigators
  assert.equal(owner.hand.includes(ITEM_ASSET), false, '牌主手牌中的牌被代打移出')
  // 08016 印刷：「打出后置于该调查员（手牌所有者）控制之下」——P5 起由 actions.js#doPlay 落实控制权；
  // P4 的通路契约（无残留上下文、牌主手牌移出）保持不变。
  assert.ok(owner.assets.some(asset => asset.code === ITEM_ASSET), '支援在牌主（手牌所有者）控制下进场')
  assert.equal(state._playedFromOtherHand, undefined, '行动结束后不残留跨座位上下文')
})
