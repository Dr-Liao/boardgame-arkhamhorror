import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { buildDeck, buildDeckFromList, drawBasicWeaknesses, expandedPlayablePool, matchesDeckOptions } from '../src/deck/deckbuilding.js'
import { canSelectInvestigator, getAvailability } from '../src/deck/availability.js'
import { applyStartingDeckExperience, awardExperience, campaignDeckLocked, availablePurchases, campaignCardChange, finishUpgradeDraft, purchaseCard, replacementOptions, stagePurchase } from '../src/campaign/campaign.js'
import { createGameState, drawCards, drawEncounter, performTest, phaseBeginningWindow } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { adoptInvestigatorIdentity } from '../src/engine/investigator-form.js'
import { registeredEntry } from '../src/engine/ability.js'
import { asset, enemy, fixture, legalMoves, move, play, settle, use, validateMove } from './core-fixture.mjs'

const investigator = state => state.investigators[0]
const record = state => state.campaign.investigators[0]
const defeat = state => {
  move(state, { action: 'debug', kind: 'harm', targetSeat: 0, damage: investigator(state).health })
  settle(state)
}

function resolve(state, execute, choose = () => null) {
  resolveTransaction(state, 0, { action: 'tdcPlayerFixture' }, execute)
  for (let step = 0; state.pendingChoice; step++) {
    const pending = state.pendingChoice
    assert.ok(step < 80, pending.prompt)
    const optionId = choose(pending) ?? pending.options.find(option => ['skip', 'done', 'self'].includes(option.id))?.id
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

test('11021 通过战斗属性调查，重整后另一能力以战斗加值攻击', () => {
  const state = fixture('01001')
  const dowsing = asset(state, '11021')
  use(state, dowsing)
  settle(state)
  assert.equal(state.lastTestResult.skill, 'combat')
  const source = investigator(state).assets.find(card => card.id === dowsing.id)
  assert.equal(source.exhausted, true)
  source.exhausted = false
  const target = enemy(state)
  use(state, dowsing, { abilityIndex: 1, targetId: target.id })
  settle(state)
  assert.equal(state.lastTestResult.value, investigator(state).combat + 2)
  assert.equal(state.enemies.find(card => card.id === target.id).damageTaken, 1)
})

test('11024 若当轮已抽到敌人则抽两张牌，随后治疗恐惧', () => {
  for (const withEnemy of [false, true]) {
    const state = fixture('01001')
    const inv = investigator(state)
    inv.hand = ['11024']
    inv.horror = 1
    if (withEnemy) {
      state.encounterDeck.push('ghoulMinion')
      resolve(state, draft => drawEncounter(draft, investigator(draft), []))
    }
    const command = legalMoves(state).find(item => item.action === 'play' && item.cardId === '11024')
    assert.ok(command)
    move(state, command)
    settle(state)
    assert.equal(investigator(state).hand.length, withEnemy ? 2 : 1)
    assert.equal(investigator(state).horror, 0)
  }
})

test('11029 成功投入可重整并治疗同地点队友的盟友', () => {
  const state = fixture('01001', 2)
  state.investigators[1].location = investigator(state).location
  const ally = asset(state, '01018', { exhausted: true, damage: 1, horror: 1 }, 1)
  investigator(state).hand = ['11029']
  resolve(state, draft => performTest(draft, 0, 'combat', 1), pending =>
    pending.kind === 'commit' && pending.options.some(option => option.id === '0') ? '0' : null)
  const ready = state.investigators[1].assets.find(card => card.id === ally.id)
  assert.equal(ready.exhausted, false)
  assert.equal(ready.damage + ready.horror, 0)
})

test('11095 手动构筑提供 10 点起始 XP，之后禁止获取 XP 和再购买', () => {
  const state = fixture('01001')
  const current = record(state)
  const withPermanent = buildDeckFromList(INVESTIGATORS['01001'],
    [...buildDeck(INVESTIGATORS['01001']).playerCards, '11095'], { playerPool: expandedPlayablePool() })
  assert.deepEqual(withPermanent.errors, [])
  current.deck = withPermanent.deck
  applyStartingDeckExperience(state.campaign, current, withPermanent)
  assert.equal(current.xp, 10)
  assert.equal(awardExperience(state.campaign, 0, 3), 0)
  assert.deepEqual(replacementOptions({ ...current, deck: current.deck.filter(code => code !== '11095') }, '11095'), [])
})

test('11100 在诡计检定成功后留在游戏区域，再移出游戏取消非险境诡计显现', () => {
  const state = fixture('01001')
  investigator(state).hand = ['11100']
  resolve(state, draft => performTest(draft, 0, 'willpower', 0, { source: { code: '01166', label: 'Ancient Evils' } }),
    pending => pending.kind === 'commit' && pending.options.some(option => option.id === '0') ? '0' : null)
  assert.ok(investigator(state).assets.some(card => card.code === '11100'))
  state.encounterDeck.push('ancientEvils')
  const doom = state.agendas[state.agendaIndex].doom
  resolve(state, draft => drawEncounter(draft, investigator(draft), []), pending =>
    pending.options.find(option => option.cardCode === '11100')?.id)
  assert.ok(state.removedFromGame.includes('11100'))
  assert.equal(state.agendas[state.agendaIndex].doom, doom)
})

test('11101 可调整成功差值并把新差值交给实际检定结果', () => {
  const state = fixture('01001')
  investigator(state).hand = ['11101']
  resolve(state, draft => performTest(draft, 0, 'combat', 1), pending => {
    if (pending.kind === 'commit' && pending.options.some(option => option.id === '0')) return '0'
    if (pending.source === '11101') return '2'
    return null
  })
  assert.equal(state.lastTestResult.success, true)
  assert.equal(state.lastTestResult.successBy, investigator(state).combat + ALL_CARDS['11101'].icons.wild + 2 - 1)
})

test('11120 进入有敌人的地点可支付线索标记并横置造成伤害', () => {
  const state = fixture('01001')
  const tracker = asset(state, '11120')
  const source = state.locations.find(place => place.id === investigator(state).location)
  state.locations.push({ id: 'tdc-destination', name: '测试目的地', revealed: true, inPlay: true, connections: [source.id] })
  source.connections = ['tdc-destination']
  const command = legalMoves(state).find(item => item.action === 'move')
  assert.ok(command)
  const location = command.locationId || command.to
  const target = enemy(state, { location, engagedSeat: null })
  move(state, command)
  settle(state, pending => pending.options.find(option => option.cardCode === '11120')?.id
    ?? (pending.source === '11120' ? target.id : null))
  const placed = investigator(state).assets.find(card => card.id === tracker.id)
  assert.equal(placed.uses, 4)
  assert.equal(placed.exhausted, true)
  assert.equal(state.enemies.find(card => card.id === target.id).damageTaken, 1)
})

test('11121 11122 11123 三种誓约共用一个秘法槽，按各自特质取消诡计', () => {
  const state = fixture('01004')
  for (const code of ['11121', '11122', '11123']) {
    play(state, code)
    settle(state)
  }
  assert.equal(investigator(state).assets.filter(card => /^1112[1-3]$/.test(card.code)).length, 3)
  investigator(state).hand = ['11121']
  assert.ok(validateMove(state, 0, { action: 'play', cardId: '11121' }))
  for (const [code, treachery] of [['11121', 'rottingRemains'], ['11122', 'mysteriousChanting'], ['11123', 'ancientEvils']]) {
    state.encounterDeck.push(treachery)
    resolve(state, draft => drawEncounter(draft, investigator(draft), []), pending =>
      pending.options.find(option => option.cardCode === code)?.id)
    assert.ok(investigator(state).discard.includes(code), code)
    assert.ok(state.encounterDiscard.includes(treachery))
  }
  assert.equal(investigator(state).horror, 0)
})

test('11124 调查阶段起始只将所选地点的非精英敌人放到一旁', () => {
  const state = fixture('01001')
  investigator(state).hand = ['11124', '11124']
  const common = enemy(state, { engagedSeat: null })
  const elite = enemy(state, { elite: true, engagedSeat: null })
  const choose = pending => pending.options.find(option => option.cardCode === '11124')?.id
  resolve(state, draft => phaseBeginningWindow(draft, []), choose)
  assert.ok(!state.enemies.some(card => card.id === common.id))
  assert.ok(state.enemies.some(card => card.id === elite.id))
  assert.equal(investigator(state).hand.filter(code => code === '11124').length, 1)
  enemy(state, { engagedSeat: null })
  resolve(state, draft => phaseBeginningWindow(draft, []), choose)
  assert.equal(investigator(state).hand.filter(code => code === '11124').length, 1)
})

test('11097 每多揭示一枚标记就增加一个投入图标，最多加三枚', () => {
  for (const [extra, expected] of [[0, 0], [2, 2], [4, 3]]) {
    const state = fixture('01001')
    state.chaosBag = Array(6).fill('0')
    investigator(state).hand.push('11097')
    resolve(state, draft => performTest(draft, 0, 'combat', 1, { extraChaosChoices: extra }), pending =>
      pending.kind === 'commit' && pending.options.some(option => option.id === '0') ? '0' : null)
    assert.equal(state.lastTestResult.value, investigator(state).combat + ALL_CARDS['11097'].icons.wild + expected)
    assert.equal(state.chaosBag.length, 6)
  }
})

test('11027 可加入手动牌组，11126–11129 只作为基础弱点候选', () => {
  const def = INVESTIGATORS['01001']
  const base = buildDeck(def, { seed: 'tdc-p6-manual' })
  const codes = [...base.playerCards]
  codes[0] = '11027'
  const built = buildDeckFromList(def, codes, { seed: 'tdc-p6-manual', playerPool: expandedPlayablePool(), xpBudget: 2 })
  assert.deepEqual(built.errors, [])
  assert.ok(built.playerCards.includes('11027'))
  assert.equal(getAvailability('11068b').deckbuilding, false)
  for (const code of ['11126', '11127', '11128', '11129']) {
    assert.equal(getAvailability(code).deckbuilding, false)
    assert.deepEqual(drawBasicWeaknesses(def, () => 0, [code]), [code])
  }
})

test('11098 购买时选择一种创伤，取消草稿可撤销，确认后同步战役创伤', () => {
  const state = fixture('01004')
  const campaign = state.campaign
  campaign.phase = 'interlude'
  const current = record(state)
  current.xp = 10
  current.trauma = { physical: 1, mental: 2 }
  campaign.trauma[0] = { ...current.trauma }
  const select = { choosePurchaseEffect: spec => {
    assert.deepEqual(spec.options.map(option => option.id), ['physical', 'mental'])
    return 'mental'
  } }
  stagePurchase(campaign, 0, '11098', null, select)
  assert.deepEqual(current.trauma, { physical: 1, mental: 2 })
  assert.deepEqual(current.upgradeDraft.record.trauma, { physical: 1, mental: 1 })
  finishUpgradeDraft(campaign, 0, false)
  assert.deepEqual(campaign.trauma[0], { physical: 1, mental: 2 })
  stagePurchase(campaign, 0, '11098', null, select)
  finishUpgradeDraft(campaign, 0, true)
  assert.deepEqual(campaign.trauma[0], { physical: 1, mental: 1 })
  assert.ok(record(state).deck.includes('11098'))
  assert.equal(record(state).xp, 6)
})

test('11080 支付特殊经验费用后记下法术名，拒绝再次购买同名法术', () => {
  const state = fixture('01004')
  const campaign = state.campaign
  campaign.phase = 'interlude'
  const current = record(state)
  current.xp = 15
  current.deck = ['01060', '01061', '01064']
  const title = ALL_CARDS['01060'].name
  const purchase = purchaseCard(campaign, 0, '11080', null, {
    choosePurchaseEffect: spec => {
      assert.ok(spec.options.some(option => option.id === title))
      return title
    },
  })
  assert.equal(purchase.cost, 10)
  assert.equal(current.brandedSpell, title)
  assert.deepEqual(replacementOptions(current, '01060', campaign.records), [])
})

test('11125 成功时免费打出收藏卡，技能移出游戏，战役牌组保持原状', () => {
  const state = fixture('11007')
  const inv = investigator(state)
  inv.hand = ['11125']
  const resources = inv.resources
  const deck = [...record(state).deck]
  const investigate = legalMoves(state).find(command => command.action === 'investigate')
  assert.ok(investigate)
  move(state, investigate)
  settle(state, choice => {
    if (choice.kind === 'commit') return choice.options.find(option => option.id === '0')?.id
    if (choice.kind === 'search' && choice.source === '11125') return '01016'
    return null
  })
  assert.ok(state.removedFromGame.includes('11125'))
  assert.ok(investigator(state).assets.some(card => card.code === '01016'))
  assert.equal(investigator(state).resources, resources)
  assert.deepEqual(record(state).deck, deck)
})

test('11068a 在败退后接管牌组，替换签名与专属弱点，保持本局败退', () => {
  const state = fixture('01001')
  const work = asset(state, '11068a')
  record(state).deck.push(work.code)
  const oldDeck = [...record(state).deck]
  const oldXp = record(state).earnedXp
  defeat(state)
  const current = record(state)
  assert.equal(investigator(state).code, '11068b')
  assert.equal(state.campaign.scenarioResults.at(-1).investigators[0].defeated, true)
  assert.equal(current.code, '11068b')
  assert.equal(current.status, 'active')
  assert.equal(current.trauma.physical, 1)
  assert.equal(current.earnedXp, oldXp + 3) // 《聚集》的 2 XP 加永久卡的 1 XP。
  assert.equal(state.campaign.retired.at(-1).code, '01001')
  assert.equal(state.campaign.retired.at(-1).status, 'killed')
  assert.equal(current.deck.length, oldDeck.length - 1)
  assert.ok(!current.deck.some(code => code === '11068a' || ALL_CARDS[code]?.signatureFor?.includes('01001')))
  const basicCount = deck => deck.filter(code => ALL_CARDS[code]?.subtype === 'basicweakness').length
  assert.equal(basicCount(current.deck), basicCount(oldDeck) + 2)
  assert.equal(state.campaign.retired.filter(item => item.code === '01001').length, 1)
  assert.equal(investigator(state).assets.some(card => card.id === work.id), false)
})

test('11068b 不能作为起始调查员，牌组锁定，再次败退时死亡', () => {
  assert.equal(canSelectInvestigator('11068b', 'strict'), false)
  assert.throws(() => buildDeck(INVESTIGATORS['11068b']), /调查员/)
  const lobby = createGameState({ campaignHub: true, seed: 'tdc-successor-lobby' }, [{ seat: 0, role: 'human' }])
  move(lobby, { action: 'hubGoSetup' })
  assert.ok(!legalMoves(lobby, 0).some(command => command.action === 'hubSelectInvestigator' && command.code === '11068b'))
  assert.ok(validateMove(lobby, 0, { action: 'hubSelectInvestigator', code: '11068b' }))
  const state = fixture('01001')
  const inv = adoptInvestigatorIdentity(state, investigator(state), '11068b')
  record(state).code = inv.code
  record(state).xp = 10
  assert.equal(campaignDeckLocked(record(state)), true)
  assert.deepEqual(availablePurchases(record(state)), [])
  const oldDeck = [...record(state).deck]
  campaignCardChange(state.campaign, inv.seat, '01088', 'add', 'test')
  assert.deepEqual(record(state).deck, oldDeck)
  defeat(state)
  assert.equal(record(state).status, 'killed')
})

test('11082 从手牌发动时只弃掉选择的副本，并且不支付印刷资源费用', () => {
  const state = fixture('01001')
  const inv = investigator(state)
  inv.hand = ['11082', '01088', '11082']
  const target = enemy(state)
  const action = legalMoves(state).find(candidate => candidate.uiKey === 'hand:0:2' && candidate.targetId === target.id)
  assert.ok(action)
  const startingResources = inv.resources
  const startingActions = inv.actionsLeft
  move(state, action)
  settle(state)
  assert.deepEqual(investigator(state).hand, ['11082', '01088'])
  assert.equal(investigator(state).discard.filter(code => code === '11082').length, 1)
  assert.equal(investigator(state).resources, startingResources)
  assert.equal(investigator(state).actionsLeft, startingActions - 1)
})

test('11126 未执行要求的行动时，恐惧与回洗各只结算一次', () => {
  const state = fixture('01001', 2)
  const inv = investigator(state)
  inv.deck.push('11126')
  drawCards(state, inv, 1, [])
  assert.ok(inv.threat.some(card => card.code === '11126'))
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(investigator(state).horror, 1)
  assert.ok(!investigator(state).threat.some(card => card.code === '11126'))
  assert.deepEqual(investigator(state).discard.filter(code => code === '11126'), [])
  assert.equal(investigator(state).deck.filter(code => code === '11126').length, 1)
})

test('11126 允许同地点调查员清除，四张基础弱点保留各自要求', () => {
  for (const code of ['11126', '11127', '11128', '11129']) {
    const entry = registeredEntry(code)
    assert.equal(entry.trackRoundActionHistory, true)
    assert.equal(entry.teamActivatable, true)
    assert.ok(entry.abilities.some(ability => ability.kind === 'forced' && ability.trigger.includes('turnEnded')))
  }
  const state = fixture('01001', 2)
  const inv = investigator(state)
  inv.deck.push('11126')
  drawCards(state, inv, 1, [])
  move(state, { action: 'resource' })
  settle(state)
  assert.ok(investigator(state).roundActionHistory.actions.includes('resource'))
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(investigator(state).horror, 0)
  assert.ok(investigator(state).threat.some(card => card.code === '11126'))
  const team = fixture('01001', 2)
  const teammate = team.investigators[1]
  teammate.location = investigator(team).location
  teammate.deck.push('11126')
  drawCards(team, teammate, 1, [])
  const threat = teammate.threat.find(card => card.code === '11126')
  const pay = legalMoves(team).find(candidate => candidate.assetId === threat.id && candidate.ownerSeat === 1)
  assert.ok(pay)
  move(team, pay)
  settle(team)
  assert.ok(!team.investigators[1].threat.some(card => card.code === '11126'))
})

for (const [code, action] of [['11127', 'investigate'], ['11128', 'evade'], ['11129', 'fight']]) {
  test(`${code} 识别本轮成功的 ${action} 检定并保留威胁区卡牌`, () => {
    const state = fixture('01001', 2)
    investigator(state).deck.push(code)
    drawCards(state, investigator(state), 1, [])
    if (action !== 'investigate') enemy(state)
    const command = legalMoves(state).find(candidate => candidate.action === action)
    assert.ok(command)
    move(state, command)
    settle(state)
    assert.ok(investigator(state).roundActionHistory.successes.includes(action))
    move(state, { action: 'endTurn' })
    settle(state)
    assert.equal(investigator(state).damage + investigator(state).horror, 0)
    assert.ok(investigator(state).threat.some(card => card.code === code))
  })
}

test('11119 按调查员印刷特性筛选，并以炮弹和横置约束攻击、装填', () => {
  assert.equal(matchesDeckOptions(INVESTIGATORS['01001'], ALL_CARDS['11119']), false)
  const hunter = { ...INVESTIGATORS['01001'], traits: ['Hunter'] }
  assert.equal(matchesDeckOptions(hunter, { ...ALL_CARDS['11119'], xp: 0, klass: 'guardian', factions: ['guardian'] }), true)
  const state = fixture('01001')
  const weapon = asset(state, '11119')
  const target = enemy(state)
  const fire = legalMoves(state).find(candidate => candidate.assetId === weapon.id && candidate.targetId === target.id)
  assert.ok(fire)
  move(state, fire)
  settle(state)
  const findWeapon = () => investigator(state).assets.find(card => card.id === weapon.id)
  assert.equal(findWeapon().uses, 0)
  assert.equal(state.enemies.find(card => card.id === target.id)?.damageTaken, 4)
  const reload = legalMoves(state).find(candidate => candidate.assetId === weapon.id && candidate.abilityIndex === 1)
  assert.ok(reload)
  move(state, reload)
  settle(state)
  assert.equal(findWeapon().uses, 1)
  assert.equal(findWeapon().exhausted, true)
  assert.ok(!legalMoves(state).some(candidate => candidate.assetId === weapon.id))
})
