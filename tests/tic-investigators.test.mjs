import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle, answer } from './core-fixture.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { resolveTransaction, choiceError } from '../src/engine/resolution.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { createGameState, performTest, phaseBeginningWindow, reactionWindow, triggerReaction, applyDamage,
  drawCards, getStat, legalMoves, validateMove, executeDescriptor, discoverClueAt, autoEvadeEnemy, applyHorror } from '../src/engine/engine.js'
import { buildDeck, buildDeckFromList } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { canSelectInvestigator, getAvailability, TIC_INVESTIGATOR_CODES, PLAYABLE_INVESTIGATOR_CODES } from '../src/deck/availability.js'
import { entityMoves } from '../web/card-interactions.js'
import { mechanicView, mechanicSnapshot, maskMechanicSnapshot } from '../src/integration/mechanic-view.js'
import { migrateState } from '../src/engine/save-migration.js'

registerCardAbilities([{ code: 'testTicTriggeredSkill', abilities: [{ kind: 'action', label: '触发能力技能验收',
  resolve: ({ inv, api }) => api.test(inv.seat, 'willpower', 0, {}) }] }])

const clone = value => JSON.parse(JSON.stringify(value))
const firstAbility = c => c.options.find(option => option.id.startsWith('desc:'))?.id
function transact(state, run, select = () => null, { save = false } = {}) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'ticInvestigatorTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    if (save) Object.assign(state, clone(state))
    const c = state.pendingChoice
    const id = select(c, state) ?? ['done', 'skip', 'self'].find(id => c.options.some(o => o.id === id)) ?? c.options[0]?.id
    const command = { action: 'choose', choiceId: c.id, optionId: id }
    assert.equal(choiceError(state, c.seat, command), null)
    resolveTransaction(state, c.seat, command, execute)
  }
}
function setup(code, count = 1) {
  const s = fixture(code, count)
  s.abilityLimits = {}
  if (s.scenarioFlags.mechanics?.beneath) s.scenarioFlags.mechanics.beneath = {}
  return s
}
const beneath = (s, code) => createMechanicsApi(s).commitOrigins.beneath(0, code)
const store = (s, host, code) => { s.investigators[0].hand.push(code); assert.equal(createMechanicsApi(s).commitOrigins.store(0, host, code), true) }

for (const code of ['07001', '07002', '07003', '07004', '07005']) test(`P5 ${code} 自动构筑、专属依赖及合法／非法职业等级`, () => {
  assert.equal(canSelectInvestigator(code), true)
  assert.equal(PLAYABLE_INVESTIGATOR_CODES.includes(code), false, '既有 AI 随机池保持稳定')
  const built = buildDeck(INVESTIGATORS[code], { seed: `tic-${code}` })
  assert.equal(built.playerCards.length, 30)
  assert.equal(buildDeckFromList(INVESTIGATORS[code], built.playerCards, { seed: `tic-manual-${code}` }).playerCards.length, 30)
  assert.equal(validateDeckRules(INVESTIGATORS[code], built.playerCards, ALL_CARDS).errors.length, 0)
  for (const sig of INVESTIGATORS[code].deckRequirements.signatureCards) {
    assert.ok(registeredEntry(sig)); assert.equal(getAvailability(sig).dependencyOnly, true)
    assert.equal(getAvailability(sig).deckbuilding, false)
    assert.ok([...built.signatureCards, ...built.signatureWeaknesses].includes(sig))
  }
  assert.equal(validateDeckRules(INVESTIGATORS[code], ['01088'], ALL_CARDS, { partial: true }).errors.length, 0)
  const banned = { ...ALL_CARDS['01030'], code: 'illegal', klass: 'guardian', xp: 6, level: 6, factions: ['guardian'] }
  assert.ok(validateDeckRules(INVESTIGATORS[code], ['illegal'], { ...ALL_CARDS, illegal: banned }, { partial: true }).errors.length)
  const side = {
    '07001': { klass: 'mystic', xp: 2 }, '07002': { klass: 'guardian', xp: 3, type: 'skill', traits: ['Practiced'] },
    '07003': { klass: 'seeker', xp: 2 }, '07004': { klass: 'rogue', xp: 2 },
    '07005': { klass: 'guardian', xp: 2, type: 'skill', traits: ['Innate'] },
  }[code]
  const allowed = { ...ALL_CARDS['01030'], ...side, code: 'side', factions: [side.klass], level: side.xp }
  assert.deepEqual(validateDeckRules(INVESTIGATORS[code], ['side'], { side: allowed }, { partial: true }).errors, [])
  const denied = { ...allowed, xp: side.xp + 1, level: side.xp + 1 }
  assert.ok(validateDeckRules(INVESTIGATORS[code], ['side'], { side: denied }, { partial: true }).errors.length)
})

test('P5 玛丽：真实开局两祝福、轮末上限与旧印成功／失败', () => {
  const initial = createGameState({ playerInvestigator: '07001', seed: 'mary-setup' }, [{ seat: 0 }]); settle(initial)
  assert.equal(initial.chaosBag.filter(t => t === 'bless').length, 2)
  const s = setup('07001'); s.chaosBag.push(...Array(9).fill('bless'))
  transact(s, draft => reactionWindow(draft, 'roundEnds', { when: 'roundEnds', round: draft.round }, []), firstAbility, { save: true })
  assert.equal(s.chaosBag.filter(t => t === 'bless').length, 10)
  for (const [difficulty, count] of [[0, 1], [100, 0]]) {
    const state = setup('07001'); state.chaosBag = ['eldersign']
    transact(state, draft => performTest(draft, 0, 'willpower', difficulty, {}))
    assert.equal(state.chaosBag.filter(t => t === 'bless').length, count)
  }
})

test('P5 信仰危机只处理袋内祝福；诅咒池满时替换仍移除祝福，恐惧选项保留祝福', () => {
  const s = setup('07001'); s.chaosBag = ['0', 'bless', 'bless', ...Array(10).fill('curse')]
  createMechanicsApi(s).chaosTokens.seal('angel', 'bless', 1)
  s.investigators[0].deck.push('07007')
  transact(s, draft => drawCards(draft, draft.investigators[0], 1, []), c => c.source === '07007' ? 'curse' : null)
  assert.equal(s.chaosBag.includes('bless'), false); assert.equal(s.chaos.sealed.length, 1)
  assert.equal(s.chaosBag.filter(t => t === 'curse').length, 10)
  const t = setup('07001'); t.chaosBag.push('bless'); t.investigators[0].deck.push('07007')
  transact(t, draft => drawCards(draft, draft.investigators[0], 1, []), c => c.source === '07007' ? 'horror' : null)
  assert.equal(t.investigators[0].horror, 1); assert.ok(t.chaosBag.includes('bless'))
})

test('P5 守护天使承接连接地点队友伤害，致命分配也能加入祝福，恐惧不能跨座位承接', () => {
  const s = setup('07001', 2), angel = asset(s, '07006')
  s.locations.push({ id: 'adjacent', name: '相邻地点', connections: [s.investigators[0].location], revealed: true, clues: 0, shroud: 1 })
  s.locations[0].connections.push('adjacent'); s.investigators[1].location = 'adjacent'
  transact(s, draft => applyDamage(draft, draft.investigators[1], 1, []), c => c.kind === 'assign-damage' ? angel.id : firstAbility(c))
  assert.equal(s.investigators[1].damage, 0); assert.equal(s.investigators[0].assets[0].damage, 1)
  assert.equal(s.chaosBag.filter(t => t === 'bless').length, 1)
  const t = setup('07001', 2), doomed = asset(t, '07006')
  t.investigators[1].location = t.investigators[0].location
  const health = ALL_CARDS['07006'].health
  transact(t, draft => applyDamage(draft, draft.investigators[1], health, []), c => c.kind === 'assign-damage' ? doomed.id : firstAbility(c), { save: true })
  assert.equal(t.investigators[0].assets.some(a => a.id === doomed.id), false)
  assert.equal(t.chaosBag.filter(token => token === 'bless').length, health)
  transact(s, draft => applyHorror(draft, draft.investigators[1], 1, []), c => {
    if (c.kind === 'assign-horror') assert.equal(c.options.some(o => o.id === angel.id), false)
    return null
  })
  assert.equal(s.investigators[1].horror, 1)
})

test('P5 阿曼达轮换：先抽、清理旧牌、强制选择深海低语；多人窗口与 JSON 恢复', () => {
  const s = setup('07002', 2); store(s, '07002', '01089')
  s.investigators[0].hand = ['07009', '01093']
  transact(s, draft => reactionWindow(draft, 'investigationPhaseStarts', { when: 'investigationPhaseStarts' }, []), c => {
    if (c.source === '07002') { assert.deepEqual(c.options.map(o => o.cardCode), ['07009']); return c.options[0].id }
    return null
  }, { save: true })
  assert.deepEqual(beneath(s, '07002'), ['07009']); assert.ok(s.investigators[0].discard.includes('01089'))
  assert.ok(s.investigators[0].hand.includes('01088'))
  transact(s, draft => reactionWindow(draft, 'investigationPhaseStarts', { when: 'investigationPhaseStarts' }, []), c => c.source === '07002'
    ? c.options.find(o => o.cardCode === '01093')?.id : null)
  assert.deepEqual(beneath(s, '07002'), ['01093']); assert.ok(s.investigators[0].discard.includes('07009'))
})

test('P5 阿曼达真实开局：先用五张手牌换牌，再在调查阶段抽取第六张并选择下方牌', () => {
  const s = createGameState({ playerInvestigator: '07002', seed: 'amanda-mulligan-order' }, [{ seat: 0 }])
  assert.equal(s.pendingChoice.kind, 'mulligan'); assert.equal(s.investigators[0].hand.length, 5)
  assert.deepEqual(beneath(s, '07002'), [])
  answer(s, 'done')
  assert.equal(s.pendingChoice.kind, 'effect'); assert.equal(s.investigators[0].hand.length, 6)
  answer(s, s.pendingChoice.options[0].id); settle(s)
  assert.equal(s.investigators[0].hand.length, 5); assert.equal(beneath(s, '07002').length, 1)
})

test('P5 无显现弱点真实抽取：深海低语与神秘残片留在手中；塞壬进入威胁区，特工生成并仅追归属者', () => {
  for (const [investigator, code] of [['07002', '07009'], ['07004', '07013'], ['07005', '07016'], ['07003', '07011']]) {
    const s = setup(investigator); s.investigators[0].deck.push(code)
    transact(s, draft => drawCards(draft, draft.investigators[0], 1, []))
    if (['07009', '07013'].includes(code)) {
      assert.ok(s.investigators[0].hand.includes(code)); assert.equal(s.investigators[0].discard.includes(code), false)
    } else if (code === '07016') assert.ok(s.investigators[0].threat.some(card => card.code === code))
    else { assert.equal(s.enemies[0].code, code); assert.equal(s.enemies[0].prey, 'bearer'); assert.equal(s.enemies[0].bearerSeat, 0) }
  }
})

test('P5 阿曼达每次检定重复投入同一实体并重复结算技能；不能投入图标不匹配的牌', () => {
  const s = setup('07002'); store(s, '07002', '01089')
  transact(s, draft => { performTest(draft, 0, 'willpower', 0, {}); performTest(draft, 0, 'willpower', 0, {}) })
  assert.deepEqual(beneath(s, '07002'), ['01089']); assert.equal(s.investigators[0].discard.includes('01089'), false)
  assert.equal(s.investigators[0].hand.length, 2, '胆识每次成功均抽 1 张')
  const t = setup('07002'); store(t, '07002', '01091')
  transact(t, draft => performTest(draft, 0, 'willpower', 0, {}))
  assert.equal(t.investigators[0].discard.includes('01091'), false); assert.deepEqual(beneath(t, '07002'), ['01091'])
})

test('P5 晦涩研究在投入前替换下方牌，不额外产生弃牌副本；阿曼达旧印可翻倍正负图标', () => {
  const s = setup('07002'); store(s, '07002', '01089'); s.investigators[0].hand.push('07008')
  transact(s, draft => performTest(draft, 0, 'willpower', 0, {}), c => c.options.find(o => o.cardCode === '07008')?.id)
  assert.deepEqual(beneath(s, '07002'), ['07008']); assert.ok(s.investigators[0].hand.includes('01089'))
  assert.equal(s.investigators[0].discard.includes('07008'), false)
  for (const [code, expected] of [['01089', 6], ['07009', 0]]) {
    const t = setup('07002'); store(t, '07002', code); t.chaosBag = ['eldersign']
    transact(t, draft => performTest(draft, 0, 'willpower', 0, {}), c => c.options.some(o => o.id === 'double') ? 'double' : null)
    assert.equal(t.lastTestResult.value, expected)
  }
})

test('P5 特里希发现线索：有敌人时额外发现或自动躲避，每轮一次且不会递归', () => {
  const s = setup('07003'); enemy(s); s.locations[0].clues = 4
  transact(s, draft => discoverClueAt(draft, draft.investigators[0], 1, []), c => c.options.some(o => o.id === 'clue') ? 'clue' : firstAbility(c), { save: true })
  assert.equal(s.investigators[0].clues, 2)
  transact(s, draft => discoverClueAt(draft, draft.investigators[0], 1, []), firstAbility)
  assert.equal(s.investigators[0].clues, 3)
  const t = setup('07003'); const e = enemy(t); t.locations[0].clues = 1
  transact(t, draft => discoverClueAt(draft, draft.investigators[0], 1, []), c => c.options.some(o => o.id === e.id) ? e.id : firstAbility(c))
  assert.equal(t.enemies[0].exhausted, true); assert.equal(t.enemies[0].engagedSeat, null)
})

test('P5 特里希旧印可改在不连接的已揭示地点调查，使用新帷幕与线索区', () => {
  const s = setup('07003'); s.chaosBag = ['eldersign']
  s.locations.push({ id: 'remote', name: '远处', revealed: true, shroud: 1, clues: 3, connections: [] })
  move(s, { action: 'investigate' }); settle(s, c => c.options.some(o => o.id === 'remote') ? 'remote' : null)
  assert.equal(s.locations.find(loc => loc.id === 'remote').clues, 2)
  assert.equal(s.lastTestResult.difficulty, 1); assert.equal(s.investigators[0].location, s.locations[0].id)
})

test('P5 潜于阴影真实回合开始窗口解除全部交战，阻止再交战与伤害；影子特工调查例外及自动躲避弃置', () => {
  const s = setup('07003'); s.investigators[0].hand.push('07010'); enemy(s)
  transact(s, draft => triggerReaction(draft, 0, 'turnBegins', [], { seat: 0, when: 'turnBegins' }), firstAbility)
  assert.equal(s.enemies[0].engagedSeat, null)
  assert.equal(legalMoves(s, 0).some(m => m.action === 'engage'), false)
  assert.ok(s.effects.some(effect => effect.sourceCode === '07010'))
  const t = setup('07003'); const shadow = enemy(t, { code: '07011', bearerSeat: 0 }); t.locations[0].clues = 4
  transact(t, draft => discoverClueAt(draft, draft.investigators[0], 1, []))
  assert.equal(t.investigators[0].clues, 0)
  move(t, { action: 'investigate' }); settle(t)
  assert.equal(t.investigators[0].clues, 1)
  transact(t, draft => autoEvadeEnemy(draft, draft.enemies.find(e => e.id === shadow.id), []))
  assert.equal(t.enemies.length, 0); assert.ok(t.investigators[0].discard.includes('07011'))
})

test('P5 戴克斯特主动能力接入合法动作及调查员卡入口；折扣、同名拒绝与每轮限制', () => {
  const s = setup('07004'); const old = asset(s, '01030'); s.investigators[0].hand.push('01031')
  const mv = legalMoves(s, 0).find(m => m.assetId === 'investigator:0')
  assert.ok(mv); assert.ok(entityMoves({ ...s, legalMoves: legalMoves(s, 0) }, 'investigator:0').length)
  const before = s.investigators[0].resources, actions = s.investigators[0].actionsLeft
  move(s, mv); const saved = clone(s); settle(s); settle(saved)
  assert.deepEqual(saved.investigators[0], s.investigators[0], '戴克斯特选择暂停后 JSON 恢复一致')
  assert.ok(s.investigators[0].discard.includes(old.code)); assert.ok(s.investigators[0].assets.some(a => a.code === '01031'))
  assert.equal(s.investigators[0].resources, before - 2); assert.equal(s.investigators[0].actionsLeft, actions)
  assert.equal(legalMoves(s, 0).some(m => m.assetId === 'investigator:0'), false)
  const t = setup('07004'); asset(t, '01030'); t.investigators[0].hand.push('01030')
  assert.equal(legalMoves(t, 0).some(m => m.assetId === 'investigator:0'), false)
  assert.equal(registeredEntry('98016').investigator.elderSign.bonus, 2)
})

test('P5 戴克斯特旧印收回支援并抽牌；神秘残片在手／场上分别 -2／-1 意志且不能行动打出', () => {
  const s = setup('07004'); const old = asset(s, '01030'); s.chaosBag = ['eldersign']
  transact(s, draft => performTest(draft, 0, 'willpower', 0, {}), c => c.options.some(o => o.id === old.id) ? old.id : null)
  assert.ok(s.investigators[0].hand.includes('01030')); assert.ok(s.investigators[0].hand.includes('01088'))
  const t = setup('07004'); t.investigators[0].hand = ['07013']
  assert.equal(getStat(t, t.investigators[0], 'willpower'), 3)
  assert.equal(legalMoves(t, 0).some(m => m.action === 'play' && m.cardId === '07013'), false)
  asset(t, '01030'); const mv = legalMoves(t, 0).find(m => m.assetId === 'investigator:0'); move(t, mv); settle(t)
  assert.equal(getStat(t, t.investigators[0], 'willpower'), 4)
})

test('P5 表演技巧给新支援的触发能力 +2，普通检定及下一轮不加成', () => {
  const s = setup('07004'); asset(s, '07012'); const book = asset(s, '01031')
  transact(s, draft => triggerReaction(draft, 0, 'assetEnteredPlay', [], { seat: 0, assetId: book.id, assetCode: book.code }), firstAbility)
  assert.equal(s.investigators[0].assets.find(a => a.id === book.id).triggeredSkillBonus.amount, 2)
  assert.equal(getStat(s, s.investigators[0], 'willpower'), 5)
  s._resolvingAssetId = book.id; assert.equal(getStat(s, s.investigators[0], 'willpower'), 7)
  s.round++; assert.equal(getStat(s, s.investigators[0], 'willpower'), 5)
})

test('P5 表演技巧由放置入场原语触发，实际能力检定加值且不残留到普通检定', () => {
  const s = setup('07004'); asset(s, '07012'); s.investigators[0].hand.push('01031')
  const descriptor = { ...registeredEntry('testTicTriggeredSkill').abilities[0], resolve: ({ inv, api }) => api.putAssetIntoPlay(inv.seat, '01031') }
  transact(s, draft => executeDescriptor(draft, { inv: draft.investigators[0], source: draft.investigators[0].assets[0],
    descriptor, alreadyPaid: true, events: [] }), firstAbility)
  const book = s.investigators[0].assets.find(a => a.code === '01031'); assert.equal(book.triggeredSkillBonus.amount, 2)
  assert.ok(migrateState(clone(s)).state)
  const invalid = clone(s); invalid.investigators[0].assets.find(a => a.id === book.id).triggeredSkillBonus.round = 'bad'
  assert.throws(() => migrateState(invalid), /触发能力技能加成存档/)
  transact(s, draft => executeDescriptor(draft, { inv: draft.investigators[0], source: draft.investigators[0].assets.find(a => a.id === book.id),
    descriptor: registeredEntry('testTicTriggeredSkill').abilities[0], alreadyPaid: true, events: [] }))
  assert.equal(s.lastTestResult.value, 7); assert.equal(s._resolvingAssetId, undefined)
  transact(s, draft => performTest(draft, 0, 'willpower', 0, {})); assert.equal(s.lastTestResult.value, 5)
})

test('P5 阿曼达公开下方牌；普通宿主仍保密；强制投入免额外费用且不选择其他弱点', () => {
  const s = setup('07002', 2); store(s, '07002', '01089'); store(s, 'secret-host', '01093')
  const projection = mechanicView(s, 1), snapshot = maskMechanicSnapshot(mechanicSnapshot(s), 1)
  for (const model of [projection, snapshot]) {
    assert.deepEqual(model.beneath.find(item => item.host === '07002').codes, ['01089'])
    assert.equal(model.beneath.find(item => item.host === 'secret-host').codes, undefined)
  }
  s.investigators[0].resources = 0; s.investigators[0].threat.push({ id: 'call', code: '07016' })
  transact(s, draft => performTest(draft, 0, 'willpower', 0, {}))
  assert.equal(s.lastTestResult.value, 4); assert.equal(s.investigators[0].resources, 0)
  s.investigators[0].hand = ['01096']; s.investigators[0].deck = ['01088']
  transact(s, draft => reactionWindow(draft, 'investigationPhaseStarts', { when: 'investigationPhaseStarts' }, []), c => {
    if (c.source === '07002') assert.equal(c.options.some(option => option.cardCode === '01096'), false)
    return null
  })
  assert.deepEqual(beneath(s, '07002'), ['01088'])
})

test('P5 真实轮末与新调查阶段读点：玛丽补祝福、阿曼达轮换；额外阶段同轮再次轮换', () => {
  const mary = setup('07001'); move(mary, { action: 'endTurn' }); settle(mary, firstAbility)
  assert.equal(mary.round, 2); assert.equal(mary.chaosBag.filter(token => token === 'bless').length, 1)
  const amanda = setup('07002'); store(amanda, '07002', '01089'); amanda.investigators[0].hand = ['01093']
  move(amanda, { action: 'endTurn' }); settle(amanda)
  assert.equal(amanda.round, 2); assert.ok(amanda.investigators[0].discard.includes('01089'))
  assert.equal(beneath(amanda, '07002').length, 1)
})

test('P5 戴克斯特不能弃永久或他人支援；塞壬呼唤在恰好两行动时可移除', () => {
  const s = setup('07004', 2); asset(s, '06010'); asset(s, '01030', {}, 1); s.investigators[0].hand = ['01031']
  assert.equal(legalMoves(s, 0).some(m => m.assetId === 'investigator:0'), false)
  const t = setup('07005'); t.investigators[0].threat.push({ id: 'call', code: '07016' })
  t.investigators[0].actionsLeft = 1; assert.equal(legalMoves(t, 0).some(m => m.assetId === 'call'), false)
  t.investigators[0].actionsLeft = 2; const mv = legalMoves(t, 0).find(m => m.assetId === 'call'); move(t, mv); settle(t)
  assert.equal(t.round, 2, '恰好花完行动后正常进入下一轮'); assert.equal(t.investigators[0].threat.some(card => card.code === '07016'), false)
})

test('P5 赛拉斯收回仅技能：图标及成功奖励一起移除，祝福追加揭示只用一次；旧印弃牌技能检定后回手', () => {
  const s = setup('07005'); s.investigators[0].hand.push('01089'); s.chaosBag = ['0']
  transact(s, draft => performTest(draft, 0, 'willpower', 0, {}), c => {
    if (c.kind === 'commit' && c.options.some(o => o.id === '0')) return '0'
    if (c.kind === 'reaction') return firstAbility(c)
    if (c.kind === 'mechanic') return c.options.some(o => o.id === 'confirm') ? 'confirm' : 'pick:0'
    return null
  })
  assert.equal(s.investigators[0].hand.filter(c => c === '01089').length, 1)
  assert.equal(s.investigators[0].hand.includes('01088'), false); assert.equal(s.lastTestResult.value, 2)
  const t = setup('07005'); t.investigators[0].discard.push('01089', '01030'); t.chaosBag = ['eldersign']
  transact(t, draft => performTest(draft, 0, 'willpower', 0, {}), c => c.kind === 'mechanic'
    ? c.options.some(o => o.id === 'confirm') ? 'confirm' : 'pick:0' : null, { save: true })
  assert.ok(t.investigators[0].hand.includes('01089')); assert.ok(t.investigators[0].discard.includes('01030'))
  assert.equal(t.lastTestResult.value, 4)
})

test('P5 鱼叉和渔网真实行动：技能条件加伤／额外躲避，检定结束收回武器与技能', () => {
  for (const [code, skillCode] of [['07014', '01091'], ['07015', '01092']]) {
    const s = setup('07005'); const weapon = asset(s, code); const e = enemy(s); const second = code === '07015' ? enemy(s) : null
    s.investigators[0].hand.push(skillCode)
    const mv = legalMoves(s, 0).find(m => m.assetId === weapon.id && m.targetId === e.id)
    assert.ok(mv)
    move(s, mv); settle(s, c => {
      if (c.kind === 'commit' && c.options.some(o => o.id === '0')) return '0'
      if (c.options.some(o => o.id === second?.id)) return second.id
      if (c.kind === 'reaction' && c.options.some(o => o.label.includes('收回鱼叉') || o.label.includes('收回渔网'))) return firstAbility(c)
      return null
    })
    assert.ok(s.investigators[0].hand.includes(code)); assert.ok(s.investigators[0].hand.includes(skillCode))
    if (code === '07014') assert.equal(s.enemies[0].damageTaken, 2)
    else assert.equal(s.enemies.filter(e => e.exhausted).length, 2)
  }
})

test('P5 塞壬呼唤：匹配图标逐张收取资源，不够不能投入；移除确实花两行动', () => {
  const s = setup('07005'); s.investigators[0].threat.push({ id: 'call', code: '07016' }); s.investigators[0].hand.push('01089')
  s.investigators[0].resources = 1
  transact(s, draft => performTest(draft, 0, 'willpower', 0, {}), c => { if (c.kind === 'commit') assert.equal(c.options.some(o => o.id === '0'), false); return null })
  s.investigators[0].resources = 2
  transact(s, draft => performTest(draft, 0, 'willpower', 0, {}), c => c.kind === 'commit' && c.options.some(o => o.id === '0') ? '0' : null)
  assert.equal(s.investigators[0].resources, 0)
  const actions = s.investigators[0].actionsLeft
  const mv = legalMoves(s, 0).find(m => m.assetId === 'call'); assert.ok(mv); move(s, mv); settle(s)
  assert.equal(s.investigators[0].actionsLeft, actions - 2); assert.equal(s.investigators[0].threat.length, 0)
})
