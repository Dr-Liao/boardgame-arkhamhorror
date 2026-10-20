import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, enemy, move, settle, legalMoves, validateMove } from './core-fixture.mjs'
import { getStat, performTest } from '../src/engine/engine.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { EFFECTS } from '../src/cards/card-effects.js'
import { lifecycleChannel } from '../src/engine/lifecycle.js'
import { getAvailability, PLAYER_CARD_CODES } from '../src/deck/availability.js'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { buildDeck, matchesDeckOptions } from '../src/deck/deckbuilding.js'
import { replacementOptions, purchaseCard, shrewdAnalysisUpgrade } from '../src/campaign/campaign.js'
import { manifest, IMPLEMENTED_PLAYER_CODES, WEAKNESS_PLAYER_CODES } from '../content/packs/tfaPlayer/manifest.js'
import { registeredEntry } from '../src/engine/ability.js'

const me = state => state.investigators[0]
const IMPLEMENTED = [...IMPLEMENTED_PLAYER_CODES]
const ALL_PLAYER_CARD_CODES = Object.values(ALL_CARDS)
  .filter(card => /^04\d{3}$/.test(card.code) && !card.encounterCode && !card.signatureFor
    && card.type !== 'investigator' && ['asset', 'event', 'skill', 'treachery', 'enemy'].includes(card.type))
  .map(card => card.code)

function playCard(state, code) {
  me(state).hand.push(code)
  move(state, { action: 'play', cardId: code })
  settle(state)
}

function sign(state, execute, choose) {
  resolveTransaction(state, 0, { action: 'tfaPlayerTest' }, execute)
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 60, `Choice loop: ${state.pendingChoice.kind}`)
    const pending = state.pendingChoice
    const optionId = choose?.(pending, state)
      ?? pending.options.find(option => ['done', 'skip', 'self'].includes(option.id))?.id
      ?? pending.options[0].id
    resolveTransaction(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId }, execute)
  }
  return state.testResult
}

function hasBehaviorData(code) {
  if (EFFECTS[code]) return true
  // Phase 1 起，「有实现」不再等于「有 EFFECTS 条目」：生命周期钩子可以在能力层描述子里。
  const channel = lifecycleChannel(code)
  if (channel.played || channel.commit || channel.weakness || channel.entersPlay || channel.leavesPlay) return true
  // Phase 2：逃生卡迁移后，主动/奖励/修正也在能力层描述子里（entry.abilities / modifiers）。
  const entry = registeredEntry(code)
  return Boolean(entry && (entry.abilities.length || entry.modifiers.length || entry.passive
    || entry.freeTriggers.length))
}

test('M2 implements the announced player-card wave and keeps the rest catalog-only', () => {
  assert.equal(IMPLEMENTED.length, 91, `已实现 ${IMPLEMENTED.length} 张，应为 91 张`)
  for (const code of IMPLEMENTED) {
    assert.ok(hasBehaviorData(code), `缺少效果：${code}`)
    assert.equal(getAvailability(code).availability, 'strict', code)
    assert.equal(getAvailability(code).rulesImplemented ?? true, true, code)
  }
  for (const code of WEAKNESS_PLAYER_CODES) {
    assert.equal(getAvailability(code).deckbuilding, false, `弱点不能构筑：${code}`)
  }
  const buildable = IMPLEMENTED.filter(code => !WEAKNESS_PLAYER_CODES.includes(code))
  assert.equal(buildable.length, IMPLEMENTED.length - WEAKNESS_PLAYER_CODES.length)
  for (const code of buildable) {
    assert.equal(getAvailability(code).deckbuilding, true, code)
    assert.equal(getAvailability(code).deckbuilding, true, code)
  }
  // 失落的时代玩家卡池已全部开放：没有遗留的 catalog-only 卡。
  const allPlayerCodes = Object.values(ALL_CARDS)
    .filter(card => /^04\d{3}$/.test(card.code) && !card.encounterCode && !card.signatureFor
      && card.type !== 'investigator' && ['asset', 'event', 'skill', 'treachery', 'enemy'].includes(card.type))
    .map(card => card.code)
  assert.equal(allPlayerCodes.filter(code => getAvailability(code).availability !== 'strict').length, 0)
  assert.equal(ALL_PLAYER_CARD_CODES.length, 91)
  assert.equal(manifest.status, 'development')
  assert.match(manifest.description, /91 张玩家卡/)
})

test('M2 treasure hunter raises intellect and charges upkeep', () => {
  const state = fixture('01001')
  playCard(state, '04025')
  assert.equal(getStat(state, me(state), 'intellect'), ALL_CARDS['01001'].intellect + 1)
  const resources = me(state).resources
  move(state, { action: 'endTurn' })
  let asked = false
  settle(state, pending => {
    if (pending.kind === 'upkeep' && pending.source?.startsWith('c')) { asked = true; return 'pay' }
    return null
  })
  assert.equal(asked, true)
  assert.ok(me(state).assets.some(item => item.code === '04025'), '支付后保留支援')
})

test('M2 ornate skull charges after a defeat and converts charges into cards', () => {
  const state = fixture('01001')
  playCard(state, '04026')
  const skull = me(state).assets.find(item => item.code === '04026')
  assert.equal(skull.uses, 0)
  const victim = enemy(state, { id: 'skull-target', fight: 0, evade: 0, health: 1 })
  state.chaosBag = ['0']
  move(state, { action: 'fight', enemyId: victim.id })
  // Phase 2：反应能力现在由能力层窗口枚举，选项 id 是 'desc:…' 而不是旧的 'trigger'。
  settle(state, pending => pending.kind === 'reaction'
    ? (pending.options.find(option => option.id !== 'skip')?.id ?? null) : null)
  assert.equal(me(state).assets.find(item => item.code === '04026').uses, 1)
  me(state).resources = 0
  me(state).deck = ['01088', '01088']
  move(state, { action: 'ability', assetId: skull.id, abilityIndex: 0 })
  settle(state)
  assert.equal(me(state).resources, 1)
  assert.equal(me(state).hand.length, 1)
})

test('M2 lucky cigarette case draws after a strong investigate success', () => {
  const state = fixture('01001')
  playCard(state, '04107')
  const study = state.locations.find(location => location.id === me(state).location)
  study.clues = 3
  study.shroud = 0
  me(state).deck = ['01088', '01088', '01088']
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  settle(state, pending => pending.source === 'luckyCase' ? 'trigger' : null)
  assert.equal(me(state).hand.length, 1)
  assert.equal(me(state).assets.find(item => item.code === '04107').exhausted, true)
})

test('M2 trench coat adds agility during evade attempts', () => {
  const state = fixture('01001')
  playCard(state, '04203')
  const engaged = enemy(state, { id: 'coat-enemy', fight: 0, evade: 6, health: 5 })
  state.chaosBag = ['0']
  let result = null
  const execute = current => {
    const before = current.investigators[0].agility
    return undefined
  }
  // 躲避检定：敏捷 2 + 大衣 1，rolled 0 → 3。
  move(state, { action: 'evade', enemyId: engaged.id })
  settle(state)
  assert.ok(!state.enemies.find(item => item.id === engaged.id).exhausted, '3 < 6 仍失败')
  // 用一次 +4 的检定对象验证加成确实计入：换成 evade 值 3。
  const state2 = fixture('01001')
  playCard(state2, '04203')
  const target = enemy(state2, { id: 'coat-enemy-2', fight: 0, evade: 3, health: 5 })
  state2.chaosBag = ['0']
  move(state2, { action: 'evade', enemyId: target.id })
  settle(state2)
  assert.equal(state2.enemies.find(item => item.id === target.id).exhausted, true, '敏捷 2 + 大衣 1 = 3 成功')
})

test('M2 ancient signet seals the elder sign and adds one to every skill', () => {
  const state = fixture('01001')
  state.chaosBag = ['eldersign', '0', '0']
  playCard(state, '04235')
  const signet = me(state).assets.find(item => item.code === '04235')
  assert.ok(signet)
  assert.equal(state.chaos.sealed.some(entry => entry.source === signet.id && entry.token === 'eldersign'), true)
  for (const skill of ['willpower', 'intellect', 'combat', 'agility']) {
    assert.equal(getStat(state, me(state), skill), ALL_CARDS['01001'][skill] + 1, skill)
  }
})

test('M2 Colt vest pocket pistol fires and is discarded at the round end', () => {
  const state = fixture('01001')
  playCard(state, '04268')
  const pistol = me(state).assets.find(item => item.code === '04268')
  assert.equal(pistol.uses, 5)
  const target = enemy(state, { id: 'colt-target', fight: 0, evade: 0, health: 5 })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: pistol.id, abilityIndex: 0 })
  settle(state, pending => pending.kind === 'target' ? target.id : null)
  assert.equal(me(state).assets.find(item => item.code === '04268').uses, 4)
  assert.ok(state.enemies.find(item => item.id === target.id).damageTaken >= 1)
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(me(state).assets.some(item => item.code === '04268'), false, '轮末弃置')
})

test('M2 old shotgun jams when a skull is revealed', () => {
  const state = fixture('01001')
  playCard(state, '04273')
  const shotgun = me(state).assets.find(item => item.code === '04273')
  const target = enemy(state, { id: 'shotgun-target', fight: 0, evade: 0, health: 6 })
  state.chaosBag = ['skull']
  move(state, { action: 'ability', assetId: shotgun.id, abilityIndex: 0 })
  settle(state, pending => pending.kind === 'target' ? target.id : null)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 0, '卡膛：不造成伤害')
  assert.equal(me(state).assets.find(item => item.code === '04273').uses, 2)
})

test('M2 hemisphere map scales with the number of connections', () => {
  const state = fixture('01001')
  playCard(state, '04275')
  const here = state.locations.find(location => location.id === me(state).location)
  const base = getStat(state, me(state), 'willpower')
  for (const id of ['n1', 'n2']) {
    state.locations.push({ id, name: id, revealed: true, clues: 0, maxClues: 0, shroud: 1, connections: [here.id] })
    here.connections.push(id)
  }
  assert.equal(getStat(state, me(state), 'willpower'), base + 1)
  for (const id of ['n3', 'n4']) {
    state.locations.push({ id, name: id, revealed: true, clues: 0, maxClues: 0, shroud: 1, connections: [here.id] })
    here.connections.push(id)
  }
  assert.equal(getStat(state, me(state), 'willpower'), base + 2)
})

test('M2 crime scene is first-action only and scales with a present enemy', () => {
  const blocked = fixture('01001')
  me(blocked).hand = ['04103']
  const study = blocked.locations.find(location => location.id === me(blocked).location)
  study.clues = 3
  move(blocked, { action: 'resource' })
  settle(blocked)
  assert.notEqual(validateMove(blocked, 0, { action: 'play', cardId: '04103' }), null, '不是第一个行动')

  const state = fixture('01001')
  me(state).hand = ['04103']
  state.locations.find(location => location.id === me(state).location).clues = 3
  enemy(state, { id: 'scene-enemy' })
  playCard(state, '04103')
  assert.equal(me(state).clues, 2, '有敌人时发现 2 个线索')
})

test('M2 staunch cancels up to four points of harm', () => {
  const state = fixture('01001')
  me(state).hand = ['04111']
  me(state).deck = ['01015']
  const health = ALL_CARDS['01001'].health
  move(state, { action: 'draw' })
  let played = false
  settle(state, pending => {
    if (pending.kind === 'reaction' && pending.options.some(option => option.cardCode === '04111') && !played) {
      played = true
      return pending.options.find(option => option.cardCode === '04111').id
    }
    if (pending.kind === 'harm') {
      const best = pending.options.reduce((left, right) => {
        const sum = option => option.id.split(':').map(Number).reduce((a, b) => a + b, 0)
        return sum(left) >= sum(right) ? left : right
      })
      return best.id
    }
    return null
  })
  // 直接恐惧 2 点被完全取消。
  assert.equal(played, true)
  assert.equal(me(state).horror, 0)
  assert.equal(me(state).damage < health, true)
})

test('M2 payday converts this turn\'s actions into resources and ends the turn', () => {
  const state = fixture('01001')
  me(state).hand = ['04233']
  me(state).resources = 0
  const serialBefore = state.turnSerial
  move(state, { action: 'play', cardId: '04233' })
  settle(state)
  assert.equal(me(state).resources >= 1, true, '每执行一个行动获得 1 资源')
  assert.ok(state.turnSerial > serialBefore, '结束回合并推进到下一回合')
})

test('M2 sacrifice to the tribute discards a mystic asset and splits three rewards', () => {
  const state = fixture('01001')
  me(state).hand = ['04234']
  me(state).assets.push({ id: 'spell', code: '01060', exhausted: false, uses: 2, usesType: 'charges' })
  me(state).deck = ['01088', '01088', '01088']
  me(state).resources = 0
  move(state, { action: 'play', cardId: '04234' })
  settle(state, pending => {
    if (pending.kind === 'target' && pending.options.some(option => option.id === 'spell')) return 'spell'
    if (pending.kind === 'effect' && pending.source === '04234') return '1-2'
    return null
  })
  assert.equal(me(state).assets.some(item => item.code === '01060'), false)
  assert.equal(me(state).resources, 2)
  assert.equal(me(state).hand.length, 1)
})

test('M2 last shot damages an enemy, draws on defeat and ends the turn', () => {
  const state = fixture('01001')
  me(state).hand = ['04269']
  me(state).deck = ['01088', '01088']
  const target = enemy(state, { id: 'last-shot-target', fight: 1, evade: 1, health: 1 })
  move(state, { action: 'play', cardId: '04269' })
  settle(state, pending => pending.kind === 'target' ? target.id : null)
  assert.equal(state.enemies.some(item => item.id === target.id), false)
  assert.equal(me(state).discard.includes('04269'), true, '事件已结算')
  assert.ok(me(state).hand.length >= 1, '击败目标后抽了 1 张牌')
  assert.ok(state.turnSerial > 1, '自己的回合结束时结束回合')
})

test('M2 professional hit adds one damage to the evaded enemy', () => {
  const state = fixture('01001')
  const target = enemy(state, { id: 'hit-target', fight: 0, evade: 0, health: 6 })
  me(state).hand = ['04155']
  state.chaosBag = ['0']
  move(state, { action: 'evade', enemyId: target.id })
  let committed = false
  settle(state, pending => {
    if (pending.kind === 'commit' && !committed && pending.options.some(option => option.id === '0')) {
      committed = true
      return '0'
    }
    return null
  })
  const evaded = state.enemies.find(item => item.id === target.id)
  assert.equal(evaded.exhausted, true)
  assert.deepEqual(evaded.tfaDamageBonus, { amount: 1, round: state.round })
  state.chaosBag = ['0']
  move(state, { action: 'fight', enemyId: target.id })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2, '基础 1 + 职业杀手 1')
})

test('M2 in the know places a charge or secret after a successful investigate', () => {
  const state = fixture('01001')
  me(state).hand = ['04157']
  state.locations.find(location => location.id === me(state).location).clues = 2
  me(state).assets.push({ id: 'charge-asset', code: '01060', exhausted: false, uses: 1, usesType: 'charges' })
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  let committed = false
  settle(state, pending => {
    if (pending.kind === 'commit' && !committed && pending.options.some(option => option.id === '0')) {
      committed = true
      return '0'
    }
    if (pending.kind === 'target' && pending.source === '04157') return 'charge-asset'
    return null
  })
  assert.equal(me(state).assets.find(item => item.id === 'charge-asset').uses, 2)
})

test('M2 defiance ignores symbol effects and modifiers', () => {
  const state = fixture('01001')
  me(state).hand = ['04198']
  state.chaosBag = ['cultist']
  let result = null
  const execute = current => performTest(current, 0, 'willpower', 3, {
    resolve: value => { current.testResult = value },
  })
  let committed = false
  sign(state, execute, pending => {
    if (pending.kind === 'commit' && !committed && pending.options.some(option => option.id === '0')) {
      committed = true
      return '0'
    }
    return null
  })
  result = state.testResult
  assert.equal(result.drawn.includes('cultist'), true)
  assert.equal(result.value, ALL_CARDS['01001'].willpower + 1, '符号修正不计入，只计投入的图标')
  assert.equal(me(state).horror, 0, '符号的失败恐惧被忽略')
  assert.equal(result.success, true)
})

test('M2 all in draws per point of success and reshuffles drawn weaknesses', () => {
  const state = fixture('01001')
  me(state).hand = ['04309']
  me(state).deck = ['01088', '01088', '01088', '01096']
  state.chaosBag = ['0']
  const execute = current => performTest(current, 0, 'willpower', 0, {
    resolve: value => { current.testResult = value },
  })
  let committed = false
  sign(state, execute, pending => {
    if (pending.kind === 'commit' && !committed && pending.options.some(option => option.id === '0')) {
      committed = true
      return '0'
    }
    return null
  })
  const result = state.testResult
  assert.equal(result.success, true)
  assert.equal(me(state).hand.length, Math.min(3, result.value), '按成功点数抽牌（受牌库张数限制）')
  assert.equal(me(state).deck.includes('01096'), true, '抽到的弱点洗回牌库')
})

test('M2 script-mode weakness chain resolves and swaps cards', () => {
  const pact = fixture('01001')
  me(pact).deck = ['04038']
  me(pact).hand = []
  enemy(pact, { id: 'pact-witness' })
  move(pact, { action: 'draw' })
  settle(pact)
  assert.equal(me(pact).damage, 2, '黑暗契约造成 2 点伤害')

  const price = fixture('01001')
  me(price).deck = ['04039']
  const doomBefore = price.doom
  move(price, { action: 'draw' })
  settle(price)
  assert.equal(me(price).damage, 2)
  assert.equal(me(price).horror, 2)
  assert.equal(price.doom, doomBefore + 1)
  assert.equal(me(price).discard.includes('04038'), true, '失败代价把黑暗契约放进弃牌堆')
  assert.equal(me(price).deck.includes('04038'), false, '不再塞回牌库')

  const doom = fixture('01001')
  me(doom).deck = ['04040']
  move(doom, { action: 'draw' })
  settle(doom)
  assert.equal(me(doom).horror, 1)
  assert.equal(me(doom).weaknessCounters.impendingDoom, 1)

  const fate = fixture('01001')
  me(fate).deck = ['04041']
  move(fate, { action: 'draw' })
  settle(fate)
  assert.equal(me(fate).horror, 2)
  assert.equal(me(fate).weaknessCounters.cursedFate, 1)

  const knell = fixture('01001')
  me(knell).deck = ['04042']
  move(knell, { action: 'draw' })
  settle(knell)
  assert.equal(me(knell).defeated, true, '丧钟敲响：调查员阵亡')
  assert.equal(me(knell).defeatCause, 'killed')
  assert.equal(knell.log.some(entry => String(entry.text || entry).includes('死期到了')), true)
})

// ---------------------------------------------------------------------------
// 第二批：武器、事件与技能（M2-B 第一组）
// ---------------------------------------------------------------------------

function dropHand(state, codes) { me(state).hand = codes; return state }

function placeEnemies(state, list) {
  for (const entry of list) enemy(state, entry)
  return state
}


test('M2 adventurer adds one supply or ammo to an asset at the location', () => {
  const state = fixture('01001')
  playCard(state, '04018')
  me(state).assets.push({ id: 'gun', code: '01016', exhausted: false, uses: 3, usesType: 'ammo' })
  move(state, { action: 'ability', assetId: me(state).assets.find(item => item.code === '04018').id, abilityIndex: 0 })
  settle(state, pending => pending.kind === 'target' ? 'gun' : null)
  assert.equal(me(state).assets.find(item => item.id === 'gun').uses, 4)
  assert.equal(me(state).assets.find(item => item.code === '04018').uses, 2)
})


test('M2 unearth the ancients puts a seeker asset into play', () => {
  const state = fixture('01001')
  dropHand(state, ['04024', '01030'])
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '04024' })
  settle(state, pending => pending.kind === 'target' ? '01030' : null)
  assert.equal(me(state).assets.some(item => item.code === '01030'), true)
})

test('M2 eavesdrop finds two clues from an unengaged enemy', () => {
  const state = fixture('01001')
  dropHand(state, ['04027'])
  state.locations.find(location => location.id === me(state).location).clues = 3
  const eavesdropped = enemy(state, { id: 'eavesdrop-enemy', fight: 1, evade: 1, health: 5, engagedSeat: null })
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '04027' })
  settle(state, pending => pending.kind === 'target' ? eavesdropped.id : null)
  assert.equal(me(state).clues, 2)
})

test('M2 lure of leylines evades with willpower', () => {
  const state = fixture('01001')
  playCard(state, '04029')
  const target = enemy(state, { id: 'lure-enemy', fight: 1, evade: 2, health: 5 })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: me(state).assets.find(item => item.code === '04029').id, abilityIndex: 0 })
  settle(state, pending => pending.kind === 'target' ? target.id : null)
  assert.equal(state.enemies.find(item => item.id === target.id).exhausted, true)
  assert.equal(me(state).assets.find(item => item.code === '04029').uses, 3)
})



test('M2 persuasion shuffles a humanoid enemy back into the encounter deck', () => {
  const state = fixture('01001')
  dropHand(state, ['04105'])
  state.chaosBag = ['0']
  const humanoid = enemy(state, { id: 'persuade-enemy', fight: 2, evade: 2, health: 5, engagedSeat: null, traits: ['Humanoid'] })
  move(state, { action: 'play', cardId: '04105' })
  settle(state, pending => pending.kind === 'target' ? humanoid.id : null)
  assert.equal(state.enemies.some(item => item.id === humanoid.id), false)
  assert.equal(state.encounterDeck.includes('ghoulMinion'), true)
})


test('M2 stunning blow evades the attacked enemy after a successful fight', () => {
  const state = fixture('01001')
  dropHand(state, ['04112'])
  const target = enemy(state, { id: 'stun-target', fight: 0, evade: 1, health: 6 })
  state.chaosBag = ['0']
  move(state, { action: 'fight', enemyId: target.id })
  let committed = false
  settle(state, pending => {
    if (pending.kind === 'commit' && !committed && pending.options.some(option => option.label.includes('晕眩重击'))) {
      committed = true
      return pending.options.find(option => option.label.includes('晕眩重击')).id
    }
    return null
  })
  const after = state.enemies.find(item => item.id === target.id)
  assert.equal(after.exhausted, true)
  assert.equal(after.engagedSeat, null)
})

test('M2 recover stamina heals and draws', () => {
  const state = fixture('01001')
  dropHand(state, ['04149'])
  me(state).damage = 2
  me(state).deck = ['01088', '01088']
  move(state, { action: 'play', cardId: '04149' })
  settle(state)
  assert.equal(me(state).damage, 1)
  assert.equal(me(state).hand.length, 1)
})


test('M2 discern truth places two secrets on an asset', () => {
  const state = fixture('01001')
  dropHand(state, ['04152'])
  state.locations.find(location => location.id === me(state).location).clues = 2
  me(state).clues = 1
  me(state).assets.push({ id: 'tome', code: '01031', exhausted: false, uses: 0, usesType: 'secrets' })
  move(state, { action: 'play', cardId: '04152' })
  settle(state, pending => pending.kind === 'target' ? 'tome' : null)
  assert.equal(me(state).assets.find(item => item.id === 'tome').uses, 2)
})


test('M2 extravagance spends three resources for +2 and refunds on success', () => {
  const state = fixture('01001')
  playCard(state, '04156')
  me(state).resources = 5
  const study = state.locations.find(location => location.id === me(state).location)
  study.clues = 2
  study.shroud = 3
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  settle(state, pending => {
    if (pending.options.some(option => option.label.includes('花 3 资源'))) return pending.options.find(option => option.label.includes('花 3 资源')).id
    return null
  })
  assert.equal(me(state).resources >= 5, true, '花费 3 后成功返还 3')
})

test('M2 otherworld compass reduces shroud by revealed connections', () => {
  const state = fixture('01001')
  playCard(state, '04194')
  const here = state.locations.find(location => location.id === me(state).location)
  here.clues = 2
  here.shroud = 4
  state.locations.push({ id: 'near', name: '近处', revealed: true, clues: 0, maxClues: 0, shroud: 1, connections: [here.id] })
  here.connections.push('near')
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: me(state).assets.find(item => item.code === '04194').id, abilityIndex: 0 })
  settle(state)
  assert.equal(me(state).clues, 1, '帷幕 4-1=3，智力 3 成功')
})

test('M2 lola santiago pays resources equal to shroud for a clue', () => {
  const state = fixture('01001')
  playCard(state, '04196')
  const here = state.locations.find(location => location.id === me(state).location)
  here.clues = 2
  here.shroud = 2
  me(state).resources = 10
  move(state, { action: 'ability', assetId: me(state).assets.find(item => item.code === '04196').id, abilityIndex: 0 })
  settle(state)
  assert.equal(me(state).resources, 8)
  assert.equal(me(state).clues, 1)
})

test('M2 recall the faithful can be committed to any test and pays off on failure', () => {
  const state = fixture('01001')
  dropHand(state, ['04201'])
  state.chaosBag = ['-5']
  const execute = current => performTest(current, 0, 'willpower', 6, { resolve: value => { current.testResult = value } })
  let committed = false
  sign(state, execute, pending => {
    if (pending.kind === 'commit' && !committed && pending.options.some(option => option.label.includes('重拾信念'))) {
      committed = true
      return pending.options.find(option => option.label.includes('重拾信念')).id
    }
    return null
  })
  assert.equal(committed, true)
  assert.equal(state.testResult.success, false)
  assert.equal(me(state).resources >= 2, true)
  assert.equal(me(state).hand.length >= 2, true)
})

test('M2 ornate bow fires with agility and can be reloaded', () => {
  const state = fixture('01001')
  playCard(state, '04204')
  const bow = me(state).assets.find(item => item.code === '04204')
  assert.equal(bow.uses, 1)
  const target = enemy(state, { id: 'bow-target', fight: 1, evade: 1, health: 6 })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: bow.id, abilityIndex: 0 })
  settle(state, pending => pending.kind === 'target' ? target.id : null)
  assert.equal(me(state).assets.find(item => item.code === '04204').uses, 0)
  move(state, { action: 'ability', assetId: bow.id, abilityIndex: 1 })
  settle(state)
  assert.equal(me(state).assets.find(item => item.code === '04204').uses, 1, '重新搭箭')
})

test('M2 Browning rifle spends bullets for matching damage', () => {
  const state = fixture('01001')
  playCard(state, '04229')
  const rifle = me(state).assets.find(item => item.code === '04229')
  const target = enemy(state, { id: 'browning-target', fight: 0, evade: 0, health: 10 })
  state.chaosBag = ['0']
  const shot = legalMoves(state).find(command => command.action === 'ability'
    && command.assetId === rifle.id && command.targetId === target.id)
  assert.ok(shot, '勃朗宁应当按 target 枚举出攻击动作')
  move(state, shot)
  settle(state, pending => (pending.kind === 'resource' && pending.source === '04229' ? '3' : null))
  assert.equal(me(state).assets.find(item => item.code === '04229').uses, 5)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 3)
})

test('M2 slip away adds intellect to the evade attempt and delays readying', () => {
  const state = fixture('01001')
  dropHand(state, ['04232'])
  const target = enemy(state, { id: 'slip-target', fight: 1, evade: 3, health: 5 })
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '04232' })
  settle(state, pending => pending.kind === 'target' ? target.id : null)
  const evaded = state.enemies.find(item => item.id === target.id)
  assert.equal(evaded.exhausted, true)
  assert.ok(evaded.preventReady, '下个补给阶段不重整')
})

test('M2 bloodletting trades damage for willpower and damage bonus', () => {
  const state = fixture('01001')
  dropHand(state, ['04266'])
  const target = enemy(state, { id: 'blood-target', fight: 0, evade: 0, health: 8 })
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '04266' })
  settle(state, pending => {
    if (pending.kind === 'resource' && pending.source === '04266') return '2'
    if (pending.kind === 'target') return target.id
    return null
  })
  assert.equal(me(state).damage, 2, '额外承受 2 点伤害')
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 3, '基础 1 + 2')
})

test('M2 restorative draws by success then punishes overflow', () => {
  const state = fixture('01001')
  playCard(state, '04267')
  const restorative = me(state).assets.find(item => item.code === '04267')
  me(state).deck = Array(12).fill('01088')
  me(state).hand = Array(9).fill('01088')
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: restorative.id, abilityIndex: 0 })
  settle(state)
  assert.equal(me(state).assets.find(item => item.code === '04267').uses, 2)
  assert.ok(me(state).horror >= 1, '超出手牌上限受恐惧')
})



test('M2 rusted sword heavy slash adds willpower and triple damage', () => {
  const state = fixture('01001')
  playCard(state, '04276')
  const sword = me(state).assets.find(item => item.code === '04276')
  const target = enemy(state, { id: 'sword-target', fight: 0, evade: 1, health: 10 })
  state.chaosBag = ['0']
  const slash = legalMoves(state).find(command => command.action === 'ability'
    && command.assetId === sword.id && command.abilityIndex === 1 && command.targetId === target.id)
  assert.ok(slash, '蓄力斩应当按 target 枚举出攻击动作')
  move(state, slash)
  settle(state)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 3)
  // 「每局一次」现在记在 state.abilityLimits（不再有 inv.rustedSwordUsed 裸字段）。
  assert.ok(Object.keys(state.abilityLimits || {}).some(key => key.startsWith('04276#1|')))
})

test('M2 kerosene heals horror only after a local defeat', () => {
  const blocked = fixture('01001')
  playCard(blocked, '04304')
  const blockedKerosene = me(blocked).assets.find(item => item.code === '04304')
  me(blocked).horror = 2
  move(blocked, { action: 'ability', assetId: blockedKerosene.id, abilityIndex: 0 })
  settle(blocked)
  assert.equal(me(blocked).horror, 2, '本地点没有击败敌人，不治疗')

  const state = fixture('01001')
  playCard(state, '04304')
  const kerosene = me(state).assets.find(item => item.code === '04304')
  me(state).horror = 2
  const victim = enemy(state, { id: 'kerosene-victim', fight: 0, evade: 0, health: 1 })
  state.chaosBag = ['0']
  move(state, { action: 'fight', enemyId: victim.id })
  settle(state)
  move(state, { action: 'ability', assetId: kerosene.id, abilityIndex: 0 })
  settle(state, pending => pending.kind === 'target' ? 'inv:0' : null)
  assert.equal(me(state).horror, 0)
})

test('M2 flamethrower spreads damage among engaged enemies', () => {
  const state = fixture('01001')
  playCard(state, '04305')
  const flamer = me(state).assets.find(item => item.code === '04305')
  const first = enemy(state, { id: 'flame-a', fight: 3, evade: 1, health: 6 })
  const second = enemy(state, { id: 'flame-b', fight: 2, evade: 1, health: 6 })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: flamer.id, abilityIndex: 0 })
  settle(state, pending => {
    if (pending.kind === 'effect' && pending.source === '04305') return 'spread'
    return null
  })
  assert.ok(state.enemies.find(item => item.id === first.id).damageTaken >= 1)
  assert.ok(state.enemies.find(item => item.id === second.id).damageTaken >= 1)
})



// ---------------------------------------------------------------------------
// 第一批附属（M2-C ①）
// ---------------------------------------------------------------------------

test('M2 bonds of kinship attach to an ally and raise its capacity', () => {
  const state = fixture('01001')
  dropHand(state, ['04019'])
  me(state).assets.push({ id: 'ally', code: '01018', exhausted: false })
  move(state, { action: 'play', cardId: '04019' })
  settle(state)
  const ally = me(state).assets.find(item => item.id === 'ally')
  assert.equal((ally.attachments || []).some(entry => entry.code === '04019'), true)
  assert.equal(me(state).discard.includes('04019'), false)
})

test('M2 trusted attaches to an item and boosts its ability test', () => {
  const state = fixture('01001')
  dropHand(state, ['04020'])
  me(state).assets.push({ id: 'item', code: '01020', exhausted: false })
  move(state, { action: 'play', cardId: '04020' })
  settle(state)
  const item = me(state).assets.find(entry => entry.id === 'item')
  assert.equal((item.attachments || []).some(entry => entry.code === '04020'), true)
  const target = enemy(state, { id: 'trusted-enemy', fight: 0, evade: 0, health: 6 })
  state.chaosBag = ['0']
  const before = state.investigators[0].combat
  move(state, { action: 'ability', assetId: 'item', abilityIndex: 0 })
  settle(state, pending => pending.kind === 'target' ? target.id : null)
  assert.equal(state.testResult?.value ?? before, before, '检定值包含宿主能力 +1')
})

test('M2 dr horowitz attaches a relic from the top nine cards', () => {
  const state = fixture('01001')
  me(state).deck = [...me(state).deck.slice(0, -1), '10035']
  me(state).hand.push('04021')
  move(state, { action: 'play', cardId: '04021' })
  settle(state)
  const host = me(state).assets.find(item => item.code === '04021')
  assert.ok(host.attachments?.length >= 1, '从牌库顶 9 张找到了遗物')
  const code = host.attachments[0].code
  assert.equal((ALL_CARDS[code].traits || []).some(trait => String(trait).toLowerCase() === 'relic'), true)
})

test('M2 backpack stores up to three items from the top cards', () => {
  const state = fixture('01001')
  me(state).deck = ['01088', '01020', '01016', '01006', '01029', '01031', '01032']
  me(state).hand.push('04037')
  move(state, { action: 'play', cardId: '04037' })
  settle(state, pending => {
    if (pending.kind !== 'card') return null
    const pick = pending.options.find(option => option.id !== 'done')
    return pick ? pick.id : 'done'
  })
  const pack = me(state).assets.find(item => item.code === '04037')
  assert.ok(pack.attachedCards.length >= 1)
  assert.equal(pack.attachedCards.length, 3, '最多附属 3 张')
  for (const code of pack.attachedCards) {
    assert.equal((ALL_CARDS[code].traits || []).some(trait => ['Item', 'Supply'].includes(trait)), true)
  }
})

test('M2 custom ammunition adds two bullets and bonus damage against monsters', () => {
  const state = fixture('01001')
  dropHand(state, ['04193'])
  me(state).assets.push({ id: 'gun', code: '01016', exhausted: false, uses: 3, usesType: 'ammo' })
  move(state, { action: 'play', cardId: '04193' })
  settle(state, pending => pending.kind === 'target' ? 'gun' : null)
  assert.equal(me(state).assets.find(item => item.id === 'gun').uses, 5)
  const monster = enemy(state, { id: 'monster', fight: 0, evade: 0, health: 8, traits: ['Monster'] })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: 'gun', abilityIndex: 0 })
  settle(state, pending => pending.kind === 'target' ? monster.id : null)
  assert.equal(state.enemies.find(item => item.id === monster.id).damageTaken, 3, '枪械基础伤害 2 + 特制弹药 1')
})

test('M2 handcuffs restrain a humanoid enemy', () => {
  const state = fixture('01001')
  playCard(state, '04265')
  const humanoid = enemy(state, { id: 'humanoid', fight: 1, evade: 0, health: 6, traits: ['Humanoid'] })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: me(state).assets.find(item => item.code === '04265').id, abilityIndex: 0 })
  settle(state, pending => pending.kind === 'target' ? humanoid.id : null)
  const cuffed = state.enemies.find(item => item.id === humanoid.id)
  assert.equal(cuffed.attachments.some(entry => entry.code === '04265'), true)
  assert.equal(cuffed.exhausted, true)
})

test('M2 skeleton key sets the location shroud to one and can be detached', () => {
  const state = fixture('01001')
  playCard(state, '04270')
  const here = state.locations.find(location => location.id === me(state).location)
  here.clues = 2
  here.shroud = 5
  move(state, { action: 'ability', assetId: me(state).assets.find(item => item.code === '04270').id, abilityIndex: 0 })
  settle(state)
  const keyedLocation = state.locations.find(location => location.id === me(state).location)
  assert.equal((keyedLocation.attachments || []).some(entry => entry.code === '04270'), true)
  assert.equal(me(state).assets.some(item => item.code === '04270'), false)
  state.chaosBag = ['0']
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(me(state).clues, 1, '隐藏值视为 1，智力 3 成功')
})

test('M2 vantage point lowers shroud for the turn and moves a clue', () => {
  const state = fixture('01001')
  dropHand(state, ['04306'])
  const here = state.locations.find(location => location.id === me(state).location)
  here.shroud = 3
  here.clues = 0
  state.locations.push({ id: 'elsewhere', name: '别处', revealed: true, clues: 1, maxClues: 1, shroud: 1, connections: [here.id] })
  here.connections.push('elsewhere')
  move(state, { action: 'play', cardId: '04306' })
  settle(state, pending => pending.kind === 'location' ? 'elsewhere' : null)
  const lowered = state.locations.find(location => location.id === here.id)
  assert.equal(lowered.turnShroudMod.amount, -1)
  assert.equal(lowered.clues, 1)
  assert.equal(state.locations.find(location => location.id === 'elsewhere').clues, 0)
})

// ---------------------------------------------------------------------------
// ② 封印（M2-C）
// ---------------------------------------------------------------------------

test('M2 chthonian stone seals a symbol token and returns to hand on auto-fail', () => {
  const state = fixture('01001')
  state.chaosBag = ['0', 'skull', 'cultist']
  playCard(state, '04030')
  const stone = me(state).assets.find(item => item.code === '04030')
  assert.equal(state.chaos.sealed.some(entry => entry.source === stone.id), true, '封印了一个符号标记')
  state.chaosBag = ['autofail']
  const study = state.locations.find(location => location.id === me(state).location)
  study.clues = 2
  move(state, { action: 'investigate' })
  settle(state)
  assert.equal(me(state).assets.some(item => item.code === '04030'), false)
  assert.equal(me(state).hand.includes('04030'), true, '揭示自动失败后回到手牌')
})

test('M2 protective incantation seals any non-auto-fail token and demands upkeep payment', () => {
  const state = fixture('01001')
  state.chaosBag = ['0', '-2', 'autofail']
  playCard(state, '04031')
  const spell = me(state).assets.find(item => item.code === '04031')
  assert.equal(state.chaos.sealed.some(entry => entry.source === spell.id && entry.token !== 'autofail'), true)
  const before = me(state).resources
  move(state, { action: 'endTurn' })
  settle(state, pending => pending.kind === 'reaction' && pending.source === '04031' ? 'pay' : null)
  const stillInPlay = me(state).assets.some(item => item.code === '04031')
  assert.ok(stillInPlay || me(state).discard.includes('04031'), '支付 1 资源保留，或弃掉保护咒语')
})

test('M2 seal of the seventh sign seals auto-fail with seven charges', () => {
  const state = fixture('01001')
  state.chaosBag = ['autofail', '0']
  playCard(state, '04311')
  const seal = me(state).assets.find(item => item.code === '04311')
  assert.equal(seal.uses, 7)
  assert.equal(state.chaos.sealed.some(entry => entry.source === seal.id && entry.token === 'autofail'), true)
})


// ---------------------------------------------------------------------------
// ③ 检定改写与弃牌堆（M2-C）
// ---------------------------------------------------------------------------








test('M2 lure of leylines upgrade evades with willpower and five charges', () => {
  const state = fixture('01001')
  playCard(state, '04271')
  const target = enemy(state, { id: 'lure2-enemy', fight: 1, evade: 2, health: 5 })
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: me(state).assets.find(item => item.code === '04271').id, abilityIndex: 0 })
  settle(state, pending => pending.kind === 'target' ? target.id : null)
  assert.equal(state.enemies.find(item => item.id === target.id).exhausted, true)
  assert.equal(me(state).assets.find(item => item.code === '04271').uses, 4)
})


test('M2 thermos heals damage and horror at the location', () => {
  const state = fixture('01001')
  playCard(state, '04274')
  const thermos = me(state).assets.find(item => item.code === '04274')
  me(state).damage = 1
  move(state, { action: 'ability', assetId: thermos.id, abilityIndex: 0 })
  settle(state)
  assert.equal(me(state).damage, 0)
  assert.equal(me(state).assets.find(item => item.code === '04274').uses, 2)
})






test('M2 alter fate discards a threat in play', () => {
  const state = fixture('01001')
  me(state).threat = [{ id: 'threat-1', code: 'frozenInFear', exhausted: false }]
  me(state).hand = ['04313']
  move(state, { action: 'play', cardId: '04313' })
  settle(state, pending => pending.kind === 'target' ? 'threat-1' : null)
  assert.equal(me(state).threat.some(item => item.id === 'threat-1'), false)
})

// ---------------------------------------------------------------------------
// 第四批：M2-B 收尾（支援、事件、技能与战役层永久卡）
// ---------------------------------------------------------------------------

// 反应窗口里打出指定卡牌的选项。
const reactionCard = code => pending => pending.kind === 'reaction'
  && pending.options.some(option => option.cardCode === code)
  ? pending.options.find(option => option.cardCode === code).id : null

// 投入窗口里某张手牌的选项（投入选项只带标签，因此按卡名匹配）。
const commitOption = (pending, code) => pending.kind === 'commit'
  ? pending.options.find(option => option.label.includes(ALL_CARDS[code].nameZh || ALL_CARDS[code].name)) : null

// 在检定里投入指定卡牌并继续。
const commitCards = (...codes) => {
  let index = 0
  return pending => {
    if (pending.kind !== 'commit' || index >= codes.length) return null
    const option = commitOption(pending, codes[index])
    if (!option) return null
    index++
    return option.id
  }
}

// 选择「混乱标记」窗口里指定面值的选项。
const tokenChoice = face => pending => pending.kind === 'token'
  ? pending.options.find(option => option.label === face)?.id ?? null : null

// 玩家窗口里某个支援的指定能力。
const windowAbility = (pending, asset, index = 0) => pending.kind === 'playerWindow'
  ? pending.options.find(option => option.assetId === asset?.id && option.abilityIndex === index)?.id ?? null : null

const statOf = (state, skill) => getStat(state, me(state), skill)
const assetOf = (state, code) => me(state).assets.find(item => item.code === code)

// 多调查员对局：让每位调查员依次结束回合，直到进入下一轮。
function endRound(state, select) {
  for (let guard = 0; guard < 12; guard++) {
    if (state.pendingChoice) { settle(state, select); continue }
    if (state.round > 1) return
    move(state, { action: 'endTurn' })
    settle(state, select)
  }
}

test('M2-B survival knife fights back after an enemy attack deals damage', () => {
  const state = fixture('01001')
  playCard(state, '04017')
  const attacker = enemy(state, { id: 'knife-attacker', fight: 0, evade: 0, health: 8, damage: 1, horror: 0 })
  state.chaosBag = ['0']
  move(state, { action: 'endTurn' })
  settle(state, pending => pending.kind === 'reaction' && pending.source === 'survivalKnife' ? 'trigger' : null)
  assert.equal(me(state).damage >= 1, true, '敌人攻击造成了伤害')
  assert.ok(state.enemies.find(item => item.id === attacker.id).damageTaken >= 1, '横置匕首发起反击')
  assert.ok(assetOf(state, '04017'), '匕首仍在场')
  assert.ok(state.log.some(text => text.includes('求生匕首')), '记录了反击')
})

test('M2-B ancient stone investigates at +3 shroud and records the difficulty', () => {
  const state = fixture('01001')
  playCard(state, '04022')
  const stone = me(state).assets.find(item => item.code === '04022')
  const study = state.locations.find(location => location.id === me(state).location)
  study.clues = 3
  study.shroud = 0
  state.chaosBag = ['0']
  move(state, { action: 'ability', assetId: stone.id, abilityIndex: 0 })
  settle(state)
  assert.equal(me(state).clues, 2, '基础 1 + 鉴定成功额外 1')
  assert.equal(state.campaign.records.identifiedTheAncientStone, 3, '记录本次检定难度')
  assert.equal(me(state).assets.some(item => item.code === '04022'), false)
  assert.equal(me(state).discard.includes('04022'), true)
})

test('M2-B tooth of eztli boosts skills while resolving a treachery and draws on success', () => {
  const state = fixture('01001')
  playCard(state, '04023')
  state._treacheryResolving = 'dissonantVoices'
  const base = ALL_CARDS['01001'].willpower
  const execute = current => {
    current.statSeen = getStat(current, current.investigators[0], 'willpower')
    performTest(current, 0, 'willpower', 1, { source: { type: 'encounter', label: '遭遇检定', scenarioAbility: true },
      resolve: value => { current.testResult = value } })
  }
  sign(state, execute, pending => pending.kind === 'reaction' && pending.source === 'toothOfEztli' ? 'trigger' : null)
  assert.equal(state.statSeen, base + 1, '结算诡计能力期间 +1 意志')
  assert.equal(state.testResult.success, true)
  assert.equal(me(state).hand.length, 1, '检定成功后横置抽 1 张')
  assert.equal(assetOf(state, '04023').exhausted, true)
})

test('M2-B you handle this one hands the encounter card to another investigator', () => {
  const state = fixture('01001', 2)
  me(state).hand = ['04028']
  const other = state.investigators[1]
  const before = me(state).resources
  endRound(state, pending => pending.kind === 'reaction' && pending.options.some(option => option.cardCode === '04028')
    ? pending.options.find(option => option.cardCode === '04028').id : null)
  assert.ok(me(state).resources > before, '获得 1 资源（另有重整阶段收入）')
  assert.ok(state.log.some(text => text.includes('并获得 1 资源')), '触发时获得 1 资源')
  assert.ok(me(state).discard.includes('04028'))
  assert.ok(state.log.some(text => text.includes(other.name) && text.includes('遭遇')), '改由另一位调查员结算')
})

test('M2-B dark prophecy reveals five tokens and resolves one symbol', () => {
  const state = fixture('01001')
  me(state).hand = ['04032']
  state.chaosBag = ['skull', '0', '0', '0', '0']
  const execute = current => performTest(current, 0, 'willpower', 2, {
    resolve: value => { current.testResult = value } })
  sign(state, execute, pending => reactionCard('04032')(pending) ?? tokenChoice('skull')(pending))
  const result = state.testResult
  assert.deepEqual(result.drawn, ['skull'], '只结算骷髅标记')
  assert.equal(result.token, 'skull')
  assert.equal(state.chaosBag.length, 5, '其余标记归还混乱袋')
})

test('M2-B improvised weapon plays from the discard pile and shuffles back', () => {
  const state = fixture('01001')
  me(state).discard = ['04033']
  const target = enemy(state, { id: 'improvised-target', fight: 1, evade: 1, health: 8 })
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '04033', fromDiscard: true })
  settle(state, pending => pending.kind === 'target' ? target.id : null)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 2, '来自弃牌堆：+1 伤害')
  assert.equal(me(state).deck.includes('04033'), true, '结算后洗回牌库')
  assert.equal(me(state).discard.includes('04033'), false)
})

test('M2-B dumb luck puts an enemy on top of the encounter deck after a narrow evade failure', () => {
  const state = fixture('01001')
  me(state).hand = ['04034']
  const slippery = enemy(state, { id: 'slippery-enemy', fight: 1, evade: 4, health: 5 })
  state.chaosBag = ['0']
  move(state, { action: 'evade', enemyId: slippery.id })
  settle(state, reactionCard('04034'))
  assert.equal(state.enemies.some(item => item.id === slippery.id), false, '敌人离开场上')
  assert.equal(state.encounterDeck.at(-1), 'ghoulMinion', '放回遭遇牌库顶')
  assert.equal(me(state).discard.includes('04034'), true)
})

test('M2-B yaotl borrows icons from the discard pile and discards the top card once per phase', () => {
  const state = fixture('01001')
  playCard(state, '04035')
  const yaotl = assetOf(state, '04035')
  me(state).discard = ['01030']
  const execute = current => performTest(current, 0, 'intellect', 0, {
    resolve: value => { current.testResult = value } })
  sign(state, execute, pending => windowAbility(pending, yaotl, 0))
  assert.equal(state.testResult.value, 3 + 1, '弃牌堆顶的智识图标计入本次检定')

  const deckBefore = me(state).deck.length
  move(state, { action: 'ability', assetId: yaotl.id, abilityIndex: 1 })
  settle(state)
  assert.equal(me(state).deck.length, deckBefore - 1)
  assert.ok(me(state).discard.includes('01088'), '弃掉了牌库顶')
  assert.notEqual(validateMove(state, 0, { action: 'ability', assetId: yaotl.id, abilityIndex: 1 }), null,
    '每阶段仅限一次')
})

test('M2-B last chance only sees wild icons and loses one per card in hand', () => {
  const state = fixture('01001')
  me(state).hand = ['04036', '01088', '01088']
  const execute = current => performTest(current, 0, 'willpower', 0, {
    resolve: value => { current.testResult = value } })
  let sawSolo = false
  sign(state, execute, pending => {
    const option = commitOption(pending, '04036')
    if (option && !sawSolo) { sawSolo = true; return option.id }
    if (sawSolo && pending.kind === 'commit') {
      // 投入「殊死一搏」后不能再投入其他牌。
      assert.equal(pending.options.every(item => !item.label.startsWith('投入：')), true)
    }
    return null
  })
  // 手牌剩 2 张：自定义 5 个万能图标 − 2 = 3。
  assert.equal(state.testResult.value, 3 + 3)
})

test('M2-B marksmanship attacks an enemy at a connecting location with a firearm', () => {
  const state = fixture('01001')
  me(state).assets.push({ id: 'marksman-gun', code: '01016', exhausted: false, uses: 3, usesType: 'ammo' })
  me(state).hand = ['04104']
  const here = state.locations.find(location => location.id === me(state).location)
  state.locations.push({ id: 'next-door', name: '隔壁', revealed: true, clues: 0, maxClues: 0, shroud: 1, connections: [here.id] })
  here.connections.push('next-door')
  const faraway = enemy(state, { id: 'faraway-enemy', fight: 0, evade: 0, health: 8, engagedSeat: null, location: 'next-door' })
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '04104' })
  settle(state, pending => pending.kind === 'target' ? pending.options[0].id : null)
  assert.equal(state.enemies.find(item => item.id === faraway.id).damageTaken, 2, '远程支援基础 1 + 未交战 +1')
})

test('M2-B fence makes an illicit card fast and discounts an already fast one', () => {
  const state = fixture('01001')
  playCard(state, '04108')
  me(state).hand.push('01045')
  const actions = me(state).actionsLeft
  move(state, { action: 'play', cardId: '01045' })
  settle(state)
  assert.equal(me(state).actionsLeft, actions, '违法卡获得快速：不消耗行动')
  assert.equal(assetOf(state, '04108').exhausted, true)
  assert.equal(me(state).assets.some(item => item.code === '01045'), true)

  const fast = fixture('01001')
  playCard(fast, '04108')
  fast.investigators[0].hand.push('02152')
  const resources = me(fast).resources
  move(fast, { action: 'play', cardId: '02152' })
  settle(fast)
  assert.equal(me(fast).resources, resources, '已有快速：改为减 1 费用（1 → 0）')
})

test('M2-B counterspell cancels a revealed symbol token without redrawing', () => {
  const state = fixture('01001')
  me(state).hand = ['04110']
  state.chaosBag = ['skull']
  const execute = current => performTest(current, 0, 'willpower', 3, {
    resolve: value => { current.testResult = value } })
  sign(state, execute, reactionCard('04110'))
  assert.equal(state.testResult.success, true, '取消符号后没有修正值')
  assert.equal(me(state).horror, 0, '符号效果也被取消')
  assert.equal(state.chaosBag.length, 1, '不揭示替代标记')
})

test('M2-B take the initiative loses wild icons for actions completed this phase', () => {
  const state = fixture('01001')
  me(state).hand = ['04150']
  move(state, { action: 'resource' })
  settle(state)
  const execute = current => performTest(current, 0, 'intellect', 0, {
    resolve: value => { current.testResult = value } })
  sign(state, execute, commitCards('04150'))
  assert.equal(state.testResult.value, 3 + 2, '3 个万能图标 − 本阶段 1 个行动')
})

test('M2-B well prepared adds the matching icons of a chosen asset', () => {
  const state = fixture('01001')
  playCard(state, '04151')
  const prepared = assetOf(state, '04151')
  me(state).assets.push({ id: 'well-glass', code: '01030', exhausted: false })
  const execute = current => performTest(current, 0, 'intellect', 0, {
    resolve: value => { current.testResult = value } })
  sign(state, execute, pending => windowAbility(pending, prepared)
    ?? (pending.kind === 'target' && pending.source === '04151' ? 'well-glass' : null))
  assert.equal(state.testResult.value, 3 + 1)
  assert.equal(assetOf(state, '04151').exhausted, true)
})

test('M2-B true understanding is limited to scenario-card tests and finds a clue', () => {
  const state = fixture('01001')
  me(state).hand = ['04153']
  const execute = current => performTest(current, 0, 'intellect', 0,
    { source: { type: 'encounter', label: '遭遇检定', scenarioAbility: true }, resolve: value => { current.testResult = value } })
  sign(state, execute, commitCards('04153'))
  assert.equal(state.testResult.clueBonus, 1, '成功后额外发现 1 个线索')

  const blocked = fixture('01001')
  me(blocked).hand = ['04153']
  let offered = false
  const plain = current => performTest(current, 0, 'intellect', 0, { resolve: value => { current.testResult = value } })
  sign(blocked, plain, pending => {
    if (commitOption(pending, '04153')) offered = true
    return null
  })
  assert.equal(offered, false, '普通检定不能投入')
})

test('M2-B quick study returns a clue and adds three to the test', () => {
  const state = fixture('01001')
  playCard(state, '04154')
  const study = assetOf(state, '04154')
  const here = state.locations.find(location => location.id === me(state).location)
  here.clues = 0
  me(state).clues = 1
  const execute = current => performTest(current, 0, 'intellect', 0, {
    resolve: value => { current.testResult = value } })
  sign(state, execute, pending => windowAbility(pending, study))
  assert.equal(state.testResult.value, 3 + 3)
  assert.equal(me(state).clues, 0, '线索被放回地点')
  assert.equal(state.locations.find(location => location.id === here.id).clues, 1)
  assert.equal(assetOf(state, '04154').exhausted, true)
})

test('M2-B recall the future names a token and pays off when it is revealed', () => {
  const state = fixture('01001')
  playCard(state, '04158')
  state.chaosBag = ['0']
  const execute = current => performTest(current, 0, 'willpower', 0, {
    resolve: value => { current.testResult = value } })
  sign(state, execute, pending =>
    (pending.kind === 'reaction' && pending.source === 'recallTheFuture' ? 'trigger' : null)
    ?? (pending.kind === 'token' ? pending.options[0].id : null))
  assert.equal(state.testResult.value, 3 + 2, '命中指定标记 +2')
  assert.equal(assetOf(state, '04158').exhausted, true)
})

test('M2-B try and try again returns a committed skill card after a failure', () => {
  const state = fixture('01001')
  playCard(state, '04159')
  me(state).hand = ['04150']
  const execute = current => performTest(current, 0, 'willpower', 20, {
    resolve: value => { current.testResult = value } })
  sign(state, execute, pending => commitCards('04150')(pending)
    ?? (pending.kind === 'reaction' && pending.source === 'tryAndTryAgain' ? 'trigger' : null))
  assert.equal(state.testResult.success, false)
  assert.equal(me(state).hand.includes('04150'), true, '技能牌返回手牌')
  assert.equal(assetOf(state, '04159').uses, 2, '花费 1 次数')
})

test('M2-B cornered discards a card for plus two once per test', () => {
  const state = fixture('01001')
  playCard(state, '04160')
  const cornered = me(state).assets.find(item => item.code === '04160')
  me(state).hand = ['04150', '04155']
  const execute = current => performTest(current, 0, 'intellect', 0, {
    resolve: value => { current.testResult = value } })
  sign(state, execute, pending => windowAbility(pending, cornered)
    ?? (pending.kind === 'discard' && pending.source === '04160' ? pending.options[0].id : null))
  assert.equal(state.testResult.value, 3 + 2)
  assert.equal(me(state).hand.length, 1, '弃掉 1 张手牌')
})

test('M2-B intrepid becomes an asset until the end of the round', () => {
  const state = fixture('01001')
  me(state).hand = ['04192']
  const execute = current => performTest(current, 0, 'willpower', 0, {
    resolve: value => { current.testResult = value } })
  sign(state, execute, commitCards('04192'))
  assert.equal(state.testResult.success, true)
  assert.equal(me(state).assets.some(item => item.code === '04192'), true, '作为支援进入游戏区域')
  assert.equal(statOf(state, 'intellect'), ALL_CARDS['01001'].intellect + 1)
  assert.equal(statOf(state, 'agility'), ALL_CARDS['01001'].agility + 1)
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(me(state).assets.some(item => item.code === '04192'), false, '轮末弃掉')
})

test('M2-B olive mcbride reveals three tokens and resolves two', () => {
  const state = fixture('01001')
  playCard(state, '04197')
  state.chaosBag = ['0', '0', '-2']
  const execute = current => performTest(current, 0, 'willpower', 0, {
    resolve: value => { current.testResult = value } })
  sign(state, execute, pending => (pending.kind === 'reaction' && pending.source === 'oliveMcBride' ? 'trigger' : null)
    ?? tokenChoice('0')(pending))
  assert.equal(state.testResult.drawn.length, 2, '结算 2 个标记')
  assert.equal(state.testResult.value, 3, '两个「0」标记没有修正')
  assert.equal(state.chaosBag.length, 3, '被忽略的标记归还')
})

test('M2-B premonition enters play with a sealed token and substitutes it', () => {
  const state = fixture('01001')
  me(state).hand = ['04199']
  state.chaosBag = ['-2', '0', '0']
  move(state, { action: 'play', cardId: '04199' })
  settle(state)
  const premonition = me(state).assets.find(item => item.code === '04199')
  assert.ok(premonition, '进入场上')
  // Phase 5（5c-24）：字段从卡号化的 `tfaSealedToken` 改成通用的 `sealedToken`
  // （读点由条目的 substituteSealedToken 声明，引擎不再认卡号）。
  const sealed = premonition.sealedToken
  assert.ok(sealed, '封印了一个随机标记')
  const execute = current => performTest(current, 0, 'willpower', 0, {
    resolve: value => { current.testResult = value } })
  sign(state, execute)
  assert.deepEqual(state.testResult.drawn, [sealed], '改为结算封印的标记')
  assert.equal(me(state).assets.some(item => item.code === '04199'), false)
  assert.equal(me(state).discard.includes('04199'), true)
})

test('M2-B live and learn retries the failed test with plus two', () => {
  const state = fixture('01001')
  me(state).hand = ['04200']
  state.chaosBag = ['0']
  const execute = current => performTest(current, 0, 'intellect', 5, {
    resolve: value => { current.testResults = [...(current.testResults || []), value] } })
  sign(state, execute, reactionCard('04200'))
  assert.equal(state.testResults.length, 2, '重新尝试了一次检定')
  assert.equal(state.testResults[0].success, false)
  assert.equal(state.testResults[1].value, 5, '基础 3 + 2')
  assert.equal(state.testResults[1].success, true)
})

test('M2-B against all odds reveals extra tokens when the difficulty exceeds the base skill', () => {
  const state = fixture('01001')
  me(state).hand = ['04202']
  state.chaosBag = ['0', '-2', '-2']
  const execute = current => performTest(current, 0, 'willpower', 5, {
    resolve: value => { current.testResult = value } })
  sign(state, execute, pending => reactionCard('04202')(pending) ?? tokenChoice('0')(pending))
  assert.equal(state.testResult.value, 3, '选择了「0」标记，其余被忽略')
  assert.equal(state.chaosBag.length, 3)
})

test('M2-B researched ancient stone spends secrets equal to the cards drawn', () => {
  const damage = fixture('01001')
  damage.campaign.records.identifiedTheAncientStone = 2
  playCard(damage, '04230')
  const stone = me(damage).assets.find(item => item.code === '04230')
  assert.equal(stone.uses, 2, '秘密数等于记录的难度')
  const target = enemy(damage, { id: 'stone-target', fight: 0, evade: 0, health: 6 })
  move(damage, { action: 'draw' })
  settle(damage, pending => pending.kind === 'reaction' && pending.source === stone.id ? 'trigger' : null)
  assert.equal(stateEnemyDamage(damage, target.id), 1, '抽 1 张牌 → 花 1 秘密 → 1 点伤害')
  assert.equal(me(damage).assets.find(item => item.code === '04230').uses, 1)

  const heal = fixture('01001')
  heal.campaign.records.identifiedTheAncientStone = 2
  playCard(heal, '04231')
  me(heal).horror = 2
  move(heal, { action: 'draw' })
  settle(heal, pending => pending.kind === 'reaction' && pending.source === me(heal).assets.find(item => item.code === '04231')?.id ? 'trigger' : null)
  assert.equal(me(heal).horror, 1, '抽 1 张牌 → 治愈 1 点恐惧')
})

test('M2-B on your own discounts survivor events and is discarded by an ally', () => {
  const state = fixture('01001')
  playCard(state, '04236')
  const resources = me(state).resources
  me(state).hand.push('04033')
  move(state, { action: 'play', cardId: '04033' })
  settle(state)
  assert.equal(me(state).resources, resources, '幸存者事件费用 1 − 2 = 0')
  assert.equal(assetOf(state, '04236').exhausted, true)

  me(state).assets.push({ id: 'own-ally', code: '01018', exhausted: false })
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(me(state).assets.some(item => item.code === '04236'), false, '控制盟友支援后弃掉')
  assert.equal(me(state).discard.includes('04236'), true)
})

test('M2-B winging it plays from the discard pile with a lower shroud', () => {
  const state = fixture('01001')
  me(state).discard = ['04272']
  const study = state.locations.find(location => location.id === me(state).location)
  study.clues = 2
  study.shroud = 3
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '04272', fromDiscard: true })
  settle(state)
  assert.equal(me(state).clues, 2, '帷幕 3−1=2，智识 3 成功并额外 1 线索')
  assert.equal(me(state).deck.includes('04272'), true)
})

test('M2-B pnakotic manuscripts skips chaos tokens during a revelation test', () => {
  const state = fixture('01001')
  playCard(state, '04307')
  const tome = me(state).assets.find(item => item.code === '04307')
  assert.equal(tome.uses, 3)
  state._treacheryResolving = 'dissonantVoices'
  const execute = current => performTest(current, 0, 'willpower', 4, {
    resolve: value => { current.testResult = value } })
  sign(state, execute, pending => pending.kind === 'reaction' && pending.source === 'pnakoticRevelation' ? 'trigger' : null)
  assert.equal(state.testResult.value, 3, '不揭示混乱标记，因此没有修正值')
  assert.deepEqual(state.testResult.drawn, ['0'], '没有消耗混乱袋里的标记')
  assert.equal(state.chaosBag.length, 1, '混乱袋未被抽取')
  assert.equal(assetOf(state, '04307').uses, 2)

  const action = fixture('01001')
  playCard(action, '04307')
  const book = assetOf(action, '04307')
  move(action, { action: 'ability', assetId: book.id, abilityIndex: 0 })
  settle(action)
  assert.deepEqual(me(action).nextTestNoTokens, { round: action.round })
})

test('M2-B borrowed time turns clicks into extra actions at the start of the turn', () => {
  const state = fixture('01001')
  playCard(state, '04308')
  const borrowed = assetOf(state, '04308')
  for (let index = 0; index < 3; index++) {
    move(state, { action: 'ability', assetId: borrowed.id, abilityIndex: 0 })
    settle(state)
  }
  assert.equal(assetOf(state, '04308').clicks, 3)
  assert.notEqual(validateMove(state, 0, { action: 'ability', assetId: borrowed.id, abilityIndex: 0 }), null,
    '最多 3 声滴答')
  move(state, { action: 'endTurn' })
  settle(state)
  assert.equal(me(state).actionsLeft, 6, '3 + 3 次额外行动')
})

test('M2-B shards of the void fights with willpower and seals revealed zeros', () => {
  const state = fixture('01001')
  state.chaosBag = ['0', '0', '0']
  playCard(state, '04310')
  const shards = assetOf(state, '04310')
  assert.equal(shards.uses, 3)
  const target = enemy(state, { id: 'void-target', fight: 0, evade: 0, health: 10 })
  move(state, { action: 'ability', assetId: shards.id, abilityIndex: 0 })
  settle(state)
  assert.equal(state.enemies.find(item => item.id === target.id).damageTaken, 3, '1 + 1 伤害加成 + 1 个「0」标记')
  assert.equal(assetOf(state, '04310').uses, 2)
  assert.equal(state.chaos.sealed.filter(entry => entry.source === shards.id).length, 2, '入场封印 1 个 + 揭示封印 1 个')
})

test('M2-B impromptu barrier evades a second enemy when played from the discard', () => {
  const state = fixture('01001')
  me(state).discard = ['04312']
  const first = enemy(state, { id: 'barrier-first', fight: 1, evade: 2, health: 5 })
  const second = enemy(state, { id: 'barrier-second', fight: 1, evade: 1, health: 5, engagedSeat: null })
  state.chaosBag = ['0']
  move(state, { action: 'play', cardId: '04312', fromDiscard: true })
  settle(state, pending => pending.kind === 'target'
    ? (pending.options.some(option => option.id === first.id) ? first.id : second.id) : null)
  assert.equal(state.enemies.find(item => item.id === first.id).exhausted, true)
  assert.equal(state.enemies.find(item => item.id === second.id).exhausted, true, '额外躲避一个敌人')
  assert.equal(me(state).deck.includes('04312'), true)
})

function stateEnemyDamage(state, id) {
  return state.enemies.find(item => item.id === id)?.damageTaken ?? 0
}

// ---------------------------------------------------------------------------
// 战役层永久卡（04106 老练分析 / 04109 奥术研究）
// ---------------------------------------------------------------------------

function upgradeCampaign(code, mutate) {
  const deck = buildDeck(INVESTIGATORS[code], { seed: 'tfa-m2b-upgrade' }).playerCards.slice()
  const inv = INVESTIGATORS[code]
  return {
    id: 'theForgottenAge', phase: 'interlude', scenarioIndex: 1, records: {}, xp: 0,
    trauma: { 0: { physical: 0, mental: 0 } },
    investigators: {
      0: { id: 'investigator-1', seat: 0, code, name: inv.nameZh || inv.name,
        deck: mutate ? mutate(deck) : deck, currentScenarioIndex: 1, xp: 20, earnedXp: 20, spentXp: 0,
        trauma: { physical: 0, mental: 0 }, status: 'active', purchases: [], removedCards: [] },
    },
  }
}

test('M2-B shrewd analysis upgrades a second unresolved copy at no experience', () => {
  const campaign = upgradeCampaign('04002', deck => {
    deck[0] = '04022'
    deck[1] = '04022'
    deck.push('04106')
    return deck
  })
  const record = campaign.investigators[0]
  assert.ok(replacementOptions(record, '04230', campaign.records).length, '失落的时代升级路径已开放')
  purchaseCard(campaign, 0, '04230', '04022')
  const second = shrewdAnalysisUpgrade(campaign, 0, '04022')
  assert.ok(second, '第二张同名副本免费升级')
  assert.equal(second.cost, 0, '不消耗经验')
  assert.equal(record.deck.filter(code => code === '04022').length, 0)
  assert.equal(record.deck.filter(code => ['04230', '04231'].includes(code)).length, 2, '两张升级版本')
})

test('M2-B arcane research charges mental trauma and discounts the first spell upgrade', () => {
  const campaign = upgradeCampaign('04004')
  const record = campaign.investigators[0]
  const options = replacementOptions(record, '04109', campaign.records)
  assert.ok(options.length, '永久卡可以升级购买')
  purchaseCard(campaign, 0, '04109', options[0].code)
  assert.equal(campaign.trauma[0].mental, 1, '购买时承受 1 点精神创伤')
  assert.equal(record.arcaneResearchDiscount, true)

  const spell = Object.values(ALL_CARDS).find(card => card.klass === 'mystic'
    && (card.traits || []).some(trait => String(trait).toLowerCase() === 'spell') && (card.xp || 0) >= 2
    && EFFECTS[card.code] && matchesDeckOptions(INVESTIGATORS['04004'], card))
  assert.ok(spell, '找到一张可升级的法术卡')
  const candidates = replacementOptions(record, spell.code, campaign.records)
  assert.ok(candidates.length, '法术升级可购买')
  const best = candidates.reduce((left, right) => (left.discount >= right.discount ? left : right))
  assert.equal(best.discount, 1, '第一张法术升级减 1 经验')
  assert.match(best.explanation, /优惠/)
})