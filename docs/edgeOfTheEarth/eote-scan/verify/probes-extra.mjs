// 独立复核员补充探针（只读 games/arkhamhorror/**，输出仅 stdout）。
// 目的：复核审计员未覆盖/表述过强的点。
// 运行：cd G:\boardgame-hall-ai && node games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/verify/probes-extra.mjs
import { pathToFileURL } from 'node:url'

const MOD = 'G:/boardgame-hall-ai/games/arkhamhorror/'
const imp = rel => import(pathToFileURL(MOD + rel).href)

const fx = await imp('tests/core-fixture.mjs')
const engine = await imp('src/engine/engine.js')
const support = await imp('src/engine/eote-investigator-support.js')
const disciplines = await imp('src/engine/eote-disciplines.js')
const mechanics = await imp('src/engine/api-mechanics.js')
const { ALL_CARDS } = await imp('src/cards/cards-data.js')

const { fixture, asset, move, settle } = fx
const { legalMoves, actionCost } = engine
const dec = (title, value) => console.log(`\n## ${title}\n${JSON.stringify(value, null, 1)}`)

const lilyAssets = state => state.investigators[0].assets.filter(a => /^0801[1-4][ab]$/.test(a.code))

function initDisciplines (s) {
  if (!s.campaign.eote?.disciplines?.sets?.length) {
    disciplines.initializeDisciplines(s, { sets: [
      { unbrokenCode: '08011a', brokenCode: '08011b', burdenCode: '08015' },
      { unbrokenCode: '08012a', brokenCode: '08012b', burdenCode: '08015' },
      { unbrokenCode: '08013a', brokenCode: '08013b', burdenCode: '08015' },
      { unbrokenCode: '08014a', brokenCode: '08014b', burdenCode: '08015' },
    ] })
  }
}

// ── V1 08005 第二条 [fast]：真正的技能检定窗口里，能力是否可被激活？ ──────────────
{
  const s = fixture('08004')
  const inv = s.investigators[0]
  const book = asset(s, '08005')
  inv.deck = ['01088', '01031']
  support.syncPassiveDeckTop(s, 0)
  // 模拟真实检定期间：引擎把 commit 提示做成 pendingChoice（tests.js:434 requestChoice kind='commit'）。
  s.pendingChoice = { id: 'probe-commit', kind: 'commit', seat: 0, prompt: '投入手牌', options: [{ id: 'done', label: '开始检定' }] }
  const moves = legalMoves(s, 0)
  const abilityMoves = moves.filter(m => m.action === 'ability')
  dec('V1 08005 投入能力在真实检定窗口的可达性', {
    pendingChoiceKind: s.pendingChoice.kind,
    legalMoveActions: [...new Set(moves.map(m => m.action))],
    abilityMoveCount: abilityMoves.length,
    bookAbilityOffered: abilityMoves.some(m => m.assetId === book.id && m.abilityIndex === 1),
    verdict: abilityMoves.length === 0
      ? '未证实可达：pendingChoice 存在时 legalMoves 只返回 choose（moves.js:206-208）；而 state.skillTest 在检定之外被还原为 null（tests.js:644），criteria 亦不成立'
      : '可达',
  })
}

// ── V2 08013a：翻面标记 eoteFlipAfterTest 没有回合末清理，效果过期后标记仍在 ──────────
{
  const s = fixture('08010')
  const inv = s.investigators[0]
  inv.assets = []
  initDisciplines(s)
  const card = asset(s, '08013a')
  move(s, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settle(s)
  const afterUse = { effects: s.effects.length, marker: lilyAssets(s)[0]?.eoteFlipAfterTest || null }
  // 回合结束：endOfTurn 会清 endOfTest 效果（turn-flow.js:414），但不碰 asset.eoteFlipAfterTest。
  move(s, { action: 'endTurn' })
  settle(s)
  const afterTurn = {
    round: s.round,
    effects: s.effects.length,
    marker: lilyAssets(s)[0]?.eoteFlipAfterTest || null,
    assetCode: lilyAssets(s)[0]?.code || null,
  }
  dec('V2 08013a 翻面标记的过期点', {
    afterUse,
    afterTurn,
    verdict: afterTurn.marker != null && afterTurn.effects === 0
      ? 'BUG（审计员未提）：+5 效果随回合结束清除，但延迟翻面标记留在资产上，没有任何过期/清理读点；会在之后任意一次检定结束时（可能跨回合、跨轮、由别的调查员触发）才翻面'
      : '标记已随回合清理或效果仍在（需人工判读）',
  })
}

// ── V3 08014a：fightEvade 额度没有清理点，跨回合残留并占用下回合行动点 ───────────────
{
  const s = fixture('08010')
  const inv = s.investigators[0]
  inv.assets = []
  initDisciplines(s)
  const card = asset(s, '08014a')
  move(s, { action: 'ability', assetId: card.id, abilityIndex: 0 })
  settle(s)
  const afterUse = { actionsLeft: s.investigators[0].actionsLeft, credits: s.investigators[0].fightEvadeOnlyActions || 0 }
  move(s, { action: 'endTurn' })
  settle(s)
  const after = s.investigators[0]
  dec('V3 08014a 免费行动额度的清理点', {
    afterUse,
    afterPhaseAdvance: {
      round: s.round,
      phase: s.phase,
      actionsLeft: after.actionsLeft,
      fightEvadeCredits: after.fightEvadeOnlyActions || 0,
      normalActionsUsable: Math.max(0, (after.actionsLeft || 0) - (after.fightEvadeOnlyActions || 0)),
    },
    note: '清点：beginInvestigationPhase（turn.js:552-565）只对声明 investigator.restrictedAction 的调查员调用 clearRestrictedAction；08010 未声明，fightEvade 额度无任何清除调用点（全仓 grep 仅 grant/consume/reads）。',
    verdict: (after.fightEvadeOnlyActions || 0) > 0
      ? 'BUG（比审计员“可留到本回合之后使用”更强）：额度跨阶段残留，新回合 actionsLeft=3 被 3 点受限额度抵掉 → 普通行动可用 0'
      : 'ok',
  })
}

// ── V4 08006：封锁是否也覆盖「弃顶/搬走顶牌」等其他操纵路径（审计员只举证了 searchDeck）──
{
  const s = fixture('08004')
  const inv = s.investigators[0]
  inv.deck = ['01088', '01031', '08006'] // 数组尾 = 牌库顶
  support.syncPassiveDeckTop(s, 0)
  const before = [...inv.deck]
  const looked = engine.lookAt(s, 0, { count: 1, source: 'probe' })
  const moved = engine.moveCardTo(s, inv, { code: '08006', from: 'deck', to: 'discard' }, [])
  const after = [...s.investigators[0].deck]
  dec('V4 08006 封锁对其它牌库操纵路径', {
    lockActive: Boolean(support.blockedByDeckTopLock(s, inv)),
    deckTopBefore: before.at(-1),
    lookAtResult: JSON.stringify(looked).slice(0, 160),
    moveTopToDiscard: moved,
    deckAfter: after,
    deckChanged: JSON.stringify(after) !== JSON.stringify(before),
    discardHas08006: (s.investigators[0].discard || []).includes('08006') || (s.encounterDiscard || []).includes('08006'),
    verdict: JSON.stringify(after) !== JSON.stringify(before)
      ? 'BUG 扩展成立：封锁期内把牌库顶移入弃牌堆（操纵）未被拦截，且 lock 唯一读点是 drawCards'
      : '本探针未观察到破坏',
  })
}

// ── V5 08016：授权后，代打是否必须花 itemPlay 受限额度（普通行动能不能代打）──────────
{
  const s = fixture('08016', 2)
  const [, mate] = s.investigators
  s.currentSeat = 0
  s.phase = 'investigation'
  mate.hand = ['01016'] // [[道具]] 支援
  mate.location = s.investigators[0].location
  const api = mechanics.createMechanicsApi(s)
  api.interactions.crossSeat.grant(0, { fromSeat: 1, codes: ['01016'] })
  s.investigators[0].actionsLeft = 3
  delete s.investigators[0].itemPlayOnlyActions
  const candidate = legalMoves(s, 0).find(m => m.action === 'play' && m.fromOtherHand === true)
  let error = null
  try { error = fx.validateMove(s, 0, candidate) } catch (e) { error = 'throw:' + e.message }
  dec('V5 08016 代打是否需要受限额度', {
    itemPlayCredits: s.investigators[0].itemPlayOnlyActions || 0,
    actionsLeft: s.investigators[0].actionsLeft,
    candidateFound: Boolean(candidate),
    actionCost: candidate ? actionCost(s, s.investigators[0], candidate) : null,
    validateMoveError: error,
    verdict: candidate && error == null
      ? 'BUG：itemPlay 受限额度=0 时，代打仍作为合法普通行动（actionCost=1），只花普通行动点；卡面「额外行动只能用于代打」未被强制'
      : '不成立',
  })
}

// ── V6 08017：非 [[Item]] 资产是否也弹「由谁控制」───────────────────────────────
{
  const s = fixture('08016', 2)
  s.currentSeat = 0
  s.phase = 'investigation'
  asset(s, '08017')
  const inv = s.investigators[0]
  const code = '01017' // 体能训练：asset，traits = Talent（不含 Item）
  inv.hand = [code]
  inv.resources = 30
  inv.actionsLeft = 30
  const traits = ALL_CARDS[code].traits || []
  let prompted = false
  let promptText = null
  let canSkip = null
  move(s, { action: 'play', cardId: code })
  if (s.pendingChoice) {
    prompted = true
    promptText = s.pendingChoice.prompt || null
    canSkip = s.pendingChoice.canSkip ?? null
  }
  settle(s)
  dec('V6 08017 非 Item 资产的控制者询问', {
    card: code,
    cardTraits: traits,
    isItem: traits.some(t => String(t).toLowerCase() === 'item'),
    prompted,
    promptText,
    canSkip,
    verdict: prompted
      ? 'BUG 成立：非 [[Item]] 资产也弹「由谁控制」（actions.js:387-400 未按 traits 过滤）'
      : '本探针未触发（可能只有 1 位同地点候选或资产未上场）',
  })
}

// ── V7 08010 旧印翻回演武是否读 08015「本轮不能翻回」锁 ────────────────────────────
{
  const s = fixture('08010')
  const inv = s.investigators[0]
  inv.assets = []
  const broken = asset(s, '08011b')
  // 08015 的锁形状：endOfRound 效果，sourceCode='08015'，sourceInstanceId=被翻面的资产实例。
  // （08011b/12b/13b/14b 的 lockedThisRound 正是按这两个字段判定。）
  s.effects.push({
    id: 'probe-lock', sourceCode: '08015', sourceInstanceId: broken.id, controllerSeat: 0,
    duration: 'endOfRound', label: '命运重担：本轮不能翻回', modifiers: [],
    createdAt: { round: s.round, phase: s.phase, turnSerial: s.turnSerial },
  })
  s.chaosBag = ['eldersign']
  const before = lilyAssets(s).map(a => a.code)
  const { performTest } = engine
  const resolution = await imp('src/engine/resolution.js')
  const execute = draft => { performTest(draft, 0, 'willpower', 0, {}) }
  resolution.resolveTransaction(s, 0, { action: 'probe' }, execute)
  for (let i = 0; s.pendingChoice && i < 50; i++) {
    const c = s.pendingChoice
    const id = ['done', 'skip', 'self'].find(oid => c.options.some(o => o.id === oid)) ?? c.options[0]?.id
    resolution.resolveTransaction(s, c.seat, { action: 'choose', choiceId: c.id, optionId: id }, execute)
  }
  dec('V7 08010 旧印与 08015 翻回锁', {
    before,
    after: lilyAssets(s).map(a => a.code),
    lockStillPresent: (s.effects || []).some(e => e.sourceCode === '08015'),
    verdict: lilyAssets(s).some(a => a.code === '08011a')
      ? 'BUG 成立：08010 旧印在 08015 锁生效期间仍把 Broken 演武翻回 Unbroken（四张 Broken 面的 lockedThisRound 检查未被 08010 复用）'
      : '未复现',
  })
}
