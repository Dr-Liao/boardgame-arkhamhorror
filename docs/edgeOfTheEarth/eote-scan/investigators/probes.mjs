// inv-auditor 只读探针：验证 EOTE 调查员 22 卡审计中的可疑点。
// 只读 games/arkhamhorror/**（import），不写任何 Mod 文件；输出仅 stdout。
// 运行：cd G:\boardgame-hall-ai && node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/investigators/probes.mjs
import { pathToFileURL } from 'node:url'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror/'
const imp = rel => import(pathToFileURL(MOD + rel).href)

const fx = await imp('tests/core-fixture.mjs')
const engine = await imp('src/engine/engine.js')
const support = await imp('src/engine/eote-investigator-support.js')
const mechanics = await imp('src/engine/api-mechanics.js')
const resolution = await imp('src/engine/resolution.js')
const disciplines = await imp('src/engine/eote-disciplines.js')

const { fixture, asset, enemy, move, settle } = fx
const { legalMoves, performTest, searchDeck, applyDamage, getStat, reactionWindow } = engine

function transact (state, run, select = () => null) {
  const execute = draft => run(draft)
  resolution.resolveTransaction(state, 0, { action: 'probe' }, execute)
  for (let i = 0; state.pendingChoice; i++) {
    if (i > 100) throw new Error('choice loop')
    const c = state.pendingChoice
    const id = select(c, state) ?? ['done', 'skip', 'self'].find(oid => c.options.some(o => o.id === oid)) ?? c.options[0]?.id
    resolution.resolveTransaction(state, c.seat, { action: 'choose', choiceId: c.id, optionId: id }, execute)
  }
}
const topRecord = (state, seat = 0) => state.scenarioFlags?.mechanics?.eote?.deckTop?.seats?.[seat] || null
const dec = (title, value) => console.log(`\n## ${title}\n${typeof value === 'string' ? value : JSON.stringify(value, null, 1)}`)

// ── P1 08004：打出牌库顶后，新的牌库顶不再揭示（同步缺口）──────────────────────
{
  const s = fixture('08004')
  const inv = s.investigators[0]
  inv.deck = ['01030', '01088', '01031']
  support.syncPassiveDeckTop(s, 0)
  const before = topRecord(s)
  const playMove = legalMoves(s, 0).find(m => m.action === 'play' && m.fromDeckTop)
  move(s, playMove)
  settle(s)
  const afterPlay = topRecord(s)
  support.syncPassiveDeckTop(s, 0) // 手工补一次同步（真实对局里只有抽牌/轮初才同步）
  const afterSync = topRecord(s)
  dec('P1 08004 牌库顶揭示同步', {
    topBefore: before?.code || null,
    topAfterPlayingTop: afterPlay?.code || null,
    topAfterManualSync: afterSync?.code || null,
    deckTopAfterPlayIsNull: afterPlay == null,
    verdict: afterPlay == null ? 'BUG: 打出顶牌后揭示记录被清空且无人重新同步，顶牌在抽牌/轮初前不再揭示' : 'ok'
  })
}

// ── P2 08004：顶牌揭示到弱点时“强制抽取”只在 drawCards 尾部执行，不是揭示即抽 ──
{
  const s = fixture('08004')
  const inv = s.investigators[0]
  inv.deck = ['01088', '01096'] // 01096 失忆（基础弱点）
  inv.hand = []
  support.syncPassiveDeckTop(s, 0)
  const revealedWeakness = topRecord(s)?.code
  const deckBefore = inv.deck.length
  const handBefore = inv.hand.length
  dec('P2 08004 强制抽弱点时机', {
    revealedTop: revealedWeakness,
    deckLengthBeforeAnyDraw: deckBefore,
    handBefore,
    note: '揭示本身不触发强制抽取；实现只在 drawCards 尾部（deck-ops.js:632-640）才抽。下一步用 0 张抽牌触发同一函数的尾部逻辑。'
  })
  transact(s, draft => { engine.drawCards(draft, draft.investigators[0], 0, []) })
  dec('P2 08004 强制抽弱点实际触发', {
    deckLengthAfterTriggeringDrawCards0: s.investigators[0].deck.length,
    handCodes: s.investigators[0].hand,
    topAfter: topRecord(s)?.code
  })
}

// ── P3 08005：伊波恩之书投入牌库顶 —— 技能图标不计匹配、也不校验同地点 ──────────
{
  const s = fixture('08004')
  const book = asset(s, '08005')
  const inv = s.investigators[0]
  inv.deck = ['01088', '01031'] // 01031 智慧古书：图标只有 intellect/wild
  support.syncPassiveDeckTop(s, 0)
  s.skillTest = { seat: 0, skill: 'combat', difficulty: 2, committed: [] }
  const icons = {}
  const { ALL_CARDS } = await imp('src/cards/cards-data.js')
  icons.card = ALL_CARDS['01031']
  const ok = support.canCommitDeckTop(s, 0)
  const commitMove = legalMoves(s, 0).find(m => m.action === 'ability' && m.assetId === book.id && m.abilityIndex === 1)
  move(s, commitMove)
  settle(s)
  dec('P3a 08005 投入牌库顶的合法性', {
    canCommitDeckTopOnCombatTest: ok,
    committed: s.skillTest.committed.map(x => ({ code: x.code, icons: x.icons, fromDeckTop: x.fromDeckTop })),
    lostEligibilityCheck: 'canCommitToTest（commit-rules.js:19-54 的图标匹配/额外费用检查）完全没走；icons 取的是全部图标之和'
  })

  const s2 = fixture('08004', 2)
  const inv2 = s2.investigators[0]
  inv2.deck = ['01088', '01031']
  support.syncPassiveDeckTop(s2, 0)
  if (!s2.locations.some(l => l.id === 'probeOther')) {
    s2.locations.push({ id: 'probeOther', name: '探针地点', code: 'probeOther', connections: [], revealed: true, clues: 0, shroud: 1 })
  }
  s2.investigators[1].location = 'probeOther'
  s2.skillTest = { seat: 1, skill: 'willpower', difficulty: 2, committed: [] }
  dec('P3b 08005 投入牌库顶的同地点检查', {
    performerSeat: s2.skillTest.seat,
    performerLocation: s2.investigators[1].location,
    bookOwnerLocation: inv2.location,
    canCommitDeckTop: support.canCommitDeckTop(s2, 0),
    verdict: support.canCommitDeckTop(s2, 0) ? 'BUG: 非本人/非同地点调查员执行的检定仍可投入牌库顶（卡面限定 at your location）' : 'ok'
  })
}

// ── P4 08014a：翻面发生在获得免费行动之前 → 三个攻击/躲避行动失去 +1 敏捷 ─────────
{
  const s = fixture('08010')
  const inv = s.investigators[0]
  inv.assets = []
  if (!s.campaign.eote?.disciplines?.sets?.length) {
    disciplines.initializeDisciplines(s, { sets: [
      { unbrokenCode: '08011a', brokenCode: '08011b', burdenCode: '08015' },
      { unbrokenCode: '08012a', brokenCode: '08012b', burdenCode: '08015' },
      { unbrokenCode: '08013a', brokenCode: '08013b', burdenCode: '08015' },
      { unbrokenCode: '08014a', brokenCode: '08014b', burdenCode: '08015' },
    ] })
  }
  const card = asset(s, '08014a')
  const agilityBefore = getStat(s, inv, 'agility')
  move(s, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settle(s)
  const agilityAfter = getStat(s, s.investigators[0], 'agility')
  dec('P4 08014a 翻面时机与 +1 敏捷', {
    agilityWithUnbroken: agilityBefore,
    agilityImmediatelyAfterAction: agilityAfter,
    assetCodeNow: s.investigators[0].assets.find(a => /^0801[1-4][ab]$/.test(a.code))?.code,
    fightEvadeCredits: s.investigators[0].fightEvadeOnlyActions,
    verdict: agilityAfter === agilityBefore - 1
      ? 'BUG: 翻面在获得免费行动之前完成，随后 3 次战斗/躲避都用 Broken 面结算（失去 +1 敏捷；卡面是“先行动、后翻面”）'
      : 'ok'
  })
}

// ── P5 08006：牌库顶封锁只在 drawCards 生效；searchDeck 仍可检索 ──────────────────
{
  const s = fixture('08004')
  const inv = s.investigators[0]
  inv.deck = ['01088', '01031', '08006']
  support.syncPassiveDeckTop(s, 0)
  let taken = []
  transact(s, draft => { taken = searchDeck(draft, 0, { type: 'asset', choose: 1, optional: true }) }, c =>
    c.kind === 'search' ? '0' : null)
  dec('P5 08006 封锁牌库的读点覆盖', {
    deckTopRevealed: topRecord(s)?.code,
    lockActive: Boolean(support.blockedByDeckTopLock(s, inv)),
    searchDeckReturned: taken,
    verdict: taken.length
      ? 'BUG: 预示者在牌库顶揭示时仍能 searchDeck 并取走牌（卡面：cannot be searched, drawn, or manipulated in any way）；实现只在 deck-ops.js#drawCards 挡了抽牌'
      : 'ok'
  })
}

// ── P6 08004 旧印换牌：api.moveCard 按 currentSeat 而不是 inv.seat ────────────────
{
  const s = fixture('08004', 2)
  const [n0, n1] = s.investigators
  n1.code = '08004'
  n1.originalCode = '08004'
  n1.name = '诺曼（座位 1）'
  n0.deck = ['01030', '01088', '01031']
  n1.deck = ['01030', '01088', '01031']
  n1.hand = ['01030']
  support.syncPassiveDeckTop(s, 1)
  s.currentSeat = 0 // 例：神话阶段座位 1 的诺曼被迫做检定，行动者仍是座位 0
  s.chaosBag = ['eldersign']
  transact(s, draft => performTest(draft, 1, 'willpower', 0, {}), c =>
    c.kind === 'effect' && c.options.some(o => o.id === '01030') ? '01030' : null)
  dec('P6 08004 旧印换牌的座位归属', {
    seat0Deck: s.investigators[0].deck,
    seat0Hand: s.investigators[0].hand,
    seat1Deck: s.investigators[1].deck,
    seat1Hand: s.investigators[1].hand,
    seat0TopRecord: topRecord(s, 0)?.code || null,
    seat1TopRecord: topRecord(s, 1)?.code || null,
    verdict: (s.investigators[0].hand.length > 0 || s.investigators[0].deck.length !== 3)
      ? 'BUG: 座位 1 诺曼的旧印换牌调用了 api.moveCard（api-test.js:199 固定用 state.currentSeat=0），换的是座位 0 的牌'
      : 'ok'
  })
}

// ── P7 08011b：“本轮受到伤害/恐惧”记账在分配/取消前写入 ─────────────────────────
{
  const s = fixture('08010')
  const inv = s.investigators[0]
  inv.roundEvents = { damage: 0, horror: 0, tests: 0, handTwoPlus: false, enemyAtLocation: false }
  // 制造一个会在 harmDealt 窗口取消全部伤害的观察：先看记账是否已发生（引擎只在 applyHarm 里记账）
  transact(s, draft => { applyDamage(draft, draft.investigators[0], 1, []) })
  dec('P7 08011b 受伤记账口径', {
    roundEventsAfterApplyDamage: s.investigators[0].roundEvents,
    note: '记账在 applyHarm 入口（enemies.js:864-865）先写，随后 harmDealt/beforeHarm 才可能取消/改值；被取消的伤害也计数。'
  })
}

// ── P8 08013a：延迟翻面/「下一次检定 +5」按任意调查员的检定结束结算 ──────────────
{
  const s = fixture('08010', 2)
  const inv = s.investigators[0]
  inv.assets = []
  if (!s.campaign.eote?.disciplines?.sets?.length) {
    disciplines.initializeDisciplines(s, { sets: [
      { unbrokenCode: '08011a', brokenCode: '08011b', burdenCode: '08015' },
      { unbrokenCode: '08012a', brokenCode: '08012b', burdenCode: '08015' },
      { unbrokenCode: '08013a', brokenCode: '08013b', burdenCode: '08015' },
      { unbrokenCode: '08014a', brokenCode: '08014b', burdenCode: '08015' },
    ] })
  }
  const card = asset(s, '08013a')
  move(s, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settle(s)
  const effectAfterUse = s.effects.length
  const assetAfterUse = s.investigators[0].assets.find(a => /^0801[1-4][ab]$/.test(a.code))?.code
  // 另一名调查员（座位 1）做一个检定：卡面只要求「你」的下一次检定。
  s.chaosBag = ['0']
  transact(s, draft => performTest(draft, 1, 'willpower', 0, {}))
  dec('P8 08013a 延迟翻面/效果过期的座位归属', {
    effectAfterUse,
    assetCodeAfterUse: assetAfterUse,
    effectsAfterOtherSeatTest: s.effects.length,
    assetCodeAfterOtherSeatTest: s.investigators[0].assets.find(a => /^0801[1-4][ab]$/.test(a.code))?.code,
    verdict: (s.effects.length === 0 || s.investigators[0].assets.find(a => /^0801[1-4][ab]$/.test(a.code))?.code === '08013b')
      ? 'BUG: 任意调查员的检定结束都会 expireEffects(endOfTest) 并 applyPendingFlipAfterTests，陈丽丽的“下一次检定 +5/结束后翻面”被别人的检定提前消耗'
      : 'ok'
  })
}

