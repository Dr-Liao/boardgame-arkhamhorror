// 七循环《地球边缘》P5-B：陈丽丽（08010）+ 4 组双面演武（08011a/b–08014a/b）+ 命运重担（08015）Node 验收。
//
// 口径：
//   · 构筑：默认起始演武 08011a（不入 30 张玩家卡），每张演武配 1 张 08015；options.disciplines 可选
//     1–4 张、按 15 XP 门控（options.xp）；禁 [[Firearm]] 由 deckOptions 的 not/trait 生效；
//   · 开局：牌组里的永久演武按 Unbroken 面进场；命运重担作为专属弱点加入牌组；战役层演武面同步登记；
//   · 四张 Unbroken 主动行动；四张 Broken 轮末反应；旧印 +2 与结束后翻回；命运重担二选一。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fixture, asset, enemy, move, settle } from './core-fixture.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { registeredEntry, registerCardAbilities } from '../src/engine/ability.js'
import { resolveTransaction } from '../src/engine/resolution.js'
import { buildDeck, buildDeckFromList } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { canSelectInvestigator, getAvailability } from '../src/deck/availability.js'
import { createGameState, applyDamage, drawCards, getStat, legalMoves, performTest, reactionWindow } from '../src/engine/engine.js'
import { investigatorRule } from '../src/cards/investigator-abilities.js'
import { disciplineFace, initializeDisciplines } from '../src/engine/eote-disciplines.js'

import lily from '../src/cards/entries/08010.js'
import discipline11a from '../src/cards/entries/08011a.js'
import discipline11b from '../src/cards/entries/08011b.js'
import discipline12a from '../src/cards/entries/08012a.js'
import discipline12b from '../src/cards/entries/08012b.js'
import discipline13a from '../src/cards/entries/08013a.js'
import discipline13b from '../src/cards/entries/08013b.js'
import discipline14a from '../src/cards/entries/08014a.js'
import discipline14b from '../src/cards/entries/08014b.js'
import burden from '../src/cards/entries/08015.js'

const ENTRY_LIST = [lily, discipline11a, discipline11b, discipline12a, discipline12b,
  discipline13a, discipline13b, discipline14a, discipline14b, burden]
if (!registeredEntry('08010')) registerCardAbilities(ENTRY_LIST)

const SETS = Object.freeze([
  { unbrokenCode: '08011a', brokenCode: '08011b', burdenCode: '08015' },
  { unbrokenCode: '08012a', brokenCode: '08012b', burdenCode: '08015' },
  { unbrokenCode: '08013a', brokenCode: '08013b', burdenCode: '08015' },
  { unbrokenCode: '08014a', brokenCode: '08014b', burdenCode: '08015' },
])
const ALL_UNBROKEN = SETS.map(set => set.unbrokenCode)
const DISCIPLINE_PATTERN = /^0801[1-4][ab]$/

const clone = value => JSON.parse(JSON.stringify(value))

// 规则事务里的选择（reactionWindow / 弱点显现 / performTest 等）必须用 resolveTransaction
// 消费恢复凭据；对局行动（ability/fight move）产生的是标准选择，用 choose move 继续。
function transact(state, run, select = () => null) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'eoteLilyTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const choice = state.pendingChoice
    const id = select(choice, state) ?? ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0]?.id
    resolveTransaction(state, choice.seat, { action: 'choose', choiceId: choice.id, optionId: id }, execute)
  }
}
function settleChoice(state, select = () => null) {
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 50, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    const choice = state.pendingChoice
    const id = select(choice, state) ?? ['done', 'skip', 'self'].find(id => choice.options.some(option => option.id === id))
      ?? choice.options[0]?.id
    move(state, { action: 'choose', choiceId: choice.id, optionId: id })
  }
}
const invOf = state => state.investigators[0]
const disciplineOf = state => invOf(state).assets.find(card => DISCIPLINE_PATTERN.test(String(card.code || '')))

function addDiscipline(state, code) {
  const card = asset(state, code, {}, 0)
  if (!state.campaign.eote?.disciplines?.sets?.length) initializeDisciplines(state, { sets: SETS })
  // Broken 面入场：真实流程由翻面入口同步战役面；测试状态直接登记。
  if (/b$/.test(code)) state.campaign.eote.disciplines.faces[`${code.slice(0, -1)}a`] = 'broken'
  return card
}
function setupLily(codes = ['08011a']) {
  const state = fixture('08010')
  state.abilityLimits = {}
  const inv = state.investigators[0]
  inv.assets = []
  inv.threat = []
  inv.hand = []
  inv.damage = 0
  inv.horror = 0
  inv.resources = 20
  inv.actionsLeft = 20
  if (!state.campaign.eote?.disciplines?.sets?.length) initializeDisciplines(state, { sets: SETS })
  for (const code of codes) addDiscipline(state, code)
  return state
}
function useDiscipline(state, code, select = () => null) {
  const card = invOf(state).assets.find(asset => asset.code === code)
  assert.ok(card, `缺少演武 ${code}`)
  move(state, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settleChoice(state, select)
  return card
}
// 轮末反应：trigger 选第一个非 skip 选项；skipOnly 时选跳过。
function roundEnds(state, mode = 'trigger') {
  transact(state, draft => reactionWindow(draft, 'roundEnds', { when: 'roundEnds', round: draft.round }, []), choice => {
    const skip = choice.options.find(option => option.id === 'skip')
    const trigger = choice.options.find(option => option.id !== 'skip')
    return mode === 'trigger' ? (trigger?.id ?? skip?.id) : (skip?.id ?? choice.options[0]?.id)
  })
}

// ── 条目与卡面数据 ────────────────────────────────────────────────────────────
test('P5 08010 条目注册、双面演武卡面数据与旧印字段', () => {
  for (const entry of ENTRY_LIST) assert.ok(registeredEntry(entry.code), `条目未注册：${entry.code}`)
  assert.equal(investigatorRule('08010').elderSign.bonus, 2, '旧印 +2 应写在 investigator.elderSign.bonus')
  assert.ok(registeredEntry('08010').elderSign, '旧印能力描述子应注册')
  for (const set of SETS) {
    const front = ALL_CARDS[set.unbrokenCode]
    const back = ALL_CARDS[set.brokenCode]
    assert.equal(front.type, 'asset')
    assert.equal(front.permanent, true)
    assert.equal(back.permanent, true)
    assert.equal(front.linkedCardCode, set.brokenCode, `${set.unbrokenCode} 未声明背面`)
    assert.deepEqual(front.traits, ['Unbroken'])
    assert.deepEqual(back.traits, ['Broken'])
    assert.ok(front.restrictions?.investigator?.['08010'])
    assert.deepEqual(ALL_CARDS[set.burdenCode].signatureFor, ['08010'])
    assert.equal(ALL_CARDS[set.burdenCode].quantity, 4)
  }
  // 四张 Unbroken 面各 +1 对应技能。
  const stats = { '08011a': 'willpower', '08012a': 'intellect', '08013a': 'combat', '08014a': 'agility' }
  const state = setupLily(ALL_UNBROKEN)
  for (const [code, skill] of Object.entries(stats)) {
    assert.equal(getStat(state, invOf(state), skill), ALL_CARDS['08010'][skill] + 1, `${code} 应 +1 ${skill}`)
  }
})

// ── 构筑 ─────────────────────────────────────────────────────────────────────
test('P5 08010 构筑：默认起始演武、命运重担数量与 15 XP 门控', () => {
  assert.equal(canSelectInvestigator('08010'), true)
  assert.equal(getAvailability('08011a').dependencyOnly, true)
  assert.equal(getAvailability('08011a').deckbuilding, false)

  const built = buildDeck(INVESTIGATORS['08010'], { seed: 'lily-deck' })
  assert.equal(built.playerCards.length, 30)
  assert.deepEqual(built.signatureCards, ['08011a'])
  assert.deepEqual(built.signatureWeaknesses, ['08015'])
  assert.equal(built.playerCards.filter(code => DISCIPLINE_PATTERN.test(code)).length, 0)
  assert.equal(built.deck.length, 33, '30 张玩家卡 + 1 演武 + 1 命运重担 + 1 随机基础弱点')

  // 每 15 XP 可加 1 张不同演武（默认 1 张 → 15 XP 可 2 张）。
  const two = buildDeckFromList(INVESTIGATORS['08010'], built.playerCards,
    { seed: 'lily-deck-2', disciplines: ['08011a', '08012a'], xp: 15 })
  assert.deepEqual(two.errors, [])
  assert.deepEqual(two.signatureCards, ['08011a', '08012a'])
  assert.deepEqual(two.signatureWeaknesses, ['08015', '08015'])

  const notEnoughXp = buildDeckFromList(INVESTIGATORS['08010'], built.playerCards,
    { seed: 'lily-deck-xp0', disciplines: ['08011a', '08012a'], xp: 0 })
  assert.ok(notEnoughXp.errors.length > 0, '缺少 15 XP 时不能带 2 张演武')

  const duplicate = buildDeckFromList(INVESTIGATORS['08010'], built.playerCards,
    { seed: 'lily-deck-dup', disciplines: ['08012a', '08012a'], xp: 15 })
  assert.ok(duplicate.errors.length > 0, '重复演武必须被拒绝')

  const illegal = buildDeckFromList(INVESTIGATORS['08010'], built.playerCards,
    { seed: 'lily-deck-illegal', disciplines: ['08016'], xp: 15 })
  assert.ok(illegal.errors.length > 0, '非演武卡号必须被拒绝')

  const tooMany = buildDeckFromList(INVESTIGATORS['08010'], built.playerCards,
    { seed: 'lily-deck-five', disciplines: [...ALL_UNBROKEN, '08011a'], xp: 60 })
  assert.ok(tooMany.errors.length > 0, '最多 4 张演武')

  // 禁 [[Firearm]]：守卫者 0 级非枪械可入，枪械被 deckOptions 排除（真实卡 01016 为枪械）。
  const item = { ...ALL_CARDS['01016'], code: 'fakeLilyItem', type: 'asset', klass: 'guardian',
    factions: ['guardian'], level: 0, xp: 0, traits: ['Item'], restrictions: undefined, signatureFor: undefined }
  const firearm = { ...item, code: 'fakeLilyFirearm', traits: ['Firearm', 'Item'] }
  const cards = { ...ALL_CARDS, fakeLilyItem: item, fakeLilyFirearm: firearm }
  assert.deepEqual(validateDeckRules(INVESTIGATORS['08010'], ['fakeLilyItem'], cards, { partial: true }).errors, [])
  assert.ok(validateDeckRules(INVESTIGATORS['08010'], ['fakeLilyFirearm'], cards, { partial: true }).errors.length > 0)
  assert.ok(validateDeckRules(INVESTIGATORS['08010'], ['01016'], ALL_CARDS, { partial: true }).errors.length > 0)
})

// ── 开局 ─────────────────────────────────────────────────────────────────────
test('P5 08010 开局：演武以 Unbroken 面永久进场，命运重担作为专属弱点在牌组里', () => {
  const state = createGameState({ playerInvestigator: '08010', seed: 'lily-setup' }, [{ seat: 0 }])
  settle(state)
  const inv = invOf(state)
  const disciplines = inv.assets.filter(card => DISCIPLINE_PATTERN.test(card.code))
  assert.equal(disciplines.length, 1, '默认开局应有 1 张演武在场')
  assert.equal(disciplines[0].code, '08011a')
  assert.equal(ALL_CARDS[disciplines[0].code].permanent, true)
  assert.equal(ALL_CARDS[disciplines[0].code].traits[0], 'Unbroken')
  const zones = [...inv.deck, ...inv.hand, ...inv.discard]
  assert.equal(zones.filter(code => code === '08015').length, 1)
  assert.ok(state.campaign.eote?.disciplines?.sets?.length >= 1)
  assert.equal(disciplineFace(state, '08011a'), 'unbroken')
})

// ── Unbroken 主动行动 ───────────────────────────────────────────────────────
test('P5 08010 演武 08011a：伤害/恐惧二选一，治疗 3 点后翻至 Broken', () => {
  const state = setupLily(['08011a'])
  invOf(state).horror = 4
  useDiscipline(state, '08011a', () => 'damage')
  assert.equal(invOf(state).damage, 1, '承受 1 点直接伤害')
  assert.equal(invOf(state).horror, 1, '治愈 3 点恐惧')
  assert.equal(disciplineOf(state).code, '08011b')
  assert.equal(disciplineFace(state, '08011a'), 'broken')

  const second = setupLily(['08011a'])
  invOf(second).damage = 4
  useDiscipline(second, '08011a', () => 'horror')
  assert.equal(invOf(second).damage, 1, '治愈 3 点伤害')
  assert.equal(invOf(second).horror, 1, '承受 1 点直接恐惧')
  assert.equal(disciplineOf(second).code, '08011b')
})

test('P5 08010 演武 08012a：手牌少于 5 张时补到手牌 5 张并翻至 Broken', () => {
  const state = setupLily(['08012a'])
  invOf(state).hand = ['01088', '01088']
  useDiscipline(state, '08012a')
  assert.equal(invOf(state).hand.length, 5)
  assert.equal(disciplineOf(state).code, '08012b')
  assert.equal(disciplineFace(state, '08012a'), 'broken')
})

test('P5 08010 演武 08013a：下一次技能检定 +5，检定结束后翻至 Broken', () => {
  const state = setupLily(['08013a'])
  state.chaosBag = ['0']
  const before = getStat(state, invOf(state), 'combat')
  useDiscipline(state, '08013a')
  assert.ok(state.effects.some(effect => effect.sourceCode === '08013a'), '应挂上「下一次检定 +5」效果')
  transact(state, draft => performTest(draft, 0, 'combat', 0, {}))
  assert.equal(state.lastTestResult.value, before + 5, '下一次技能检定 +5')
  assert.equal(disciplineOf(state).code, '08013b', '检定结束后翻面')
  assert.equal(disciplineFace(state, '08013a'), 'broken')
  assert.equal(state.effects.some(effect => effect.sourceCode === '08013a'), false, '效果在检定后过期')
})

test('P5 08010 演武 08014a：至多 3 次免费战斗/躲避行动，然后翻至 Broken', () => {
  const state = setupLily(['08014a'])
  const foe = enemy(state)
  // 受限行动额度按「actionsLeft 包含额度、额度是最后 N 个行动」口径发放：使用演武后
  // actionsLeft += 3 且 fightEvadeOnlyActions = 3；3 次战斗各自消耗 1 点，但不额外花普通行动。
  const before = invOf(state).actionsLeft
  useDiscipline(state, '08014a')
  assert.equal(invOf(state).fightEvadeOnlyActions, 3, '应获得 3 次战斗/躲避专用行动')
  assert.equal(disciplineOf(state).code, '08014b')
  assert.equal(disciplineFace(state, '08014a'), 'broken')
  for (let used = 0; used < 3; used++) {
    const fight = legalMoves(state, 0).find(candidate => candidate.action === 'fight' && candidate.enemyId === foe.id)
    assert.ok(fight, `第 ${used + 1} 次免费战斗行动应可用`)
    move(state, fight)
    settleChoice(state)
  }
  assert.equal(invOf(state).fightEvadeOnlyActions, 0, '额度用尽')
  assert.equal(invOf(state).actionsLeft, before - 1, '3 次免费行动只消耗演武行动本身')
  const extra = legalMoves(state, 0).find(candidate => candidate.action === 'fight' && candidate.enemyId === foe.id)
  if (extra) {
    move(state, extra)
    settleChoice(state)
    assert.equal(invOf(state).actionsLeft, before - 2, '额度用尽后的第 4 次战斗恢复消耗普通行动')
  }
})

// ── Broken 轮末反应（直接构造轮内事件读点） ─────────────────────────────────
test('P5 08010 Broken 面轮末反应：四组条件分别翻回或保持 Broken', () => {
  const cases = [
    { broken: '08011b', unbroken: '08011a', events: { damage: 0, horror: 0 }, flip: true },
    { broken: '08011b', unbroken: '08011a', events: { damage: 1, horror: 0 }, flip: false },
    { broken: '08011b', unbroken: '08011a', events: { damage: 0, horror: 1 }, flip: false },
    { broken: '08012b', unbroken: '08012a', events: { handTwoPlus: false }, flip: true },
    { broken: '08012b', unbroken: '08012a', events: { handTwoPlus: true }, flip: false },
    { broken: '08013b', unbroken: '08013a', events: { tests: 0 }, flip: true },
    { broken: '08013b', unbroken: '08013a', events: { tests: 2 }, flip: false },
    { broken: '08014b', unbroken: '08014a', events: { enemyAtLocation: false }, flip: true },
    { broken: '08014b', unbroken: '08014a', events: { enemyAtLocation: true }, flip: false },
  ]
  for (const item of cases) {
    const state = setupLily([item.broken])
    invOf(state).roundEvents = { damage: 0, horror: 0, tests: 0, handTwoPlus: false, enemyAtLocation: false, ...item.events }
    roundEnds(state, item.flip ? 'trigger' : 'skip')
    assert.equal(disciplineOf(state).code, item.flip ? item.unbroken : item.broken,
      `${item.broken} 在 ${JSON.stringify(item.events)} 时应${item.flip ? '' : '不'}翻回`)
    if (item.flip) assert.equal(disciplineFace(state, item.broken), 'unbroken')
  }
})

test('P5 08010 轮内事件追踪：受伤/手牌 2 张/技能检定/同地点敌人分别写入 roundEvents', () => {
  const harmed = setupLily(['08011b'])
  transact(harmed, draft => applyDamage(draft, draft.investigators[0], 1, []))
  assert.ok((invOf(harmed).roundEvents?.damage || 0) >= 1, '受到伤害应记入 roundEvents.damage')

  const hand = setupLily(['08012b'])
  transact(hand, draft => drawCards(draft, draft.investigators[0], 2, []))
  assert.equal(invOf(hand).roundEvents?.handTwoPlus, true, '手牌达到 2 张应记 handTwoPlus')

  const tested = setupLily(['08013b'])
  tested.chaosBag = ['0']
  transact(tested, draft => performTest(draft, 0, 'willpower', 0, {}))
  assert.ok((invOf(tested).roundEvents?.tests || 0) >= 1, '技能检定应记入 roundEvents.tests')

  const foe = setupLily(['08014b'])
  enemy(foe)
  foe.chaosBag = ['0']
  transact(foe, draft => performTest(draft, 0, 'willpower', 0, {}))
  assert.equal(invOf(foe).roundEvents?.enemyAtLocation, true, '同地点出现过敌人应记 enemyAtLocation')

  // 受伤过的本轮轮末不能翻回。
  roundEnds(harmed, 'skip')
  assert.equal(disciplineOf(harmed).code, '08011b')
})

// ── 旧印 ─────────────────────────────────────────────────────────────────────
test('P5 08010 旧印：+2，且此次检定结束后翻回一张 Broken 演武', () => {
  const state = setupLily(['08011b'])
  state.chaosBag = ['eldersign']
  const before = getStat(state, invOf(state), 'willpower')
  transact(state, draft => performTest(draft, 0, 'willpower', 0, {}))
  assert.equal(state.lastTestResult.value, before + 2, '旧印 +2')
  assert.equal(disciplineOf(state).code, '08011a', '检定结束后翻回 Unbroken 面')
  assert.equal(disciplineFace(state, '08011a'), 'unbroken')
})

// ── 命运重担 08015 ──────────────────────────────────────────────────────────
test('P5 08015 命运重担：翻演武并锁定本轮，不能翻回；另一选项 1 伤害 1 恐惧', () => {
  const flipState = setupLily(['08011a'])
  invOf(flipState).deck = ['08015']
  transact(flipState, draft => drawCards(draft, draft.investigators[0], 1, []), choice => {
    if (choice.options.some(option => option.id === 'flip')) return 'flip'
    if (choice.options.some(option => option.id === 'pick:0')) return 'pick:0'
    if (choice.options.some(option => option.id === '0')) return '0'
    return null
  })
  assert.equal(disciplineOf(flipState).code, '08011b', '应翻至 Broken 面')
  assert.ok(flipState.effects.some(effect => effect.sourceCode === '08015'), '应留下本轮锁定标记')
  roundEnds(flipState, 'skip')
  assert.equal(disciplineOf(flipState).code, '08011b', '锁定效果应阻止本轮翻回')
  assert.equal(invOf(flipState).damage, 0)
  assert.equal(invOf(flipState).horror, 0)

  const harmState = setupLily([])
  invOf(harmState).deck = ['08015']
  transact(harmState, draft => drawCards(draft, draft.investigators[0], 1, []), choice =>
    choice.options.some(option => option.id === 'harm') ? 'harm' : null)
  assert.equal(invOf(harmState).damage, 1, '承受 1 点伤害')
  assert.equal(invOf(harmState).horror, 1, '承受 1 点恐惧')
})

test('P5 08010 存档往返：演武面与演武战役状态随 JSON 保存/读取', () => {
  const state = setupLily(['08011b'])
  invOf(state).roundEvents = { damage: 0, horror: 0, tests: 0, handTwoPlus: false, enemyAtLocation: false }
  const restored = clone(state)
  assert.equal(restored.investigators[0].assets.find(asset => DISCIPLINE_PATTERN.test(asset.code)).code, '08011b')
  assert.equal(disciplineFace(restored, '08011a'), 'broken')
  assert.deepEqual(restored.investigators[0].roundEvents, invOf(state).roundEvents)
})

// ── P0-10 修复回归（真实引擎路径） ───────────────────────────────────────────
test('P5 08010 演武 08013a：+5/翻面只按本人检定结算，别人的检定不消耗（P0-10 #1）', () => {
  const state = fixture('08010', 2)
  state.abilityLimits = {}
  for (const inv of state.investigators) {
    inv.assets = []
    inv.threat = []
    inv.hand = []
    inv.damage = 0
    inv.horror = 0
    inv.resources = 20
    inv.actionsLeft = 20
  }
  if (!state.campaign.eote?.disciplines?.sets?.length) initializeDisciplines(state, { sets: SETS })
  const card = addDiscipline(state, '08013a')
  state.chaosBag = ['0']
  state.currentSeat = 0
  move(state, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settleChoice(state)
  const effectCount = () => state.effects.filter(effect => effect.sourceCode === '08013a').length
  assert.equal(effectCount(), 1, '使用后挂上「下一次检定 +5」')
  assert.equal(disciplineOf(state).eoteFlipAfterTest, '08013b', '延迟翻面标记已挂上')

  // 座位 1 做一次真实技能检定：陈丽丽没有参与，效果与标记都不得被消耗。
  state.investigators[1].willpower = 4
  transact(state, draft => performTest(draft, 1, 'willpower', 0, {}))
  assert.equal(effectCount(), 1, '别人的检定结束不使 +5 过期')
  assert.equal(disciplineOf(state).eoteFlipAfterTest, '08013b', '别人的检定结束不触发翻面标记')
  assert.equal(disciplineOf(state).code, '08013a', '别人的检定结束不翻面')

  // 本人的下一次检定：+5 生效（getStat 含该效果修正，检定值应恰等于它，不双计），结束后翻面。
  const valueBeforeOwnTest = getStat(state, invOf(state), 'combat')
  transact(state, draft => performTest(draft, 0, 'combat', 0, {}))
  assert.equal(state.lastTestResult.value, valueBeforeOwnTest, '本人的下一次检定获得 +5（且只计一次）')
  assert.equal(disciplineOf(state).code, '08013b', '本人检定结束后翻面')
  assert.equal(disciplineOf(state).eoteFlipAfterTest, undefined, '标记已消费')
  assert.equal(effectCount(), 0, '效果在本人检定结束后过期')
})

test('P5 08010 演武 08013a：用完但本回合没做检定 → 轮边界标记作废、不翻面（P0-10 #1 加强）', () => {
  const state = setupLily(['08013a'])
  state.chaosBag = ['0']
  useDiscipline(state, '08013a')
  assert.equal(disciplineOf(state).eoteFlipAfterTest, '08013b')
  move(state, { action: 'endTurn' })
  settleChoice(state)
  assert.equal(state.round, 2, '已进入下一轮')
  assert.equal(state.effects.filter(effect => effect.sourceCode === '08013a').length, 0, '+5 效果随回合结束清除')
  assert.equal(disciplineOf(state).eoteFlipAfterTest, undefined, '翻面标记在轮边界作废（不再无过期点）')
  assert.equal(disciplineOf(state).code, '08013a', '没做检定就不翻面')
  // 跨轮之后的检定也不能因旧标记翻面。
  transact(state, draft => performTest(draft, 0, 'combat', 0, {}))
  assert.equal(disciplineOf(state).code, '08013a', '旧标记不会等到之后任意一次检定才翻面')
})

test('P5 08010 演武 08014a：fightEvade 额度在轮边界清理，不挤占下一轮普通行动（P0-10 #5）', () => {
  const state = setupLily(['08014a'])
  state.chaosBag = ['0']
  const card = disciplineOf(state)
  move(state, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settleChoice(state)
  assert.equal(invOf(state).fightEvadeOnlyActions, 3, '使用后获得 3 点战斗/躲避专用行动')
  move(state, { action: 'endTurn' })
  settleChoice(state)
  assert.equal(state.round, 2, '已进入下一轮')
  assert.equal(invOf(state).fightEvadeOnlyActions || 0, 0, '受限额度在轮边界被清理（不再跨轮残留）')
  assert.equal(invOf(state).actionsLeft, 3, '下一轮普通行动额度恢复为 3（不被 3 点受限额度吃掉）')
})
