import test from 'node:test'
import assert from 'node:assert/strict'
import { registerCardAbilities } from '../src/engine/ability.js'
import { getStat } from '../src/engine/engine.js'
import { asset, enemy, fixture, legalMoves, move, settle } from './core-fixture.mjs'

const investigator = (state, seat = 0) => state.investigators[seat]
const here = state => state.locations.find(location => location.id === investigator(state).location)

function playEvent(state, code) {
  const command = legalMoves(state).find(candidate => candidate.action === 'play' && candidate.cardId === code)
  assert.ok(command, `Missing play move for ${code}`)
  move(state, command)
}

test('11086 的额外费用检查手部道具，并区分手牌与场上支援', () => {
  for (const zone of ['hand', 'play']) {
    const state = fixture('01005')
    const target = enemy(state)
    investigator(state).hand = ['11086', '01075']
    assert.equal(legalMoves(state).some(candidate => candidate.cardId === '11086'), false)
    if (zone === 'hand') investigator(state).hand.push('01016')
    else asset(state, '01016')
    playEvent(state, '11086')
    settle(state, choice => choice.options.find(option => option.cardCode === '01016')?.id)
    assert.equal(state.lastTestResult.success, true)
    assert.equal(state.lastTestResult.value - state.lastTestResult.baseValue, 4)
    assert.deepEqual(investigator(state).discard.sort(), ['01016', '11086'])
    assert.ok(investigator(state).hand.includes('01075'))
    assert.equal(state.enemies.find(card => card.id === target.id).preventReady?.rounds ?? 0, zone === 'play' ? 1 : 0)
  }
})

test('11087 正常调查，从场上弃置的费用让成功调查一次发现两个线索', () => {
  const state = fixture('01005')
  const location = here(state)
  location.clues = 4
  location.shroud = 1
  investigator(state).hand.push('11087')
  asset(state, '01016')
  playEvent(state, '11087')
  settle(state, choice => choice.options.find(option => option.cardCode === '01016')?.id)
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.lastTestResult.value - state.lastTestResult.baseValue, 4)
  assert.equal(investigator(state).clues, 2)
  assert.equal(here(state).clues, 2)
})

test('11088 允许连接地点的单张牌投入，额外线索交给检定者', () => {
  const state = fixture('01005', 2)
  const location = here(state)
  location.shroud = 1
  location.clues = 4
  location.connections = [...location.connections, 'survivor-commit-neighbor']
  state.locations.push({
    ...location, id: 'survivor-commit-neighbor', name: '相邻测试地点',
    connections: [location.id], clues: 0,
  })
  investigator(state, 1).location = 'survivor-commit-neighbor'
  investigator(state, 1).hand = ['11088', '01090']
  const command = legalMoves(state).find(candidate => candidate.action === 'investigate')
  assert.ok(command)
  move(state, command)
  let offered = false
  settle(state, choice => {
    if (choice.kind !== 'commit' || choice.seat !== 1) return null
    const card = choice.options.find(option => option.id === '0')
    assert.ok(card)
    assert.ok(!choice.options.some(option => option.id === '1'))
    offered = true
    return card.id
  })
  assert.ok(offered)
  assert.deepEqual(investigator(state, 1).discard, ['11088'])
  assert.deepEqual(investigator(state, 1).hand, ['01090'])
  assert.equal(investigator(state).clues, 2)
  assert.equal(investigator(state, 1).clues, 0)
})

test('11094 从弃牌堆投入所选技能，付出手牌并把投入牌放到牌库底', () => {
  const state = fixture('01005')
  const inv = investigator(state)
  inv.hand = ['01088']
  inv.discard = ['01081']
  const nodens = asset(state, '11094')
  enemy(state)
  const command = legalMoves(state).find(candidate => candidate.action === 'evade')
  assert.ok(command)
  move(state, command)
  let selected = false
  settle(state, choice => {
    const reaction = choice.kind === 'reaction' && choice.options.find(option => option.cardCode === nodens.code)
    if (reaction) { selected = true; return reaction.id }
    return choice.options.find(option => option.cardCode === '01088')?.id
  })
  assert.ok(selected, 'missing Gift of Nodens commit reaction')
  assert.deepEqual(investigator(state).hand, [])
  assert.deepEqual(investigator(state).discard, ['01088'])
  assert.equal(investigator(state).deck[0], '01081')
  assert.equal(state.lastTestResult.value - state.lastTestResult.baseValue, 1)
})

test('11104 提高谈判检定值，成功后才可横置获得资源', () => {
  for (const face of ['0', 'autofail']) {
    const state = fixture('01005')
    state.chaosBag = [face]
    const before = investigator(state).resources
    const walter = asset(state, '11104')
    const file = asset(state, '10064')
    const target = enemy(state, { health: 2 })
    const command = legalMoves(state).find(candidate => candidate.assetId === file.id && candidate.targetId === target.id)
    assert.ok(command, 'missing Blackmail File parley move')
    move(state, command)
    let offered = false
    settle(state, choice => {
      const option = choice.options.find(candidate => candidate.cardCode === walter.code)
      if (option) { offered = true; return option.id }
      return null
    })
    const success = face === '0'
    assert.equal(state.lastTestResult.success, success)
    assert.equal(offered, success)
    assert.equal(investigator(state).assets.find(card => card.id === walter.id).exhausted, success)
    assert.equal(investigator(state).resources, before + Number(success))
    if (success) assert.equal(state.lastTestResult.value - state.lastTestResult.baseValue, 1)
  }
})

test('11114 通过空手部槽位加值，并只将用此攻击击败的非精英和事件附属放入胜利区', () => {
  for (const elite of [false, true]) {
    const state = fixture('01005')
    const target = enemy(state, { health: 2, elite })
    state.encounterDiscard = [target.code]
    investigator(state).hand = ['11114']
    asset(state, '01016')
    playEvent(state, '11114')
    settle(state, choice => choice.options.some(option => option.id === 'willpower') ? 'willpower' : null)
    assert.equal(state.lastTestResult.skill, 'willpower')
    assert.equal(state.lastTestResult.value - state.lastTestResult.baseValue, 2)
    assert.ok(!state.enemies.some(card => card.id === target.id))
    const defeated = state.victoryDisplay.find(card => card.id === target.id)
    if (elite) {
      assert.equal(defeated, undefined)
      assert.deepEqual(investigator(state).discard, ['11114'])
      assert.deepEqual(state.encounterDiscard, [target.code, target.code])
    } else {
      assert.equal(defeated?.attachments?.length, 1)
      assert.equal(defeated.attachments[0].code, '11114')
      assert.deepEqual(investigator(state).discard, [])
      assert.deepEqual(state.encounterDiscard, [target.code])
    }
  }
})

test('11108 连续三种行动后奖励未用类型的额外行动，不扣普通行动', () => {
  const state = fixture('01005')
  const initialActions = investigator(state).actionsLeft
  const talent = asset(state, '11108')
  enemy(state)
  for (const action of ['resource', 'draw', 'fight']) {
    const command = legalMoves(state).find(candidate => candidate.action === action)
    assert.ok(command)
    move(state, command)
    if (action !== 'fight') settle(state)
  }
  let offered = false
  let granted = false
  settle(state, choice => {
    const reaction = choice.kind === 'reaction' && choice.options.find(option => option.cardCode === talent.code)
    if (reaction) { offered = true; return reaction.id }
    if (choice.kind !== 'action') return null
    assert.ok(!choice.options.some(option => /^(?:💰|🀄|⚔️)/u.test(option.label)))
    const investigate = choice.options.find(option => /调查/.test(option.label))
    assert.ok(investigate)
    granted = true
    return investigate.id
  })
  assert.ok(offered && granted)
  assert.equal(investigator(state).actionsLeft, initialActions - 3)
  assert.equal(investigator(state).assets.find(card => card.id === talent.id).exhausted, true)
})

test('11111 的工具检定失败补回刚刚花费的补给', () => {
  const state = fixture('01005')
  state.chaosBag = ['autofail']
  const talent = asset(state, '11111')
  const tool = asset(state, '01087')
  const command = legalMoves(state).find(candidate => candidate.assetId === tool.id)
  assert.ok(command)
  move(state, command)
  let offered = false
  settle(state, choice => {
    const ability = choice.options.find(option => option.assetId === talent.id)
    if (ability) { offered = true; return ability.id }
    return choice.options.some(option => option.id === 'replenish') ? 'replenish' : null
  })
  assert.ok(offered)
  assert.equal(state.lastTestResult.success, false)
  assert.equal(investigator(state).assets.find(card => card.id === tool.id).uses, 3)
})

test('11113 统计护甲入场前的趁乱攻击，并取消下一轮的首次攻击', () => {
  const state = fixture('01005')
  const inv = investigator(state)
  inv.deck.unshift('11113')
  enemy(state, { damage: 1 })
  move(state, { action: 'resource' })
  settle(state)
  assert.equal(investigator(state).damage, 1)
  const armor = asset(state, '11113')
  move(state, { action: 'resource' })
  settle(state)
  assert.equal(investigator(state).damage + (investigator(state).assets.find(card => card.id === armor.id).damage || 0), 2)
  state.round += 1
  move(state, { action: 'resource' })
  settle(state)
  assert.equal(investigator(state).damage + (investigator(state).assets.find(card => card.id === armor.id).damage || 0), 2)
})

test('11118 满手部槽位可附属书籍，回合末将它放到牌库底', () => {
  const state = fixture('01005', 2)
  const host = asset(state, '11118')
  investigator(state).hand = ['01031']
  asset(state, '01016')
  asset(state, '01086')
  const attach = legalMoves(state).find(candidate => candidate.assetId === host.id)
  assert.ok(attach)
  move(state, attach)
  settle(state)
  assert.ok(investigator(state).assets.some(card => card.code === '01031' && card.attachedToAsset === host.id))
  assert.equal(investigator(state).assets.length, 4)
  move(state, { action: 'endTurn' })
  settle(state, choice => choice.options.some(option => option.id === 'bottom') ? 'bottom' : null)
  assert.equal(investigator(state).deck[0], '01031')
  assert.equal(investigator(state).assets.length, 3)
  assert.deepEqual(investigator(state).assets.find(card => card.id === host.id).attachments, [])
})

test('11117 能用另一件受控支援的秘密支付洞察事件，不能支付非洞察牌', () => {
  const state = fixture('01003')
  const inv = investigator(state)
  here(state).clues = 2
  inv.resources = 0
  inv.hand = ['01037', '01016']
  const archibald = asset(state, '11117')
  const tome = asset(state, '05116')
  assert.equal(legalMoves(state).some(candidate => candidate.cardId === '01016'), false)
  playEvent(state, '01037')
  let spent = false
  settle(state, choice => {
    if (choice.source !== tome.id) return null
    const payment = choice.options.find(option => option.id === '2')
    assert.ok(payment)
    spent = true
    return payment.id
  })
  assert.ok(spent)
  assert.equal(investigator(state).assets.find(card => card.id === tome.id).uses, 1)
  assert.equal(investigator(state).assets.find(card => card.id === archibald.id).uses, 4)
  assert.equal(investigator(state).resources, 0)
  assert.equal(investigator(state).clues, 1)
})

test('11116 让同地点队友免费打出盟友，换槽后还能忽略弃置费用触发能力', () => {
  const state = fixture('01005', 2)
  const other = investigator(state, 1)
  other.location = investigator(state).location
  other.resources = 0
  other.hand = ['01018']
  const existingAlly = asset(state, '01033', {}, 1)
  const target = enemy(state)
  investigator(state).hand = ['11116']
  playEvent(state, '11116')
  let replaced = false
  let activated = false
  settle(state, choice => {
    if (choice.kind === 'investigator') return '1'
    if (choice.kind === 'assetReplacement' && choice.options.some(option => option.id === existingAlly.id)) {
      replaced = true
      return existingAlly.id
    }
    if (choice.kind === 'card' && choice.options.some(option => option.id === '01018')) return '01018'
    if (choice.kind === 'ability') {
      activated = true
      return '0'
    }
    return null
  })
  const ally = investigator(state, 1).assets.find(card => card.code === '01018')
  assert.ok(ally && replaced && activated)
  assert.deepEqual(investigator(state, 1).discard, ['01033'])
  assert.equal(investigator(state, 1).resources, 0)
  assert.equal(state.enemies.find(card => card.id === target.id).damageTaken, 1)
})

test('11111 登记失败补偿后，即使自身先离场也仍结算', () => {
  const probe = 'tdc-player-11111-leave-probe'
  registerCardAbilities({
    code: probe,
    abilities: [{
      kind: 'forced', trigger: 'beforeChaosTokenReveal',
      label: '弃掉已经横置的埋头苦干',
      criteria: ({ inv }) => inv.assets.some(card => card.code === '11111' && card.exhausted),
      resolve: ({ inv, api }) => {
        const talent = inv.assets.find(card => card.code === '11111' && card.exhausted)
        api.discardAsset(inv.seat, talent)
      },
    }],
  })
  const state = fixture('01005')
  state.chaosBag = ['autofail']
  const talent = asset(state, '11111')
  const tool = asset(state, '01087')
  asset(state, probe)
  const command = legalMoves(state).find(candidate => candidate.assetId === tool.id)
  assert.ok(command)
  move(state, command)
  let offered = false
  settle(state, choice => {
    const ability = choice.options.find(option => option.assetId === talent.id)
    if (ability) return ability.id
    if (choice.options.some(option => option.id === 'replenish')) {
      assert.ok(!investigator(state).assets.some(card => card.id === talent.id))
      offered = true
      return 'replenish'
    }
    return null
  })
  assert.ok(offered)
  assert.equal(state.lastTestResult.success, false)
  assert.ok(investigator(state).discard.includes('11111'))
  assert.equal(investigator(state).assets.find(card => card.id === tool.id).uses, 3)
})

function connectLocation(state, id) {
  const start = here(state)
  start.connections = [...start.connections, id]
  state.locations.push({ ...start, id, name: '相邻测试地点', connections: [start.id], clues: 0 })
  return id
}

test('11102 横置并弃手牌，免费移动到连接地点', () => {
  const state = fixture('01005')
  const inv = investigator(state)
  const destination = connectLocation(state, 'tdc-horizon')
  const talent = asset(state, '11102')
  const before = inv.actionsLeft
  inv.hand = ['01088']
  const action = legalMoves(state).find(candidate => candidate.assetId === talent.id && candidate.targetId === destination)
  assert.ok(action)
  move(state, action)
  settle(state)
  assert.equal(investigator(state).location, destination)
  assert.equal(investigator(state).actionsLeft, before)
  assert.deepEqual(investigator(state).discard, ['01088'])
  assert.equal(investigator(state).assets.find(card => card.id === talent.id).exhausted, true)
})

test('11103 法术事件检定的技能加值与自选额外揭示都生效', () => {
  const state = fixture('01005')
  state.chaosBag = ['0', '0', '0']
  investigator(state).hand = ['01066']
  const sutra = asset(state, '11103')
  enemy(state)
  playEvent(state, '01066')
  let revealed = false
  settle(state, choice => {
    const ability = choice.options.find(option => option.assetId === sutra.id)
    if (ability) return ability.id
    if (choice.kind === 'amount' && choice.source === '11103') return '2'
    if (choice.kind !== 'token' || choice.source !== '11103') return null
    assert.equal(choice.options.length, 3)
    revealed = true
    return choice.options[0].id
  })
  assert.ok(revealed)
  assert.equal(investigator(state).horror, 2)
  assert.equal(state.lastTestResult.value - state.lastTestResult.baseValue, 1)
  assert.deepEqual(state.lastTestResult.drawn, ['0'])
})

test('11105 对非精英与精英谈判分别造成 10 与 5 伤害，并将事件移出游戏', () => {
  for (const elite of [false, true]) {
    const state = fixture('01005')
    const target = enemy(state, { elite, damage: 3 })
    investigator(state).hand = ['11105']
    playEvent(state, '11105')
    settle(state)
    assert.equal(state.enemies.find(card => card.id === target.id).damageTaken, elite ? 5 : 10)
    assert.equal(investigator(state).damage, 0)
    assert.equal(investigator(state).resources, 10)
    assert.ok(state.removedFromGame.includes('11105'))
    assert.ok(!investigator(state).discard.includes('11105'))
  }
})

test('11106 按选择顺序结算两种不同效果，并在第二次选择隐藏已用效果', () => {
  const state = fixture('01005')
  const inv = investigator(state)
  inv.hand = ['11106']
  inv.damage = 1
  inv.horror = 1
  const choices = []
  playEvent(state, '11106')
  settle(state, choice => {
    if (choice.source !== '11106') return null
    if (!choices.length) {
      choices.push('draw')
      return 'draw'
    }
    assert.ok(!choice.options.some(option => option.id === 'draw'))
    choices.push('damage')
    return 'damage'
  })
  assert.deepEqual(choices, ['draw', 'damage'])
  assert.equal(investigator(state).hand.length, 2)
  assert.equal(investigator(state).damage, 0)
  assert.equal(investigator(state).horror, 1)
})

test('11110 横置盟友移动并交战，在生物所在地点获得两项技能值', () => {
  const state = fixture('01005')
  const inv = investigator(state)
  const destination = connectLocation(state, 'tdc-dakota')
  const target = enemy(state, { location: destination, traits: ['Creature'], engagedSeat: null })
  const dakota = asset(state, '11110')
  const skills = ['willpower', 'combat']
  const oldValues = skills.map(skill => getStat(state, inv, skill))
  const action = legalMoves(state).find(candidate => candidate.assetId === dakota.id)
  assert.ok(action)
  move(state, action)
  settle(state)
  assert.equal(investigator(state).location, destination)
  assert.equal(state.enemies.find(card => card.id === target.id).engagedSeat, 0)
  assert.deepEqual(skills.map(skill => getStat(state, investigator(state), skill)), oldValues.map(value => value + 1))
})

test('11112 可以承受同地点队友的伤害和恐惧，并于持有者回合开始治疗其一', () => {
  const state = fixture('01005', 2)
  investigator(state, 1).location = investigator(state).location
  const support = asset(state, '11112', {}, 1)
  enemy(state, { damage: 1, horror: 1 })
  const findSupport = () => investigator(state, 1).assets.find(card => card.id === support.id)
  move(state, { action: 'resource' })
  settle(state, choice => choice.kind.startsWith('assign-') ? support.id : null)
  assert.equal(findSupport().damage, 1)
  assert.equal(findSupport().horror, 1)
  assert.equal(investigator(state).damage + investigator(state).horror, 0)
  move(state, { action: 'endTurn' })
  settle(state, choice => {
    if (choice.kind === 'reaction') return choice.options.find(option => option.cardCode === support.code)?.id
    return choice.options.some(option => option.id === 'horror') ? 'horror' : null
  })
  assert.equal(findSupport().damage, 1)
  assert.equal(findSupport().horror, 0)
})

test('11081 从手牌付费躲避，成功可额外弃牌阻止敌人补给重整', () => {
  const state = fixture('01005')
  const inv = investigator(state)
  const target = enemy(state)
  const actions = inv.actionsLeft
  inv.hand = ['11081', '01088']
  const action = legalMoves(state).find(candidate => candidate.uiKey === 'hand:0:0' && candidate.targetId === target.id)
  assert.ok(action)
  move(state, action)
  settle(state, choice => choice.source === '11081'
    ? choice.options.find(option => option.cardCode === '01088')?.id : null)
  assert.ok(state.lastTestResult.success)
  assert.equal(state.lastTestResult.value - state.lastTestResult.baseValue, 1)
  assert.deepEqual(investigator(state).discard, ['11081', '01088'])
  assert.equal(investigator(state).actionsLeft, actions - 1)
  assert.equal(state.enemies.find(card => card.id === target.id).preventReady?.rounds, 1)
})

test('11084 在场时横置而不离场，弃 1 张手牌使本次调查多发现一个线索', () => {
  const state = fixture('01005')
  here(state).clues = 4
  here(state).shroud = 1
  const charts = asset(state, '11084')
  investigator(state).hand = ['01088']
  const action = legalMoves(state).find(candidate => candidate.assetId === charts.id)
  assert.ok(action)
  move(state, action)
  settle(state, choice => choice.source === '11084'
    ? choice.options.find(option => option.cardCode === '01088')?.id : null)
  assert.equal(investigator(state).assets.find(card => card.id === charts.id).exhausted, true)
  assert.deepEqual(investigator(state).discard, ['01088'])
  assert.equal(investigator(state).clues, 2)
  assert.equal(here(state).clues, 2)
})

test('11089 弃手牌后横置增加一个补给，弃掉自身将补给转为资源', () => {
  const state = fixture('01005')
  const inv = investigator(state)
  const supplies = asset(state, '11089')
  const resources = inv.resources
  const target = enemy(state)
  inv.hand = ['11082']
  const fight = legalMoves(state).find(candidate => candidate.uiKey === 'hand:0:0' && candidate.targetId === target.id)
  assert.ok(fight)
  move(state, fight)
  settle(state, choice => choice.kind === 'reaction'
    ? choice.options.find(option => option.cardCode === supplies.code)?.id : null)
  const findSupplies = () => investigator(state).assets.find(card => card.id === supplies.id)
  assert.equal(findSupplies().uses, 3)
  assert.equal(findSupplies().exhausted, true)
  const cash = legalMoves(state).find(candidate => candidate.assetId === supplies.id)
  assert.ok(cash)
  move(state, cash)
  settle(state)
  assert.equal(investigator(state).resources, resources + 3)
  assert.equal(findSupplies(), undefined)
  assert.ok(investigator(state).discard.includes('11089'))
})

test('11090 只能从弃牌堆打出并收回包括不同等级在内的所有同名牌', () => {
  const state = fixture('01005')
  const inv = investigator(state)
  inv.hand = ['11090']
  inv.discard = ['11090', '06245', '11090', '01088']
  const actions = legalMoves(state).filter(candidate => candidate.cardId === '11090')
  assert.ok(actions.length && actions.every(candidate => candidate.fromDiscard))
  move(state, actions[0])
  settle(state)
  assert.deepEqual(investigator(state).hand.sort(), ['06245', '11090', '11090', '11090'])
  assert.deepEqual(investigator(state).discard, ['01088'])
})

test('11092 从弃牌堆攻击后先洗回再抽牌，空牌库时抽到自身', () => {
  const state = fixture('01005')
  const inv = investigator(state)
  const target = enemy(state, { fight: 2 })
  inv.deck = []
  inv.discard = ['11092']
  const attack = legalMoves(state).find(candidate => candidate.cardId === '11092' && candidate.fromDiscard)
  assert.ok(attack)
  move(state, attack)
  settle(state)
  assert.equal(state.lastTestResult.difficulty, 0)
  assert.equal(state.enemies.find(card => card.id === target.id).damageTaken, 2)
  assert.deepEqual(investigator(state).hand, ['11092'])
  assert.deepEqual(investigator(state).deck, [])
  assert.deepEqual(investigator(state).discard, [])
})

test('11093 独立投入，每张剩余手牌减一个百搭，成功抽两张', () => {
  const state = fixture('01005')
  investigator(state).hand = ['11093', '01091']
  const target = enemy(state)
  move(state, { action: 'fight', enemyId: target.id })
  let invested = false
  settle(state, choice => {
    if (choice.kind !== 'commit') return null
    if (!invested) {
      invested = true
      return '0'
    }
    assert.deepEqual(choice.options.map(option => option.id), ['done'])
    return 'done'
  })
  assert.ok(invested)
  assert.equal(state.lastTestResult.value - state.lastTestResult.baseValue, 5)
  assert.equal(investigator(state).hand.length, 3)
  assert.deepEqual(investigator(state).discard, ['11093'])
})

test('11083 增加智识，并在自己的回合弃手牌后横置获得资源', () => {
  const state = fixture('01005')
  const inv = investigator(state)
  const base = getStat(state, inv, 'intellect')
  const lawrence = asset(state, '11083')
  assert.equal(getStat(state, inv, 'intellect'), base + 1)
  const resources = inv.resources
  const target = enemy(state)
  inv.hand = ['11082']
  const use = legalMoves(state).find(option => option.uiKey === 'hand:0:0' && option.targetId === target.id)
  assert.ok(use)
  move(state, use)
  settle(state, choice => choice.kind === 'reaction'
    ? choice.options.find(option => option.cardCode === lawrence.code)?.id : null)
  assert.equal(investigator(state).resources, resources + 1)
  assert.equal(investigator(state).assets.find(card => card.id === lawrence.id).exhausted, true)
})

test('11085 只能从弃牌堆打出，被击败后单张洗回牌库', () => {
  const state = fixture('01005')
  const inv = investigator(state)
  inv.hand = ['11085']
  assert.ok(!legalMoves(state).some(candidate => candidate.cardId === '11085'))
  inv.hand = []
  inv.discard = ['11085']
  const place = legalMoves(state).find(candidate => candidate.cardId === '11085' && candidate.fromDiscard)
  assert.ok(place)
  move(state, place)
  settle(state)
  const idol = investigator(state).assets.find(card => card.code === '11085')
  assert.ok(idol)
  enemy(state, { horror: 3 })
  move(state, { action: 'resource' })
  settle(state, choice => choice.kind === 'assign-horror' ? idol.id : null)
  assert.equal(investigator(state).horror, 0)
  assert.ok(!investigator(state).assets.some(card => card.id === idol.id))
  assert.ok(!investigator(state).discard.includes('11085'))
  assert.equal(investigator(state).deck.filter(card => card === '11085').length, 1)
})

test('11091 在阶段开始时快速打出，团队共享一种技能加值且下次阶段开始弃掉', () => {
  const state = fixture('01005', 2)
  state.encounterDeck = []
  state.encounterDiscard = []
  for (const inv of state.investigators) inv.hand = ['11091']
  const bases = state.investigators.map(inv => getStat(state, inv, 'intellect'))
  const endBoth = select => {
    for (let i = 0; i < 2; i++) {
      move(state, { action: 'endTurn' })
      settle(state, select)
    }
  }
  let offers = 0
  endBoth(choice => {
    if (choice.kind === 'skill' && choice.source === '11091') return 'intellect'
    if (choice.source?.when !== 'phaseBegins') return null
    const card = choice.options.find(option => option.cardCode === '11091' || option.label.includes('好天气'))
    if (!card) return null
    offers += 1
    return card.id
  })
  assert.equal(offers, 1)
  const weather = state.agendaAside?.find(card => card.code === '11091')
  assert.equal(weather?.selectedSkill, 'intellect')
  assert.deepEqual(state.investigators.map(inv => getStat(state, inv, 'intellect')), bases.map(base => base + 2))
  assert.ok(!investigator(state, weather.ownerSeat).discard.includes('11091'))
  let replacementOffered = false
  endBoth(choice => {
    if (choice.source?.when !== 'phaseBegins') return null
    replacementOffered ||= choice.options.some(option => option.cardCode === '11091' || option.label.includes('好天气'))
    return null
  })
  assert.ok(replacementOffered)
  assert.ok(!state.agendaAside.some(card => card.code === '11091'))
  assert.ok(investigator(state, weather.ownerSeat).discard.includes('11091'))
  assert.deepEqual(state.investigators.map(inv => getStat(state, inv, 'intellect')), bases)
})

test('11107 每次仅投入一张，并按花费的资源每枚增加两枚百搭', () => {
  const state = fixture('01005')
  investigator(state).hand = ['11107', '11107']
  investigator(state).resources = 2
  const target = enemy(state)
  move(state, { action: 'fight', enemyId: target.id })
  let selected = false
  settle(state, choice => {
    if (choice.source === '11107') {
      assert.deepEqual(choice.options.map(option => option.id), ['0', '1', '2'])
      return '2'
    }
    if (choice.kind !== 'commit') return null
    if (!selected) { selected = true; return '0' }
    assert.deepEqual(choice.options.map(option => option.id), ['done'])
    return 'done'
  })
  assert.equal(state.lastTestResult.value - state.lastTestResult.baseValue, 5)
  assert.equal(investigator(state).resources, 0)
  assert.deepEqual(investigator(state).hand, ['11107'])
  assert.deepEqual(investigator(state).discard, ['11107'])
})

test('11115 将意志加入攻击值，只在揭示符号时可横置伤害另一目标', () => {
  for (const face of ['skull', '0']) {
    const state = fixture('01005')
    state.chaosBag = [face]
    const sword = asset(state, '11115')
    const target = enemy(state)
    const second = enemy(state, { engagedSeat: null })
    const command = legalMoves(state).find(option => option.assetId === sword.id && option.targetId === target.id)
    assert.ok(command)
    move(state, command)
    let offered = false
    settle(state, choice => {
      if (choice.source !== '11115' || choice.kind !== 'enemy') return null
      offered = true
      return second.id
    })
    assert.equal(state.lastTestResult.success, true)
    if (face === '0') assert.equal(state.lastTestResult.value - state.lastTestResult.baseValue, getStat(state, investigator(state), 'willpower'))
    assert.equal(state.enemies.find(card => card.id === target.id).damageTaken, 1)
    assert.equal(state.enemies.find(card => card.id === second.id).damageTaken, face === 'skull' ? 1 : 0)
    assert.equal(investigator(state).assets.find(card => card.id === sword.id).exhausted, face === 'skull')
    assert.equal(offered, face === 'skull')
  }
})
