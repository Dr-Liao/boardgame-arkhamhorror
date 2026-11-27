// 验收 08-a 分片 2：沿正常行动、费用、伤害分配与检定读点复验旧报告中的行为缺口。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, enemy, legalMoves, move, play, settle } from './core-fixture.mjs'
import { ALL_CARDS } from '../src/cards/cards-data.js'
import { cardCounterOf } from '../src/engine/card-counters.js'
import { applyHarm, beginInvestigationPhase, commitIcons, getMaxHealth, getMaxSanity, getStat, scenarioRuntime } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { validateDeckRules } from '../web/deck-rules.js'

const owner = (state, seat = 0) => state.investigators[seat]
const source = (state, id, seat = 0) => owner(state, seat).assets.find(card => card.id === id)
const ability = (state, id, index) => legalMoves(state).find(command =>
  command.action === 'ability' && command.assetId === id && command.abilityIndex === index)
const choose = (choice, id) => choice.options.find(option => option.id === id)?.id
const cardChoice = (choice, code) => choice.options.find(option => option.cardCode === code)?.id

function link(state, from, id, clues = 1) {
  state.locations.push({ id, name: id, connections: [from], revealed: true, clues, shroud: 1 })
  state.locations.find(location => location.id === from).connections.push(id)
  return id
}

test('08043 通路档案：只给非精英敌人灵脉，未标记时不能激活移动；解除交战不横置敌人', () => {
  const state = fixture('01001', 2)
  const start = owner(state).location
  const target = link(state, start, 'archiveRoad')
  const archive = asset(state, '08043')
  enemy(state, { elite: true, engagedSeat: null, exhausted: true })
  assert.equal(ability(state, archive.id, 0), undefined)
  const foe = enemy(state, { engagedSeat: 1, exhausted: false })
  assert.equal(ability(state, archive.id, 1), undefined)
  move(state, ability(state, archive.id, 0))
  settle(state)
  assert.equal(source(state, archive.id).uses, 3)
  assert.equal(cardCounterOf(state.enemies.find(card => card.id === foe.id), 'leyline'), 1)
  move(state, ability(state, archive.id, 1))
  settle(state, choice => choose(choice, target) ?? choose(choice, 'skip'))
  const stillReady = state.enemies.find(card => card.id === foe.id)
  assert.equal(owner(state, 1).location, target)
  assert.equal(stillReady.location, start)
  assert.notEqual(stillReady.engagedSeat, 1)
  assert.equal(stillReady.exhausted, false)
  assert.equal(cardCounterOf(stillReady, 'leyline'), 1)
})

test('08044 通路档案：未标记时不能强化，另一位调查员消耗灵脉抽 2 张并治愈 2 点', () => {
  const state = fixture('01001', 2)
  const archive = asset(state, '08044')
  owner(state, 1).damage = 2
  assert.equal(ability(state, archive.id, 1), undefined)
  move(state, ability(state, archive.id, 0))
  settle(state, choice => choose(choice, '1'))
  assert.equal(cardCounterOf(owner(state, 1), 'leyline'), 1)
  assert.equal(cardCounterOf(owner(state), 'leyline'), 0)
  move(state, ability(state, archive.id, 1))
  settle(state, choice => choose(choice, 'remove') ?? choose(choice, 'damage'))
  assert.equal(cardCounterOf(owner(state, 1), 'leyline'), 0)
  assert.equal(owner(state, 1).damage, 0)
  assert.equal(owner(state, 1).hand.length, 2)
  assert.equal(owner(state).hand.length, 0)
})

test('08046 地下支持：同名跨卡号重复的普通卡拒绝，改为单张后合法且牌库规模减 5', () => {
  const inv = ALL_CARDS['01003']
  const pair = ['01088', '01588']
  assert.equal(ALL_CARDS[pair[0]].name, ALL_CARDS[pair[1]].name)
  const legalPair = validateDeckRules(inv, pair, ALL_CARDS, { partial: true })
  const one = validateDeckRules(inv, ['08046', pair[0]], ALL_CARDS, { partial: true })
  const duplicate = validateDeckRules(inv, ['08046', ...pair], ALL_CARDS, { partial: true })
  assert.deepEqual(legalPair.errors, [])
  assert.deepEqual(one.errors, [])
  assert.equal(one.size, legalPair.size - 5)
  assert.equal(duplicate.errors.length, 1)
  assert.match(duplicate.errors[0], /Emergency Cache|应急物品/)
})

test('08047 提前侦察：移动不触发敌人交战强制能力，已经交战的敌人同行', () => {
  const state = fixture()
  const start = owner(state).location
  const middle = link(state, start, 'scoutMiddle')
  const end = link(state, middle, 'scoutEnd')
  const following = enemy(state, { exhausted: false })
  const deepOne = enemy(state, { code: 'youngDeepOne', originalCode: '01181', location: middle, engagedSeat: null, exhausted: false })
  const route = [middle, end, 'stop']
  play(state, '08047')
  settle(state, choice => choice.source === '08047' ? choose(choice, route.shift()) : null)
  assert.equal(route.length, 0)
  assert.equal(owner(state).location, end)
  assert.equal(owner(state).horror || 0, 0)
  assert.equal(state.enemies.find(enemy => enemy.id === following.id)?.engagedSeat, 0)
  assert.equal(state.enemies.find(enemy => enemy.id === following.id)?.location, end)
  assert.equal(state.enemies.find(enemy => enemy.id === deepOne.id)?.engagedSeat, null)

  move(state, { action: 'move', locationId: middle })
  settle(state)
  assert.equal(state.enemies.find(enemy => enemy.id === deepOne.id)?.engagedSeat, 0)
  assert.equal(owner(state).horror, 1)
})

test('08049 反间谍活动：跨地点取消其他调查员的显现需多付 2，可另付 2 改抽自己的牌库', () => {
  const code = '08049'
  const cost = ALL_CARDS[code].cost
  for (const enough of [false, true]) {
    const state = fixture('01001', 2)
    owner(state, 1).location = link(state, owner(state).location, 'remoteTreachery')
    owner(state).hand = [code]
    owner(state).resources = cost + (enough ? 4 : 1)
    const turn = draft => scenarioRuntime(draft, []).drawEncounter(1, { code: 'dissonantVoices' })
    resolveTransaction(state, 0, { action: 'acceptance-08-a-draw' }, turn)
    let offered = false
    for (let count = 0; state.pendingChoice; count++) {
      assert.ok(count < 30)
      const choice = state.pendingChoice
      const card = cardChoice(choice, code) ?? choice.options.find(option => option.id.includes(code))?.id
      const upgrade = choice.options.find(option => /改抽自己的牌库/.test(option.label))?.id
      if (card && !offered) {
        offered = true
        assert.equal(choice.seat, 0)
      }
      const optionId = card ?? upgrade ?? choose(choice, 'skip') ?? choice.options[0].id
      resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId }, turn)
    }
    assert.equal(offered, enough)
    assert.equal(owner(state).resources, enough ? 0 : cost + 1)
    assert.equal(owner(state).deck.length, enough ? 29 : 30)
    assert.equal(owner(state, 1).threat.length, enough ? 0 : 1)
  }
})

test('08051 不当交易：由受邀席位选择并支付道具费用，原出牌者抽牌并获印刷费用', () => {
  const state = fixture('01001', 2)
  const item = '01030'
  const cost = ALL_CARDS[item].cost
  owner(state).hand = [item]
  const resources = owner(state).resources
  const otherResources = owner(state, 1).resources
  play(state, '08051')
  let offered = false
  settle(state, choice => {
    if (!choose(choice, 'play')) return null
    offered = true
    assert.equal(choice.seat, 1)
    return 'play'
  })
  assert.equal(offered, true)
  const received = owner(state, 1).assets.find(card => card.code === item)
  assert.ok(received)
  assert.equal(received.ownerSeat, 0)
  assert.ok(!owner(state).hand.includes(item))
  assert.equal(owner(state).hand.length, 1)
  assert.equal(owner(state).resources, resources - ALL_CARDS['08051'].cost + cost)
  assert.equal(owner(state, 1).resources, otherResources - cost)
})

test('08055 黑市：调查阶段开始逐张揭示牌库顶，队友付款打出，剩牌回到各自牌库', () => {
  const state = fixture('01001', 2)
  const code = '08055'
  state.humanSeats = [0, 1]
  owner(state).hand = [code]
  owner(state).deck = ['01017', '01092', '01088', '01016']
  owner(state, 1).deck = ['01026', '01027', '01028']
  assert.equal(legalMoves(state).some(move => move.action === 'play' && move.cardId === code), false)

  const deckOwners = [0, 1, 0, 1, 0]
  let reveals = 0
  let offered = false
  const begin = (draft, seat, command, events) => beginInvestigationPhase(draft, events)
  const startPhase = () => {
    resolveTransaction(state, 0, { action: 'acceptance-08-a-investigation-phase' }, begin)
    for (let count = 0; state.pendingChoice; count++) {
      assert.ok(count < 30)
      const choice = state.pendingChoice
      let optionId = cardChoice(choice, code) ?? choice.options.find(option => option.id.includes(code))?.id
      if (optionId) {
        assert.equal(choice.seat, 0)
        offered = true
      } else if (choice.source === code && choice.kind === 'investigator') {
        assert.ok(reveals < deckOwners.length)
        optionId = String(deckOwners[reveals++])
        assert.ok(choose(choice, optionId))
      } else if (choice.kind === 'turnOrder') {
        optionId = choose(choice, '1')
      }
      optionId ??= choose(choice, 'skip') ?? choice.options[0].id
      const selected = choice.options.find(option => option.id === optionId)
      resolveTransaction(state, selected.responderSeat ?? choice.seat, { action: 'choose', choiceId: choice.id, optionId }, begin)
    }
  }
  startPhase()
  assert.equal(offered, true)
  assert.equal(reveals, 5)
  assert.deepEqual(state.sharedPlayCards.map(({ code, ownerSeat }) => [code, ownerSeat]), [
    ['01016', 0], ['01028', 1], ['01088', 0], ['01027', 1], ['01092', 0],
  ])
  assert.deepEqual(owner(state).deck, ['01017'])
  assert.deepEqual(owner(state, 1).deck, ['01026'])
  assert.ok(owner(state).discard.includes(code))

  const resources = owner(state, 1).resources
  const commands = legalMoves(state)
  const gun = commands.find(move => move.action === 'play' && move.cardId === '01016' && move.fromSharedSetAside)
  const cache = commands.find(move => move.action === 'play' && move.cardId === '01088' && move.fromSharedSetAside)
  assert.ok(gun)
  assert.ok(cache)
  move(state, gun)
  settle(state)
  assert.equal(owner(state, 1).resources, resources - ALL_CARDS['01016'].cost)
  assert.equal(owner(state, 1).assets.find(card => card.code === '01016')?.ownerSeat, 0)
  assert.equal(state.sharedPlayCards.some(card => card.code === '01016'), false)

  move(state, cache)
  settle(state)
  assert.equal(owner(state, 1).resources, resources - ALL_CARDS['01016'].cost + 3)
  assert.ok(owner(state).discard.includes('01088'))
  assert.ok(!owner(state, 1).discard.includes('01088'))
  assert.equal(state.sharedPlayCards.some(card => card.code === '01088'), false)

  state.round++
  startPhase()
  assert.equal(state.sharedPlayCards?.length ?? 0, 0)
  assert.deepEqual(owner(state).deck.toSorted(), ['01017', '01092'])
  assert.deepEqual(owner(state, 1).deck.toSorted(), ['01026', '01027', '01028'])
})

for (const spec of [
  { code: '08052', withCard: '01055', tested: 'intellect', skill: 'agility' },
  { code: '08065', withCard: '08081', tested: 'willpower', skill: 'intellect' },
  { code: '08078', withCard: '08081', tested: 'combat', skill: 'willpower' },
]) {
  test(spec.code + ' 投入图标随实时属性修正改变', () => {
    const state = fixture()
    const inv = owner(state)
    const before = commitIcons(state, inv, spec.code, spec.tested)
    const beforeStat = getStat(state, inv, spec.skill)
    asset(state, spec.withCard)
    assert.equal(getStat(state, inv, spec.skill), beforeStat + 1)
    assert.equal(commitIcons(state, inv, spec.code, spec.tested), before + 1)
  })
}

for (const code of ['08056', '08069', '08081']) {
  test(code + ' 沉稳：非直接伤害先给支援，直接伤害仍给调查员', () => {
    const state = fixture()
    const card = asset(state, code)
    const rival = asset(state, '01018')
    enemy(state, { damage: 1, horror: 0, exhausted: false })
    move(state, { action: 'resource' })
    let assigned = false
    settle(state, choice => {
      if (choice.kind !== 'assign-damage') return null
      assigned = true
      assert.ok(choose(choice, card.id))
      assert.equal(choose(choice, 'self'), undefined)
      return card.id
    })
    assert.equal(assigned, true)
    assert.equal(source(state, card.id)?.damage ?? (owner(state).discard.includes(code) ? 1 : 0), 1)
    assert.equal(source(state, rival.id).damage || 0, 0)
    assert.equal(owner(state).damage || 0, 0)
    applyHarm(state, owner(state), 1, 0, [], true)
    assert.equal(owner(state).damage, 1)
  })
}

test('08057 黑色扇子：低于 10 资源无生命/神智加成，达到或失去阈值时更新', () => {
  const state = fixture()
  const inv = owner(state)
  const baseline = [getMaxHealth(inv), getMaxSanity(inv)]
  asset(state, '08057')
  inv.resources = 9
  assert.deepEqual([getMaxHealth(inv), getMaxSanity(inv)], baseline)
  inv.resources = 10
  assert.deepEqual([getMaxHealth(inv), getMaxSanity(inv)], baseline.map(value => value + 1))
  inv.resources = 9
  assert.deepEqual([getMaxHealth(inv), getMaxSanity(inv)], baseline)
})

test('08062 闭环：仅本次免费基础调查可改用意志，下一次调查恢复智力', () => {
  const state = fixture('01004')
  const inv = owner(state)
  const here = state.locations.find(location => location.id === inv.location)
  here.clues = 6
  here.shroud = 1
  const circle = asset(state, '08062', { uses: 3 })
  const actions = inv.actionsLeft
  move(state, ability(state, circle.id, 0))
  let choseWillpower = false
  settle(state, choice => {
    if (choice.kind === 'action') return choice.options.find(option => /调查/.test(option.label))?.id
    if (choose(choice, 'willpower')) { choseWillpower = true; return 'willpower' }
    return null
  })
  assert.equal(choseWillpower, true)
  assert.equal(state.lastTestResult.skill, 'willpower')
  assert.equal(owner(state).actionsLeft, actions)
  assert.equal(source(state, circle.id).uses, 2)
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(state.lastTestResult.skill, 'intellect')
})

test('08064 先见：在抽牌前私选卡名，猜中可折价打出，猜错照常抽取', () => {
  const code = '08064'
  const drawn = '01018'
  for (const hit of [false, true]) {
    const state = fixture('01001', 2)
    state.humanSeats = [0, 1]
    owner(state).resources = 2
    owner(state).deck = ['01022', drawn]
    owner(state, 1).hand = [code]
    const otherResources = owner(state, 1).resources
    move(state, { action: 'draw' })
    let named = false
    let offeredPlay = false
    settle(state, choice => {
      const foresight = cardChoice(choice, code) ?? choice.options.find(option => option.id.includes(code))?.id
      if (foresight) {
        assert.equal(choice.seat, 1)
        return foresight
      }
      if (choice.kind === 'cardName') {
        named = true
        assert.equal(choice.seat, 1)
        assert.ok(choice.options.every(option => !option.cardCode), '指定牌名时不展示正要抽出的卡')
        return hit ? 'Beat Cop' : 'Vicious Blow'
      }
      if (choose(choice, 'play')) {
        offeredPlay = true
        assert.equal(choice.seat, 0)
        return 'play'
      }
      return null
    })
    assert.equal(named, true)
    assert.equal(offeredPlay, hit)
    assert.equal(owner(state, 1).resources, otherResources - ALL_CARDS[code].cost)
    assert.equal(owner(state).hand.includes(drawn), !hit)
    assert.equal(owner(state).assets.some(card => card.code === drawn), hit)
    assert.equal(owner(state).resources, hit ? 0 : 2)
  }
})

test('08066 平行命运：可逐张以任意顺序摆回另一位调查员的顶 6 张，并由其决定抽牌', () => {
  const state = fixture('01001', 2)
  const six = ['01018', '01025', '01028', '01030', '01032', '01088']
  const order = [six[2], six[0], six[5], six[1], six[4], six[3]]
  owner(state, 1).deck = ['01022', ...six]
  play(state, '08066')
  let arranged = 0
  let askedOwner = false
  settle(state, choice => {
    if (choose(choice, 'seat:1')) return 'seat:1'
    if (choose(choice, 'top')) return 'top'
    if (choice.kind === 'look' && /选择放回牌库顶的第/.test(choice.prompt)) {
      const id = cardChoice(choice, order[arranged++])
      assert.ok(id)
      return id
    }
    if (choose(choice, 'draw')) {
      askedOwner = true
      assert.equal(choice.seat, 1)
      return 'draw'
    }
    return null
  })
  assert.equal(arranged, 5)
  assert.equal(askedOwner, true)
  assert.deepEqual(owner(state, 1).hand, [order[0]])
  assert.deepEqual(owner(state, 1).deck.slice().reverse(), [...order.slice(1), '01022'])
})

test('08079 血债血偿：同一次敌袭分给盟友时不可打出，给自己时真实支付并按伤害抽牌', () => {
  for (const assignToAlly of [true, false]) {
    const state = fixture()
    const ally = asset(state, '01018')
    owner(state).hand = ['08079']
    enemy(state, { damage: 1, horror: 0, exhausted: false })
    move(state, { action: 'resource' })
    let offered = false
    settle(state, choice => {
      if (assignToAlly && choice.kind === 'assign-damage' && choose(choice, ally.id)) return ally.id
      const event = cardChoice(choice, '08079') ?? choice.options.find(option => option.id.includes('08079'))?.id
      if (event) { offered = true; return event }
      return null
    })
    assert.equal(offered, !assignToAlly)
    assert.equal(owner(state).hand.includes('08079'), assignToAlly)
    assert.equal(owner(state).deck.length, assignToAlly ? 30 : 29)
    assert.equal(source(state, ally.id)?.damage || 0, assignToAlly ? 1 : 0)
  }
})

for (const [code, clues] of [['08084', 0], ['08085', 2]]) {
  test(code + ' 追踪：可以选其他地点的精英敌人，完成印刷的移动与线索结算', () => {
    const state = fixture()
    const middle = link(state, owner(state).location, 'trackingMiddle')
    const end = link(state, middle, 'trackingTarget')
    enemy(state, { elite: true, location: end, engagedSeat: null, exhausted: true })
    play(state, code)
    settle(state, choice => choose(choice, 'move'))
    assert.equal(owner(state).location, end)
    assert.equal(owner(state).clues, clues)
  })
}

test('08087 狙击：打出不引发借机攻击，只将下一次使用枪械攻击的自动失败视为 0', () => {
  const state = fixture()
  const foe = enemy(state, { damage: 1, horror: 0, fight: 1, health: 20, exhausted: false })
  const gun = asset(state, '01016', { uses: 3 })
  state.chaosBag = ['autofail']
  play(state, '08087')
  settle(state)
  assert.equal(owner(state).damage || 0, 0)

  move(state, { action: 'fight', enemyId: foe.id })
  settle(state)
  assert.equal(state.lastTestResult.success, false)
  assert.equal(state.lastTestResult.autoFail, true)

  move(state, ability(state, gun.id, 0))
  settle(state)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.lastTestResult.autoFail, false)

  move(state, ability(state, gun.id, 0))
  settle(state)
  assert.equal(state.lastTestResult.success, false)
  assert.equal(state.lastTestResult.autoFail, true)
})

test('08088 老旧的霰弹枪：正常入场没有弹药，事件入场有 2 发，其他事件不会给已入场的枪补弹', () => {
  const direct = fixture()
  play(direct, '08088')
  settle(direct)
  assert.equal(owner(direct).assets.find(card => card.code === '08088').uses, 0)
  play(direct, '01088')
  settle(direct)
  assert.equal(owner(direct).assets.find(card => card.code === '08088').uses, 0)

  const viaEvent = fixture()
  owner(viaEvent).hand.push('08088')
  play(viaEvent, '03029')
  settle(viaEvent, choice => cardChoice(choice, '08088'))
  assert.equal(owner(viaEvent).assets.find(card => card.code === '08088').uses, 2)
})
