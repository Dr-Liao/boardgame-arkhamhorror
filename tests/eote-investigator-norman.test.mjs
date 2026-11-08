// P5 诺曼·威瑟斯（08004）及专属卡 Node 验收。
//
// 验收口径（docs/edgeOfTheEarth/README.md §3 P5、§5）：
//   · 条目注册：08004 investigator（deckTop 被动声明）+ elderSign、08005 支援两条 [fast] 能力、
//     08006 诡计型弱点（weaknessStaysOnDeckTop / locksDeckWhileRevealed / activatableWhileOnDeckTop）；
//   · 旧印：+X（X = 牌库顶费用）；可用一张手牌交换牌库顶；
//   · 伊波恩之书：[fast] 横置换顶；[fast] 横置把牌库顶投入当前技能检定；
//   · 常驻揭示 / 每轮一次 -1 费打出（ps 通道）/ 顶牌弱点强制抽取（引擎 eote-investigator-support 读点）；
//   · 预示者：揭示置于牌库顶；牌库顶揭示期间封锁抽牌；[action][action] 弃掉（moves#deckTopWeaknessDiscard）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { fixture, asset, move, settle } from './core-fixture.mjs'
import { ALL_CARDS, INVESTIGATORS } from '../src/cards/cards-data.js'
import { registerCardAbilities, registeredEntry } from '../src/engine/ability.js'
import { resolveTransaction, choiceError } from '../src/engine/resolution.js'
import { legalMoves, performTest, drawCards, executeDescriptor, getStat, moveCardTo, searchDeck } from '../src/engine/engine.js'
import { createMechanicsApi } from '../src/engine/api-mechanics.js'
import { syncPassiveDeckTop } from '../src/engine/eote-investigator-support.js'
import { buildDeck, buildDeckFromList } from '../src/deck/deckbuilding.js'
import { validateDeckRules } from '../src/deck/deck-rules.js'
import { canSelectInvestigator, getAvailability } from '../src/deck/availability.js'
import { implementation } from '../src/cards/card-implementation.js'

import norman from '../src/cards/entries/08004.js'
import livre from '../src/cards/entries/08005.js'
import harbinger from '../src/cards/entries/08006.js'

// entries/index.js 已包含这些条目时由引擎统一注册；仅在独立导入时兜底自注册。
if (!registeredEntry('08004')) registerCardAbilities([norman, livre, harbinger])

const clone = value => JSON.parse(JSON.stringify(value))
function transact (state, run, select = () => null, { save = false } = {}) {
  const execute = draft => run(draft)
  resolveTransaction(state, 0, { action: 'eoteInvestigatorTest' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    assert.ok(i < 100, `选择循环 ${JSON.stringify(state.pendingChoice)}`)
    if (save) Object.assign(state, clone(state))
    const choice = state.pendingChoice
    const id = select(choice, state) ?? ['done', 'skip', 'self'].find(optionId => choice.options.some(option => option.id === optionId)) ?? choice.options[0]?.id
    assert.ok(id != null, JSON.stringify(choice))
    const command = { action: 'choose', choiceId: choice.id, optionId: id }
    assert.equal(choiceError(state, choice.seat, command), null)
    resolveTransaction(state, choice.seat, command, execute)
  }
}
const deckTopRecord = (state, seat = 0) => state.scenarioFlags?.mechanics?.eote?.deckTop?.seats?.[seat] || null
function normanFixture () {
  const state = fixture('08004')
  state.abilityLimits = {}
  const inv = state.investigators[0]
  inv.hand = []
  inv.threat = []
  inv.damage = 0
  inv.horror = 0
  return state
}
const revealTop = (state, options = { public: false, discount: 1 }) => createMechanicsApi(state).deckTop.reveal(0, options)

test('P5 08004 自动构筑、专属依赖与注册身份', (t) => {
  assert.equal(canSelectInvestigator('08004'), true)
  assert.equal(registeredEntry('08004').kind, 'investigator')
  assert.deepEqual({ ...registeredEntry('08004').investigator.deckTop }, { reveal: true, public: false, discount: 1, drawWeakness: true })
  for (const sig of ['08005', '08006']) {
    assert.equal(getAvailability(sig).dependencyOnly, true)
    assert.equal(getAvailability(sig).deckbuilding, false)
    assert.ok(registeredEntry(sig), `${sig} 必须注册`)
  }
  // 构筑断言需要条目进入生成的 entries/index.js（Lead 重建后 implementation 才为 true）。
  if (!implementation('08005').implemented) return t.skip('entries/index.js 重建后启用真实构筑断言（Lead）')
  const built = buildDeck(INVESTIGATORS['08004'], { seed: 'eote-08004' })
  assert.equal(built.playerCards.length, 30)
  assert.equal(buildDeckFromList(INVESTIGATORS['08004'], built.playerCards, { seed: 'eote-08004-manual' }).playerCards.length, 30)
  assert.equal(validateDeckRules(INVESTIGATORS['08004'], built.playerCards, ALL_CARDS).errors.length, 0)
  for (const sig of ['08005', '08006']) {
    assert.ok(built.signatureCards.includes(sig) || built.signatureWeaknesses.includes(sig), `${sig} 必须在构筑依赖中`)
  }
})

test('P5 08004 旧印：+X（牌库顶费用）；可用手牌交换牌库顶', () => {
  const topCode = '01031'
  const handCode = '01030'
  const topCost = ALL_CARDS[topCode].cost
  const s = normanFixture()
  s.chaosBag = ['eldersign']
  s.investigators[0].deck = [handCode, '01088', topCode]
  s.investigators[0].hand = [handCode]
  revealTop(s)
  transact(s, draft => performTest(draft, 0, 'willpower', 0, {}), choice => choice.kind === 'effect' && choice.options.some(option => option.id === 'skip') ? 'skip' : null)
  assert.equal(s.lastTestResult.value, 4 + topCost, '旧印 +X = 牌库顶费用')
  assert.equal(deckTopRecord(s).code, topCode, '未选择交换时牌库顶保持')

  const swap = normanFixture()
  swap.chaosBag = ['eldersign']
  swap.investigators[0].deck = [handCode, '01088', topCode]
  swap.investigators[0].hand = [handCode]
  revealTop(swap)
  transact(swap, draft => performTest(draft, 0, 'willpower', 0, {}), choice => {
    if (choice.kind === 'effect' && choice.options.some(option => option.id === handCode)) return handCode
    return null
  })
  assert.equal(deckTopRecord(swap).code, handCode, '手牌与牌库顶交换')
  assert.ok(swap.investigators[0].hand.includes(topCode), '原牌库顶进入手牌')
})

test('P5 08005 伊波恩之书：[fast] 横置换顶；[fast] 横置把牌库顶投入当前检定', () => {
  const s = normanFixture()
  const book = asset(s, '08005')
  const topCode = '01031'
  const handCode = '01030'
  s.investigators[0].deck = [handCode, '01088', topCode]
  s.investigators[0].hand = [handCode]
  revealTop(s)
  const swapMove = legalMoves(s, 0).find(command => command.action === 'ability' && command.assetId === book.id && command.abilityIndex === 0)
  assert.ok(swapMove, '换顶能力进入合法动作')
  move(s, swapMove)
  settle(s, choice => choice.kind === 'effect' && choice.options.some(option => option.id === handCode) ? handCode : null)
  assert.equal(deckTopRecord(s).code, handCode)
  assert.ok(s.investigators[0].hand.includes(topCode))
  assert.equal(s.investigators[0].assets.find(item => item.id === book.id).exhausted, true, '[fast] 横置已支付')

  // 投入牌库顶（P0-10 #3 修复后的真实路径）：技能检定的「投入窗口」本身是待决选择
  // （pendingChoice.kind='commit'，tests.js:434）。08005 第二条 [fast] 由 flags.deckTopCommit
  // 声明为「牌库顶投入」通道，在窗口里以候选形式出现——而不是手工注入 state.skillTest。
  const commit = normanFixture()
  const book2 = asset(commit, '08005')
  const inv = commit.investigators[0]
  inv.deck = ['01088', '01031'] // 01031 智慧古书：只有 willpower 1 个图标
  revealTop(commit)
  commit.chaosBag = ['0']
  const willpowerBase = getStat(commit, inv, 'willpower')
  const commitWindows = []
  let committedAtLastWindow = []
  let result = null
  transact(commit, draft => { result = performTest(draft, 0, 'willpower', 0, {}) }, choice => {
    if (choice.kind !== 'commit') return null
    commitWindows.push(choice.options.map(option => String(option.id)))
    committedAtLastWindow = (commit.skillTest?.committed || []).map(item => ({ code: item.code, icons: item.icons }))
    const deckTopOption = choice.options.find(option => String(option.id).startsWith('deckTopCommit:'))
    return deckTopOption ? deckTopOption.id : 'done'
  })
  assert.ok(commitWindows.some(ids => ids.some(id => id.startsWith('deckTopCommit:'))),
    '真实技能检定投入窗口里应出现 08005 的「牌库顶投入」候选')
  assert.deepEqual(committedAtLastWindow, [{ code: '01031', icons: 1 }],
    '按本次检定技能过滤图标（不是 Object.values(icons) 全量求和），且图标只计一次')
  assert.equal(result.value, willpowerBase + 1, '检定值只加 1 个匹配图标（不双计 extraCommittedIcons）')
  assert.equal(commit.investigators[0].assets.find(item => item.id === book2.id).exhausted, true,
    '[fast] 横置伊波恩之书作为费用')
  assert.deepEqual(commit.investigators[0].deck, ['01088'], '投入后牌库顶牌离开牌库')
  assert.equal(deckTopRecord(commit).code, '01088', '投入后新的牌库顶立即重新揭示（常驻揭示不断档）')

  // 合法性：图标不匹配的牌库顶不能投入（01032 只有 agility 1，本次是 willpower 检定）。
  const mismatch = normanFixture()
  asset(mismatch, '08005')
  mismatch.investigators[0].deck = ['01088', '01032']
  revealTop(mismatch)
  mismatch.chaosBag = ['0']
  const mismatchWindows = []
  transact(mismatch, draft => performTest(draft, 0, 'willpower', 0, {}), choice => {
    if (choice.kind === 'commit') mismatchWindows.push(choice.options.map(option => String(option.id)))
    return null
  })
  assert.equal(mismatchWindows.some(ids => ids.some(id => id.startsWith('deckTopCommit:'))), false,
    '图标不匹配 → 不出现牌库顶投入候选（走 canCommitToTest）')
  assert.deepEqual(mismatch.investigators[0].deck, ['01088', '01032'], '非法时不移动牌库')
  assert.equal(mismatch.investigators[0].assets.find(item => item.code === '08005').exhausted, false,
    '非法时不支付横置费用')

  // 同地点：书主不在检定者所在地点时不开放投入窗口（队友投入窗口只开给同地点调查员）。
  const far = fixture('08004', 2)
  const [performer, norman] = far.investigators
  performer.code = '01001'
  performer.originalCode = '01001'
  norman.code = '08004'
  norman.originalCode = '08004'
  norman.assets = []
  asset(far, '08005', {}, 1)
  norman.deck = ['01088', '01031']
  const farLocation = { id: 'farLocation', name: '远处地点', code: 'farLocation', connections: [], revealed: true, clues: 0, shroud: 1 }
  far.locations.push(farLocation)
  norman.location = farLocation.id
  syncPassiveDeckTop(far, 1)
  far.chaosBag = ['0']
  const farCommitSeats = []
  transact(far, draft => performTest(draft, 0, 'willpower', 0, {}), choice => {
    if (choice.kind === 'commit') farCommitSeats.push(choice.seat)
    return null
  })
  assert.equal(farCommitSeats.includes(1), false, '不同地点的书主不会得到投入窗口')
  assert.deepEqual(far.investigators[1].deck, ['01088', '01031'], '不同地点时牌库顶不被投入')

  // 同地点正向：检定者请求协助后，书主（座位 1）的投入窗口出现「牌库顶投入」候选。
  const mate = fixture('08004', 2)
  const [performer2, owner] = mate.investigators
  performer2.code = '01001'
  performer2.originalCode = '01001'
  owner.code = '08004'
  owner.originalCode = '08004'
  owner.assets = []
  asset(mate, '08005', {}, 1)
  owner.deck = ['01088', '01031']
  owner.location = performer2.location
  syncPassiveDeckTop(mate, 1)
  mate.chaosBag = ['0']
  const helperWindows = []
  transact(mate, draft => performTest(draft, 0, 'willpower', 0, {}), choice => {
    if (choice.kind !== 'commit') return null
    helperWindows.push({ seat: choice.seat, ids: choice.options.map(option => String(option.id)) })
    const help = choice.options.find(option => option.id === 'help')
    if (help) return 'help'
    const deckTopOption = choice.options.find(option => String(option.id).startsWith('deckTopCommit:'))
    return deckTopOption ? deckTopOption.id : null
  })
  assert.ok(helperWindows.some(window => window.seat === 1
    && window.ids.some(id => id.startsWith('deckTopCommit:'))), '同地点协助者的投入窗口应出现牌库顶候选')
  assert.equal(mate.investigators[1].assets.find(item => item.code === '08005').exhausted, true,
    '协助投入后书被横置')
  assert.deepEqual(mate.investigators[1].deck, ['01088'], '协助投入把书主的牌库顶牌移出牌库')
  assert.equal(deckTopRecord(mate, 1).code, '01088', '协助投入后新的牌库顶立即重新揭示')
})

test('P5 08004 牌库顶常驻揭示、每轮一次 -1 费打出', () => {
  const s = normanFixture()
  const inv = s.investigators[0]
  const topCode = '01031' // 智慧古书：费用 3
  inv.deck = ['01030', '01088', topCode]
  syncPassiveDeckTop(s, 0)
  const record = deckTopRecord(s)
  assert.equal(record.code, topCode, '开局/牌库变化后牌库顶被揭示')
  assert.equal(record.discount, 1, '揭示记录带每轮一次 -1 费折扣')
  const playMove = legalMoves(s, 0).find(command => command.action === 'play' && command.fromDeckTop && command.cardId === topCode)
  assert.ok(playMove, 'deckTop 通道提供打出候选')
  const resourcesBefore = inv.resources
  const actionsBefore = inv.actionsLeft
  move(s, playMove)
  settle(s)
  const fresh = s.investigators[0]
  assert.equal(fresh.assets.some(item => item.code === topCode), true, '牌库顶牌被当作手牌打出')
  assert.equal(fresh.resources, resourcesBefore - (ALL_CARDS[topCode].cost - 1), '-1 资源折扣生效')
  assert.equal(fresh.actionsLeft, actionsBefore - 1, '打出消耗 1 行动')
  // 本轮已用过牌库顶打出机会：即使再同步出下一张顶牌，也不能再次从牌库顶打出。
  syncPassiveDeckTop(s, 0)
  assert.equal(legalMoves(s, 0).some(command => command.action === 'play' && command.fromDeckTop), false, '每轮一次')
  // 下一轮恢复。
  s.round += 1
  syncPassiveDeckTop(s, 0)
  assert.equal(legalMoves(s, 0).some(command => command.action === 'play' && command.fromDeckTop), true, '新回合再次可用')
})

test('P5 08004 强制：牌库顶揭示弱点后抽取它', () => {
  const s = normanFixture()
  const inv = s.investigators[0]
  inv.deck = ['01088', '01088', '01096'] // 01096 失忆（基础弱点）
  inv.hand = []
  syncPassiveDeckTop(s, 0)
  assert.equal(deckTopRecord(s).code, '01096', '顶牌弱点被揭示')
  const deckBefore = inv.deck.length
  transact(s, draft => { drawCards(draft, draft.investigators[0], 0, []) })
  assert.equal(s.investigators[0].deck.length, deckBefore - 1, '强制抽掉顶牌弱点（且只抽 1 张）')
  assert.notEqual(deckTopRecord(s).code, '01096', '弱点不再压在牌库顶')
  assert.equal(deckTopRecord(s).code, '01088', '揭示同步到下一张顶牌')
  assert.equal(s.investigators[0].deck.at(-1), '01088', '牌库顶前进 1 张')
})

test('P5 08006 预示者：揭示置于牌库顶、封锁抽牌、两行动弃置', () => {
  assert.equal(registeredEntry('08006').flags.weaknessStaysOnDeckTop, true)
  assert.equal(registeredEntry('08006').flags.locksDeckWhileRevealed, true)
  assert.equal(registeredEntry('08006').flags.activatableWhileOnDeckTop, true)
  const s = normanFixture()
  const inv = s.investigators[0]
  inv.deck = ['01088', '01088', '08006']
  syncPassiveDeckTop(s, 0)
  assert.equal(deckTopRecord(s).code, '08006', '牌库顶揭示预示者（弱点常驻）')
  assert.equal(deckTopRecord(s).discount, 0, '弱点常驻揭示不提供 -1 费打出')

  const deckBefore = inv.deck.length
  transact(s, draft => { drawCards(draft, draft.investigators[0], 1, []) })
  assert.equal(s.investigators[0].deck.length, deckBefore, '牌库顶揭示预示者期间不能抽牌')
  assert.equal(deckTopRecord(s).code, '08006', '封锁后顶牌保持')

  const discardMove = legalMoves(s, 0).find(command => command.action === 'deckTopWeaknessDiscard' && command.cardId === '08006')
  assert.ok(discardMove, '2 行动弃掉牌库顶弱点的动作被枚举')
  const actionsBefore = s.investigators[0].actionsLeft
  move(s, discardMove)
  settle(s)
  assert.equal(s.investigators[0].actionsLeft, actionsBefore - 2, '弃置动作消耗 2 行动')
  assert.equal(s.investigators[0].deck.includes('08006'), false, '预示者离开牌库')
  assert.equal(s.encounterDiscard.includes('08006'), true, '预示者进入遭遇弃牌堆')
  assert.notEqual(deckTopRecord(s)?.code, '08006', '弃置后牌库顶恢复揭示')

  // 显现：普通抽牌抽到预示者时，放回牌库顶并保持揭示（不结算、不进弃牌堆）。
  const reveal = normanFixture()
  reveal.investigators[0].deck = ['01088', '08006']
  transact(reveal, draft => { drawCards(draft, draft.investigators[0], 1, []) })
  assert.deepEqual(reveal.investigators[0].deck, ['01088', '08006'], '预示者被放回牌库顶')
  assert.equal(reveal.investigators[0].hand.includes('08006'), false)
  assert.equal(reveal.investigators[0].discard.includes('08006'), false)
  assert.equal(deckTopRecord(reveal).code, '08006', '放回后保持揭示（进而封锁牌库）')
})

// ── P0-10 修复回归（真实引擎路径） ───────────────────────────────────────────
test('P5 08004 牌库顶打出后立即重新揭示新的顶牌（P0-10 #4）', () => {
  const s = normanFixture()
  const inv = s.investigators[0]
  inv.deck = ['01030', '01088', '01031']
  syncPassiveDeckTop(s, 0)
  assert.equal(deckTopRecord(s)?.code, '01031', '开局牌库顶揭示')
  const playMove = legalMoves(s, 0).find(command => command.action === 'play'
    && command.fromDeckTop && command.cardId === '01031')
  assert.ok(playMove, '牌库顶打出候选存在')
  move(s, playMove)
  settle(s)
  assert.deepEqual(s.investigators[0].deck, ['01030', '01088'], '打出的顶牌离开牌库')
  assert.equal(deckTopRecord(s)?.code, '01088', '打出后新的牌库顶立即重新揭示（不再等抽牌/轮初）')
})

test('P5 08004 非本人回合的旧印换牌落在本人座位（P0-10 #4）', () => {
  const s = fixture('08004', 2)
  const [roland, norman] = s.investigators
  // 座位 0 = 当回合行动者（核心调查员），座位 1 = 诺曼；诺曼在别人的回合被强制做检定。
  roland.code = '01001'
  roland.originalCode = '01001'
  roland.name = '罗兰（座位 0）'
  norman.code = '08004'
  norman.originalCode = '08004'
  norman.name = '诺曼（座位 1）'
  roland.deck = ['01030', '01088', '01031']
  roland.hand = []
  norman.deck = ['01030', '01088', '01031']
  norman.hand = ['01030']
  syncPassiveDeckTop(s, 1)
  s.currentSeat = 0
  s.chaosBag = ['eldersign']
  transact(s, draft => performTest(draft, 1, 'willpower', 0, {}), choice =>
    choice.kind === 'effect' && choice.options.some(option => option.id === '01030') ? '01030' : null)
  assert.deepEqual(s.investigators[0].deck, ['01030', '01088', '01031'], '座位 0 的牌库不被换动')
  assert.deepEqual(s.investigators[0].hand, [], '座位 0 的手牌不被换动')
  assert.ok(s.investigators[1].hand.includes('01031'), '诺曼的旧印换牌把原顶牌放进诺曼手牌')
  assert.equal(deckTopRecord(s, 1)?.code, '01030', '诺曼的牌库顶换成原手牌')
})

test('P5 08006 预示者封锁覆盖检索与搬运，不只抽牌（P0-10 #2）', () => {
  const s = normanFixture()
  const inv = s.investigators[0]
  inv.deck = ['01088', '01031', '08006']
  syncPassiveDeckTop(s, 0)
  assert.equal(deckTopRecord(s)?.code, '08006', '牌库顶揭示预示者')
  let taken = []
  transact(s, draft => { taken = searchDeck(draft, 0, { type: 'asset', choose: 1, optional: true }) },
    choice => choice.kind === 'search' ? '0' : null)
  assert.deepEqual(taken, [], '封锁期间不能检索牌库')
  assert.deepEqual(s.investigators[0].deck, ['01088', '01031', '08006'], '检索被封时不移动牌库')
  assert.equal(moveCardTo(s, inv, { code: '08006', from: 'deck', to: 'discard' }, []), null,
    '封锁期间不能把顶牌搬进弃牌堆（绕过 2 行动弃置的代价）')
  assert.equal(s.investigators[0].deck.includes('08006'), true, '顶牌仍在牌库')
  assert.equal(s.investigators[0].discard.includes('08006'), false)
  assert.equal(s.encounterDiscard.includes('08006'), false)
})
