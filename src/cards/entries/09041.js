// 09041 实证假设 · 每轮为各自的卡实例选择判据。
import { customizationOptionFullyChecked } from '../../engine/tsk-customizable.js'

const SOURCE = '09041'
const criteriaKey = source => `tskEmpiricalHypothesisCriteria:${source.id}`
const unlocked = (state, inv, index) => customizationOptionFullyChecked(state, inv.seat, SOURCE, index)
const evidenceUpgrade = (state, source, index) => state.investigators.some(owner =>
  owner.assets.includes(source) && unlocked(state, owner, index))
const meetsFor = (state, inv, seat) => seat === inv.seat
  || (unlocked(state, inv, 4) && state.investigators[seat]?.location === inv.location)
const chosenFor = (state, source) => {
  const holders = () => state.investigators.flatMap(inv => inv.assets).filter(asset => asset.code === SOURCE)
  const legacy = state.scenarioFlags?.tskEmpiricalHypothesisCriteria
  const chosen = state.scenarioFlags?.[criteriaKey(source)]
    || (legacy?.round === state.round && holders().length === 1 ? { ...legacy, used: [legacy.criteria] } : null)
  return chosen?.round === state.round ? chosen : null
}
const criteria = [
  { id: 'fail', label: '你检定失败且低于难度至少 2 点' },
  { id: 'success', label: '你检定成功且超过难度至少 3 点' },
  { id: 'hand', label: '你的手牌用尽', upgrade: 0 },
  { id: 'harm', label: '你受到伤害或恐惧', upgrade: 1 },
  { id: 'discard', label: '你从场上弃掉一张诡计或一名敌人', upgrade: 2 },
  { id: 'field', label: '你进入隐藏值至少为 3 的地点', upgrade: 3 },
]
const availableCriteria = (state, inv) => criteria.filter(({ upgrade }) => upgrade == null || unlocked(state, inv, upgrade))

function selectCriterion({ state, inv, source, api }, previous = [], optional = false) {
  const options = availableCriteria(state, inv).filter(({ id }) => !previous.includes(id))
  if (!options.length) return false
  const answer = api.choice({
    kind: 'effect', source: SOURCE, seat: inv.seat,
    prompt: '实证假设：选择本轮判据。',
    options: optional ? [...options, { id: 'skip', label: '保持当前判据' }] : options,
  })
  const selected = options.find(({ id }) => id === answer)
  if (!selected) return false
  api.setScenarioFlag(criteriaKey(source), { round: state.round, criteria: selected.id, used: [...previous, selected.id] })
  return true
}

function evidenceReaction(trigger, id, test) {
  return {
    kind: 'reaction', trigger, label: '达成判据：横置实证假设并增加 1 证据',
    criteria: [ctx => !ctx.source.exhausted && chosenFor(ctx.state, ctx.source)?.criteria === id && test(ctx)],
    resolve: ({ source, api }) => {
      api.exhaust(source)
      api.addCardCounter(source, 'evidence', 1)
    },
  }
}

const performingSeat = ({ state, context }) => state.skillTest?.seat ?? context.seat
const canSpend = count => ({ source }) => (source.markers?.evidence || 0) >= count

export default {
  code: SOURCE,
  limitPerInvestigator: true,
  teamActivatable: ({ state, owner }) => unlocked(state, owner, 4),
  customizationOptions: [
    { name: 'Pessimistic Outlook', checks: 1, text: 'Add the following criteria: "you run out of cards in your hand."' },
    { name: 'Trial and Error', checks: 1, text: 'Add the following criteria: "you are dealt damage or horror."' },
    { name: 'Independent Variable', checks: 1, text: 'Add the following criteria: "you discard a treachery or enemy from play."' },
    { name: 'Field Research', checks: 1, text: 'Add the following criteria: "you enter a location with 3 or more shroud."' },
    { name: 'Peer Review', checks: 2, text: 'The chosen criteria is met if any investigator at your location meets it, instead of only you. Other investigators at your location may trigger [fast] abilities on Empirical Hypothesis.' },
    { name: 'Research Grant', checks: 2, text: 'Empirical Hypothesis gains: "[fast] Spend 2 evidence: Reduce the cost of the next card you play this phase by 3."' },
    { name: 'Irrefutable Proof', checks: 3, text: 'Empirical Hypothesis gains: "[fast] Spend 3 evidence: Discover 1 clue at your location."' },
    { name: 'Alternative Hypothesis', checks: 4, text: 'After you exhaust Empirical Hypothesis, you may resolve its forced effect, choosing a criteria you have not chosen this round. Then, ready it.' },
  ],
  abilities: [
    {
      kind: 'forced', trigger: 'roundStarts', label: '一轮开始：选择本轮判据',
      resolve: ctx => selectCriterion(ctx),
    },
    evidenceReaction('skillTestSuccess', 'success', ctx => meetsFor(ctx.state, ctx.inv, performingSeat(ctx)) && ctx.context.successBy >= 3),
    evidenceReaction('skillTestFail', 'fail', ctx => meetsFor(ctx.state, ctx.inv, performingSeat(ctx)) && ctx.context.failedBy >= 2),
    evidenceReaction('harmDealtToInvestigator', 'harm', ({ state, inv, context }) => meetsFor(state, inv, context.seat)),
    evidenceReaction('moveBeforeEngage', 'field', ({ state, inv, context, helpers }) => meetsFor(state, inv, context.seat)
      && helpers.locationShroud(context.location, context.seat) >= 3),
    {
      kind: 'reaction', trigger: 'assetExhausted', label: '备择假设：选择新判据并重整实证假设',
      criteria: [({ state, inv, source, context }) => unlocked(state, inv, 7) && context.assetId === source.id
        && source.exhausted && availableCriteria(state, inv).some(({ id }) => !chosenFor(state, source)?.used.includes(id))],
      resolve: ctx => {
        const { state, source, api } = ctx
        if (selectCriterion(ctx, chosenFor(state, source)?.used || [], true)) api.ready(source)
      },
    },
    {
      kind: 'free', label: '花费 1 证据：抽 1 张卡牌', criteria: [canSpend(1)],
      resolve: ({ source, inv, api }) => {
        api.addCardCounter(source, 'evidence', -1)
        api.drawCards(inv.seat, 1)
      },
    },
    {
      kind: 'free', label: '研究拨款：花费 2 证据，本阶段下次打出卡牌费用 −3',
      criteria: [canSpend(2), ({ state, source }) => evidenceUpgrade(state, source, 5)],
      resolve: ({ source, inv, api }) => {
        api.addCardCounter(source, 'evidence', -2)
        api.addEffect({ sourceCode: SOURCE, duration: 'endOfPhase', nextPlayDiscount: 3 }, inv.seat)
      },
    },
    {
      kind: 'free', label: '确凿证据：花费 3 证据，在你的地点发现 1 个线索',
      criteria: [canSpend(3), ({ state, inv, source, helpers }) => evidenceUpgrade(state, source, 6)
        && state.locations.some(location => location.id === inv.location && location.clues > 0)
        && helpers.canDiscoverClueAt(inv.seat, inv.location)],
      resolve: ({ source, inv, api }) => {
        api.addCardCounter(source, 'evidence', -3)
        api.discoverClue(inv.seat, 1)
      },
    },
    evidenceReaction('handEmptied', 'hand', ({ state, inv, context }) => meetsFor(state, inv, context.seat)),
    evidenceReaction('encounterCardDiscardedFromPlay', 'discard', ({ state, inv, context }) => meetsFor(state, inv, context.seat)),
  ],
}
