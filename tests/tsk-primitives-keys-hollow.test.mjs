// TSK P2 原语验收 C：绯红密钥（keys）与空洞/存在抹除（hollow）。
//
// 覆盖 new.scarletKeyEntity / keyShift / keyBinding / keySteal、new.hollowZone / hollowCount /
// hollowCountModifierScope / hollowRecall / erasedFromExistence、extend.cardCounters（evidence/hollow）、
// extend.physicalFaces（双面配对）、extend.records（抹除名单）。
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bindKey, initializeScarletKeys, keyChoices, keyFace, keyShiftedThisRound, keysHeldBy, scarletKey,
  scarletKeys, shiftKey, stealKey, validateTskKeys,
} from '../src/engine/tsk-scarlet-keys.js'
import {
  eraseFromExistence, erasedFromExistence, hollowCard, hollowCards, hollowChoices, hollowCount,
  isErasedFromExistence, isHollowed, recallHollow, shuffledHollowRecall, validateTskHollows,
} from '../src/engine/tsk-hollow.js'
import { CARD_COUNTER_IDS, addCardCounter, cardCounterOf } from '../src/engine/card-counters.js'
import { nextPrintedFace } from '../src/engine/physical-faces.js'
import { validateTskState } from '../src/engine/tsk-primitives.js'

const plain = () => ({
  round: 4,
  investigators: [{ seat: 0, name: '甲', location: 'locA', assets: [], threat: [] }],
  locations: [{ id: 'locA', name: '甲地', connections: [] }],
  enemies: [{ id: 'enemy1', name: '敌人', location: 'locA' }],
  campaign: { records: {} },
  scenarioFlags: {},
})
const roundTrip = value => JSON.parse(JSON.stringify(value))
const fourKeys = () => [
  { id: 'k1', stableFace: 'fp1a', unstableFace: 'fp1b' },
  { id: 'k2', stableFace: 'fp2a', unstableFace: 'fp2b' },
  { id: 'k3', stableFace: 'fp3a', unstableFace: 'fp3b' },
  { id: 'k4', stableFace: 'fp4a', unstableFace: 'fp4b' },
]

test('密钥初始化：4 把密钥、稳定面/持有者；重复初始化与非法面配对拒绝', () => {
  const state = plain()
  const keys = initializeScarletKeys(state, fourKeys())
  assert.equal(keys.length, 4)
  assert.deepEqual(keys.map(key => key.id), ['k1', 'k2', 'k3', 'k4'])
  assert.equal(scarletKeys(state).length, 4)
  assert.equal(keyFace(state, 'k1'), 'fp1a')
  assert.deepEqual(scarletKey(state, 'k1').bearer, { type: 'none' })
  assert.throws(() => initializeScarletKeys(state, fourKeys()), /已经初始化/)
  assert.throws(() => nextPrintedFace(state, { from: 'x', faces: ['a', 'a'] }), /must differ/)
  assert.throws(() => nextPrintedFace(state, { from: 'x', faces: ['a', 'b'] }), /not part/)
  assert.equal(nextPrintedFace(state, { from: 'a', faces: ['a', 'b'] }), 'b')
  // 非法稳定/动荡面在写入前拒绝。
  const broken = plain()
  assert.throws(() => initializeScarletKeys(broken, [{ id: 'k', stableFace: 'x', unstableFace: 'x' }]), /不能相同/)
  assert.throws(() => initializeScarletKeys(broken, [{ id: 'k', stableFace: '', unstableFace: 'y' }]), /稳定面/)
})

test('Shift 变换：每轮一次、强制触发可覆盖；面由配对校验保证；JSON 往返', () => {
  const state = plain()
  initializeScarletKeys(state, fourKeys())
  const first = shiftKey(state, 'k1')
  assert.deepEqual(first, { id: 'k1', from: 'fp1a', to: 'fp1b', stable: false })
  assert.equal(keyFace(state, 'k1'), 'fp1b')
  assert.equal(keyShiftedThisRound(state, 'k1'), true)
  assert.throws(() => shiftKey(state, 'k1'), /本轮已经变换过/)
  // 强制触发（剧情）：不受每轮一次限制，但仍记账。
  const forced = shiftKey(state, 'k1', { force: true })
  assert.equal(forced.to, 'fp1a')
  // 下一轮可以再变换。
  state.round = 5
  assert.equal(keyShiftedThisRound(state, 'k1'), false)
  assert.equal(shiftKey(state, 'k1').to, 'fp1b')
  const restored = roundTrip(state)
  validateTskState(restored)
  assert.equal(scarletKey(restored, 'k1').stable, false)
  assert.equal(scarletKey(restored, 'k1').shiftedRound, 5)
})

test('绑定/夺取：调查员 ↔ 敌人 ↔ 未持有；持有者变化联动朝向', () => {
  const state = plain()
  initializeScarletKeys(state, fourKeys())
  assert.deepEqual(bindKey(state, 'k1', { type: 'investigator', seat: 0 }), { type: 'none' })
  assert.deepEqual(keysHeldBy(state, { type: 'investigator', seat: 0 }), ['k1'])
  // 敌人夺走：朝向动荡面。
  const stolen = stealKey(state, 'k2', { type: 'enemy', enemyId: 'enemy1' })
  assert.deepEqual(stolen.from, { type: 'none' })
  assert.equal(stolen.stable, false)
  assert.equal(keyFace(state, 'k2'), 'fp2b')
  assert.deepEqual(keysHeldBy(state, { type: 'enemy', enemyId: 'enemy1' }), ['k2'])
  // 夺回：回稳定面。
  const reclaimed = stealKey(state, 'k2', { type: 'investigator', seat: 0 })
  assert.equal(reclaimed.stable, true)
  assert.deepEqual(keysHeldBy(state, { type: 'investigator', seat: 0 }).sort(), ['k1', 'k2'])
  // 非法敌人/座位拒绝。
  assert.throws(() => bindKey(state, 'k1', { type: 'enemy', enemyId: 'ghost' }), /不在场/)
  assert.throws(() => bindKey(state, 'k1', { type: 'investigator', seat: 9 }), /座位无效/)
  // 合法动作载荷。
  const choices = keyChoices(state, 'k1')
  assert.equal(choices.canShift, true)
  assert.ok(choices.transferTargets.some(target => target.type === 'enemy' && target.enemyId === 'enemy1'))
})

test('空洞：归属口径计数、回收、抹除进战役名单；非法输入不写入', () => {
  const state = plain()
  hollowCard(state, { code: 'h1', scope: 'investigator', seat: 0, source: 'deck' })
  hollowCard(state, { code: 'h2', scope: 'team', source: 'hand' })
  assert.equal(hollowCount(state, { scope: 'team' }), 2)
  assert.equal(hollowCount(state, { scope: 'investigator', seat: 0 }), 2, '团队空洞对个人计数同样有效')
  assert.equal(isHollowed(state, 'h1'), true)
  assert.throws(() => hollowCard(state, { code: 'h1', scope: 'team' }), /已在空洞区/)
  assert.throws(() => hollowCard(state, { code: 'h3', scope: 'investigator' }), /座位无效/)
  assert.throws(() => hollowCard(state, { code: 'h3', scope: 'weird' }), /口径/)
  // 回收：从空洞区移除，回到指定区域。
  assert.deepEqual(recallHollow(state, 'h2', { to: 'deck' }), { code: 'h2', source: 'hand', scope: 'team', seat: null, to: 'deck' })
  assert.equal(isHollowed(state, 'h2'), false)
  assert.equal(recallHollow(state, 'h2'), null, '不在空洞区回收返回 null')
  // 抹除：必须先在空洞区；整批拒绝不产生部分写入。
  assert.throws(() => eraseFromExistence(state, ['h1', 'nope']), /不在空洞区/)
  assert.deepEqual(erasedFromExistence(state), [], '失败抹除不得写入')
  assert.deepEqual(eraseFromExistence(state, ['h1']), ['h1'])
  assert.equal(isErasedFromExistence(state, 'h1'), true)
  assert.equal(hollowCount(state, { scope: 'team' }), 0, '抹除后不再计入空洞')
  // 洗牌回收保持卡号守恒。
  assert.deepEqual(shuffledHollowRecall(state, ['a', 'b']).sort(), ['a', 'b'])
  assert.throws(() => shuffledHollowRecall(state, ['a'], { shuffle: () => ['b'] }), /不得增删/)
  // 合法动作载荷。
  const choices = hollowChoices(state)
  assert.deepEqual(choices.erased, ['h1'])
})

test('卡实例计数器扩展：evidence/hollow 白名单与读写（未知 id 拒绝）', () => {
  assert.deepEqual([...CARD_COUNTER_IDS], ['bounty', 'evidence', 'hollow'])
  const card = { code: '09000' }
  assert.equal(addCardCounter(card, 'evidence', 2), 2)
  assert.equal(cardCounterOf(card, 'evidence'), 2)
  assert.throws(() => addCardCounter(card, 'holo', 1), /未知卡牌计数器/)
  assert.throws(() => addCardCounter(card, 'unknown', 1), /未知卡牌计数器/)
  assert.equal(addCardCounter(card, 'evidence', -2), 0)
  assert.equal(card.markers, undefined, '归零后不留下空 markers 字段')
})

test('战役禁用卡（invalidCards）：抹除名单 + 内容层登记；构筑读点', async () => {
  const { invalidCampaignCards, cardInvalidInCampaign } = await import('../src/engine/tsk-hollow.js')
  const state = plain()
  assert.deepEqual(invalidCampaignCards(state), [])
  assert.equal(cardInvalidInCampaign(state, '09064'), false)
  state.campaign.tsk = { version: 1, invalidCards: ['02310'] }
  assert.deepEqual(invalidCampaignCards(state), ['02310'])
  assert.equal(cardInvalidInCampaign(state, '02310'), true)
  // 抹除名单与登记合并、去重、排序。
  hollowCard(state, { code: '09064', scope: 'team' })
  eraseFromExistence(state, ['09064'])
  assert.deepEqual(invalidCampaignCards(state), ['02310', '09064'])
  validateTskState(state)
  // 坏登记被读档校验拒绝。
  const bad = roundTrip(state)
  bad.campaign.tsk.invalidCards = ['02310', 42]
  assert.throws(() => validateTskState(bad), /战役禁用卡登记/)
})

test('存档往返与读档校验：密钥/空洞/抹除；非法持有者与坏名单被拒绝', () => {
  const state = plain()
  initializeScarletKeys(state, fourKeys())
  hollowCard(state, { code: '09064', scope: 'team' })
  eraseFromExistence(state, ['09064'])
  validateTskKeys(state)
  validateTskHollows(state)
  validateTskState(state)
  const restored = roundTrip(state)
  validateTskState(restored)
  assert.equal(scarletKeys(restored).length, 4)
  assert.deepEqual(erasedFromExistence(restored), ['09064'])
  const badKeys = roundTrip(state)
  badKeys.campaign.tsk.keys.keys.k1.bearer = { type: 'investigator', seat: 9 }
  assert.throws(() => validateTskState(badKeys), /座位无效/)
  const badErased = roundTrip(state)
  badErased.campaign.tsk.erased.version = 99
  assert.throws(() => validateTskState(badErased), /不支持的存在抹除版本/)
  const dupHollow = roundTrip(state)
  dupHollow.scenarioFlags.mechanics.tsk.hollows.cards.push({ ...dupHollow.scenarioFlags.mechanics.tsk.hollows.cards[0] })
  assert.throws(() => validateTskState(dupHollow), /重复或无效/)
})
