import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, legalMoves, move, settle, validateMove } from './core-fixture.mjs'
import { applyHarm, enemyDef, getStat, scenarioRuntime, slotUsage } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { expireEffects } from '../src/engine/effect-state.js'
import { attachmentTextBlanked } from '../src/engine/attachment-rules.js'
import { recordCustomizationChoices } from '../src/engine/tsk-customizable.js'

const selectCard = code => choice => choice.kind === 'reaction'
  ? choice.options.find(option => option.cardCode === code)?.id : null

test('09-a-2 09045：玩家事件将线索放到自己的地点时，笔记增加等量证据', () => {
  const state = fixture('01001')
  const notes = asset(state, '09045')
  const inv = state.investigators[0]
  inv.hand = ['09046']
  inv.clues = 2
  inv.damage = 2
  const location = state.locations.find(item => item.id === inv.location)
  const before = location.clues
  move(state, { action: 'play', cardId: '09046' })
  settle(state, selectCard('09045'))
  assert.equal(state.investigators[0].clues, 1)
  assert.equal(state.locations.find(item => item.id === location.id).clues, before + 1)
  assert.equal(state.investigators[0].assets.find(item => item.id === notes.id).markers.evidence, 1)
})

test('09-a-2 09051：诡计的打出限制被清空，下一回合仍为空白，下一轮恢复', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  const theory = asset(state, '09051')
  inv.hand = ['01088']
  inv.threat.push({ id: 'entry:t1', code: '01165' })
  const play = { action: 'play', cardId: '01088' }
  assert.notEqual(validateMove(state, 0, play), null)
  move(state, { action: 'ability', assetId: theory.id, abilityIndex: 0 })
  settle(state)
  const current = state.investigators[0].threat[0]
  assert.equal(attachmentTextBlanked(state, current), true)
  assert.equal(validateMove(state, 0, play), null)
  assert.equal(attachmentTextBlanked({ ...state, turnSerial: state.turnSerial + 1 }, current), true)
  assert.equal(attachmentTextBlanked({ ...state, round: state.round + 1 }, current), false)
})

test('09-a-2 09060：快速让队友结算，免费加入一张双特性牌，按指定顺序放回，支付费用打出', () => {
  const state = fixture('01001', 2)
  state.humanSeats = [0, 1]
  const [owner, partner] = state.investigators
  partner.location = owner.location
  const examined = ['01088', '01041', '01030', '09065', '60305', '09075']
  partner.deck = examined
  owner.hand = ['09060']
  state.campaign.tsk = { version: 1, customizations: { version: 1, bySeat: {
    0: { '09060': [0, 1, 1, 3, 3, 4, 4, 6, 6, 6] },
  } } }
  recordCustomizationChoices(state, 0, '09060', null, ['tool'])
  recordCustomizationChoices(state, 0, '09060', 1, ['illicit'])
  const initialActions = owner.actionsLeft
  const initialFunds = partner.resources
  move(state, { action: 'play', cardId: '09060' })
  settle(state, choice => {
    if (choice.kind === 'investigator') return '1'
    if (choice.prompt.includes('免费')) return choice.options.find(option => option.cardCode === '09075')?.id
    if (choice.prompt.includes('花 1 资源') && choice.options.some(option => option.cardCode === '09065')) return 'take'
    if (choice.options.some(option => option.id === 'order')) return 'order'
    if (choice.prompt.includes('从顶到底')) return choice.options.at(-1).id
    if (choice.prompt.includes('打出一张')) return choice.options.find(option => option.cardCode === '09075')?.id
    return null
  })
  const [actor, resolver] = state.investigators
  assert.equal(actor.actionsLeft, initialActions)
  assert.ok(actor.discard.includes('09060'))
  assert.equal(resolver.resources, initialFunds - 4)
  assert.deepEqual(resolver.hand, ['09065'])
  assert.deepEqual(resolver.deck, ['60305', '01030', '01041', '01088'])
  assert.ok(resolver.assets.some(item => item.code === '09075'))
})

test('09-a-2 09060 鼓舞：只给新加入的同名副本百搭图标，手牌移位和存档后仍可投入，阶段结束后失效', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  inv.hand = ['09060', '01087', '01088']
  inv.deck = ['01087']
  state.campaign.tsk = { version: 1, customizations: { version: 1, bySeat: { 0: { '09060': [2, 2] } } } }
  recordCustomizationChoices(state, 0, '09060', null, ['tool'])
  move(state, { action: 'play', cardId: '09060' })
  settle(state, choice => choice.options.some(option => option.id === 'take') ? 'take' : null)
  assert.deepEqual(state.investigators[0].hand, ['01087', '01088', '01087'])
  scenarioRuntime(state, []).discardFromHand(0, '01088')
  const saved = JSON.parse(JSON.stringify(state))
  const shifted = saved.investigators[0]
  assert.deepEqual(shifted.hand, ['01087', '01087'])
  const engage = game => enemy(game, { evade: 3 })
  const threat = engage(saved)
  move(saved, { action: 'evade', enemyId: threat.id })
  let committed = false
  settle(saved, choice => {
    if (choice.kind !== 'commit' || committed) return null
    assert.ok(!choice.options.some(option => option.id === '0'))
    assert.ok(choice.options.some(option => option.id === '1'))
    committed = true
    return '1'
  })
  assert.equal(committed, true)
  assert.deepEqual(saved.investigators[0].hand, ['01087'])
  assert.equal(saved.lastTestResult.value, getStat(saved, saved.investigators[0], 'agility') + 1)
  const expired = JSON.parse(JSON.stringify(state))
  expireEffects(expired, 'endOfPhase')
  const nextThreat = engage(expired)
  move(expired, { action: 'evade', enemyId: nextThreat.id })
  settle(expired, choice => {
    if (choice.kind === 'commit') assert.ok(!choice.options.some(option => ['0', '1'].includes(option.id)))
    return null
  })
  assert.equal(expired.lastTestResult.value, getStat(expired, expired.investigators[0], 'agility'))
})

test('09-a-2 09068：顶九张只有精英时不生成敌人、发现线索或获得资源', () => {
  const state = fixture('01001')
  const eliteCode = '01116'
  assert.ok(enemyDef(eliteCode)?.traits?.includes('Elite'))
  state.encounterDeck = Array(9).fill(eliteCode)
  const inv = state.investigators[0]
  inv.hand = ['09068']
  const clues = inv.clues
  const enemies = state.enemies.length
  const funds = inv.resources
  move(state, { action: 'play', cardId: '09068' })
  settle(state)
  assert.equal(state.enemies.length, enemies)
  assert.deepEqual(state.encounterDeck, Array(9).fill(eliteCode))
  assert.equal(state.investigators[0].clues, clues)
  assert.equal(state.investigators[0].resources, funds)
})

test('09-a-2 09072：技能加值只作用于所选事件的结算', () => {
  const state = fixture('01001')
  const inv = state.investigators[0]
  const chuck = asset(state, '09072')
  inv.hand = ['09074']
  const location = state.locations.find(item => item.id === inv.location)
  location.shroud = 1
  location.clues = 3
  state.chaosBag = ['0', '0']
  move(state, { action: 'play', cardId: '09074' })
  settle(state, choice => selectCard('09072')(choice)
    ?? choice.options.find(option => option.id === 'skill')?.id)
  assert.equal(state.lastTestResult.value, inv.intellect + inv.agility + 2)
  assert.equal(state.investigators[0].assets.find(item => item.id === chuck.id).exhausted, true)
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(state.lastTestResult.value, inv.intellect)
})

test('09-a-2 09086：额外法术槽计入抽牌，已占用的槽位另需弃牌', () => {
  const state = fixture('01001')
  asset(state, '01070')
  asset(state, '01060')
  const inv = state.investigators[0]
  inv.hand = ['09086']
  inv.deck = ['01088', '01025', '01031', '01041']
  move(state, { action: 'play', cardId: '09086' })
  settle(state)
  assert.deepEqual(state.investigators[0].deck, ['01088'])
  assert.equal(state.investigators[0].hand.length, 2)
  assert.equal(state.investigators[0].discard.filter(code => code !== '09086').length, 1)
})

test('09-a-2 09079：记录所选技能，灌墨后可由同地点调查员控制并占用法术槽', () => {
  const state = fixture('01001', 2)
  const [owner, partner] = state.investigators
  partner.location = owner.location
  state.campaign.tsk = { version: 1, customizations: { version: 1, bySeat: { 0: { '09079': [0, 2, 2] } } } }
  recordCustomizationChoices(state, 0, '09079', null, ['agility'])
  owner.hand = ['09079']
  const agility = getStat(state, partner, 'agility')
  const will = getStat(state, partner, 'willpower')
  move(state, { action: 'play', cardId: '09079' })
  settle(state, choice => choice.kind === 'investigator'
    ? choice.options.find(option => option.id === '1')?.id : null)
  const controlled = state.investigators[1]
  const ink = controlled.assets.find(item => item.code === '09079')
  assert.equal(ink.uses, 5)
  assert.equal(ink.ownerSeat, 0)
  assert.equal(slotUsage(controlled).arcane, 1)
  assert.equal(slotUsage(controlled).body || 0, 0)
  assert.equal(getStat(state, controlled, 'agility'), agility + 1)
  assert.equal(getStat(state, controlled, 'willpower'), will)
})

function servitorFixture(checks = []) {
  const state = fixture('01001', 2)
  state.humanSeats = [0, 1]
  const [controller, teammate] = state.investigators
  const origin = controller.location
  const destination = 'servitorRemote'
  state.locations.find(loc => loc.id === origin).connections = [destination]
  state.locations.push({
    id: destination, name: '远处走廊', revealed: true, shroud: 3, clues: 1, connections: [origin],
  })
  teammate.location = destination
  controller.hand = ['09080']
  state.campaign.tsk = { version: 1, customizations: { version: 1, bySeat: { 0: { '09080': checks } } } }
  return { state, origin, destination }
}

const servitorOf = state => state.investigators[0].assets.find(item => item.code === '09080')
const servitorMove = (state, label) => legalMoves(state, 0).find(candidate =>
  candidate.assetId === servitorOf(state)?.id && label.test(candidate.label))

function activateServitor(state, action) {
  assert.ok(action, '召来的仆从没有可执行的这项行动')
  const { assetId, abilityIndex, targetId } = action
  move(state, { action: 'ability', assetId, abilityIndex, ...(targetId == null ? {} : { targetId }) })
  settle(state)
}

test('09-a-2 09080：打出须弃掉另一支援，仆从自行移动并用掉唯一行动', () => {
  const { state, origin, destination } = servitorFixture()
  const play = { action: 'play', cardId: '09080' }
  assert.notEqual(validateMove(state, 0, play), null, '没有能支付额外费用的支援')
  asset(state, '01020')
  move(state, play)
  settle(state)
  assert.equal(servitorOf(state)?.location, origin)
  assert.ok(state.investigators[0].discard.includes('01020'))
  const investigatorActions = state.investigators[0].actionsLeft
  activateServitor(state, servitorMove(state, /移动召来的仆从/))
  assert.equal(servitorOf(state).location, destination)
  assert.equal(state.investigators[0].location, origin)
  assert.equal(state.investigators[0].actionsLeft, investigatorActions)
  assert.equal(servitorMove(state, /移动召来的仆从/), undefined)
})

test('09-a-2 09080：邪魔在身允许两种不同动作，利爪可远程攻击，坚壳可替同地点队友承伤', () => {
  const { state, origin, destination } = servitorFixture([0, 1, 3, 5, 5, 6, 6, 6, 7, 7, 7, 7, 7])
  recordCustomizationChoices(state, 0, '09080', 5, ['arcane'])
  asset(state, '01020', { ownerSeat: 1 })
  move(state, { action: 'play', cardId: '09080' })
  settle(state, choice => choice.options.some(option => option.id === 'return') ? 'return' : null)
  assert.ok(state.investigators[1].hand.includes('01020'), '梦中呼唤可把费用支援退给原拥有者')
  assert.equal(slotUsage(state.investigators[0]).arcane || 0, 0, '统御之术移除所选法术槽')
  assert.equal(slotUsage(state.investigators[0]).ally, 1, '仍占用盟友槽')
  const investigatorActions = state.investigators[0].actionsLeft
  activateServitor(state, servitorMove(state, /移动召来的仆从/))
  assert.equal(servitorMove(state, /移动召来的仆从/), undefined, '邪魔在身不能重复同一种动作')
  assert.ok(servitorMove(state, /亮眼如火/), '移动后仍有第二个行动')
  const target = enemy(state, { location: destination, engagedSeat: null, aloof: true, retaliate: true, fight: 4 })
  state.investigators[0].combat = 1
  activateServitor(state, servitorMove(state, /利爪如钩/))
  assert.equal(state.lastTestResult.value, 4)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 1)
  assert.equal(state.investigators[0].location, origin)
  assert.equal(state.investigators[0].actionsLeft, investigatorActions)
  assert.equal(servitorMove(state, /亮眼如火/), undefined, '第二个行动后不能再调查')

  const servitorId = servitorOf(state).id
  assert.equal(servitorOf(state).customHealth, 3)
  const harm = draft => applyHarm(draft, draft.investigators[1], 1, 0, [])
  resolveTransaction(state, 1, { action: 'assignServitorDamage' }, harm)
  const choice = state.pendingChoice
  assert.ok(choice?.options.some(option => option.id === servitorId))
  resolveTransaction(state, 1, { action: 'choose', choiceId: choice.id, optionId: servitorId }, harm)
  assert.equal(servitorOf(state).damage, 1)
  assert.equal(state.investigators[1].damage, 0)
})
