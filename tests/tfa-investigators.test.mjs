import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, enemy, move, settle, legalMoves, validateMove } from './core-fixture.mjs'
import { createGameState, performTest, getStat } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { EFFECTS, INVESTIGATOR_ABILITIES } from '../src/cards/card-effects.js'
import { canSelectInvestigator, getAvailability } from '../src/deck/availability.js'
import { signatureAndWeaknesses } from '../src/deck/deckbuilding.js'
import { registerCampaignInvestigator } from '../src/campaign/campaign.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { manifest as investigatorPack } from '../content/packs/tfaInvestigators/manifest.js'

const TFA_STATS = {
  '04001': { name: '里奥·安德森', willpower: 4, intellect: 3, combat: 4, agility: 1, health: 8, sanity: 6 },
  '04002': { name: '厄休拉·唐斯', willpower: 3, intellect: 4, combat: 1, agility: 4, health: 7, sanity: 7 },
  '04003': { name: '芬恩·爱德华兹', willpower: 1, intellect: 4, combat: 3, agility: 4, health: 7, sanity: 7 },
  '04004': { name: '马泰奥神父', willpower: 4, intellect: 3, combat: 2, agility: 3, health: 6, sanity: 8 },
  '04005': { name: '加尔文·怀特', willpower: 0, intellect: 0, combat: 0, agility: 0, health: 6, sanity: 6 },
}

// 每次事务提交后引擎会替换调查员对象，因此断言前必须重新读取 state.investigators[0]。
const me = state => state.investigators[0]

function investigatorFixture(code) {
  const state = fixture(code)
  Object.assign(me(state), { code, ...TFA_STATS[code] })
  return state
}

function withLocations(state) {
  state.locations.push(
    { id: 'alpha', code: 'alpha', name: '阿尔法', revealed: true, clues: 2, maxClues: 2, shroud: 2, connections: ['beta'] },
    { id: 'beta', code: 'beta', name: '贝塔', revealed: true, clues: 2, maxClues: 2, shroud: 3, connections: ['alpha'] },
  )
  me(state).location = 'alpha'
  return state
}

// 自定义事务：执行函数必须随每次作答一起重放。
function runTest(state, execute, choose) {
  resolveTransaction(state, 0, { action: 'tfaInvestigatorTest' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 80, `Choice loop: ${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? pending.options.find(option => ['done', 'skip', 'self'].includes(option.id))?.id
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
}

function signTest(state, skill = 'willpower', difficulty = 6, choose) {
  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, skill, difficulty, {
    resolve: value => { current.testResult = value },
  })
  runTest(state, execute, choose)
  return state.testResult
}

test('M1 exposes five selectable investigators whose signatures are dependency-only', () => {
  assert.equal(investigatorPack.status, 'verified')
  const signatures = ['04006', '04007', '04008', '04009', '04010', '04011', '04012', '04013', '04014', '04015', '04016']
  for (const code of Object.keys(TFA_STATS)) {
    assert.equal(canSelectInvestigator(code), true, code)
    assert.equal(getAvailability(code).availability, 'strict', code)
  }
  for (const code of signatures) {
    assert.equal(getAvailability(code).availability, 'strict', code)
    assert.equal(getAvailability(code).dependencyOnly, true, code)
    assert.equal(getAvailability(code).deckbuilding, false, code)
  }
  assert.equal(INVESTIGATOR_ABILITIES['04001'].elderSign.kind, 'tfaSearchAlly')
  assert.equal(INVESTIGATOR_ABILITIES['04002'].reactions[0].when, 'move')
  assert.equal(INVESTIGATOR_ABILITIES['04003'].extraEvadeAction, true)
  assert.deepEqual(INVESTIGATOR_ABILITIES['04004'].autofailToElderSign, { oncePerGame: true })
  assert.deepEqual(INVESTIGATOR_ABILITIES['04005'].statsPerHarm,
    { horror: { willpower: 1, intellect: 1 }, damage: { combat: 1, agility: 1 } })
  assert.equal(EFFECTS['04006'].passive.allySlotsForNonUnique, 2)
  assert.equal(EFFECTS['04011'].usesType, 'ammo')
  assert.equal(EFFECTS['04013'].sealOnEnter, 'eldersign')
  assert.equal(EFFECTS['04015'].passive.assignDirectHarm, true)
})

test('M1 keeps every deck requirement and signature quantity intact', () => {
  const expected = {
    '04001': { signatureCards: ['04006'], signatureWeaknesses: ['04007'] },
    '04002': { signatureCards: ['04008'], signatureWeaknesses: ['04009'] },
    '04003': { signatureCards: ['04010', '04011'], signatureWeaknesses: ['04012'] },
    '04004': { signatureCards: ['04013'], signatureWeaknesses: ['04014'] },
    '04005': { signatureCards: ['04015'], signatureWeaknesses: ['04016'] },
  }
  for (const [code, contract] of Object.entries(expected)) {
    assert.equal(INVESTIGATORS[code].deckRequirements.size, 30, code)
    assert.deepEqual(INVESTIGATORS[code].deckRequirements.signatureCards,
      [...contract.signatureCards, ...contract.signatureWeaknesses], code)
    for (const signature of [...contract.signatureCards, ...contract.signatureWeaknesses]) {
      assert.equal(ALL_CARDS[signature].quantity || 1, 1, signature)
    }
    const bundle = signatureAndWeaknesses(INVESTIGATORS[code], () => 0, { basicWeaknessPool: ['01096'] })
    assert.deepEqual(bundle.signatureCards, contract.signatureCards, code)
    assert.deepEqual(bundle.signatureWeaknesses, contract.signatureWeaknesses, code)
    assert.deepEqual(bundle.basicWeaknesses, ['01096'], code)
  }
})

test('M1 openings keep signatures and restore deterministically from JSON for 1-4 seats', () => {
  for (const code of Object.keys(TFA_STATS)) {
    for (const count of [1, 2, 3, 4]) {
      const state = createGameState({ playerInvestigator: code, seed: `m1-${code}-${count}` },
        Array.from({ length: count }, (_, seat) => ({ seat })))
      const deck = [...state.investigators[0].deck, ...state.investigators[0].hand]
      for (const signature of INVESTIGATORS[code].deckRequirements.signatureCards) {
        assert.equal(deck.filter(item => item === signature).length, 1, `${code} ${signature}`)
      }
      const restored = JSON.parse(JSON.stringify(state))
      settle(state)
      settle(restored)
      assert.deepEqual(restored, state)
    }
  }
})

test('M1 Leo Anderson plays an Ally asset at one resource discount after his turn begins', () => {
  const state = investigatorFixture('04001')
  state.encounterDeck = []
  me(state).hand = ['01018']
  me(state).resources = 10
  move(state, { action: 'endTurn' })
  let triggered = false
  settle(state, pending => {
    if (pending.source === 'leoPlayAlly' && !triggered) { triggered = true; return 'trigger' }
    if (pending.kind === 'target' && pending.options.some(option => option.id === '01018')) return '01018'
    return null
  })
  assert.equal(triggered, true)
  assert.ok(me(state).assets.some(item => item.code === '01018'), '盟友支援应当已经装备')
  assert.equal(me(state).resources, 10 + 1 - (ALL_CARDS['01018'].cost - 1))
})

test('M1 Leo Anderson cannot play a non-Ally asset with the discount reaction', () => {
  const state = investigatorFixture('04001')
  me(state).hand = ['01016']
  me(state).resources = 10
  const options = []
  move(state, { action: 'endTurn' })
  settle(state, pending => {
    if (pending.source === 'leoPlayAlly') options.push(...pending.options.map(option => option.id))
    return null
  })
  assert.equal(options.includes('01016'), false)
  assert.equal(me(state).assets.some(item => item.code === '01016'), false)
})

test('M1 Leo Anderson elder sign adds +2 and draws a searched Ally', () => {
  const state = investigatorFixture('04001')
  me(state).resources = 0
  me(state).deck = ['01088', '01018', '01088', '01088']
  const result = signTest(state, 'willpower', 5, pending => pending.kind === 'search' ? '0' : null)
  assert.equal(result.value, TFA_STATS['04001'].willpower + 2)
  assert.ok(me(state).hand.includes('01018'))
})

test('M1 Ursula Downs investigates for free once per round after moving', () => {
  const state = withLocations(investigatorFixture('04002'))
  const actionsBefore = me(state).actionsLeft
  move(state, { action: 'move', locationId: 'beta' })
  let investigated = false
  settle(state, pending => {
    if (pending.source === 'ursulaInvestigate') { investigated = true; return 'trigger' }
    return null
  })
  assert.equal(investigated, true)
  assert.equal(me(state).location, 'beta')
  assert.equal(me(state).clues, 1)
  assert.equal(me(state).actionsLeft, actionsBefore - 1, '只有移动消耗行动点')
})

test('M1 Ursula Downs reaction stays once per round', () => {
  const state = withLocations(investigatorFixture('04002'))
  me(state).actionsLeft = 5
  let prompts = 0
  const choose = pending => {
    if (pending.source === 'ursulaInvestigate') { prompts++; return 'trigger' }
    return null
  }
  move(state, { action: 'move', locationId: 'beta' })
  settle(state, choose)
  move(state, { action: 'move', locationId: 'alpha' })
  settle(state, choose)
  assert.equal(prompts, 1)
  assert.equal(me(state).clues, 1)
})

test('M1 Ursula Downs elder sign adds +1 and may move to a connecting location', () => {
  const state = withLocations(investigatorFixture('04002'))
  state.chaosBag = ['eldersign']
  const execute = current => performTest(current, 0, 'intellect', 5, { resolve: value => { current.testResult = value } })
  runTest(state, execute, pending => pending.source === 'ursulaElderSign' ? 'beta' : null)
  assert.equal(state.testResult.success, true)
  assert.equal(me(state).location, 'beta')
})

test('M1 Finn Edwards gains one extra evade action that does not cost an action', () => {
  const state = investigatorFixture('04003')
  const engaged = enemy(state, { id: 'finn-target', evade: 1, fight: 1, health: 5 })
  const actionsBefore = me(state).actionsLeft
  assert.equal(legalMoves(state).filter(option => option.action === 'extraEvade').length, 1)
  state.chaosBag = ['0']
  move(state, { action: 'extraEvade', enemyId: engaged.id })
  settle(state)
  assert.equal(me(state).actionsLeft, actionsBefore)
  assert.equal(state.enemies.find(item => item.id === engaged.id).exhausted, true)
  assert.equal(legalMoves(state).some(option => option.action === 'extraEvade'), false)
  assert.notEqual(validateMove(state, 0, { action: 'extraEvade', enemyId: engaged.id }), null)
})

test('M1 Finn Edwards extra evade is rejected for other investigators', () => {
  const state = investigatorFixture('04002')
  const engaged = enemy(state, { id: 'ursula-target', evade: 1, fight: 1, health: 5 })
  assert.equal(legalMoves(state).some(option => option.action === 'extraEvade'), false)
  assert.notEqual(validateMove(state, 0, { action: 'extraEvade', enemyId: engaged.id }), null)
})

test('M1 Finn Edwards elder sign counts exhausted enemies and finds a clue when succeeding by 2', () => {
  const state = withLocations(investigatorFixture('04003'))
  enemy(state, { id: 'tired-1', exhausted: true, engagedSeat: null })
  enemy(state, { id: 'tired-2', exhausted: true, engagedSeat: null })
  me(state).deck = []
  const result = signTest(state, 'agility', 3, pending => pending.source === 'finnElderSign' ? 'trigger' : null)
  assert.equal(result.value, TFA_STATS['04003'].agility + 2)
  assert.equal(result.success, true)
  assert.equal(me(state).clues, 1)
})

test('M1 Father Mateo cancels an autofail token once per game', () => {
  const state = investigatorFixture('04004')
  state.chaosBag = ['autofail']
  const execute = current => performTest(current, 0, 'willpower', 4, { resolve: value => { current.testResult = value } })
  runTest(state, execute, pending => pending.source === '04004' ? 'trigger' : null)
  assert.equal(me(state).mateoSignUsed, true)
  assert.equal(state.testResult.success, true, '改为旧印后自动成功')

  state.chaosBag = ['autofail']
  let asked = false
  const again = current => performTest(current, 0, 'willpower', 4, { resolve: value => { current.testResult = value } })
  runTest(state, again, pending => { if (pending.source === '04004') asked = true; return null })
  assert.equal(asked, false)
  assert.equal(state.testResult.success, false)
})

test('M1 Father Mateo elder sign auto-succeeds and grants a chosen reward', () => {
  const state = investigatorFixture('04004')
  me(state).deck = ['01088', '01088', '01088']
  me(state).resources = 2
  const result = signTest(state, 'willpower', 9, pending => pending.source === 'mateoElderSign' ? 'draw' : null)
  assert.equal(result.success, true)
  assert.equal(me(state).resources, 3)
  assert.equal(me(state).hand.length, 1)

  const actionState = investigatorFixture('04004')
  me(actionState).actionsLeft = 2
  const before = me(actionState).actionsLeft
  signTest(actionState, 'willpower', 9, pending => pending.source === 'mateoElderSign' ? 'action' : null)
  assert.equal(me(actionState).actionsLeft, before + 1)
})

test('M1 Father Mateo starts the campaign with five extra experience', () => {
  const campaign = { investigatorSeq: 0, investigators: {}, trauma: {}, scenarioIndex: 0 }
  const record = registerCampaignInvestigator(campaign, { seat: 0, code: '04004', name: '马泰奥神父' }, [])
  assert.equal(record.xp, 5)
  assert.equal(record.earnedXp, 5)
  const plain = { investigatorSeq: 0, investigators: {}, trauma: {}, scenarioIndex: 0 }
  const other = registerCampaignInvestigator(plain, { seat: 0, code: '04001', name: '里奥·安德森' }, [])
  assert.equal(other.xp, 0)
})

test('M1 Calvin Wright gains stats from damage and horror', () => {
  const state = investigatorFixture('04005')
  const investigator = me(state)
  assert.equal(getStat(state, investigator, 'willpower'), 0)
  investigator.horror = 2
  investigator.damage = 3
  assert.equal(getStat(state, investigator, 'willpower'), 2)
  assert.equal(getStat(state, investigator, 'intellect'), 2)
  assert.equal(getStat(state, investigator, 'combat'), 3)
  assert.equal(getStat(state, investigator, 'agility'), 3)
})

test('M1 Calvin Wright elder sign heals or takes one direct harm', () => {
  const healState = investigatorFixture('04005')
  me(healState).damage = 2
  signTest(healState, 'combat', 3, pending => pending.source === 'calvinElderSign' ? 'healDamage' : null)
  assert.equal(me(healState).damage, 1)

  const hurtState = investigatorFixture('04005')
  signTest(hurtState, 'combat', 3, pending => pending.source === 'calvinElderSign' ? 'takeHorror' : null)
  assert.equal(me(hurtState).horror, 1)
})

// ---------------------------------------------------------------------------
// 11 张专属卡
// ---------------------------------------------------------------------------

test('M1 Mitch Brown opens two ally slots that only non-unique allies may use', () => {
  const state = investigatorFixture('04001')
  state.encounterDeck = []
  me(state).hand = ['04006', '01018', '01021', '01028', '01055']
  me(state).resources = 40
  move(state, { action: 'play', cardId: '04006' })
  settle(state)
  assert.ok(me(state).assets.some(item => item.code === '04006'))
  // 米奇之后最多还能有 2 个非独特盟友，合计 3 个盟友槽。
  for (const code of ['01018', '01021', '01028']) {
    assert.equal(validateMove(state, 0, { action: 'play', cardId: code }), null, code)
    move(state, { action: 'play', cardId: code })
    settle(state)
  }
  assert.equal(me(state).assets.filter(item => ALL_CARDS[item.code].type === 'asset'
    && (ALL_CARDS[item.code].traits || []).some(trait => String(trait).toLowerCase() === 'ally')).length, 4)
  // 第四个非独特盟友需要换下已有盟友，而不是直接放不下。
  const replacement = validateMove(state, 0, { action: 'play', cardId: '01055' })
  assert.equal(replacement, null)
})

test('M1 Mitch Brown ally slots cannot hold a second unique ally without replacing one', () => {
  const state = investigatorFixture('04001')
  state.encounterDeck = []
  me(state).hand = ['04006', '04008']
  me(state).resources = 40
  move(state, { action: 'play', cardId: '04006' })
  settle(state)
  // 04008 杰克·威廉斯是独特盟友，基础盟友槽已被米奇占用，必须替换。
  move(state, { action: 'play', cardId: '04008' })
  settle(state, pending => pending.kind === 'assetReplacement' ? pending.options[0].id : null)
  const allies = me(state).assets.filter(item => (ALL_CARDS[item.code].traits || [])
    .some(trait => String(trait).toLowerCase() === 'ally'))
  assert.deepEqual(allies.map(item => item.code), ['04008'])
})

test('M1 Jake Williams blocks the first opportunity attack of each round', () => {
  const state = withLocations(investigatorFixture('04002'))
  me(state).assets.push({ id: 'jake', code: '04008', exhausted: false, damage: 0, horror: 0 })
  const stalker = enemy(state, { id: 'stalker', fight: 1, evade: 1, health: 5, damage: 1, horror: 0 })
  assert.equal(stalker.engagedSeat, 0)
  move(state, { action: 'move', locationId: 'beta' })
  settle(state)
  assert.equal(me(state).damage, 0, '每回合第一个移动不引发借机攻击')
  move(state, { action: 'move', locationId: 'alpha' })
  settle(state)
  assert.equal(me(state).damage, 1, '第二次移动照常引发借机攻击')
})

test('M1 Jake Williams draws a card when a location is revealed, once per round', () => {
  const state = withLocations(investigatorFixture('04002'))
  const jake = { id: 'jake', code: '04008', exhausted: false, damage: 0, horror: 0 }
  me(state).assets.push(jake)
  me(state).deck = ['01088', '01088', '01088']
  const target = state.locations.find(item => item.id === 'beta')
  target.revealed = false
  move(state, { action: 'move', locationId: 'beta' })
  settle(state, pending => pending.source === 'jakeDraw' ? 'trigger' : null)
  assert.equal(me(state).hand.length, 1)
  assert.equal(me(state).assets.find(item => item.code === '04008').exhausted, true)
})

test("M1 Finn's Trusty .38 spends ammo and deals +2 combat, +1 damage against an unengaged enemy", () => {
  const state = investigatorFixture('04003')
  me(state).hand = ['04011']
  me(state).resources = 10
  move(state, { action: 'play', cardId: '04011' })
  settle(state)
  const pistol = me(state).assets.find(item => item.code === '04011')
  assert.equal(pistol.uses, 3)
  const far = enemy(state, { id: 'far-target', fight: 2, evade: 1, health: 6, engagedSeat: null })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: pistol.id, abilityIndex: 0 })
  settle(state, pending => pending.kind === 'target' ? far.id : null)
  const target = state.enemies.find(item => item.id === far.id)
  assert.equal(me(state).assets.find(item => item.code === '04011').uses, 2)
  assert.equal(target.damageTaken, 2, '基础 1 伤害 + 未交战 1 伤害')
})

test('M1 The Codex of Ages seals the elder sign, boosts willpower and replaces one reveal', () => {
  const state = investigatorFixture('04004')
  state.chaosBag = ['eldersign', '0', '0']
  me(state).hand = ['04013']
  me(state).resources = 10
  move(state, { action: 'play', cardId: '04013' })
  settle(state)
  const codex = me(state).assets.find(item => item.code === '04013')
  assert.ok(codex)
  assert.equal(state.chaos.sealed.some(entry => entry.source === codex.id && entry.token === 'eldersign'), true)
  assert.equal(getStat(state, me(state), 'willpower'), TFA_STATS['04004'].willpower + 1)
  // 揭示前改为结算封印的旧印。
  let result = null
  const execute = current => performTest(current, 0, 'willpower', 9, { resolve: value => { current.testResult = value } })
  runTest(state, execute, pending => pending.source === codex.id ? 'trigger' : null)
  result = state.testResult
  assert.equal(result.token, 'eldersign')
  assert.equal(result.success, true)
  assert.equal(me(state).assets.some(item => item.code === '04013'), false)
  assert.equal(getStat(state, me(state), 'willpower'), TFA_STATS['04004'].willpower)
})

test('M1 Serpents of Yig spawns as a hunter weakness and seals the elder sign on itself', () => {
  const state = investigatorFixture('04004')
  state.chaosBag = ['eldersign', '0']
  me(state).deck = ['04014']
  me(state).discard = []
  move(state, { action: 'draw' })
  settle(state)
  const serpents = state.enemies.find(item => item.code === '04014')
  assert.ok(serpents, '弱点敌人应当已经生成')
  assert.equal(serpents.hunter, true)
  assert.equal(state.chaos.sealed.some(entry => entry.source === serpents.id && entry.token === 'eldersign'), true)
  assert.equal(state.chaosBag.includes('eldersign'), false)
})

test('M1 Until the End of Time soaks direct horror that would otherwise hit Calvin', () => {
  const state = investigatorFixture('04005')
  me(state).assets.push({ id: 'end-time', code: '04015', exhausted: false, damage: 0, horror: 0 })
  me(state).deck = ['01015']
  move(state, { action: 'draw' })
  settle(state, pending => pending.kind === 'assign-horror' ? 'end-time' : null)
  assert.equal(me(state).horror, 0)
  assert.equal(me(state).assets.some(item => item.code === '04015'), false, '2 点恐惧超过容量后弃置')
})

test('M1 Bought in Blood discards a controlled Ally, else hand Allies, else reshuffles', () => {
  const controlled = investigatorFixture('04001')
  me(controlled).deck = ['04007']
  me(controlled).assets.push({ id: 'ally', code: '01018', exhausted: false, damage: 0, horror: 0 })
  move(controlled, { action: 'draw' })
  settle(controlled)
  assert.equal(me(controlled).assets.length, 0)
  assert.equal(me(controlled).discard.includes('01018'), true)

  const fromHand = investigatorFixture('04001')
  me(fromHand).deck = ['04007']
  me(fromHand).hand = ['01018', '01021', '01088']
  move(fromHand, { action: 'draw' })
  settle(fromHand)
  assert.deepEqual(me(fromHand).hand.sort(), ['01088'])
  assert.equal(me(fromHand).discard.filter(code => ['01018', '01021'].includes(code)).length, 2)

  const reshuffled = investigatorFixture('04001')
  me(reshuffled).deck = ['04007']
  me(reshuffled).hand = ['01088']
  move(reshuffled, { action: 'draw' })
  settle(reshuffled)
  assert.equal(me(reshuffled).deck.includes('04007'), true)
  assert.equal(me(reshuffled).discard.includes('04007'), false)
})

test('M1 Call of the Unknown forces a location choice and punishes a failed turn', () => {
  const state = withLocations(investigatorFixture('04002'))
  state.encounterDeck = []
  me(state).deck = ['04009']
  me(state).discard = []
  move(state, { action: 'draw' })
  settle(state)
  const threat = me(state).threat.find(item => item.code === '04009')
  assert.ok(threat, '未知的呼唤进入威胁区域')
  // 入场的当回合没有指定地点，不结算；回合开始时才选择。
  move(state, { action: 'endTurn' })
  let chosen = null
  settle(state, pending => {
    if (pending.kind === 'location' && pending.source === '04009') { chosen = 'beta'; return 'beta' }
    return null
  })
  assert.equal(chosen, 'beta')
  assert.equal(me(state).threat.find(item => item.code === '04009').callTarget, 'beta')
  assert.equal(me(state).horror, 0)
  // 没有成功调查所选地点 → 受到 2 点恐惧并洗回牌库。
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(me(state).horror, 2)
  assert.equal(state.log.some(entry => String(entry.text || entry).includes('未能调查所选地点')), true)
})

test('M1 Caught Red-Handed readies enemies and pulls connecting hunters', () => {
  const state = withLocations(investigatorFixture('04003'))
  me(state).deck = ['04012']
  me(state).discard = []
  const here = enemy(state, { id: 'here', exhausted: true, engagedSeat: null, fight: 1, evade: 1, health: 5 })
  const hunter = enemy(state, { id: 'hunter', location: 'beta', exhausted: true, engagedSeat: null, hunter: true, fight: 1, evade: 1, health: 5 })
  move(state, { action: 'draw' })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === here.id).exhausted, false)
  assert.equal(state.enemies.find(item => item.id === hunter.id).location, 'alpha')
  assert.equal(me(state).deck.includes('04012'), false)
})

test('M1 Caught Red-Handed reshuffles when no enemy moves', () => {
  const state = withLocations(investigatorFixture('04003'))
  me(state).deck = ['04012']
  me(state).discard = []
  move(state, { action: 'draw' })
  settle(state)
  assert.equal(me(state).deck.includes('04012'), true)
  assert.equal(me(state).discard.includes('04012'), false)
})

test('M1 Voice of the Messenger offers damage-plus-trauma or horror-plus-trauma', () => {
  const physical = investigatorFixture('04005')
  me(physical).deck = ['04016']
  move(physical, { action: 'draw' })
  settle(physical, pending => pending.source === '04016' ? 'damage' : null)
  assert.equal(me(physical).damage, 1)
  assert.equal(physical.campaign.trauma[0].physical, 1)

  const mental = investigatorFixture('04005')
  me(mental).deck = ['04016']
  move(mental, { action: 'draw' })
  settle(mental, pending => pending.source === '04016' ? 'horror' : null)
  assert.equal(me(mental).horror, 1)
  assert.equal(mental.campaign.trauma[0].mental, 1)
})

test('M1 Smuggled Goods is blocked by a ready enemy and finds an Illicit card from the deck', () => {
  const blocked = investigatorFixture('04003')
  me(blocked).hand = ['04010']
  me(blocked).resources = 10
  enemy(blocked, { id: 'ready-enemy', exhausted: false })
  assert.notEqual(validateMove(blocked, 0, { action: 'play', cardId: '04010' }), null)
  assert.equal(legalMoves(blocked).some(option => option.action === 'play' && option.cardId === '04010'), false)

  const open = investigatorFixture('04003')
  me(open).hand = ['04010']
  me(open).resources = 10
  me(open).deck = ['01088', '01088', '01044', '01088', '01088', '01088', '01088', '01088', '01088', '01088']
  move(open, { action: 'play', cardId: '04010' })
  settle(open, pending => {
    if (pending.source === '04010' && pending.kind === 'effect') return 'deck'
    if (pending.kind === 'search') return String(pending.options.findIndex(option => option.cardCode === '01044'))
    return null
  })
  assert.equal(me(open).hand.includes('01044'), true)
})
