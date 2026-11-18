// 九循环《铁杉谷盛宴》P5 · 10004 凯特·温斯罗普（Kate Winthrop）及专属依赖 Node 验收。
//
// 覆盖：条目形状 / 构筑（30 张 + 签名 10005/10008） / 开局关闭面稳定器 / [fast] 线索搬移 /
//       旧印 / 强制翻面与绑定检索 / 开启面 +2 / 两张以太电流（攻击·躲避） / 失败的实验 / 存档往返。
import test from 'node:test'
import assert from 'node:assert/strict'

import kateWinthrop from '../src/cards/entries/10004.js'
import fluxInactive from '../src/cards/entries/10005.js'
import fluxActive from '../src/cards/entries/10005b.js'
import aethericFight from '../src/cards/entries/10006.js'
import aethericEvade from '../src/cards/entries/10007.js'
import failedExperiment from '../src/cards/entries/10008.js'
import '../src/engine/engine.js'
import { fixture, asset, enemy, move, settle, legalMoves, validateMove } from './core-fixture.mjs'

import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { createGameState, elderSignEffect, executeDescriptor, leaveAsset } from '../src/engine/engine.js'
import { buildDeck } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { getAvailability } from '../src/deck/availability.js'
import { migrateState } from '../src/engine/save-migration.js'

const CODE = '10004'
const ENTRIES = [kateWinthrop, fluxInactive, fluxActive, aethericFight, aethericEvade, failedExperiment]
// entries/index.js 已由 Lead 重建并注册本批条目；显式 import 还让本文件可以单独运行。
if (!registeredEntry(CODE)) registerCardAbilities(ENTRIES)

const copy = value => JSON.parse(JSON.stringify(value))
const invOf = state => state.investigators[0]
const locate = (state, id) => invOf(state).assets.find(item => item.id === id)

// 与 tests/fhv-primitives.test.mjs 同形：在一个 free 描述子里调用 ctx.api（用于原语级断言）。
function viaAbilityApi(state, resolve) {
  let output
  const inv = state.investigators[0]
  executeDescriptor(state, { inv, events: [], silent: true, alreadyPaid: true,
    descriptor: { kind: 'free', code: inv.code, cost: {}, resolve: ({ api }) => { output = resolve(api) } } })
  return output
}

function kateState() {
  return fixture(CODE)
}

function pushAsset(state, id, code, extra = {}) {
  invOf(state).assets.push({ id, code, exhausted: false, ...extra })
  return id
}

function chooseFastTarget(state, assetId) {
  settle(state, choice => choice.options?.some(option => option.id === assetId) ? assetId : null)
}

const chooseFluxCopy = choice => choice.options?.some(option => option.id === '10006') ? '10006' : null
const triggerReaction = choice => choice.kind === 'reaction' ? choice.options.find(option => option.id !== 'skip')?.id : null

test(`P5 ${CODE} 条目注册与依赖形状`, () => {
  const kate = registeredEntry(CODE)
  assert.equal(kate.code, CODE)
  assert.equal(kate.kind, 'investigator')
  assert.equal(Number(kate.investigator?.elderSign?.bonus), 0)
  assert.deepEqual(kate.investigator?.startsWith, ['10005'])
  assert.equal(typeof kate.investigator?.freeAction?.resolve, 'function')
  assert.equal(kate.investigator?.freeAction?.repeatable, true)
  assert.equal(kate.elderSign?.label != null, true)
  assert.equal(typeof kate.elderSign?.resolve, 'function')

  const inactive = registeredEntry('10005')
  assert.equal(inactive.code, '10005')
  const forced = inactive.abilities.find(item => item.kind === 'forced')
  assert.ok(forced, '10005 必须声明强制能力')
  assert.deepEqual(forced.trigger, ['assetCluesPlaced'])

  const active = registeredEntry('10005b')
  assert.equal(active.code, '10005b')
  const reaction = active.abilities.find(item => item.kind === 'reaction')
  assert.ok(reaction, '10005b 必须声明反应能力')
  assert.deepEqual(reaction.trigger, ['assetCluesPlaced'])
  assert.equal(reaction.limit?.scope, 'perWindow')

  const fight = registeredEntry('10006')
  const fightPlayed = fight.abilities.find(item => item.kind === 'played')
  assert.equal(fightPlayed.countsAs, 'fight')
  assert.equal(fightPlayed.noOpportunityAttack, true)
  assert.equal(ALL_CARDS['10006'].type, 'event')
  assert.equal(ALL_CARDS['10006'].bondedTo, 'Flux Stabilizer')
  assert.equal(ALL_CARDS['10006'].bondedCount, 1)

  const evade = registeredEntry('10007')
  const evadePlayed = evade.abilities.find(item => item.kind === 'played')
  assert.equal(evadePlayed.countsAs, 'evade')
  assert.equal(evadePlayed.noOpportunityAttack, true)
  assert.equal(ALL_CARDS['10007'].bondedTo, 'Flux Stabilizer')

  const weakness = registeredEntry('10008')
  const weaknessDescriptor = weakness.abilities.find(item => item.kind === 'weakness')
  assert.ok(weaknessDescriptor)
  assert.equal(weaknessDescriptor.weakness?.type, 'discardAfterResolve')
  assert.equal(ALL_CARDS['10008'].subtype, 'weakness')
  assert.notEqual(weakness.simplified, true)

  for (const code of ['10005', '10005b', '10006', '10007', '10008']) {
    const availability = getAvailability(code)
    assert.ok(registeredEntry(code), `${code} 必须注册`)
    assert.equal(availability.dependencyOnly, true, `${code} 必须是 dependencyOnly`)
    assert.equal(availability.deckbuilding, false, `${code} 不得进入一般构筑池`)
    assert.equal(availability.selectable, false, `${code} 不得作为调查员选择`)
  }
})

test(`P5 ${CODE} 构筑：30 张 + 签名 10005/10008，规则校验零错误，非法卡报错`, () => {
  const deck = buildDeck(INVESTIGATORS[CODE], { seed: 'p5-10004', xp: 0 })
  assert.equal(deck.playerCards.length, 30)
  assert.deepEqual(deck.signatureCards, ['10005'])
  assert.deepEqual(deck.signatureWeaknesses, ['10008'])
  assert.deepEqual([...deck.signatureCards, ...deck.signatureWeaknesses], ['10005', '10008'])
  assert.equal(deck.basicWeaknesses.length, 1)
  assert.equal(deck.deck.length, 33)
  assert.equal(deck.deck.filter(code => code === '10005').length, 1)
  assert.equal(deck.deck.filter(code => code === '10008').length, 1)
  const validation = validateDeckRules(INVESTIGATORS[CODE], deck.playerCards, ALL_CARDS)
  assert.deepEqual(validation.errors, [])
  const illegal = validateDeckRules(INVESTIGATORS[CODE], [...deck.playerCards, '08238'], ALL_CARDS)
  assert.ok(illegal.errors.length > 0, '混入职阶/等级范围外的卡必须报错')
})

test(`P5 ${CODE} 开局：磁通量稳定器（关闭）面朝上在场`, () => {
  const state = createGameState({ playerInvestigator: CODE, seed: 'p5-10004-setup' }, [{ seat: 0 }])
  settle(state)
  const inv = state.investigators[0]
  const fluxes = inv.assets.filter(item => item.code === '10005' || item.code === '10005b')
  assert.equal(fluxes.length, 1)
  assert.equal(fluxes[0].code, '10005')
  assert.equal(fluxes[0].originalCode, '10005')
  assert.equal(inv.assets.some(item => item.code === '10005b'), false)
  assert.equal(inv.deck.includes('10005'), false, 'startsWith 的签名卡已从牌库移入支援区')
  assert.equal(state.bondedSets?.['10005'], undefined, '绑定池惰性创建，开局不写状态键')
})

test(`P5 ${CODE} [fast]：线索搬移到无线索的[[科学]]/[[工具]]支援；已带线索目标与原语容量拒绝`, () => {
  const state = kateState()
  const inv = invOf(state)
  inv.clues = 2
  const tool = pushAsset(state, 'p5-tool', '01030') // 放大镜：[[工具]]
  pushAsset(state, 'p5-science', '10040') // 化学品套装：[[工具]]/[[科学]]
  assert.ok(legalMoves(state, 0).some(item => item.action === 'freeAction'))

  move(state, { action: 'freeAction' })
  chooseFastTarget(state, tool)
  settle(state)
  let invNow = invOf(state)
  assert.equal(locate(state, tool).clues, 1)
  assert.equal(invNow.clues, 1)
  assert.equal(locate(state, tool).returnCluesOnLeave, true, '线索搬移会登记离场归还')

  // 原语容量：目标已有线索时 emptyTarget 拒绝（直接走 ctx.api 断言，不经过卡面选择）。
  const rejected = viaAbilityApi(state, api =>
    api.transferControlledClues(0, 'investigator', tool, 1, { emptyTarget: true }))
  assert.ok(!rejected)
  assert.equal(locate(state, tool).clues, 1)

  // 没有合法目标：把唯一的空支援移除后，[fast] 仍是合法行动但结算为 no-op。
  invOf(state).assets = invOf(state).assets.filter(item => item.id !== 'p5-science')
  invOf(state).clues = 1
  move(state, { action: 'freeAction' })
  settle(state)
  assert.equal(invOf(state).clues, 1)
  assert.equal(locate(state, tool).clues, 1)
})

test(`P5 ${CODE} 旧印：+0 且把 1 个线索从支援移回凯特`, () => {
  const state = kateState()
  const inv = invOf(state)
  pushAsset(state, 'p5-tool', '01030', { clues: 2 })
  inv.clues = 1
  const effect = elderSignEffect(state, inv)
  assert.equal(effect.delta, 0)
  assert.equal(invOf(state).clues, 2)
  assert.equal(locate(state, 'p5-tool').clues, 1)

  // 没有带线索的支援时纯 +0（不产生多余移动）。
  locate(state, 'p5-tool').clues = 0
  const before = invOf(state).clues
  assert.equal(elderSignEffect(state, invOf(state)).delta, 0)
  assert.equal(invOf(state).clues, before)
})

test(`P5 ${CODE} 强制翻面：线索放到稳定器后检索以太电流洗入牌库，翻至开启面并保留标记/附属`, () => {
  const state = kateState()
  invOf(state).clues = 1
  pushAsset(state, 'p5-flux', '10005', {
    uses: 3, usesType: 'charges', attachments: [{ id: 'p5-att', code: '01089' }],
  })
  move(state, { action: 'freeAction' })
  settle(state, chooseFluxCopy)

  const inv = invOf(state)
  const flux = locate(state, 'p5-flux')
  assert.equal(flux.code, '10005b')
  assert.equal(flux.clues, 1)
  assert.equal(flux.uses, 3)
  assert.equal(flux.usesType, 'charges')
  assert.deepEqual(flux.attachments.map(item => item.id), ['p5-att'])
  assert.equal(inv.clues, 0)
  assert.equal(inv.deck.includes('10006'), true, '选定的以太电流离开绑定池进入牌库')
  assert.deepEqual(state.bondedSets['10005'].cards, ['10007'])
  assert.equal(state.bondedSets['10005'].retrieved, true)
})

test(`P5 ${CODE} 开启面反应：放置线索后本阶段下一次技能检定 +2（只用一次即到期）`, () => {
  const state = kateState()
  invOf(state).clues = 3
  pushAsset(state, 'p5-flux', '10005', { uses: 1 })
  const tool = pushAsset(state, 'p5-tool', '10040') // 化学品套装：无调查加值，便于核对数值
  // 第一次放置：稳定器翻至开启面（同一次放置不触发开启面的反应）。
  move(state, { action: 'freeAction' })
  settle(state, chooseFluxCopy)
  assert.equal(locate(state, 'p5-flux').code, '10005b')
  assert.equal(state.effects.length, 0)
  // 第二次放置到另一张空支援：触发反应。
  move(state, { action: 'freeAction' })
  settle(state, triggerReaction)
  assert.equal(state.effects.length, 1)
  assert.equal(state.effects[0].modifiers[0].target, 'skill:*')
  assert.equal(state.effects[0].modifiers[0].amount, 2)
  assert.equal(locate(state, tool).clues, 1)

  const loc = state.locations.find(item => item.id === invOf(state).location)
  Object.assign(loc, { revealed: true, shroud: 0, clues: 2 })
  state.chaosBag = ['0']
  // 凯特智识 4 + 效果 2 + 标记 0 = 6。
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(state.lastTestResult.value, 6)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.effects.length, 0, '下一次检定结束后效果到期')

  // 第二次检定不再有 +2。
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(state.lastTestResult.value, 4)
})

test(`P5 ${CODE} 以太电流（攻击）：智识代替战斗、搬回支援线索、横置移动非精英、抽牌并翻回`, () => {
  const state = kateState()
  const inv = invOf(state)
  const here = state.locations.find(item => item.id === inv.location)
  Object.assign(here, { revealed: true, shroud: 0, clues: 2, connections: ['p5-other'] })
  state.locations = [here, { id: 'p5-other', name: '另一地点', connections: [here.id],
    clues: 0, shroud: 1, traits: [], revealed: true }]
  pushAsset(state, 'p5-tool', '01030', { clues: 2 })
  pushAsset(state, 'p5-science', '10040', { clues: 1 })
  const foe = enemy(state, { fight: 1, evade: 1, health: 30, damageTaken: 0 })
  state.chaosBag = ['+1']
  inv.hand.push('10006')

  // playCondition：稳定器关闭面朝上时不能打出（此时场上没有开启面）。
  pushAsset(state, 'p5-inactive', '10005')
  assert.match(validateMove(state, 0, { action: 'play', cardId: '10006' }), /磁通量稳定器/)
  invOf(state).assets = invOf(state).assets.filter(item => item.id !== 'p5-inactive')
  pushAsset(state, 'p5-flux', '10005b', {
    uses: 2, usesType: 'charges', attachments: [{ id: 'p5-att', code: '01089' }],
  })

  const playMove = legalMoves(state, 0).find(item => item.action === 'play' && item.cardId === '10006')
  assert.ok(playMove, '开启面朝上时可以打出')
  move(state, playMove)
  settle(state, choice => {
    if (choice.options?.some(option => option.id === 'intellect')) return 'intellect'
    if (choice.options?.some(option => option.id === 'exhaustMove')) return 'exhaustMove'
    if (choice.options?.some(option => option.id === 'p5-other')) return 'p5-other'
    return null
  })

  const invNow = invOf(state)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(invNow.clues, 3, '两张支援上的线索全部移回凯特')
  assert.equal(locate(state, 'p5-tool').clues, 0)
  assert.equal(locate(state, 'p5-science').clues, 0)
  const foeNow = state.enemies.find(item => item.id === foe.id)
  assert.equal(foeNow.location, 'p5-other')
  assert.equal(foeNow.exhausted, true)
  assert.equal(foeNow.damageTaken, 1)
  assert.equal(invNow.hand.length, 1, '打出事件后抽 1 张')
  const flux = locate(state, 'p5-flux')
  assert.equal(flux.code, '10005')
  assert.equal(flux.uses, 2)
  assert.equal(flux.attachments[0].id, 'p5-att')
})

test(`P5 ${CODE} 以太电流（躲避）：智识代替敏捷、搬回线索、非精英洗回遭遇牌库并翻回`, () => {
  const state = kateState()
  const inv = invOf(state)
  pushAsset(state, 'p5-flux', '10005b', { uses: 1 })
  pushAsset(state, 'p5-tool', '01030', { clues: 2 })
  const foe = enemy(state, { fight: 1, evade: 1, health: 30 })
  state.chaosBag = ['+1']
  inv.hand.push('10007')

  move(state, { action: 'play', cardId: '10007' })
  settle(state, choice => choice.options?.some(option => option.id === 'intellect') ? 'intellect' : null)

  const invNow = invOf(state)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.enemies.some(item => item.id === foe.id), false, '非精英目标被移出场上')
  assert.equal(state.encounterDeck.filter(code => code === 'ghoulMinion').length, 1)
  assert.equal(invNow.clues, 2)
  assert.equal(locate(state, 'p5-tool').clues, 0)
  assert.equal(invNow.hand.length, 1)
  assert.equal(locate(state, 'p5-flux').code, '10005')
  assert.deepEqual(invNow.engaged, [])
})

test(`P5 ${CODE} 失败的实验：难度随带线索支援增加，按失败点数分配恐惧或线索`, () => {
  const drawFailedExperiment = (state, option) => {
    invOf(state).deck.push('10008')
    move(state, { action: 'draw' })
    settle(state, choice => {
      if (choice.source === '10008' && choice.options?.some(item => item.id === option)) return option
      return null
    })
  }
  // 0 点失败：成功，无恐惧/线索变化。
  const success = kateState()
  success.chaosBag = ['+1']
  const locBefore = success.locations.find(item => item.id === invOf(success).location).clues
  drawFailedExperiment(success, 'horror')
  assert.equal(success.lastTestResult.success, true)
  assert.equal(success.lastTestResult.difficulty, 3)
  assert.equal(invOf(success).horror, 0)
  assert.equal(success.locations.find(item => item.id === invOf(success).location).clues, locBefore)

  // 失败 1 点：选择恐惧。
  const one = kateState()
  one.chaosBag = ['0']
  drawFailedExperiment(one, 'horror')
  assert.equal(one.lastTestResult.success, false)
  assert.equal(one.lastTestResult.failedBy, 1)
  assert.equal(invOf(one).horror, 1)

  // 失败 2 点：选择放线索（你所在地点每个 +1，共 2 个）。
  const two = kateState()
  two.chaosBag = ['-1']
  invOf(two).clues = 3
  const twoLoc = two.locations.find(item => item.id === invOf(two).location)
  const twoBefore = twoLoc.clues
  drawFailedExperiment(two, 'clue')
  assert.equal(two.lastTestResult.failedBy, 2)
  assert.equal(invOf(two).clues, 1)
  assert.equal(two.locations.find(item => item.id === invOf(two).location).clues, twoBefore + 2)

  // 难度 = 3 + 带线索的受控支援数（两张 → 5）；失败 3 点全部选恐惧。
  const scaled = kateState()
  scaled.chaosBag = ['0']
  pushAsset(scaled, 'p5-tool', '01030', { clues: 1 })
  pushAsset(scaled, 'p5-science', '10040', { clues: 2 })
  drawFailedExperiment(scaled, 'horror')
  assert.equal(scaled.lastTestResult.difficulty, 5)
  assert.equal(scaled.lastTestResult.failedBy, 3)
  assert.equal(invOf(scaled).horror, 3)
})

test(`P5 ${CODE} 存档往返：翻面支援、绑定池与牌库保持，恢复后开启面反应仍生效`, () => {
  const state = kateState()
  invOf(state).clues = 2
  pushAsset(state, 'p5-flux', '10005', {
    uses: 2, usesType: 'charges', attachments: [{ id: 'p5-att', code: '01089' }],
  })
  move(state, { action: 'freeAction' })
  settle(state, chooseFluxCopy)

  const saved = copy(state)
  migrateState(saved)
  const invSaved = saved.investigators[0]
  const flux = invSaved.assets.find(item => item.id === 'p5-flux')
  assert.equal(flux.code, '10005b')
  assert.equal(flux.clues, 1)
  assert.equal(flux.uses, 2)
  assert.equal(flux.attachments[0].id, 'p5-att')
  assert.equal(invSaved.deck.includes('10006'), true)
  assert.deepEqual(saved.bondedSets['10005'].cards, ['10007'])
  assert.ok(registeredEntry('10005b'))

  // 读档后仍能触发开启面反应（再放 1 个线索到另一张空支援）。
  invSaved.clues = 1
  invSaved.assets.push({ id: 'p5-tool', code: '10040', exhausted: false })
  move(saved, { action: 'freeAction' })
  settle(saved, triggerReaction)
  assert.equal(saved.effects.length, 1)
  assert.equal(saved.effects[0].modifiers[0].amount, 2)
})

test(`P5 ${CODE} 以太电流：精英敌人不受「横置并移动」与「洗回遭遇牌库」影响`, () => {
  // 10006：精英敌人即使攻击成功也不横置、不移动。
  const fightState = kateState()
  const fightInv = invOf(fightState)
  const here = fightState.locations.find(item => item.id === fightInv.location)
  Object.assign(here, { revealed: true, shroud: 0, connections: ['p5-other'] })
  fightState.locations = [here, { id: 'p5-other', name: '另一地点', connections: [here.id],
    clues: 0, shroud: 1, traits: [], revealed: true }]
  pushAsset(fightState, 'p5-flux', '10005b', {})
  const eliteFoe = enemy(fightState, { fight: 1, evade: 1, health: 30, elite: true })
  fightState.chaosBag = ['+1']
  fightInv.hand.push('10006')
  let offeredEliteMove = false
  move(fightState, { action: 'play', cardId: '10006' })
  settle(fightState, choice => {
    if (choice.options?.some(option => option.id === 'exhaustMove')) offeredEliteMove = true
    return choice.options?.some(option => option.id === 'intellect') ? 'intellect' : null
  })
  assert.equal(offeredEliteMove, false, '精英敌人不提供横置/移动选项')
  const eliteAfter = fightState.enemies.find(item => item.id === eliteFoe.id)
  assert.ok(eliteAfter)
  assert.equal(eliteAfter.location, here.id)
  assert.ok(!eliteAfter.exhausted)
  assert.equal(locate(fightState, 'p5-flux').code, '10005')

  // 10007：精英目标躲避成功后留在场上，不洗回遭遇牌库。
  const evadeState = kateState()
  pushAsset(evadeState, 'p5-flux', '10005b', {})
  const eliteTarget = enemy(evadeState, { fight: 1, evade: 1, health: 30, elite: true })
  evadeState.chaosBag = ['+1']
  invOf(evadeState).hand.push('10007')
  move(evadeState, { action: 'play', cardId: '10007' })
  settle(evadeState, choice => choice.options?.some(option => option.id === 'intellect') ? 'intellect' : null)
  const eliteSaved = evadeState.enemies.find(item => item.id === eliteTarget.id)
  assert.ok(eliteSaved, '精英未被移出场上')
  assert.equal(eliteSaved.exhausted, true)
  assert.equal(evadeState.encounterDeck.filter(code => code === 'ghoulMinion').length, 0)
  assert.equal(locate(evadeState, 'p5-flux').code, '10005')
})

test(`P5 ${CODE} 强制离场归还：带线索支援离场时线索放到所在地点`, () => {
  const state = kateState()
  invOf(state).clues = 2
  const tool = pushAsset(state, 'p5-tool', '01030')
  move(state, { action: 'freeAction' })
  settle(state)
  assert.equal(locate(state, tool).clues, 1)

  const inv = invOf(state)
  const location = state.locations.find(item => item.id === inv.location)
  const before = location.clues
  const leaving = locate(state, tool)
  leaveAsset(state, inv, leaving, [])
  assert.equal(invOf(state).assets.some(item => item.id === tool), false)
  assert.equal(state.locations.find(item => item.id === invOf(state).location).clues, before + 1)
})
