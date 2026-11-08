// 修复小组 · 调查员 P0-10 真实路径探针（修复前复现 / 修复后验收）。
//
// 只读 games/arkhamhorror/**（import），不写 Mod 文件；输出仅 stdout。
// 运行：cd G:\boardgame-hall-ai && node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/investigators/_fix-p0-10.mjs
//
// 覆盖扫描报告 §3 P0-10 的五项：
//   F1 08013a：+5 / 延迟翻面按「执行检定的座位」结算；翻面标记有过期点（回合/轮边界）。
//   F2 08006：牌库顶揭示预示者期间，drawCards 之外的 searchDeck / moveCardTo 同样被封。
//   F3 08005：第二模式 [fast] 只能从真实检定投入窗口触发（canCommitToTest + 同地点 + 按检定技能过滤图标 + 投入后重新揭示），图标只计一次。
//   F4 08004：牌库顶打出后重新 sync 揭示；非本人回合的旧印换牌落在本人座位。
//   F5 08014a：fightEvade 受限额度在轮边界清理，不再挤占下一轮普通行动。
import { pathToFileURL } from 'node:url'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror/'
const imp = rel => import(pathToFileURL(MOD + rel).href)

const fx = await imp('tests/core-fixture.mjs')
const engine = await imp('src/engine/engine.js')
const support = await imp('src/engine/eote-investigator-support.js')
const resolution = await imp('src/engine/resolution.js')
const disciplines = await imp('src/engine/eote-disciplines.js')
const effectState = await imp('src/engine/effect-state.js')
const deckTopOps = await imp('src/engine/eote-deck-top.js')
const cardRules = await imp('src/cards/card-rules.js')

const { fixture, asset, move } = fx
const { legalMoves, performTest, searchDeck, getStat } = engine
const dec = (title, value) => console.log(`\n## ${title}\n${JSON.stringify(value, null, 1)}`)

function transact (state, run, select = () => null) {
  const execute = draft => run(draft)
  resolution.resolveTransaction(state, 0, { action: 'probe' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    if (i > 120) throw new Error('choice loop')
    const c = state.pendingChoice
    const id = select(c, state) ?? ['done', 'skip', 'self'].find(oid => c.options.some(o => o.id === oid)) ?? c.options[0]?.id
    resolution.resolveTransaction(state, c.seat, { action: 'choose', choiceId: c.id, optionId: id }, execute)
  }
}
const topRecord = (state, seat = 0) => state.scenarioFlags?.mechanics?.eote?.deckTop?.seats?.[seat] || null
const disciplineOf = (state, seat = 0) => state.investigators[seat].assets.find(card => /^0801[1-4][ab]$/.test(String(card.code || '')))
const SETS = [
  { unbrokenCode: '08011a', brokenCode: '08011b', burdenCode: '08015' },
  { unbrokenCode: '08012a', brokenCode: '08012b', burdenCode: '08015' },
  { unbrokenCode: '08013a', brokenCode: '08013b', burdenCode: '08015' },
  { unbrokenCode: '08014a', brokenCode: '08014b', burdenCode: '08015' },
]
function lilyFixture (count = 1) {
  const state = fixture('08010', count)
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
  if (!state.campaign.eote?.disciplines?.sets?.length) disciplines.initializeDisciplines(state, { sets: SETS })
  return state
}
function lilyDiscipline (state, code, seat = 0) {
  const card = asset(state, code, {}, seat)
  if (/b$/.test(code)) state.campaign.eote.disciplines.faces[`${code.slice(0, -1)}a`] = 'broken'
  return card
}
function settleChoice (state) {
  for (let i = 0; state.pendingChoice; i++) {
    if (i > 60) throw new Error('choice loop')
    const choice = state.pendingChoice
    const id = ['done', 'skip', 'self'].find(oid => choice.options.some(o => o.id === oid)) ?? choice.options[0]?.id
    move(state, { action: 'choose', choiceId: choice.id, optionId: id })
  }
}

const out = {}

// ── F1 08013a：别人的检定不得消耗 +5 / 触发翻面；标记在轮边界作废 ─────────────────
{
  const s = lilyFixture(2)
  const card = lilyDiscipline(s, '08013a')
  s.chaosBag = ['0']
  s.currentSeat = 0
  move(s, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settleChoice(s)
  const afterUse = {
    effects: s.effects.filter(effect => effect.sourceCode === '08013a').length,
    marker: disciplineOf(s)?.eoteFlipAfterTest || null,
  }
  // 座位 1 做一次真实技能检定（陈丽丽没参与）。
  s.investigators[1].willpower = 4
  let seat1Result = null
  transact(s, draft => { seat1Result = performTest(draft, 1, 'willpower', 0, {}) })
  const afterOtherSeatTest = {
    effects: s.effects.filter(effect => effect.sourceCode === '08013a').length,
    marker: disciplineOf(s)?.eoteFlipAfterTest || null,
    assetCode: disciplineOf(s)?.code || null,
    seat1TestValue: seat1Result?.value ?? null,
  }
  // 本人在同一回合做自己的检定：+5 生效、结束后翻面、效果过期。
  // 注：getStat 把「下一次检定 +5」的 effect modifier 也算进去（10 = 战斗 4 + 演武 +1 + 效果 +5），
  // 检定值等于该 getStat 即证明 +5 只计了一次。
  const combatBeforeOwnTest = getStat(s, s.investigators[0], 'combat')
  const printedCombat = Number(s.investigators[0].combat) || 0
  let ownResult = null
  transact(s, draft => { ownResult = performTest(draft, 0, 'combat', 0, {}) })
  const afterOwnTest = {
    printedCombat,
    combatBeforeOwnTest,
    ownTestValue: ownResult?.value ?? null,
    effects: s.effects.filter(effect => effect.sourceCode === '08013a').length,
    marker: disciplineOf(s)?.eoteFlipAfterTest || null,
    assetCode: disciplineOf(s)?.code || null,
  }
  // 本轮未做检定的场景：用完 08013a 直接结束回合 → +5 与翻面标记都应作废，且不得翻面。
  const stale = lilyFixture()
  const staleCard = lilyDiscipline(stale, '08013a')
  move(stale, { action: 'ability', assetId: staleCard.id, abilityIndex: 0 })
  settleChoice(stale)
  move(stale, { action: 'endTurn' })
  settleChoice(stale)
  const afterRound = {
    round: stale.round,
    effects: stale.effects.filter(effect => effect.sourceCode === '08013a').length,
    marker: disciplineOf(stale)?.eoteFlipAfterTest || null,
    assetCode: disciplineOf(stale)?.code || null,
  }
  // 之后本人再做一次检定（跨轮）：不得因为旧标记翻面。
  stale.chaosBag = ['0']
  transact(stale, draft => performTest(draft, 0, 'combat', 0, {}))
  const afterLateTest = {
    marker: disciplineOf(stale)?.eoteFlipAfterTest || null,
    assetCode: disciplineOf(stale)?.code || null,
  }
  out.F1 = {
    afterUse,
    afterOtherSeatTest,
    afterOwnTest,
    afterRound,
    afterLateTest,
    verdict: {
      otherSeatDidNotConsume: afterOtherSeatTest.effects === 1 && afterOtherSeatTest.marker === '08013b'
        && afterOtherSeatTest.assetCode === '08013a',
      ownTestGotBonusAndFlipped: afterOwnTest.ownTestValue === afterOwnTest.combatBeforeOwnTest
        && afterOwnTest.ownTestValue === afterOwnTest.printedCombat + 6
        && afterOwnTest.effects === 0 && afterOwnTest.assetCode === '08013b',
      staleMarkerExpiredAtRoundBoundary: afterRound.effects === 0 && afterRound.marker == null
        && afterRound.assetCode === '08013a',
      lateTestDidNotFlip: afterLateTest.assetCode === '08013a',
    },
  }
}

// ── F2 08006：封锁期间 searchDeck / moveCardTo 都不得操纵牌库 ──────────────────────
{
  const s = fixture('08004')
  const inv = s.investigators[0]
  inv.deck = ['01088', '01031', '08006']
  support.syncPassiveDeckTop(s, 0)
  let taken = []
  transact(s, draft => { taken = searchDeck(draft, 0, { type: 'asset', choose: 1, optional: true }) },
    c => c.kind === 'search' ? '0' : null)
  const afterSearch = { deck: [...inv.deck], taken }
  const moved = engine.moveCardTo(s, inv, { code: '08006', from: 'deck', to: 'discard' }, [])
  out.F2 = {
    lockActive: Boolean(support.blockedByDeckTopLock(s, inv)),
    afterSearch,
    moveTopToDiscard: moved,
    deckAfterMove: [...inv.deck],
    discardHas08006: (inv.discard || []).includes('08006') || (s.encounterDiscard || []).includes('08006'),
    allowedDiscardStillWorks: null,
  }
  const allowed = fixture('08004')
  allowed.investigators[0].deck = ['01088', '01088', '08006']
  support.syncPassiveDeckTop(allowed, 0)
  const discardMove = legalMoves(allowed, 0).find(m => m.action === 'deckTopWeaknessDiscard')
  if (discardMove) { move(allowed, discardMove); settleChoice(allowed) }
  out.F2.allowedDiscardStillWorks = {
    enumerated: Boolean(discardMove),
    deck: [...allowed.investigators[0].deck],
    encounterDiscardHas: (allowed.encounterDiscard || []).includes('08006'),
  }
}

// ── F3 08005 第二模式：真实检定投入窗口 / 合法性 / 图标单计 / 投入后重 sync ──────────
{
  const s = fixture('08004')
  asset(s, '08005')
  const inv = s.investigators[0]
  inv.deck = ['01088', '01031'] // 01031 智慧古书：willpower 1
  support.syncPassiveDeckTop(s, 0)
  s.chaosBag = ['0']
  const commitWindows = []
  let lastCommitted = []
  let result = null
  transact(s, draft => { result = performTest(draft, 0, 'willpower', 0, {}) }, choice => {
    if (choice.kind !== 'commit') return null
    const ids = choice.options.map(option => String(option.id))
    commitWindows.push(ids)
    lastCommitted = (s.skillTest?.committed || []).map(item => ({ code: item.code, icons: item.icons }))
    const deckTopOption = choice.options.find(option => String(option.id).startsWith('deckTopCommit:'))
    return deckTopOption ? deckTopOption.id : 'done'
  })
  out.F3 = {
    commitWindows,
    realWindowOfferedDeckTopCommit: commitWindows.some(ids => ids.some(id => id.startsWith('deckTopCommit:'))),
    testValue: result?.value ?? null,
    baseWillpower: getStat(s, s.investigators[0], 'willpower'),
    committedAtLastWindow: lastCommitted,
    bookExhausted: s.investigators[0].assets.find(item => item.code === '08005')?.exhausted ?? null,
    deck: [...s.investigators[0].deck],
    topAfterCommit: topRecord(s)?.code || null,
    committedIconsDelta: result ? result.value - getStat(s, s.investigators[0], 'willpower') : null,
  }
  // 非法：图标不匹配的技能检定不应出现投入候选（01032 只有 agility 1）。
  const bad = fixture('08004')
  asset(bad, '08005')
  bad.investigators[0].deck = ['01088', '01032']
  support.syncPassiveDeckTop(bad, 0)
  bad.chaosBag = ['0']
  const badWindows = []
  transact(bad, draft => performTest(draft, 0, 'willpower', 0, {}), choice => {
    if (choice.kind === 'commit') badWindows.push(choice.options.map(option => String(option.id)))
    return null
  })
  out.F3.mismatchedIconRejected = {
    offered: badWindows.some(ids => ids.some(id => id.startsWith('deckTopCommit:'))),
    deck: [...bad.investigators[0].deck],
    bookExhausted: bad.investigators[0].assets.find(item => item.code === '08005')?.exhausted ?? null,
  }
  // 同地点：把诺曼（座位 1）放到另一个地点，座位 0 的检定不应出现座位 1 的牌库顶投入。
  const far = fixture('08004', 2)
  far.investigators[1].code = '08004'
  far.investigators[1].originalCode = '08004'
  far.investigators[1].assets = []
  asset(far, '08005', {}, 1)
  far.investigators[1].deck = ['01088', '01031']
  far.investigators[1].location = 'farAwayLocation'
  if (!far.locations.some(loc => loc.id === 'farAwayLocation')) {
    far.locations.push({ id: 'farAwayLocation', name: '远处地点', code: 'farAwayLocation', connections: [], revealed: true, clues: 0, shroud: 1 })
  }
  support.syncPassiveDeckTop(far, 1)
  far.chaosBag = ['0']
  const farOwnerSeats = []
  transact(far, draft => performTest(draft, 0, 'willpower', 0, {}), choice => {
    if (choice.kind === 'commit') {
      farOwnerSeats.push(choice.seat)
      const help = choice.options.find(option => option.id === 'help')
      if (help) return 'help'
    }
    return null
  })
  out.F3.farOwnerCannotCommit = { commitOwnerSeats: farOwnerSeats, seat1TopRecord: topRecord(far, 1)?.code || null }
  // 同地点的队友（书主作为协助者）：检定者请求协助后，书主的投入窗口出现牌库顶候选。
  const mate = fixture('08004', 2)
  const [performer, owner] = mate.investigators
  performer.code = '01001'
  performer.originalCode = '01001'
  owner.code = '08004'
  owner.originalCode = '08004'
  owner.assets = []
  asset(mate, '08005', {}, 1)
  owner.deck = ['01088', '01031']
  owner.location = performer.location
  support.syncPassiveDeckTop(mate, 1)
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
  out.F3.helperSameLocation = {
    helperWindows,
    offeredToHelper: helperWindows.some(window => window.seat === 1
      && window.ids.some(id => id.startsWith('deckTopCommit:'))),
    ownerBookExhausted: mate.investigators[1].assets.find(item => item.code === '08005')?.exhausted ?? null,
    ownerDeck: [...mate.investigators[1].deck],
    ownerTopRecord: topRecord(mate, 1)?.code || null,
  }
}

// ── F4 08004：牌库顶打出后重新揭示；非本人回合旧印换牌落在本人座位 ──────────────────
{
  const s = fixture('08004')
  const inv = s.investigators[0]
  inv.deck = ['01030', '01088', '01031']
  support.syncPassiveDeckTop(s, 0)
  const playMove = legalMoves(s, 0).find(m => m.action === 'play' && m.fromDeckTop)
  move(s, playMove)
  settleChoice(s)
  out.F4 = {
    playMoveFound: Boolean(playMove),
    topBeforePlay: '01031',
    topAfterPlayingTop: topRecord(s)?.code || null,
    deckAfter: [...s.investigators[0].deck],
  }
  const t = fixture('08004', 2)
  const [n0, n1] = t.investigators
  // 座位 0 = 无关的核心调查员（当回合行动者），座位 1 = 诺曼（非本人回合被强制检定）。
  n0.code = '01001'
  n0.originalCode = '01001'
  n0.name = '罗兰（座位 0，当回合行动者）'
  n1.code = '08004'
  n1.originalCode = '08004'
  n1.name = '诺曼（座位 1）'
  n0.deck = ['01030', '01088', '01031']
  n0.hand = []
  n1.deck = ['01030', '01088', '01031']
  n1.hand = ['01030']
  support.syncPassiveDeckTop(t, 1)
  t.currentSeat = 0
  t.chaosBag = ['eldersign']
  const seat0Before = { deck: [...n0.deck], hand: [...n0.hand] }
  transact(t, draft => performTest(draft, 1, 'willpower', 0, {}), choice =>
    choice.kind === 'effect' && choice.options.some(option => option.id === '01030') ? '01030' : null)
  const seat0After = { deck: [...t.investigators[0].deck], hand: [...t.investigators[0].hand] }
  out.F4.elderSignSwapSeat = {
    seat0Before,
    seat0Deck: seat0After.deck,
    seat0Hand: seat0After.hand,
    seat1Deck: [...t.investigators[1].deck],
    seat1Hand: [...t.investigators[1].hand],
    seat1TopRecord: topRecord(t, 1)?.code || null,
    seat0TopRecord: topRecord(t, 0)?.code || null,
    verdict: {
      seat0Untouched: JSON.stringify(seat0Before) === JSON.stringify(seat0After),
      seat1Swapped: t.investigators[1].hand.includes('01031')
        && topRecord(t, 1)?.code === '01030',
    },
  }
}

// ── F5 08014a：fightEvade 额度在轮边界清理 ───────────────────────────────────────
{
  const s = lilyFixture()
  const card = lilyDiscipline(s, '08014a')
  move(s, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settleChoice(s)
  const afterUse = {
    actionsLeft: s.investigators[0].actionsLeft,
    credits: s.investigators[0].fightEvadeOnlyActions || 0,
  }
  move(s, { action: 'endTurn' })
  settleChoice(s)
  const inv = s.investigators[0]
  out.F5 = {
    afterUse,
    nextRound: {
      round: s.round,
      phase: s.phase,
      actionsLeft: inv.actionsLeft,
      fightEvadeCredits: inv.fightEvadeOnlyActions || 0,
      normalActionsUsable: Math.max(0, (inv.actionsLeft || 0) - (inv.fightEvadeOnlyActions || 0)),
    },
  }
}

// ── F0 修复前旧读点回放（证明下列缺陷确实由修复前的两条/若干读点造成）──────────────
// 这一节直接调用「修复前的旧读点」：不传 seat 的全局翻面、全局 expireEffects、直接
// consumeDeckTop（旧打出通道）、只查 investigator.restrictedAction 的旧清理口径。
{
  // F0-a 08013a：旧版 closeTest 结尾 = 全局 expireEffects + 全局 applyPendingFlipAfterTests。
  const s = lilyFixture(2)
  const card = lilyDiscipline(s, '08013a')
  s.chaosBag = ['0']
  s.currentSeat = 0
  move(s, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settleChoice(s)
  const legacyFlipped = support.applyPendingFlipAfterTests(s) // 不传 seat = 修复前全局行为
  const legacyExpired = effectState.expireEffects(s, 'endOfTest') // 修复前全局过期读点
  out.F0_legacy08013a = {
    scenario: '陈丽丽使用 08013a 后，座位 1 的检定收尾（旧读点：全局）',
    legacyGlobalFlipCount: legacyFlipped,
    assetCodeAfterLegacyGlobalFlip: disciplineOf(s)?.code || null,
    legacyGlobalExpireRemoved: legacyExpired.filter(effect => effect.sourceCode === '08013a').length,
    note: '修复后 tests.js 传 seat：expire 只对本次检定执行者的「下一次检定 +N」生效，'
      + 'applyPendingFlipAfterTests(state, seat) 只处理执行者本人的资产。',
  }

  // F0-b 08004：旧打出通道只 consumeDeckTop，不重新揭示。
  const t = fixture('08004')
  t.investigators[0].deck = ['01030', '01088', '01031']
  support.syncPassiveDeckTop(t, 0)
  const consumed = deckTopOps.consumeDeckTop(t, 0)
  out.F0_legacy08004 = {
    scenario: '旧 play-channels deckTop 通道：consumeDeckTop 后无 sync',
    consumed: consumed.code,
    topAfterLegacyConsume: topRecord(t)?.code ?? null,
    note: '修复后 takeToHand 的 finish()/actionFinish 在打出后调用 syncPassiveDeckTop(force) 立即揭示新顶牌。',
  }

  // F0-c 08014a：旧版 beginInvestigationPhase 只清 investigator.restrictedAction 声明的 kind。
  out.F0_legacy08014a = {
    investigator08010DeclaresRestrictedAction: cardRules.investigatorRule('08010')?.restrictedAction ?? null,
    legacyPhaseResetWouldClearFightEvade: cardRules.investigatorRule('08010')?.restrictedAction?.kind === 'fightEvade',
    note: '修复后 turn.js 在调查阶段开始对 RESTRICTED_ACTION_KINDS 全部清理（含 fightEvade/itemPlay）。',
  }
}

console.log(JSON.stringify(out, null, 1))
// 可选：把同一份 JSON 写入文件（UTF-8，供 before/after 对比留档）。
// 用法：EOTE_FIX_OUT=<path> node .../_fix-p0-10.mjs
if (process.env.EOTE_FIX_OUT) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(process.env.EOTE_FIX_OUT, JSON.stringify(out, null, 1) + '\n', 'utf8')
}
