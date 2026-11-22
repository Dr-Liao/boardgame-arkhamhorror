import test from 'node:test'
import assert from 'node:assert/strict'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { createGameState } from '../src/engine/engine.js'
import { viewState } from '../src/integration/observation.js'
import { buildDeck, buildDeckFromList, deckBuilderData } from '../src/deck/deckbuilding.js'
import { purchaseCard, replacementOptions } from '../src/campaign/campaign.js'
import { asset, enemy, fixture, legalMoves, move, settle, validateMove } from './core-fixture.mjs'

test('四个平行正面可选，签名的三种构筑均可通过手动与自动验证', () => {
  const data = deckBuilderData()
  for (const [face, back, advanced] of [
    ['90001', '01002', ['90002', '90003']],
    ['90008', '01003', ['90009', '90010']],
    ['90017', '01004', ['90018', '90019']],
    ['90024', '01001', ['90030', '90031']],
  ]) {
    assert.ok(data.investigators.some(item => item.code === face))
    const original = INVESTIGATORS[back].deckRequirements.signatureCards
    for (const signatures of ['standard', 'advanced', 'both']) {
      const options = { investigatorBuild: { back, signatures }, seed: 'parallel-test' }
      const auto = buildDeck(INVESTIGATORS[face], options)
      const manual = buildDeckFromList(INVESTIGATORS[face], auto.playerCards, options)
      assert.deepEqual(manual.errors, [])
      for (const deck of [auto.deck, manual.deck]) {
        assert.ok(original.every(code => deck.includes(code) === (signatures !== 'advanced')))
        assert.ok(advanced.every(code => deck.includes(code) === (signatures !== 'standard')))
      }
    }
  }
})

test('准备大厅接受混搭构筑，准则和签名存档后恢复并应用到开局', () => {
  let state = createGameState({ campaignHub: true, seed: 'parallel-lobby' }, [{ seat: 0, role: 'human' }])
  move(state, { action: 'hubGoSetup' })
  move(state, { action: 'hubSelectInvestigator', code: '90024' })
  const build = { back: '01001', signatures: 'both', directives: ['90025', '90028', '90029'] }
  assert.ok(validateMove(state, 0, { action: 'hubConfigureInvestigator', build: { ...build, back: '01002' } }))
  assert.ok(validateMove(state, 0, { action: 'hubConfigureInvestigator', build: { ...build, directives: ['90025', '90025', '90029'] } }))
  move(state, { action: 'hubConfigureInvestigator', build })
  assert.deepEqual(viewState(state, 0).investigators[0].investigatorBuild, build)
  const { playerCards } = buildDeck(INVESTIGATORS['90024'], { investigatorBuild: build })
  move(state, { action: 'hubSetDeck', codes: playerCards })
  settle(state)
  move(state, { action: 'hubConfirmDeck' })
  settle(state)
  state = JSON.parse(JSON.stringify(state))
  const record = state.campaign.investigators[0]
  assert.deepEqual(record.investigatorBuild, build)
  assert.equal(record.xp, 0)
  assert.ok(['01006', '01007', '90030', '90031', ...build.directives].every(code => record.deck.includes(code)))
  assert.ok(!record.deck.includes('90026') && !record.deck.includes('90027'))
  assert.ok(validateMove(state, 0, { action: 'hubConfigureInvestigator', build }))
  move(state, { action: 'hubDoneSeat' })
  move(state, { action: 'hubBeginScenario' })
  settle(state)
  assert.equal(state.investigators[0].code, '90024')
  assert.deepEqual(state.investigators[0].assets.filter(card => build.directives.includes(card.code)).map(card => card.code).sort(), build.directives)
})

test('罗兰的构筑背面独立给予 5 XP，正面与签名维持所选版本', () => {
  const state = createGameState({ campaignHub: true, seed: 'parallel-extra-xp' }, [{ seat: 0, role: 'human' }])
  move(state, { action: 'hubGoSetup' })
  move(state, { action: 'hubSelectInvestigator', code: '01001' })
  move(state, { action: 'hubConfigureInvestigator', build: { back: '90024', signatures: 'advanced' } })
  move(state, { action: 'hubAutoDeck' })
  settle(state)
  const record = state.campaign.investigators[0]
  assert.equal(record.code, '01001')
  assert.equal(record.xp + record.spentXp, 5)
  assert.ok(['90030', '90031'].every(code => record.deck.includes(code)))
  assert.ok(!record.deck.some(code => ALL_CARDS[code]?.traits?.includes('Directive')))
})

test('平行阿格妮丝可支付伤害并洗回法术，附属法术只留在场上一份', () => {
  for (const code of ['52008', '11026']) {
    const state = fixture('90017')
    const target = enemy(state, { fight: 0, engagedSeat: null })
    state.investigators[0].hand = [code]
    move(state, { action: 'play', cardId: code })
    settle(state, choice => choice.options.find(option => ['damage', 'shuffle', target.id].includes(option.id))?.id)
    const inv = state.investigators[0]
    assert.equal(inv.damage, 1)
    assert.equal(inv.deck.includes(code), code === '52008')
    if (code === '11026') assert.ok(state.enemies.find(item => item.id === target.id).attachments.some(item => item.code === code))
    assert.ok(!inv.discard.includes(code))
  }
})

test('平行罗兰的出牌准则计算本轮已打出的卡', () => {
  const state = fixture('90024')
  asset(state, '90026')
  state.investigators[0].hand = ['01088', '01088', '01088']
  for (let i = 0; i < 2; i++) {
    move(state, { action: 'play', cardId: '01088' })
    settle(state)
  }
  assert.ok(!legalMoves(state).some(row => row.action === 'play' && row.cardId === '01088'))
})

test('平行阿格妮丝洗回幽灵利刃时，回合结束不会额外返回一张', () => {
  for (const token of ['0', 'tablet']) {
    const state = fixture('90017')
    enemy(state, { fight: 0, engagedSeat: 0 })
    state.chaosBag = [token]
    state.investigators[0].hand = ['10102']
    state.investigators[0].resources = 0
    move(state, { action: 'play', cardId: '10102' })
    settle(state, choice => choice.options.find(option => ['damage', 'shuffle'].includes(option.id))?.id)
    const inv = state.investigators[0]
    assert.equal(inv.damage, 1)
    assert.equal(inv.deck.filter(code => code === '10102').length, 1)
    assert.ok(!inv.discard.includes('10102') && !inv.hand.includes('10102'))
    assert.ok(!inv.deferredEventReturns?.length)
  }
})

test('平行斯基兹押注按固定值检定，仅使用敏捷和通配图标', () => {
  const state = fixture('90008')
  const inv = state.investigators[0]
  inv.agility = 9
  inv.hand = ['01089', '01092', '01093']
  state.chaosBag = ['-2']
  move(state, { action: 'ability', assetId: 'investigator:0', abilityIndex: 0 })
  settle(state, (choice, current) => {
    if (choice.kind === 'resource') return '3'
    if (choice.kind !== 'commit') {
      assert.ok(!choice.options.some(option => option.id === 'free-descriptor:90008:0'))
      return null
    }
    if (current.skillTest.value > 3) return 'done'
    assert.deepEqual(current.skillTest.skill, [])
    assert.equal(current.skillTest.baseValue, 3)
    assert.deepEqual(choice.options.map(option => option.id), ['done', '1', '2'])
    return '1'
  })
  assert.equal(state.investigators[0].resources, 33)
  assert.ok(!legalMoves(state).some(row => row.assetId === 'investigator:0' && row.abilityIndex === 0))
})

test('平行背面升级可全价保留旧版，计数仍允许第二张同名升级', () => {
  const state = fixture('90017')
  const record = state.campaign.investigators[0]
  record.deck = buildDeck(INVESTIGATORS['90017']).deck
  record.investigatorBuild = { back: '90017', signatures: 'standard', directives: [] }
  record.xp = 6
  state.campaign.phase = 'interlude'
  const startingSize = record.deck.length
  for (let i = 0; i < 2; i++) {
    assert.ok(replacementOptions(record, '01069', state.campaign.records).some(option => option.code === '01066' && option.keepLower))
    const purchase = purchaseCard(state.campaign, 0, '01069', '01066', { keepLower: true })
    assert.equal(purchase.cost, 2)
  }
  assert.deepEqual(record.retainedUpgrades, ['01066', '01066'])
  assert.equal(record.deck.length, startingSize + 2)
  assert.equal(record.xp, 2)
  assert.equal(replacementOptions(record, '01069', state.campaign.records).filter(option => option.keepLower).length, 0)
})
