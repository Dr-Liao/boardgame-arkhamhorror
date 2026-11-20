import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { canEquip, createGameState, drawCards, elderSignEffect, getHandSize } from '../src/engine/engine.js'
import { beneathCards, stashBeneath } from '../src/engine/commit-origins.js'
import { migrateState } from '../src/engine/save-migration.js'
import { viewState } from '../src/integration/observation.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { buildDeck, buildDeckFromList, deckBuilderData, matchesDeckOptions } from '../src/deck/deckbuilding.js'
import { getAvailability } from '../src/deck/availability.js'
import { TDC_DEPENDENCY_CODES, TDC_INVESTIGATOR_CODES } from '../content/packs/tdcInvestigators/manifest.js'
import { asset, enemy, fixture, legalMoves, move, play, settle } from './core-fixture.mjs'

const option = (choice, pattern) => choice.options.find(item => pattern.test(item.label))?.id
const location = state => state.locations.find(loc => loc.id === state.investigators[0].location)
const draw = (state, code) => {
  state.investigators[0].deck.push(code)
  drawCards(state, state.investigators[0], 1, [])
}

test('全部调查员及专属依赖经过选人、自动构筑及手动构筑', () => {
  const builder = deckBuilderData()
  for (const code of TDC_INVESTIGATOR_CODES) {
    const def = INVESTIGATORS[code]
    assert.ok(registeredEntry(code)?.elderSign)
    assert.equal(getAvailability(code).selectable, true)
    const auto = buildDeck(def, { seed: 'tdc-p5' })
    const manual = buildDeckFromList(def, auto.playerCards)
    assert.equal(auto.playerCards.length, def.deckRequirements.size)
    assert.deepEqual(manual.errors, [])
    assert.deepEqual(manual.signatureCards, auto.signatureCards)
    assert.deepEqual(manual.signatureWeaknesses, auto.signatureWeaknesses)
    const row = builder.investigators.find(item => item.code === code)
    assert.deepEqual(row.signatureCards.map(item => item.code), [...new Set(auto.signatureCards)])
    assert.deepEqual(row.signatureWeaknesses.map(item => item.code), [...new Set(auto.signatureWeaknesses)])
  }
  for (const code of TDC_DEPENDENCY_CODES) {
    assert.ok(registeredEntry(code)?.abilities.length, code)
    assert.equal(getAvailability(code).dependencyOnly, true)
    assert.ok(!builder.cardPool.some(card => card.code === code), code)
  }
  assert.equal(getAvailability('11501').availability, 'catalog-only')
})

test('玛利翁构筑选择单一特质，迈克尔接受枪械字样', () => {
  const card = (code, trait) => ({ code, name: code, klass: 'seeker', type: 'event', xp: 1, traits: [trait] })
  const cards = { gambit: card('gambit', 'Gambit'), fortune: card('fortune', 'Fortune') }
  assert.deepEqual(validateDeckRules(INVESTIGATORS['11001'], ['gambit'], cards, { partial: true }).errors, [])
  assert.ok(validateDeckRules(INVESTIGATORS['11001'], ['gambit', 'fortune'], cards, { partial: true }).errors.length)
  const event = { code: 'firearm-text', klass: 'guardian', type: 'event', xp: 3 }
  assert.equal(matchesDeckOptions(INVESTIGATORS['11011'], { ...event, text: 'Choose a [[Firearm]] asset.' }), true)
  assert.equal(matchesDeckOptions(INVESTIGATORS['11011'], { ...event, text: 'Firearm.' }), false)
})

test('玛利翁额外打出不同事件，弱点恐惧和三张事件费用', () => {
  const state = fixture('11001')
  const inv = state.investigators[0]
  assert.equal(canEquip(inv, ALL_CARDS['01074']), false)
  draw(state, '11003')
  inv.hand = ['01088', '01037']
  const actions = inv.actionsLeft
  move(state, { action: 'play', cardId: '01088' })
  let offered = false
  settle(state, c => {
    if (c.prompt.includes('选择要打出的事件')) {
      offered = true
      assert.ok(!c.options.some(item => item.cardCode === '01088'))
      return '01037'
    }
    return option(c, /抽 1 张牌，然后/)
  })
  assert.ok(offered)
  assert.equal(state.investigators[0].actionsLeft, actions - 1)
  assert.equal(state.investigators[0].horror, 2)
  const after = state.investigators[0]
  const weakness = after.threat.find(item => item.code === '11003')
  after.hand = ['01088', '01037', '01086']
  const clear = () => legalMoves(state).find(action => action.assetId === weakness.id && action.action === 'ability')
  assert.equal(clear(), undefined)
  after.hand.push('01064')
  assert.ok(clear())
  move(state, clear())
  settle(state)
  assert.deepEqual(state.investigators[0].hand, ['01086'])
  assert.ok(!state.investigators[0].threat.length)
})

test('卢修斯躲避差值与限次，旧印只数同地敌人', () => {
  const state = fixture('11004')
  const first = enemy(state, { evade: 4 })
  const second = enemy(state, { evade: 3 })
  enemy(state, { location: 'elsewhere', engagedSeat: null })
  location(state).clues = 3
  assert.deepEqual(elderSignEffect(state, state.investigators[0]), { delta: 2 })
  const evade = enemyId => legalMoves(state).find(action => action.action === 'evade' && action.enemyId === enemyId)
  let opportunities = 0
  const select = c => {
    const id = option(c, /躲避成功至少/)
    if (id) opportunities++
    return id
  }
  move(state, evade(first.id))
  settle(state, select)
  assert.equal(opportunities, 0)
  move(state, evade(second.id))
  settle(state, select)
  assert.equal(opportunities, 1)
  assert.equal(state.investigators[0].clues, 1)
  const third = enemy(state, { evade: 1 })
  move(state, evade(third.id))
  settle(state, select)
  assert.equal(opportunities, 1)
})

test('卢修斯的书使检定刚好成功、抽牌并补灵感，弱点洗回牌库', () => {
  const state = fixture('11004')
  const book = asset(state, '11005')
  draw(state, '11006')
  location(state).shroud = state.investigators[0].intellect + 1
  location(state).clues = 2
  move(state, { action: 'investigate' })
  settle(state, c => option(c, /花费 1 灵感/))
  const inv = state.investigators[0]
  assert.equal(inv.clues, 1)
  assert.equal(inv.hand.length, 1)
  assert.equal(inv.assets.find(item => item.id === book.id).uses, 1)
  assert.equal(inv.horror, 1)
  assert.ok(inv.deck.includes('11006'))
})

for (const code of ['11007', '11008']) test('阿加莎 ' + code + ' 封印、替换并在回合末移除弃牌事件', () => {
  const state = fixture(code, 2)
  const ocular = asset(state, '11009')
  location(state).shroud = 0
  location(state).clues = 4
  state.investigators[0].discard.push('01037', '01037')
  move(state, { action: 'investigate' })
  settle(state, c => option(c, /封印本次成功/))
  assert.ok(state.chaos.sealed.some(item => item.source === ocular.id))
  assert.equal(state.investigators[0].chaosTokenChangeRound, state.round)
  state.chaosBag = ['-2']
  move(state, { action: 'investigate' })
  settle(state, c => option(c, /封印本次成功/))
  assert.ok(!state.chaos.sealed.length)
  move(state, { action: 'endTurn' })
  settle(state, c => option(c, /弃牌堆打出/) || (c.prompt.includes('选择要打出的事件') ? '01037' : null))
  assert.equal(state.removedFromGame.filter(item => item === '01037').length, 1)
  assert.equal(state.investigators[0].discard.filter(item => item === '01037').length, 1)
})

test('阿加莎旧印重抽，弱点额外揭示一枚', () => {
  const state = fixture('11007')
  location(state).shroud = 0
  location(state).clues = 3
  state.chaosBag = ['eldersign', '0']
  state.debugNextTokens = ['eldersign', '0']
  move(state, { action: 'investigate' })
  settle(state, c => c.options.some(item => item.id === 'replace') ? 'replace' : null)
  assert.equal(state.investigators[0].hand.length, 1)
  assert.equal(state.investigators[0].chaosTokenChangeRound, state.round)
  draw(state, '11010')
  state.chaosBag = ['0', '-1']
  state.debugNextTokens = ['0', '-1']
  move(state, { action: 'investigate' })
  settle(state)
  assert.deepEqual(state.lastTestResult.drawn || state.lastTestResult.tokens, ['0', '-1'])
})

test('迈克尔弹药按枪限制，枪盒槽位和没收', () => {
  const state = fixture('11011')
  asset(state, '11012')
  const first = asset(state, '01016')
  const second = asset(state, '01016')
  assert.ok(canEquip(state.investigators[0], ALL_CARDS['01074']))
  const foe = enemy(state)
  let offered = 0
  for (const gun of [first, first, second]) {
    const attack = legalMoves(state).find(action => action.action === 'ability' && action.assetId === gun.id)
    assert.ok(attack, JSON.stringify(legalMoves(state).filter(action => action.enemyId === foe.id)))
    move(state, attack)
    settle(state, c => {
      const id = option(c, /花费枪械弹药/)
      if (id) offered++
      return id
    })
  }
  assert.equal(offered, 2)
  draw(state, '11013')
  const inv = state.investigators[0]
  assert.ok(!inv.assets.some(item => item.code === '01016'))
  assert.equal(inv.deck.filter(code => code === '01016').length, 2)
  draw(state, '11013')
  assert.equal(inv.damage, 1)
  assert.ok(inv.deck.includes('11013'))
})

test('歌莉娅循环版将三张预言纳入遭遇库，书版带替代专属牌', () => {
  for (const [code, signature, encounters] of [['11014', '11015', 3], ['98019', '98020', 0]]) {
    const state = createGameState({ playerInvestigator: code, seed: 'tdc-kit' }, [{ seat: 0 }])
    settle(state)
    const inv = state.investigators[0]
    assert.equal(inv.code, code)
    assert.ok([...inv.deck, ...inv.hand].includes(signature))
    assert.equal(state.encounterDeck.filter(item => item === '11016').length, encounters)
    assert.equal(inv.deck.includes('98021'), code === '98019')
  }
})

test('歌莉娅旧印查看遭遇牌，三张预言击败并造成一次创伤', () => {
  const state = fixture('11014', 2)
  location(state).shroud = 0
  state.encounterDeck = ['11016', '11016', '11016']
  for (let i = 0; i < 2; i++) {
    state.chaosBag = ['eldersign']
    location(state).clues = 1
    move(state, { action: 'investigate' })
    settle(state, c => option(c, /多看 1 张/))
  }
  assert.equal(state.investigators[0].defeated, true)
  assert.equal(state.campaign.trauma[0].mental, 1)
})

test('乔治的暗置牌可投入，读档和投影保护内容，弱点清空暗置区', () => {
  let state = fixture('11017', 2)
  assert.equal(getHandSize(state, state.investigators[0]), 0)
  const pile = ['01090', '01091', '01089', '01092', '11018']
  for (const code of pile) assert.ok(stashBeneath(state, 0, '11017', code, 5))
  assert.equal(stashBeneath(state, 0, '11017', '01088', 5), false)
  assert.equal(getHandSize(state, state.investigators[0]), 5)
  state = JSON.parse(JSON.stringify(state))
  migrateState(state)
  assert.deepEqual(beneathCards(state, 0, '11017'), pile)
  assert.deepEqual(viewState(state, 0).mechanics.beneath[0].codes, pile)
  assert.equal(viewState(state, 1).mechanics.beneath[0].codes, undefined)
  move(state, { action: 'investigate' })
  settle(state, c => option(c, /投入（暗置）：洞察力/))
  assert.ok(!beneathCards(state, 0, '11017').includes('01090'))
  draw(state, '11019')
  assert.deepEqual(beneathCards(state, 0, '11017'), [])
  assert.ok(pile.every(code => state.investigators[0].discard.includes(code)))
  assert.deepEqual(elderSignEffect(state, state.investigators[0]), { delta: 1, draw: 1 })
})


test('玛利翁旧印找出事件，事件检定成功可收回专属技能', () => {
  const state = fixture('11001')
  const inv = state.investigators[0]
  inv.deck = ['01088', '01086', '01022']
  location(state).shroud = 0
  location(state).clues = 3
  state.chaosBag = ['eldersign']
  move(state, { action: 'investigate' })
  settle(state, c => c.options.find(item => item.cardCode === '01022')?.id)
  assert.ok(state.investigators[0].hand.includes('01022'))

  state.investigators[0].hand = ['02023', '11002']
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '02023' })
  settle(state, c => option(c, /投入.*坚定|投入.*决心/) || (c.options.some(item => item.id === 'return') ? 'return' : null))
  assert.ok(state.investigators[0].hand.includes('11002'))
})

test('迈克尔旧印补弹，枪盒打出时只搜索牌库顶九张', () => {
  const state = fixture('11011')
  const inv = state.investigators[0]
  const gun = asset(state, '01016', { uses: 0, usesType: 'ammo' })
  inv.deck = ['01016', ...Array(8).fill('01088'), '01016']
  play(state, '11012')
  settle(state, c => option(c, /牌库顶 9 张/) || c.options.find(item => item.cardCode === '01016')?.id)
  assert.equal(state.investigators[0].hand.filter(code => code === '01016').length, 1)
  assert.equal(state.investigators[0].deck.filter(code => code === '01016').length, 1)
  location(state).shroud = 0
  location(state).clues = 1
  state.chaosBag = ['eldersign']
  move(state, { action: 'investigate' })
  settle(state, c => c.options.find(item => item.id === gun.id)?.id)
  assert.equal(state.investigators[0].assets.find(item => item.id === gun.id).uses, 1)
})

test('歌莉娅从另一地点打出专属事件取消遭遇牌', () => {
  const state = fixture('11014', 2)
  const inv = state.investigators[0]
  state.investigators[1].location = 'hallway'
  inv.hand = ['11015']
  stashBeneath(state, 0, '11014', 'ancientEvils', 3)
  state.encounterDeck = ['dissonantVoices', 'ancientEvils']
  move(state, { action: 'endTurn' })
  settle(state)
  move(state, { action: 'endTurn' })
  settle(state, c => {
    if (c.prompt.includes('选择下一位抽取遭遇牌')) return '1'
    return c.options.find(item => item.cardCode === '11015')?.id
  })
  assert.ok(!beneathCards(state, 0, '11014').length)
  assert.equal(state.encounterDiscard.filter(code => code === 'ancientEvils').length, 2)
})

test('歌莉娅书版弃同特质暗置牌降低难度，替代弱点抽取暗置敌人', () => {
  const state = fixture('98019')
  asset(state, '98020')
  const foe = enemy(state, { code: 'ghoulMinion', originalCode: '01160', fight: 4, traits: ['Ghoul', 'Monster'] })
  stashBeneath(state, 0, '98019', 'ghoulMinion', 3)
  state.chaosBag = ['0']
  move(state, { action: 'fight', enemyId: foe.id })
  settle(state, c => option(c, /同特质/)
    || (c.prompt.includes('选择要弃掉的暗置遭遇牌') ? 'ghoulMinion' : null))
  assert.equal(state.lastTestResult.difficulty, 2)
  assert.ok(state.encounterDiscard.includes('ghoulMinion'))
  stashBeneath(state, 0, '98019', 'ghoulMinion', 3)
  state.investigators[0].deck.push('98021')
  move(state, { action: 'draw' })
  settle(state)
  assert.ok(!beneathCards(state, 0, '98019').length)
  assert.ok(state.investigators[0].damage > 0)
})

test('乔治弃牌反应每阶段一次，专属技能交换暗置牌与非弱点手牌', () => {
  const state = fixture('11017')
  const inv = state.investigators[0]
  inv.hand = ['01088', '01086', '11018']
  registerCardAbilities({ code: 'tdc-test-hand-discard', abilities: [{
    kind: 'free', label: '测试弃一张手牌', cost: { discardHand: 1 }, resolve: () => {},
  }] })
  const tool = asset(state, 'tdc-test-hand-discard')
  for (const code of ['01088', '01086']) {
    move(state, { action: 'ability', assetId: tool.id, abilityIndex: 0 })
    settle(state, c => c.options.find(item => item.cardCode === code)?.id || option(c, /将弃牌放在/))
  }
  assert.deepEqual(beneathCards(state, 0, '11017'), ['01088'])
  state.investigators[0].hand.push('01086')
  move(state, { action: 'investigate' })
  settle(state, c => option(c, /投入：坚定决心/)
    || (c.prompt.includes('手牌用于交换') && c.options.some(item => item.id === '01086') ? '01086' : null)
    || (c.prompt.includes('暗置牌用于交换') ? '01088' : null))
  assert.deepEqual(beneathCards(state, 0, '11017'), ['01086'])
  assert.ok(state.investigators[0].hand.includes('01088'))
})
