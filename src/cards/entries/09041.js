// 09041 实证假设（Empirical Hypothesis）· 探求者资产 · 0 经验 · 定制 · 每位调查员限 1 张。
// 卡面：定制。每位调查员仅限 1 张。
//       强制 - 当一轮开始时：为本轮选择下列一项标准 —— 你检定失败且低于难度至少 2 点；或
//       你检定成功且超过难度至少 3 点。在达成所选标准时，你可以横置实证假设，在上面增加 1 证据。
//       [fast] 花费 1 证据：抽取 1 张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 本轮判据存 state.scenarioFlags（api.setScenarioFlag 是唯一写入口）：{ round, criteria }；
//   · 达成判据：skillTestSuccess / skillTestFail 窗口比较 lastTestResult 的 successBy / failedBy；
//     横置（cost.exhaust）+ api.addCardCounter(source,'evidence',1)（卡实例计数器，白名单已有 evidence）；
//   · [fast] 花费 1 证据抽 1：criteria 要求证据 ≥1，resolve 扣 1 证据 + api.drawCards。
// approximation：自定义判据（Pessimistic Outlook 等 4 项）与 Peer Review / Research Grant /
//   Irrefutable Proof / Alternative Hypothesis 未接线；见 primitive-requests/09041.json。
const SOURCE = '09041'
const FLAG = 'tskEmpiricalHypothesisCriteria'
const evidenceOf = card => Number(card?.markers?.evidence || 0)
export default {
  code: '09041',
  note: 'approximation: 只实现两项印刷判据（失败 ≥2 / 成功 ≥3）与「花 1 证据抽 1」；四项定制判据、Peer Review/Research Grant/Irrefutable Proof/Alternative Hypothesis 未实现（见 primitive-requests/09041.json）',
  customizationOptions: [
    { name: 'Pessimistic Outlook', checks: 1, text: 'Add the following criteria: "you run out of cards in your hand."' },
    { name: 'Trial and Error', checks: 1, text: 'Add the following criteria: "you are dealt damage or horror."' },
    { name: 'Independent Variable', checks: 1, text: 'Add the following criteria: "you discard a treachery or enemy from play."' },
    { name: 'Field Research', checks: 1, text: 'Add the following criteria: "you enter a location with 3 or more shroud."' },
    { name: 'Peer Review', checks: 2, text: 'The chosen criteria is met if any investigator at your location meets it, instead of only you. Other investigators at your location may trigger [fast] abilities on Empirical Hypothesis.' },
    { name: 'Research Grant', checks: 2, text: 'Empirical Hypothesis gains: "[fast] Spend 2 evidence: Reduce the cost of the next card you play by 3."' },
    { name: 'Irrefutable Proof', checks: 3, text: 'Empirical Hypothesis gains: "[fast] Spend 3 evidence: Discover 1 clue at your location."' },
    { name: 'Alternative Hypothesis', checks: 4, text: 'After you exhaust Empirical Hypothesis, you may resolve its forced effect, choosing a criteria you have not chosen this round. Then, ready it.' },
  ],
  abilities: [
    {
      kind: 'forced',
      trigger: 'roundStarts',
      label: '回合开始：选择本轮判据（失败 ≥2 / 成功 ≥3）',
      resolve: ({ state, inv, api }) => {
        const criteria = api.choice({
          kind: 'effect', source: SOURCE, seat: inv.seat,
          prompt: '实证假设：选择本轮判据。',
          options: [
            { id: 'fail', label: '你检定失败且低于难度至少 2 点' },
            { id: 'success', label: '你检定成功且超过难度至少 3 点' },
          ],
        })
        api.setScenarioFlag(FLAG, { round: state.round, criteria: criteria === 'success' ? 'success' : 'fail' })
        api.info(`实证假设：本轮判据 = ${criteria === 'success' ? '成功且超过难度至少 3' : '失败且低于难度至少 2'}。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'skillTestSuccess',
      label: '达成「成功 ≥3」判据：横置并加 1 证据',
      cost: { exhaust: true },
      criteria: [({ state, inv }) => {
        const chosen = state.scenarioFlags?.[FLAG]
        if (!chosen || chosen.round !== state.round || chosen.criteria !== 'success') return false
        const test = state.lastTestResult
        return Boolean(test) && test.seat === inv.seat && (test.value - test.difficulty) >= 3
      }],
      resolve: ({ inv, source, api }) => {
        api.addCardCounter(source, 'evidence', 1)
        api.info(`实证假设：达成判据，增加 1 证据（${api.cardCounterOf(source, 'evidence')}）。`)
      },
    },
    {
      kind: 'reaction',
      trigger: 'skillTestFail',
      label: '达成「失败 ≥2」判据：横置并加 1 证据',
      cost: { exhaust: true },
      criteria: [({ state, inv }) => {
        const chosen = state.scenarioFlags?.[FLAG]
        if (!chosen || chosen.round !== state.round || chosen.criteria !== 'fail') return false
        const test = state.lastTestResult
        return Boolean(test) && test.seat === inv.seat && (test.difficulty - test.value) >= 2
      }],
      resolve: ({ source, api }) => {
        api.addCardCounter(source, 'evidence', 1)
        api.info(`实证假设：达成判据，增加 1 证据（${api.cardCounterOf(source, 'evidence')}）。`)
      },
    },
    {
      kind: 'free',
      label: '花费 1 证据：抽 1 张卡牌',
      criteria: [({ source }) => evidenceOf(source) >= 1],
      resolve: ({ source, inv, api }) => {
        api.addCardCounter(source, 'evidence', -1)
        api.drawCards(inv.seat, 1)
        api.info('实证假设：花费 1 证据，抽 1 张牌。')
      },
    },
  ],
  modifiers: [],
}
