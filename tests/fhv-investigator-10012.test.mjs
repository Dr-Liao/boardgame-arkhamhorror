// P5 九循环《铁杉谷盛宴》调查员 10012 鸣神琥珀（Kōhaku Narukami）及专属依赖 Node 验收。
//
// 覆盖：
//   · 10012 条目/旧印/回合开始反应（较少者、并列选择、2+2 换额外行动、放弃）；
//   · 10013 真幻记述：beforeChaosTokenReveal 窗口、多数祝福/诅咒、并列选择、袋内无标记、
//     横置后再次检定不再提供、同地点其他调查员的检定、与被结算标记的战役袋同步（P2 原语）；
//   · 10014 恸哭怨魂：真实弱点揭示生成、冷漠/猎手/猎物/逃逸、同地点真实检定的强制攻击、
//     每检定一次、数字标记/横置/异地点/非检定路径不触发、攻击后逃逸横置；
//   · 构筑：30 张玩家卡 + 签名卡 10013/10014 + [[密教]] 0 级 / 潜修者 0–3 / 祝福诅咒 0–5；
//   · 存档往返 migrateState(copy(state))。
//
// 注：entries/index.js 由主进程统一重建；在索引包含这三张卡之前，本文件 import 后手动登记缺失条目，
// 并像 tests/fhv-investigator-10004.test.mjs 那样把本批卡号临时登记为 data-implemented，让
// `buildDeck` 的签名卡校验与 `fixture('10012')` 在索引重建前也能走真实路径（重建后两段都是 no-op）。

import kohaku from '../src/cards/entries/10012.js'
import bookOfLivingMyths from '../src/cards/entries/10013.js'
import weepingYurei from '../src/cards/entries/10014.js'
import '../src/engine/engine.js'

import test from 'node:test'
import assert from 'node:assert/strict'

import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { drawCards, elderSignEffect, scenarioRuntime } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { migrateState } from '../src/engine/save-migration.js'
import { DATA_IMPLEMENTED_CODES, implementation } from '../src/cards/card-implementation.js'
import { canSelectInvestigator, getAvailability } from '../src/deck/availability.js'
import { buildDeck, buildDeckFromList, EXPANDED_PLAYER_CARD_CODES, matchesDeckOptions } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { asset, fixture, move, settle } from './core-fixture.mjs'

const CODE = '10012'
const BOOK = '10013'
const YUREI = '10014'
const copy = value => JSON.parse(JSON.stringify(value))

// entries/index.js 是主进程统一重建的生成物；索引合并后这里全部命中、不再重复注册。
for (const entry of [kohaku, bookOfLivingMyths, weepingYurei]) {
  if (!registeredEntry(entry.code)) registerCardAbilities(entry)
}
// 临时桥：索引重建前让构筑层的 implementation() 看到本批条目（重建后为 no-op）。
for (const entry of [kohaku, bookOfLivingMyths, weepingYurei]) {
  if (!implementation(entry.code).implemented) DATA_IMPLEMENTED_CODES.add(entry.code)
}

// 30 张合法玩家卡（15 个卡号 ×2）：潜修者 0 级 / 中立 0 级，全部在鸣神琥珀的构筑选项内。
const LEGAL_DECK = [
  '01058', '01059', '01060', '01061', '01062', '01063', '01064', '01065',
  '01066', '01067', '01086', '01087', '01088', '01089', '01090',
]

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

// 鸣神琥珀（0 号座位）+ 另一名调查员。先把当前回合交给 1 号座位，再结束它：
// 下一回合顺序选择 0 号座位后立刻进入「你的回合开始」窗口，不经过神话阶段。
function kohakuGame() {
  const state = fixture(CODE, 2)
  state.currentSeat = 1
  state.investigators[1].actionsLeft = 20
  return state
}

// 回答待决选择直到结束；返回出现过的全部选择（用于断言「没有提供某能力」）。
function answerChoices(state, pick = () => null, limit = 30) {
  const seen = []
  for (let i = 0; state.pendingChoice && i < limit; i++) {
    const choice = state.pendingChoice
    seen.push(choice)
    const option = pick(choice)
      ?? ['done', 'skip', 'self'].map(id => choice.options.find(item => item.id === id)).find(Boolean)
      ?? choice.options[0]
    assert.ok(option, `没有可提交的选项：${choice.kind}`)
    move(state, { action: 'choose', choiceId: choice.id, optionId: option.id })
  }
  assert.equal(state.pendingChoice, null, '选择链未结束')
  return seen
}

// 鸣神琥珀的回合开始：1 号座位结束回合 →（回合顺序选择 0）→ 0 号座位回合开始。
function beginKohakuTurn(state, pick) {
  move(state, { action: 'endTurn' })
  return answerChoices(state, pick)
}

const pickKohaku = choice => choice.options.find(option => option.cardCode === CODE)
const pickMode = id => choice => choice.source === CODE && choice.kind === 'effect'
  ? choice.options.find(option => option.id === id) : undefined
const pickToken = id => choice => choice.source === CODE && choice.kind === 'chaosToken'
  ? choice.options.find(option => option.id === id) : undefined
const pickAll = (...picks) => choice => {
  for (const pick of picks) {
    const option = pick(choice)
    if (option) return option
  }
  return undefined
}

// 单人牌局：鸣神琥珀当前地点已揭示、0 帷幕、有足够线索，保证调查检定可成功。
function revealedGame(clues = 4) {
  const state = fixture(CODE)
  const inv = state.investigators[0]
  const here = state.locations.find(location => location.id === inv.location)
  Object.assign(here, { revealed: true, clues, shroud: 0 })
  here.connections = []
  return { state, inv, here }
}

function addConnectedLocation(state, here, id = 'next-place') {
  state.locations.push({ id, name: '邻室', revealed: true, clues: 0, shroud: 1, connections: [here.id] })
  here.connections = [id]
  return id
}

const bookOf = state => state.investigators[0].assets.find(item => item.code === BOOK)
const yureiOf = state => state.enemies.find(item => item.code === YUREI)
const pickBook = choice => choice.options.find(option => option.cardCode === BOOK)

// 10013：一本书 + 指定袋/必抽标记 → 跑一次真实调查检定。
function runBookTest({ bag, debug, pick }) {
  const { state, here } = revealedGame()
  asset(state, BOOK)
  state.chaosBag = [...bag]
  state.campaign.chaosBag = [...bag]
  state.debugNextTokens = [...debug]
  move(state, { action: 'investigate' })
  const seen = answerChoices(state, pick)
  return { state, inv: state.investigators[0], here: state.locations.find(item => item.id === here.id), seen }
}

// 10014：把专属弱点放在牌库顶，真实抽牌 → 揭示 → 生成怨魂。
function yureiGame({ bag = ['bless', '0'], debug = ['bless'], elusive = true, clues = 4 } = {}) {
  const { state, inv, here } = revealedGame(clues)
  addConnectedLocation(state, here, 'next-place')
  inv.hand = []
  inv.deck.push(YUREI)
  const lines = drawCards(state, inv, 1, [])
  const foe = yureiOf(state)
  assert.ok(foe, `弱点应生成怨魂：${lines.join(' / ')}`)
  if (!elusive) scenarioRuntime(state, []).setEnemyKeywords(foe, ['elusive'], { enabled: false })
  state.chaosBag = [...bag]
  state.campaign.chaosBag = [...bag]
  state.debugNextTokens = [...debug]
  return { state, here }
}

function investigate(state, pick) {
  move(state, { action: 'investigate' })
  return answerChoices(state, pick)
}

// ---------------------------------------------------------------------------
// 条目与构筑
// ---------------------------------------------------------------------------

test(`P5 ${CODE} 条目与专属依赖：注册形状、关键词窗口与旧印数值`, () => {
  const investigator = registeredEntry(CODE)
  assert.ok(investigator, '10012 必须注册')
  assert.equal(investigator.kind, 'investigator')
  assert.equal(investigator.scope, 'investigator')
  assert.equal(investigator.investigator?.elderSign?.bonus, 2)
  assert.equal(typeof investigator.elderSign?.resolve, 'function')
  assert.equal(investigator.abilities.length, 1)
  assert.ok(investigator.abilities[0].trigger.includes('turnBegins'))
  assert.equal(investigator.abilities[0].limit?.scope, 'perWindow', '同一 turnBegins 窗口只结算一次')

  const book = registeredEntry(BOOK)
  assert.ok(book, '10013 必须注册')
  assert.ok(book.abilities[0].trigger.includes('beforeChaosTokenReveal'))
  assert.deepEqual({ ...book.abilities[0].cost }, { exhaust: true })
  assert.equal(ALL_CARDS[BOOK].signatureFor.includes(CODE), true)
  assert.equal(ALL_CARDS[BOOK].restrictions?.investigator?.[CODE], CODE)

  const yurei = registeredEntry(YUREI)
  assert.ok(yurei, '10014 必须注册')
  assert.equal(yurei.scope, 'enemy')
  assert.deepEqual({ ...yurei.enemyWeakness }, { aloof: true, hunter: true, prey: true })
  assert.deepEqual({ ...yurei.enemyRule }, { elusive: true })
  assert.ok(yurei.abilities[0].trigger.includes('chaosTokenRevealed'))
  assert.equal(yurei.abilities[0].kind, 'forced')
  assert.equal(yurei.abilities[0].limit?.scope, 'perTest')
  assert.equal(ALL_CARDS[YUREI].signatureFor.includes(CODE), true)

  // availability 由主进程接线：调查员可被真人选择；两张专属卡为 dependencyOnly、不可构筑。
  assert.equal(canSelectInvestigator(CODE), true)
  assert.equal(getAvailability(CODE).selectable, true)
  for (const code of [BOOK, YUREI]) {
    assert.equal(getAvailability(code).dependencyOnly, true, `${code} 必须是 dependencyOnly`)
    assert.equal(getAvailability(code).deckbuilding, false, `${code} 不得进入一般构筑池`)
  }

  // 回合开始反应只在「你的」回合开始可用。
  const state = kohakuGame()
  const inv = state.investigators[0]
  const criteria = investigator.abilities[0].criteria
  assert.equal(criteria.every(item => item({ state, inv, context: { seat: 1, location: inv.location } })), false)
  assert.equal(criteria.every(item => item({ state, inv, context: { seat: 0, location: inv.location } })), true)
})

test(`P5 ${CODE} 构筑：30 张玩家卡、签名 10013/10014、[[密教]]0 级与潜修者 0–3 边界`, () => {
  const definition = INVESTIGATORS[CODE]
  assert.equal(definition.deckRequirements.size, 30)
  assert.deepEqual([...definition.deckRequirements.signatureCards].sort(), [BOOK, YUREI])
  assert.deepEqual([...ALL_CARDS[CODE].deckRequirements.signatureCards].sort(), [BOOK, YUREI])

  // 真实自动构筑：30 张玩家卡 + 签名支援 + 专属弱点 + 1 张随机基础弱点。
  const built = buildDeck(definition, { seed: 'p5-10012', xp: 0 })
  assert.equal(built.playerCards.length, 30)
  assert.ok(built.signatureCards.includes(BOOK), '构筑必须带入签名支援 10013')
  assert.ok(built.signatureWeaknesses.includes(YUREI), '构筑必须带入专属弱点 10014')
  assert.equal(built.basicWeaknesses.length, 1)
  assert.deepEqual(validateDeckRules(definition, built.playerCards, ALL_CARDS).errors, [])

  // 30 张合法牌组：潜修者 0–3 / 中立 0–5 全部命中构筑选项。
  const legalDeck = [...LEGAL_DECK, ...LEGAL_DECK]
  assert.equal(legalDeck.length, 30)
  for (const code of legalDeck) {
    assert.equal(matchesDeckOptions(definition, ALL_CARDS[code]), true, `${code} 应在构筑范围内`)
  }
  const validation = validateDeckRules(definition, legalDeck, ALL_CARDS)
  assert.deepEqual(validation.errors, [], `合法牌组不应报错：${validation.errors.join('；')}`)
  assert.equal(validation.count, 30)

  // 特性开放：祝福/诅咒 0–5 不受职阶限制；[[密教]] 只到 0 级；潜修者只到 3 级。
  assert.equal(matchesDeckOptions(definition, ALL_CARDS['07302']), true, '祝福 5 级合法')
  assert.equal(matchesDeckOptions(definition, ALL_CARDS['07308']), true, '祝福/诅咒 5 级合法')
  assert.equal(matchesDeckOptions(definition, ALL_CARDS['03025']), true, '[[密教]] 0 级合法')
  assert.equal(matchesDeckOptions(definition, ALL_CARDS['06021']), false, '[[密教]] 1 级非法')
  assert.equal(matchesDeckOptions(definition, ALL_CARDS['02233']), false, '潜修者 4 级非法（上限 3）')
  assert.equal(matchesDeckOptions(definition, ALL_CARDS['01016']), false, '守护者 0 级非法（非允许职阶）')

  // 非法牌组：真实构筑器拒绝越界卡；数量越界由 validateDeckRules 报错。
  const illegal = buildDeckFromList(definition, [...legalDeck, '02233'], { playerPool: EXPANDED_PLAYER_CARD_CODES })
  assert.ok(illegal.errors.some(error => error.includes('不符合构筑限制')), illegal.errors.join('；'))
  assert.ok(validateDeckRules(definition, [...legalDeck, '01058'], ALL_CARDS).errors.length > 0)
})

// ---------------------------------------------------------------------------
// 10012 回合开始反应
// ---------------------------------------------------------------------------

test(`P5 ${CODE} 回合开始：加入数量较少者；祝福与诅咒并列时由玩家选择`, () => {
  // 2 祝福 / 1 诅咒：强制加入诅咒，不出现标记选择。
  {
    const state = kohakuGame()
    state.chaosBag = ['bless', 'bless', 'curse', '0']
    const seen = beginKohakuTurn(state, pickKohaku)
    assert.equal(state.chaosBag.filter(token => token === 'curse').length, 2)
    assert.equal(state.chaosBag.filter(token => token === 'bless').length, 2)
    assert.equal(state.investigators[0].actionsLeft, 20, '加标记模式不获得额外行动')
    assert.equal(seen.some(choice => choice.kind === 'chaosToken'), false, '非并列不需要选择标记')
  }
  // 1 祝福 / 2 诅咒：加入祝福。
  {
    const state = kohakuGame()
    state.chaosBag = ['bless', 'curse', 'curse', '0']
    beginKohakuTurn(state, pickKohaku)
    assert.equal(state.chaosBag.filter(token => token === 'bless').length, 2)
  }
  // 1 祝福 / 1 诅咒：并列 → 玩家选择诅咒。
  {
    const state = kohakuGame()
    state.chaosBag = ['bless', 'curse', '0']
    const seen = beginKohakuTurn(state, pickAll(pickKohaku, pickToken('curse')))
    assert.ok(seen.some(choice => choice.kind === 'chaosToken'), '并列时必须询问加入哪一种')
    assert.equal(state.chaosBag.filter(token => token === 'curse').length, 2)
    assert.equal(state.chaosBag.filter(token => token === 'bless').length, 1)
    assert.equal(state.investigators[0].actionsLeft, 20)
  }
})

test(`P5 ${CODE} 回合开始：2 祝福 + 2 诅咒换 1 个额外行动，标记不足时该模式不可用`, () => {
  // 2+2：两种模式都可用，选择「额外行动」。
  {
    const state = kohakuGame()
    state.chaosBag = ['bless', 'bless', 'curse', 'curse', '0']
    const seen = beginKohakuTurn(state, pickAll(pickKohaku, pickMode('action')))
    assert.ok(seen.some(choice => choice.source === CODE && choice.kind === 'effect'
      && choice.options.some(option => option.id === 'action')), '2+2 时应提供额外行动模式')
    assert.deepEqual(state.chaosBag, ['0'])
    assert.equal(state.investigators[0].actionsLeft, 21, '额外行动 +1')
  }
  // 1 祝福 + 1 诅咒：额外行动模式不可用，只能加标记。
  {
    const state = kohakuGame()
    state.chaosBag = ['bless', 'curse']
    const seen = beginKohakuTurn(state, pickAll(pickKohaku, pickToken('bless')))
    assert.equal(seen.some(choice => choice.source === CODE && choice.options.some(option => option.id === 'action')), false,
      '不足 2 祝福 + 2 诅咒时不能选择额外行动')
    assert.equal(state.investigators[0].actionsLeft, 20)
    assert.equal(state.chaosBag.filter(token => token === 'bless').length, 2)
  }
})

test(`P5 ${CODE} 回合开始：可以放弃反应，混乱袋与行动点不变`, () => {
  const state = kohakuGame()
  state.chaosBag = ['bless', 'bless', 'curse', 'curse', '0']
  const before = [...state.chaosBag]
  const seen = beginKohakuTurn(state) // 默认：回合顺序选第一项、对 reaction 选「不触发」
  assert.ok(seen.some(choice => choice.options.some(option => option.cardCode === CODE)), '回合开始应提供反应')
  assert.deepEqual(state.chaosBag, before)
  assert.equal(state.investigators[0].actionsLeft, 20)
  assert.equal(Object.keys(state.abilityLimits || {}).some(key => key.startsWith('kohakuTurnBegins')), false,
    '放弃不记入能力上限')
})

// ---------------------------------------------------------------------------
// 10012 旧印
// ---------------------------------------------------------------------------

test(`P5 ${CODE} 旧印：+2 并在混乱袋中加入 1 祝福与 1 诅咒`, () => {
  const state = fixture(CODE)
  state.chaosBag = ['0']
  const effect = elderSignEffect(state, state.investigators[0])
  assert.equal(effect.delta, 2)
  assert.equal(state.chaosBag.filter(token => token === 'bless').length, 1)
  assert.equal(state.chaosBag.filter(token => token === 'curse').length, 1)

  // 存档往返后仍保留；祝福/诅咒属于当前混乱袋（关卡结束回供应堆，不写战役袋）。
  const saved = copy(state)
  migrateState(saved)
  assert.equal(saved.chaosBag.filter(token => token === 'bless').length, 1)
  assert.equal(saved.chaosBag.filter(token => token === 'curse').length, 1)
  assert.equal(elderSignEffect(saved, saved.investigators[0]).delta, 2)
})

// ---------------------------------------------------------------------------
// 10013 真幻记述
// ---------------------------------------------------------------------------

test(`P5 ${BOOK} 真幻记述：按袋内多数把将揭示的标记改为祝福/诅咒（当前袋与战役袋同步消耗）`, () => {
  // 多数祝福：2 祝福 / 1 诅咒。
  {
    const { state, inv, seen } = runBookTest({
      bag: ['bless', 'bless', 'curse', '0'], debug: ['0'], pick: pickBook,
    })
    assert.ok(seen.some(choice => choice.options.some(option => option.cardCode === BOOK)), '应提供真幻记述反应')
    assert.deepEqual(state.chaosBag, ['bless', 'curse', '0'], '改为结算并消耗 1 个祝福')
    assert.deepEqual(state.campaign.chaosBag, ['bless', 'curse', '0'], '被结算的祝福同时从战役袋移除')
    assert.equal(bookOf(state)?.exhausted, true, '横置作为费用')
    assert.equal(inv.clues, 1, '真实调查检定结算成功')
  }
  // 多数诅咒：3 诅咒 / 1 祝福。
  {
    const { state } = runBookTest({
      bag: ['curse', 'curse', 'curse', 'bless', '0'], debug: ['0'], pick: pickBook,
    })
    assert.deepEqual(state.chaosBag, ['curse', 'curse', 'bless', '0'])
    assert.deepEqual(state.campaign.chaosBag, ['curse', 'curse', 'bless', '0'])
    assert.equal(bookOf(state)?.exhausted, true)
  }
})

test(`P5 ${BOOK} 真幻记述：并列由玩家选择；袋内没有祝福/诅咒时不可用`, () => {
  // 并列 1/1：选择诅咒。
  {
    const { state, seen } = runBookTest({
      bag: ['bless', 'curse', '0'], debug: ['0'],
      pick: choice => choice.options.find(option => option.cardCode === BOOK)
        ?? (choice.source === BOOK && choice.kind === 'chaosToken'
          ? choice.options.find(option => option.id === 'curse') : undefined),
    })
    assert.ok(seen.some(choice => choice.source === BOOK && choice.kind === 'chaosToken'), '并列时应询问标记')
    assert.deepEqual(state.chaosBag, ['bless', '0'])
    assert.deepEqual(state.campaign.chaosBag, ['bless', '0'])
  }
  // 袋内没有祝福/诅咒：能力不可用（既不横置也不改变袋）。
  {
    const { state, seen } = runBookTest({ bag: ['0', '-1'], debug: ['0'], pick: pickBook })
    assert.equal(seen.some(choice => choice.options.some(option => option.cardCode === BOOK)), false,
      '没有祝福/诅咒时不应提供真幻记述')
    assert.deepEqual(state.chaosBag, ['0', '-1'])
    assert.equal(bookOf(state)?.exhausted, false)
  }
})

test(`P5 ${BOOK} 真幻记述：同地点另一名调查员的检定也可以改为结算`, () => {
  const state = fixture('01001', 2)
  const here = state.locations.find(location => location.id === state.investigators[0].location)
  Object.assign(here, { revealed: true, clues: 3, shroud: 0 })
  asset(state, BOOK, {}, 0)
  state.currentSeat = 1
  state.investigators[1].actionsLeft = 20
  state.chaosBag = ['bless', 'bless', 'curse', '0']
  state.campaign.chaosBag = [...state.chaosBag]
  state.debugNextTokens = ['0']
  move(state, { action: 'investigate' })
  const seen = answerChoices(state, pickBook)
  assert.ok(seen.some(choice => choice.options.some(option => option.cardCode === BOOK)),
    '「在你的地点」包括同地点其他调查员的检定')
  assert.deepEqual(state.chaosBag, ['bless', 'curse', '0'])
  assert.deepEqual(state.campaign.chaosBag, ['bless', 'curse', '0'])
  assert.equal(state.investigators[0].assets.find(item => item.code === BOOK)?.exhausted, true)
  assert.equal(state.investigators[1].clues, 1, '检定仍由另一名调查员结算')
})

test(`P5 ${BOOK} 真幻记述：横置后同一回合的第二次检定不再提供该反应`, () => {
  const first = runBookTest({ bag: ['bless', 'bless', 'curse', '0'], debug: ['0'], pick: pickBook })
  const state = first.state
  assert.equal(bookOf(state)?.exhausted, true)
  // 第二次检定：袋里仍有祝福，但书已横置 → 反应不可用，正常揭示数字标记且不消耗祝福。
  state.chaosBag.push('bless')
  state.debugNextTokens = ['0']
  move(state, { action: 'investigate' })
  const seen = answerChoices(state, pickBook)
  assert.equal(seen.some(choice => choice.options.some(option => option.cardCode === BOOK)), false)
  assert.equal(bookOf(state)?.exhausted, true)
  assert.equal(state.chaosBag.filter(token => token === 'bless').length, 2, '祝福都没有被消耗')
})

// ---------------------------------------------------------------------------
// 10014 恸哭怨魂
// ---------------------------------------------------------------------------

test(`P5 ${YUREI} 恸哭怨魂：真实弱点揭示生成、数值/冷漠/猎手/猎物/逃逸关键词`, () => {
  const { state, here } = yureiGame()
  const foe = yureiOf(state)
  assert.equal(foe.code, YUREI)
  assert.equal(foe.name, '恸哭怨魂')
  assert.deepEqual(
    [foe.fight, foe.evade, foe.health, foe.damage, foe.horror],
    [2, 2, 2, 0, 2],
  )
  assert.equal(foe.hunter, true, '猎手')
  assert.equal(foe.aloof, true, '冷漠：入场不与抽到者交战')
  assert.equal(foe.prey, 'bearer', '猎物 = 抽到它的调查员')
  assert.equal(foe.bearerSeat, 0)
  assert.equal(foe.engagedSeat, null)
  assert.equal(foe.location, here.id)
  assert.equal(foe.exhausted, false)
  // 逃逸由 enemyRule.elusive 声明并被攻击结算读取（下面用例验证行为）。
  assert.equal(registeredEntry(YUREI).enemyRule?.elusive, true)
  assert.equal(state.investigators[0].hand.includes(YUREI), false)
  assert.equal(state.investigators[0].discard.includes(YUREI), false)
})

test(`P5 ${YUREI} 恸哭怨魂：同地点真实检定揭示祝福/诅咒后强制攻击该调查员，随后逃逸横置`, () => {
  const { state } = yureiGame()
  const seen = investigate(state)
  assert.ok(seen.some(choice => choice.kind === 'commit'), '必须是真实技能检定')
  assert.equal(state.investigators[0].horror, 2, '怨魂 2 点恐惧命中揭示者')
  assert.equal(state.investigators[0].damage, 0)
  const foe = yureiOf(state)
  assert.equal(foe.location, 'next-place', '逃逸：攻击后移动到连接地点')
  assert.equal(foe.exhausted, true, '逃逸后横置')
  assert.equal(foe.engagedSeat, null)
  assert.equal(state.chaosBag.includes('bless'), false, '祝福已结算并移除')
  assert.ok(state.log.some(line => String(line.text || line).includes(`「${foe.name}」攻击`)), '攻击写入日志')
})

test(`P5 ${YUREI} 恸哭怨魂：数字标记、已横置、不在同地点、非技能检定都不触发攻击`, () => {
  // 只揭示数字标记。
  {
    const { state } = yureiGame({ bag: ['0', '0', '0'], debug: ['0'] })
    move(state, { action: 'investigate' })
    settle(state)
    assert.equal(state.investigators[0].horror, 0)
    assert.equal(yureiOf(state)?.exhausted, false)
    assert.equal(yureiOf(state)?.location, state.investigators[0].location)
  }
  // 怨魂已横置。
  {
    const { state } = yureiGame()
    yureiOf(state).exhausted = true
    investigate(state)
    assert.equal(state.investigators[0].horror, 0)
    assert.equal(state.chaosBag.includes('bless'), false, '祝福仍照常结算，只是不触发攻击')
  }
  // 怨魂不在检定地点。
  {
    const { state } = yureiGame()
    yureiOf(state).location = 'next-place'
    investigate(state)
    assert.equal(state.investigators[0].horror, 0)
  }
  // 非技能检定：用机制面的 inspect 直接揭示标记，不进入 chaosTokenRevealed 窗口。
  {
    const { state } = yureiGame({ bag: ['bless', '0', 'bless'], debug: ['0'] })
    const tokens = createMechanicsApi(state).chaosTokens.inspect(2)
    assert.deepEqual([...tokens].sort(), ['0', 'bless'])
    assert.equal(state.investigators[0].horror, 0)
    assert.equal(yureiOf(state)?.exhausted, false)
  }
})

test(`P5 ${YUREI} 恸哭怨魂：每次检定仅攻击一次，下一次检定可再次触发`, () => {
  // 关闭逃逸（只验证每次检定的次数限制；否则攻击后它已横置并离开）。
  const { state } = yureiGame({ bag: ['bless', 'bless', '0'], debug: ['bless', 'bless'], elusive: false })
  investigate(state)
  assert.equal(state.investigators[0].horror, 2, '同一次检定揭示两个祝福也只攻击一次')
  assert.equal(yureiOf(state)?.exhausted, false)
  const keys = Object.keys(state.abilityLimits || {}).filter(key => key.startsWith('weepingYureiAttack|'))
  assert.equal(keys.length, 1)
  assert.match(keys[0], /test:/, '按 skillTest.id 记「每次检定一次」')

  // 第二次检定（同一回合）：perTest 记账重新生效。
  state.chaosBag.push('bless', '0')
  state.debugNextTokens = ['bless']
  investigate(state)
  assert.equal(state.investigators[0].horror, 4, '下一场检定可以再次攻击')
})

// ---------------------------------------------------------------------------
// 存档往返
// ---------------------------------------------------------------------------

test(`P5 ${CODE} 存档往返：回合开始效果、额外行动与怨魂战斗状态可恢复`, () => {
  // 10012 回合开始：移除 2+2 拿额外行动。
  const kohakuState = kohakuGame()
  kohakuState.chaosBag = ['bless', 'bless', 'curse', 'curse', '0']
  beginKohakuTurn(kohakuState, pickAll(pickKohaku, pickMode('action')))
  const savedKohaku = copy(kohakuState)
  migrateState(savedKohaku)
  assert.deepEqual(savedKohaku.chaosBag, ['0'])
  assert.equal(savedKohaku.investigators[0].actionsLeft, 21)
  assert.ok(Object.keys(savedKohaku.abilityLimits || {}).some(key => key.startsWith('kohakuTurnBegins')),
    '窗口上限记账随存档往返')

  // 10014 强制攻击后的怨魂/调查员状态。
  const { state } = yureiGame()
  investigate(state)
  const saved = copy(state)
  migrateState(saved)
  const foe = yureiOf(saved)
  assert.equal(foe.exhausted, true)
  assert.equal(foe.location, 'next-place')
  assert.equal(saved.investigators[0].horror, 2)

  // 读档后强制能力仍能结算：把怨魂放回原地点并重整，再进行一次真实检定。
  foe.location = saved.investigators[0].location
  foe.exhausted = false
  saved.chaosBag = ['bless', '0']
  saved.debugNextTokens = ['bless']
  investigate(saved)
  assert.equal(saved.investigators[0].horror, 4)
})
