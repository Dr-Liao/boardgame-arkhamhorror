import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, play, settle, legalMoves, validateMove } from './core-fixture.mjs'
import { performTest, drawCards, reactionWindow, drawEncounter, advanceAgenda, runMythos, enemyPhase, damageEnemy, playerWindow, descriptorSources } from '../src/engine/engine.js'
import { resolveTransaction, choiceError } from '../src/engine/resolution.js'
import { randomValue } from '../src/engine/rules-state.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
function tx(state, run, select = () => null) {
  let result
  const execute = draft => { result = run(draft); return result }
  resolveTransaction(state, 0, { action: 'ticSurvivorTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 120, JSON.stringify(state.pendingChoice))
    const c = state.pendingChoice
    const id = select(c, state) ?? ['done', 'skip', 'self'].find(id => c.options.some(o => o.id === id)) ?? c.options[0].id
    const command = { action: 'choose', choiceId: c.id, optionId: id }
    assert.equal(choiceError(state, c.seat, command), null)
    resolveTransaction(state, c.seat, command, execute)
  }
  return result
}
const first=c=>c.options.find(o=>o.id.startsWith('desc:'))?.id
const count=(s,t)=>s.chaosBag.filter(x=>x===t).length

test('P6 07034 Keep Faith fast play uses finite bless pool and no action',()=>{const s=fixture();s.chaosBag.push(...Array(8).fill('bless'));const inv=s.investigators[0],a=inv.actionsLeft;play(s,'07034');settle(s);assert.equal(s.investigators[0].actionsLeft,a);assert.equal(count(s,'bless'),10);assert.equal(s.investigators[0].resources,28);assert.ok(s.investigators[0].discard.includes('07034'))})
test('P6 07037 Tempt Fate then branch needs full three curses; full bless still draws',()=>{for(const room of [2,3]){const s=fixture();s.chaosBag.push(...Array(10-room).fill('curse'));play(s,'07037');settle(s);assert.equal(count(s,'curse'),10);assert.equal(count(s,'bless'),room===3?3:0);assert.equal(s.investigators[0].hand.length,room===3?1:0)}const s=fixture();s.chaosBag.push(...Array(10).fill('bless'));play(s,'07037');settle(s);assert.equal(s.investigators[0].hand.length,1);assert.equal(count(s,'bless'),10)})
test('P6 07039 Dread Curse actual weakness draw adds up to five and is discarded',()=>{const s=fixture();s.chaosBag.push(...Array(8).fill('curse'));s.investigators[0].deck=['07039'];tx(s,d=>drawCards(d,d.investigators[0],1,[]));assert.equal(count(s,'curse'),10);assert.ok(s.investigators[0].discard.includes('07039'));assert.ok(!s.investigators[0].hand.includes('07039'))})
test('P6 07035 Predestined any test max one; failure add bless or remove only bag curses', () => {
  for (const option of ['bless', 'curse']) {
    const state = fixture(); state.chaosBag = ['0', 'curse', 'curse']; firstToken(state, '0')
    state.investigators[0].hand = ['07035', '07035']
    tx(state, d => performTest(d, 0, 'intellect', 100, {}), (c, d) => {
      if (c.kind === 'commit') return commitOne(c, d, '07035')
      if (c.source === '07035') { assert.ok(c.options.some(o => o.id === option)); return option }
      return null
    })
    assert.equal(state.lastTestResult.success, false)
    assert.equal(state.investigators[0].hand.filter(code => code === '07035').length, 1)
    assert.equal(count(state, 'bless'), option === 'bless' ? 2 : 0)
    assert.equal(count(state, 'curse'), option === 'curse' ? 0 : 2)
  }
  const success = fixture(); success.chaosBag = ['0', 'curse', 'curse']; firstToken(success, '0')
  success.investigators[0].hand = ['07035']
  tx(success, d => performTest(d, 0, 'intellect', 0, {}), (c, d) => commitOne(c, d, '07035'))
  assert.equal(success.lastTestResult.success, true)
  assert.equal(count(success, 'bless'), 0); assert.equal(count(success, 'curse'), 2)
})

test('P6 07033 Token of Faith any completed test includes cancelled curses, capped pool and exhaustion',()=>{const s=fixture('01001',2),a=asset(s,'07033');s.investigators[1].location='remote';tx(s,d=>reactionWindow(d,'testEnds',{when:'testEnds',seat:1,result:{drawn:['curse','0'],cancelledTokens:['autofail','curse']}},[]),first);assert.equal(count(s,'bless'),3);assert.equal(s.investigators[0].assets.find(x=>x.id===a.id).exhausted,true);tx(s,d=>reactionWindow(d,'testEnds',{when:'testEnds',seat:1,result:{drawn:['curse']}},[]),first);assert.equal(count(s,'bless'),3)})
test('P6 07122 Ancient Covenant stops local bless while keeping +2, excludes remote tests and exhausted source', () => {
  const state = fixture(), card = asset(state, '07122'); state.chaosBag = ['bless', '0']; firstToken(state, 'bless')
  tx(state, d => performTest(d, 0, 'intellect', 0, {}), first)
  assert.deepEqual(state.lastTestResult.drawn, ['bless'])
  assert.equal(state.lastTestResult.value, state.investigators[0].intellect + 2)
  assert.equal(state.investigators[0].assets.find(a => a.id === card.id).exhausted, true)
  for (const remote of [true, false]) {
    const t = fixture('01001', 2), covenant = asset(t, '07122', { exhausted: !remote })
    const seat = remote ? 1 : 0
    if (remote) t.investigators[1].location = 'remote'
    t.chaosBag = ['bless', '0']; firstToken(t, 'bless')
    tx(t, d => performTest(d, seat, 'intellect', 0, {}), first)
    assert.deepEqual(t.lastTestResult.drawn, ['bless', '0'])
    assert.equal(t.investigators[0].assets.find(a => a.id === covenant.id).exhausted, !remote)
  }
})

test('P6 07230 Harmony Restored removes only up to bag bless count and gains actual resources',()=>{const s=fixture();s.chaosBag.push('bless','bless','curse','curse','curse');const r=s.investigators[0].resources;play(s,'07230');settle(s);assert.equal(count(s,'curse'),1);assert.equal(count(s,'bless'),2);assert.equal(s.investigators[0].resources,r-3+2);const empty=fixture();empty.chaosBag=['0','curse','curse'];play(empty,'07230');settle(empty);assert.equal(count(empty,'curse'),2);assert.equal(empty.investigators[0].resources,27)})


test('P6 07121 Mariners Compass bonus clue depends on resources at success, boosts are limited to three',()=>{for(const resources of [0,3,4]){const s=fixture(),inv=s.investigators[0],a=asset(s,'07121');inv.resources=resources;const loc=s.locations.find(l=>l.id===inv.location);loc.clues=6;loc.shroud=0;move(s,{action:'ability',assetId:a.id,abilityIndex:0});settle(s,c=>c.kind==='playerWindow'?c.options.find(o=>o.assetId===a.id&&o.abilityIndex===1||o.id==='free-descriptor:07121:1')?.id:null);assert.equal(s.lastTestResult.source.assetId,a.id);assert.equal(s.investigators[0].resources,resources===4?1:0);assert.equal(s.investigators[0].clues,resources===4?1:2);assert.equal(s.lastTestResult.value,s.investigators[0].intellect+Math.min(3,resources));assert.equal(s.investigators[0].assets.find(x=>x.id===a.id).exhausted,true)}})
test('P6 07197 Signum Crucis uses base skill excluding passive bonuses and cannot help others', () => {
  const state = fixture(); asset(state, '01018'); state.investigators[0].hand = ['07197']
  const base = state.investigators[0].combat, removed = state.chaos.removed.filter(face => face === 'bless').length
  tx(state, d => performTest(d, 0, 'combat', base + 1, {}), (c, d) => commitOne(c, d, '07197'))
  assert.equal(count(state, 'bless') + state.chaos.removed.filter(face => face === 'bless').length - removed, 1,
    'one bless is added, including one revealed and consumed during this actual test')
  assert.ok(state.investigators[0].discard.includes('07197'))
  const t = fixture(); t.investigators[0].hand = ['07197']
  tx(t, d => performTest(d, 0, 'combat', base, {}), (c, d) => {
    if (c.kind === 'commit') assert.ok(!c.options.some(o => /^\d+$/.test(o.id) && d.investigators[c.seat].hand[Number(o.id)] === '07197'))
    return null
  })
  assert.equal(count(t, 'bless'), 0)
})

test('P6 07309 Jacob Morrison failure bonus works and own bless can ready exhausted Jacob',()=>{const s=fixture(),a=asset(s,'07309');tx(s,d=>performTest(d,0,'combat',d.investigators[0].combat+1,{}),first);assert.equal(s.lastTestResult.success,true);assert.equal(s.investigators[0].assets.find(x=>x.id===a.id).exhausted,true);s.chaosBag=['bless','0'];firstToken(s,'bless');tx(s,d=>performTest(d,0,'combat',0,{}),first);assert.equal(s.investigators[0].assets.find(x=>x.id===a.id).exhausted,false);const upkeep=fixture();normalAgendas(upkeep);const captain=asset(upkeep,'07309',{exhausted:true});move(upkeep,{action:'endTurn'});settle(upkeep);assert.equal(upkeep.investigators[0].assets.find(a=>a.id===captain.id).exhausted,true,'Jacob stays exhausted through actual upkeep')})
test('P6 07270 Dig Deep spends its own resources during matching tests and replenishes without losing excess', () => {
  const state = fixture(), card = asset(state, '07270'); state.investigators[0].resources = 0
  let activations = 0
  tx(state, d => performTest(d, 0, 'willpower', 0, {}), (c, d) => {
    if (c.kind === 'playerWindow') {
      const source = d.investigators[0].assets.find(a => a.id === card.id)
      const option = c.options.find(o => o.assetId === card.id || o.id === 'free-descriptor:07270:1')
      if (source.uses > 0 && activations < 2 && option) { activations++; return option.id }
      return 'skip'
    }
    if (c.source === card.id && c.options.some(o => o.id === 'asset')) return 'asset'
    return null
  })
  assert.equal(state.lastTestResult.value, state.investigators[0].willpower + 2)
  assert.equal(state.investigators[0].assets.find(a => a.id === card.id).uses, 0)
  tx(state, d => reactionWindow(d, 'roundStarts', { when: 'roundStarts' }, []))
  assert.equal(state.investigators[0].assets.find(a => a.id === card.id).uses, 2)
  state.investigators[0].assets.find(a => a.id === card.id).uses = 4
  tx(state, d => reactionWindow(d, 'roundStarts', { when: 'roundStarts' }, []))
  assert.equal(state.investigators[0].assets.find(a => a.id === card.id).uses, 4)
  const u = fixture(), wrongSkill = asset(u, '07270'); u.investigators[0].resources = 0
  tx(u, d => performTest(d, 0, 'combat', 0, {}), c => {
    if (c.kind === 'playerWindow') assert.ok(!c.options.some(o => o.assetId === wrongSkill.id))
    return null
  })
  assert.equal(u.investigators[0].assets.find(a => a.id === wrongSkill.id).uses, 2)
  assert.equal(u.lastTestResult.value, u.investigators[0].combat)
})

test('P6 07162 Manipulate Destiny returns inspected tokens, avoids opportunity attack, damages or heals real target',()=>{const s=fixture(),e=enemy(s,{damage:1});s.chaosBag=['curse'];play(s,'07162');settle(s);assert.equal(s.enemies.find(x=>x.id===e.id).damageTaken,2);assert.equal(s.investigators[0].damage,0);assert.deepEqual(s.chaosBag,['curse']);const t=fixture();t.chaosBag=['bless'];t.investigators[0].damage=3;play(t,'07162');settle(t);assert.equal(t.investigators[0].damage,1);assert.deepEqual(t.chaosBag,['bless']);const u=fixture(),a=asset(u,'01018',{damage:1});u.chaosBag=['eldersign'];play(u,'07162');settle(u);assert.equal(u.investigators[0].assets.find(x=>x.id===a.id).damage,0);const v=fixture();v.chaosBag=['0'];play(v,'07162');settle(v);assert.deepEqual(v.chaosBag,['0'])})


// These helpers choose actual options produced by the server. No card behavior is mocked.
const committedCodes = result => (result.committed || []).map(item => typeof item === 'string' ? item : item.code)
function handOption(choice, state, code) {
  return choice.options.find(option => option.cardCode === code
    || (/^\d+$/.test(option.id) && state.investigators[choice.seat].hand[Number(option.id)] === code))?.id
}
function commitOne(choice, state, code) {
  if (choice.kind !== 'commit') return null
  return state.skillTest.committed.some(item => item.code === code) ? 'done' : handOption(choice, state, code) || 'done'
}
function reactionCard(choice, state, code) {
  return choice.kind === 'reaction' ? handOption(choice, state, code) : null
}
function firstToken(state, face) {
  const index = state.chaosBag.indexOf(face)
  assert.ok(index >= 0)
  // Find a fixture seed using the production deterministic RNG, without duplicating it.
  for (let seed = 0; seed < 10000; seed++) {
    if (Math.floor(randomValue({ rngState: seed }) * state.chaosBag.length) === index) {
      state.rngState = seed
      return
    }
  }
  throw new Error('No fixture seed found')
}
function sealing(choice, countWanted, goodOnly = false) {
  if (choice.kind === 'effect' && choice.prompt.includes('选择封印标记数量')) return String(countWanted)
  if (choice.kind !== 'mechanic' || choice.source?.operation !== 'seal') return null
  if (choice.source.selectedCount >= countWanted) return 'confirm'
  return choice.options.find(option => option.id.startsWith('pick:') && !option.selected
    && (!goodOnly || ['+1', '0', 'bless', 'eldersign'].includes(option.token)))?.id
}
function normalAgendas(state) {
  state.agendaIndex = 0
  state.doom = 0
  state.agendas = [1, 2].map(stage => ({ id: `p6-test-agenda-${stage}`, code: `p6TestAgenda${stage}`,
    stage, name: `测试密谋 ${stage}`, text: '', doomThreshold: 99 }))
}

test('P6 07036 Beloved real hand commitment replaces bless, removes physical skill, stops reveal and retains token', () => {
  const s = fixture()
  s.investigators[0].hand = ['07036']
  s.chaosBag = ['bless', '0']; firstToken(s, 'bless')
  const actual = tx(s, d => performTest(d, 0, 'willpower', 100, {}), (c, d) =>
    commitOne(c, d, '07036') || reactionCard(c, d, '07036'))
  assert.equal(s.lastTestResult.success, true)
  assert.deepEqual(s.lastTestResult.drawn, ['bless'])
  assert.equal(count(s, 'bless'), 1, 'replacement returns this actual bless after the test')
  assert.equal((s.removedFromGame || []).filter(code => code === '07036').length, 1)
  assert.ok(!s.investigators[0].hand.includes('07036'))
  assert.ok(!s.investigators[0].discard.includes('07036'))
  assert.ok(!committedCodes(actual).includes('07036'), 'removed skill contributes no final commitment')
  const t = fixture(); t.investigators[0].hand = ['07036']; t.chaosBag = ['bless', '0']; firstToken(t, 'bless')
  tx(t, d => performTest(d, 0, 'willpower', 100, {}), (c, d) => commitOne(c, d, '07036'))
  assert.equal(t.lastTestResult.success, false, 'declining the reaction keeps normal resolution')
  assert.ok(t.investigators[0].discard.includes('07036'))
  assert.ok(!(t.removedFromGame || []).includes('07036'))
  assert.equal(count(t, 'bless'), 0)
})

test('P6 07038 Accursed Follower actual weakness spawns farthest aloof, curses at actual enemy-phase end, stops after defeat', () => {
  const s = fixture()
  s.locations = ['a', 'b', 'c'].map((id, index) => ({ id, name: id, revealed: true, clues: 0, shroud: 0,
    connections: ['a', 'b', 'c'].filter((_, other) => Math.abs(other - index) === 1) }))
  s.investigators[0].location = 'a'; s.investigators[0].deck = ['07038']
  tx(s, d => drawCards(d, d.investigators[0], 1, []))
  const follower = s.enemies.find(card => card.code === '07038')
  assert.ok(follower); assert.equal(follower.location, 'c'); assert.equal(follower.aloof, true)
  assert.equal(follower.engagedSeat, null)
  assert.ok(!s.investigators[0].discard.includes('07038'))
  tx(s, d => enemyPhase(d))
  assert.equal(count(s, 'curse'), 1)
  s.chaosBag = ['0', ...Array(9).fill('curse')]
  tx(s, d => enemyPhase(d)); assert.equal(count(s, 'curse'), 10)
  tx(s, d => damageEnemy(d, d.enemies.find(e => e.id === follower.id), 100, 0, [], 'test'))
  assert.ok(!s.enemies.some(e => e.id === follower.id))
  s.chaosBag = ['0']
  tx(s, d => enemyPhase(d)); assert.equal(count(s, 'curse'), 0)
})

test('P6 07040 Day of Reckoning actual draw attaches one weakness and agenda advancement releases sealed eldersign', () => {
  for (const hasSign of [true, false]) {
    const s = fixture(); normalAgendas(s)
    s.chaosBag = hasSign ? ['0', 'eldersign'] : ['0']
    s.investigators[0].deck = ['07040']
    tx(s, d => drawCards(d, d.investigators[0], 1, []))
    const attached = s.agendas[0].attachments?.find(card => card.code === '07040')
    assert.ok(attached); assert.equal(attached.ownerSeat, 0)
    assert.ok(!s.investigators[0].discard.includes('07040'), 'there is exactly one physical attached weakness')
    assert.ok(!s.investigators[0].hand.includes('07040'))
    assert.equal(s.chaos.sealed.filter(token => token.source === attached.id).length, hasSign ? 1 : 0)
    tx(s, d => advanceAgenda(d, []))
    assert.equal(s.agendaIndex, 1)
    assert.equal(s.chaos.sealed.filter(token => token.source === attached.id).length, 0)
    assert.equal(s.chaosBag.filter(face => face === 'eldersign').length, hasSign ? 1 : 0)
    assert.equal(s.investigators[0].discard.filter(code => code === '07040').length, 1)
  }
})

test('P6 07160 Butterfly Effect late commit and withdrawal change actual icons and success rewards; numeric reveal cannot play', () => {
  for (const operation of ['commit', 'return']) {
    const s = fixture(); s.chaosBag = ['skull']; s.investigators[0].hand = ['07160', '01090']
    const actual = tx(s, d => performTest(d, 0, 'intellect', 0, {}), (c, d) => {
      if (c.kind === 'commit') return operation === 'return' ? commitOne(c, d, '01090') : 'done'
      if (c.source === 'lateCommit') return c.options.find(option => option.id.startsWith(operation + ':'))?.id
      return reactionCard(c, d, '07160')
    })
    assert.ok(s.investigators[0].discard.includes('07160'))
    if (operation === 'commit') {
      assert.ok(committedCodes(actual).includes('01090'))
      assert.equal(s.lastTestResult.value, s.investigators[0].intellect + 2)
      assert.ok(s.investigators[0].discard.includes('01090'))
      assert.equal(s.investigators[0].hand.filter(code => code === '01088').length, 1)
    } else {
      assert.ok(!committedCodes(actual).includes('01090'))
      assert.equal(s.lastTestResult.value, s.investigators[0].intellect)
      assert.ok(s.investigators[0].hand.includes('01090'))
      assert.equal(s.investigators[0].hand.filter(code => code === '01088').length, 0)
    }
  }
  const t = fixture(); t.investigators[0].hand = ['07160']; t.chaosBag = ['0']
  tx(t, d => performTest(d, 0, 'intellect', 0, {}), (c, d) => reactionCard(c, d, '07160'))
  assert.ok(t.investigators[0].hand.includes('07160'))
})

test('P6 07161 Third Times a Charm actual test allows exactly two physical cancel-return-redraws and excludes remote play', () => {
  const s = fixture(); s.investigators[0].hand = ['07161']; s.chaosBag = ['0']
  const actual = tx(s, d => performTest(d, 0, 'combat', 0, {}), (c, d) =>
    c.source === 'tokenRedraws' ? 'redraw' : reactionCard(c, d, '07161'))
  assert.deepEqual(actual.cancelledTokens, ['0', '0'])
  assert.deepEqual(s.lastTestResult.drawn, ['0'])
  assert.deepEqual(s.chaosBag, ['0'])
  assert.equal(s.investigators[0].resources, 29)
  assert.equal(s.investigators[0].discard.filter(code => code === '07161').length, 1)
  const t = fixture('01001', 2); t.investigators[1].location = 'remote'; t.investigators[1].hand = ['07161']
  const remote = tx(t, d => performTest(d, 0, 'combat', 0, {}), (c, d) => reactionCard(c, d, '07161'))
  assert.ok(t.investigators[1].hand.includes('07161'))
  assert.equal(remote.cancelledTokens.length, 0)
})

test('P6 07196 Unrelenting actual seal selection draws only for three good faces, releases even after late withdrawal', () => {
  for (const mode of ['good', 'two', 'bad', 'withdraw']) {
    const s = fixture()
    s.investigators[0].hand = mode === 'withdraw' ? ['07196', '07160'] : ['07196']
    s.chaosBag = mode === 'two' ? ['0', '+1', 'autofail']
      : mode === 'bad' ? ['0', '+1', '-1', 'autofail'] : ['0', '+1', 'bless', mode === 'withdraw' ? 'skull' : 'autofail']
    const original = [...s.chaosBag].sort()
    const actual = tx(s, d => performTest(d, 0, 'willpower', 0, {}), (c, d) => {
      if (c.kind === 'commit') return commitOne(c, d, '07196')
      const seal = sealing(c, mode === 'two' ? 2 : 3, mode !== 'bad')
      if (seal) return seal
      if (mode === 'withdraw' && c.source === 'lateCommit') return c.options.find(option => option.id.startsWith('return:'))?.id
      return mode === 'withdraw' ? reactionCard(c, d, '07160') : null
    })
    assert.equal(s.chaos.sealed.length, 0)
    assert.deepEqual([...s.chaosBag].sort(), original)
    assert.equal(s.investigators[0].hand.filter(code => code === '01088').length, ['good', 'withdraw'].includes(mode) ? 2 : 0)
    if (mode === 'withdraw') {
      assert.ok(s.investigators[0].hand.includes('07196'))
      assert.ok(!committedCodes(actual).includes('07196'))
    }
  }
})

test('P6 07229 Spirit of Humanity pays assignable combined harm or exact two curses before healing, with exhaustion and failed preflight', () => {
  const s = fixture(), spirit = asset(s, '07229'), ally = asset(s, '01018')
  const actions = s.investigators[0].actionsLeft
  move(s, { action: 'ability', assetId: spirit.id, abilityIndex: 0 })
  settle(s, c => c.kind.startsWith('assign-') && c.options.some(option => option.id === ally.id) ? ally.id : null)
  assert.equal(s.investigators[0].damage, 0)
  assert.equal(s.investigators[0].horror, 0)
  assert.equal(s.investigators[0].assets.find(card => card.id === ally.id).damage, 1)
  assert.equal(s.investigators[0].assets.find(card => card.id === ally.id).horror, 1)
  assert.equal(count(s, 'bless'), 2)
  assert.equal(s.investigators[0].assets.find(card => card.id === spirit.id).exhausted, true)
  assert.equal(s.investigators[0].actionsLeft, actions)
  assert.ok(!legalMoves(s, 0).some(m => m.assetId === spirit.id))
  s.investigators[0].assets.find(card => card.id === spirit.id).exhausted = false
  s.investigators[0].damage = 1; s.investigators[0].horror = 1
  s.chaosBag = ['0', ...Array(9).fill('curse')]
  const command = { action: 'ability', assetId: spirit.id, abilityIndex: 1 }
  assert.ok(validateMove(s, 0, command), 'one free curse token is insufficient for a cost of two')
  assert.equal(s.investigators[0].assets.find(card => card.id === spirit.id).exhausted, false)
  assert.equal(count(s, 'curse'), 9)
  s.chaosBag = ['0', ...Array(8).fill('curse')]
  move(s, command); settle(s)
  assert.equal(count(s, 'curse'), 10)
  assert.equal(s.investigators[0].damage, 0); assert.equal(s.investigators[0].horror, 0)
  assert.equal(s.investigators[0].assets.find(card => card.id === spirit.id).exhausted, true)
  assert.equal(s.investigators[0].actionsLeft, actions)
})

test('P6 07269 A Watchful Peace pays five bag/sealed bless and skips real multiplayer mythos encounter draws only; four cannot pay', () => {
  const s = fixture('01001', 2); normalAgendas(s)
  s.investigators[0].hand = ['07269']; s.chaosBag = ['0', ...Array(5).fill('bless')]
  const favor = asset(s, '07272')
  assert.equal(createMechanicsApi(s).chaosTokens.seal(favor.id, 'bless', 2), 2)
  const encounterCount = s.encounterDeck.length, round = s.round
  tx(s, d => runMythos(d), (c, d) => reactionCard(c, d, '07269'))
  assert.equal(s.round, round + 1); assert.equal(s.doom, 1, 'the ordinary doom step is preserved')
  assert.equal(s.encounterDeck.length, encounterCount)
  assert.equal(count(s, 'bless'), 0); assert.equal(s.chaos.sealed.length, 0)
  assert.equal(s.investigators[0].resources, 29)
  assert.equal(s.investigators[0].discard.filter(code => code === '07269').length, 1)
  assert.ok(!s.investigators[0].assets.some(card => card.id === favor.id), 'paying the last sealed token discards Favor')
  const t = fixture('01001', 2); normalAgendas(t)
  t.investigators[0].hand = ['07269']; t.chaosBag = ['0', ...Array(4).fill('bless')]
  const before = t.encounterDeck.length
  tx(t, d => runMythos(d), (c, d) => {
    assert.ok(!reactionCard(c, d, '07269'), 'insufficient token cost must not offer the quick event')
    return null
  })
  assert.equal(t.encounterDeck.length, before - 2)
  assert.ok(t.investigators[0].hand.includes('07269'))
  assert.equal(t.investigators[0].resources, 30); assert.equal(count(t, 'bless'), 4)
})

for (const [code, face, price] of [['07271', 'curse', 1], ['07272', 'bless', 2]]) {
  test(`P6 ${code} Favor real fast play seals a physical token, substitutes before bag reveal, consumes it and discards empty source`, () => {
    const s = fixture(); s.chaosBag = [face, '0']
    const actions = s.investigators[0].actionsLeft
    play(s, code); settle(s, c => sealing(c, 1))
    const favor = s.investigators[0].assets.find(card => card.code === code)
    assert.ok(favor); assert.equal(s.chaos.sealed.filter(item => item.source === favor.id).length, 1)
    assert.equal(s.investigators[0].actionsLeft, actions)
    assert.deepEqual(s.chaosBag, ['0'])
    tx(s, d => performTest(d, 0, 'combat', 0, {}), (c, d) => reactionCard(c, d, code))
    assert.deepEqual(s.lastTestResult.drawn, [face, '0'])
    assert.equal(s.chaos.sealed.length, 0)
    assert.deepEqual(s.chaosBag, ['0'], 'bless/curse follows the normal token consumption rule')
    assert.ok(!s.investigators[0].assets.some(card => card.id === favor.id))
    assert.equal(s.investigators[0].discard.filter(item => item === code).length, 1)
    assert.equal(s.investigators[0].resources, 30 - price + (code === '07271' ? 1 : 0))
    const t = fixture(); t.chaosBag = [face, '0']
    play(t, code); settle(t, c => sealing(c, 0))
    assert.ok(!t.investigators[0].assets.some(card => card.code === code))
    assert.equal(t.investigators[0].discard.filter(item => item === code).length, 1)
    assert.equal(t.chaos.sealed.length, 0)
    assert.deepEqual(t.chaosBag, [face, '0'])
  })
}

test('P6 07273 Purifying Corruption cancels real revelations, pays combined harm, removes at three, draws encounter before choice and excludes weaknesses', () => {
  const s = fixture(), corruption = asset(s, '07273')
  const previousTest = s.lastTestResult
  for (let i = 1; i <= 3; i++) {
    s.encounterDeck = ['rottingRemains']
    tx(s, d => drawEncounter(d, d.investigators[0], []), (c, d) => reactionCard(c, d, '07273'))
    assert.equal(s.investigators[0].damage, i); assert.equal(s.investigators[0].horror, i)
    assert.deepEqual(s.lastTestResult, previousTest, 'the cancelled revelation never performs its willpower test')
    if (i < 3) assert.equal(s.investigators[0].assets.find(card => card.id === corruption.id).uses, i)
  }
  assert.ok(!s.investigators[0].assets.some(card => card.id === corruption.id))
  assert.equal((s.removedFromGame || []).filter(code => code === '07273').length, 1)
  assert.ok(!s.investigators[0].discard.includes('07273'))
  const t = fixture(), cleanse = asset(t, '07273', { uses: 1 })
  t.investigators[0].damage = 1; t.investigators[0].horror = 1; t.encounterDeck = ['dissonantVoices']
  const actions = t.investigators[0].actionsLeft
  const cleanseMove = legalMoves(t, 0).find(m => m.assetId === cleanse.id)
  assert.ok(cleanseMove); move(t, cleanseMove)
  settle(t, c => c.source === '07273' && c.options.some(option => option.id === 'corruption') ? 'corruption' : null)
  assert.equal(t.encounterDeck.length, 0)
  assert.ok(t.investigators[0].threat.some(card => card.code === 'dissonantVoices'))
  assert.equal(t.investigators[0].assets.find(card => card.id === cleanse.id).uses, 0)
  assert.equal(t.investigators[0].damage, 1); assert.equal(t.investigators[0].horror, 1)
  assert.equal(t.investigators[0].actionsLeft, actions)
  const u = fixture(), noCancel = asset(u, '07273'); u.investigators[0].deck = ['07039']
  tx(u, d => drawCards(d, d.investigators[0], 1, []), (c, d) => reactionCard(c, d, '07273'))
  assert.equal(count(u, 'curse'), 5); assert.equal(u.investigators[0].damage, 0); assert.equal(u.investigators[0].horror, 0)
  assert.equal(u.investigators[0].assets.find(card => card.id === noCancel.id).uses, 0)
  assert.ok(!legalMoves(u, 0).some(m => m.assetId === noCancel.id), 'undamaged and clean cannot pay encounter cost for no effect')
})

test('P6 07310 Shrine of Moirai actual attached event is usable by local teammate, pays encounter before recovering two cards with total level at most five', () => {
  const s = fixture('01001', 2)
  s.humanSeats = [0, 1]
  s.investigators[1].location = s.investigators[0].location
  play(s, '07310'); settle(s)
  const shrine = s.playerLocationAttachments.find(card => card.code === '07310')
  assert.ok(shrine?.id); assert.equal(shrine.uses, 3); assert.equal(shrine.ownerSeat, 0)
  assert.ok(!s.investigators[0].discard.includes('07310'))
  s.investigators[1].discard = ['07161', '07270', '07034']
  s.encounterDeck = ['dissonantVoices']
  const teammateActions = s.investigators[1].actionsLeft
  tx(s, d => playerWindow(d, 'turn.afterAction', []), (c, d) => {
    if (c.kind === 'playerWindow') {
      if (c.seat !== 1) return 'skip'
      return c.options.find(option => option.id === 'free-descriptor:07310:1'
        || option.assetId === shrine.id)?.id || 'skip'
    }
    if (c.source === 'recoverDiscard') {
      if (!d.investigators[1].hand.includes('07161')) return c.options.find(option => option.cardCode === '07161')?.id
      assert.ok(!c.options.some(option => option.cardCode === '07270'), 'level four cannot follow level two under a total-five cap')
      return c.options.find(option => option.cardCode === '07034')?.id || 'done'
    }
    return null
  })
  const after = s.playerLocationAttachments.find(card => card.id === shrine.id)
  assert.equal(after.uses, 2); assert.equal(after.exhausted, true)
  assert.equal(s.encounterDeck.length, 0)
  assert.ok(s.investigators[1].threat.some(card => card.code === 'dissonantVoices'))
  assert.deepEqual([...s.investigators[1].hand].sort(), ['07034', '07161'])
  assert.deepEqual(s.investigators[1].discard, ['07270'])
  assert.equal(s.investigators[1].actionsLeft, teammateActions)
  assert.ok(!s.investigators[0].hand.includes('07161'))
  const t = JSON.parse(JSON.stringify(s))
  t.playerLocationAttachments.find(card => card.id === shrine.id).exhausted = false
  t.investigators[1].location = 'remote'; t.encounterDeck = ['dissonantVoices']
  assert.ok(!descriptorSources(t, t.investigators[1]).some(row => row.source?.id === shrine.id))
  tx(t, d => playerWindow(d, 'turn.afterAction', []), c => {
    if (c.kind === 'playerWindow' && c.seat === 1) assert.ok(!c.options.some(option => option.id === 'free-descriptor:07310:1'))
    return 'skip'
  })
  assert.equal(t.encounterDeck.length, 1)
  assert.equal(t.playerLocationAttachments.find(card => card.id === shrine.id).uses, 2)
})
