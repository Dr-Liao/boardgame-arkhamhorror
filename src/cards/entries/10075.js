// 10075 福倚祸伏（Diabolical Luck）· 潜袭者（Rogue）技能 · 0 费 · [[幸运]]/[[被诅咒]]。
// 卡面：你执行的技能检定期间，在你揭示一个[诅咒]标记时，你可以将福倚祸伏从手牌投入到该技能检定。
//       如果你这么做，福倚祸伏获得[意志][意志][意志]（3 个[万能]图标）。
//
// 一卡一个文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 正常投入 → commit 描述子（印刷 1 个[万能]图标由 cards-data 提供）。
//   · 「揭示[诅咒]标记时从手牌投入」→ reaction + fromHand + trigger:'tokenReveal'（tests.js 在
//     ST.4 揭示标记后开窗；duringOwnSkillTest 锁定“你执行的检定”）；resolve 调 api.commitCards
//     把本卡放进投入区。
//   · 「获得 3 个[万能]图标」的计时缺口：引擎的图标合计在 ST.3（本次检定值）完成，ST.4 才投入的
//     卡没有图标读点。这里在 tokenReveal 时记录一条 endOfTest 效果，并在 testWouldFail /
//     wouldSucceedTest 窗口用 context.testBonus 把「获得的 3 个[万能]图标」补进本次检定值
//     （印刷的 1 个[万能]由 api.commitCards 计入）。见 note 与 primitive-requests/10075.json。
const CODE = '10075'

const pendingLuck = state => (state.effects || []).some(effect =>
  effect.sourceCode === CODE && effect.duration === 'endOfTest'
  && effect.sourceInstanceId !== `${CODE}:bonus`)

const bonusApplied = state => (state.effects || []).some(effect =>
  effect.sourceCode === CODE && effect.sourceInstanceId === `${CODE}:bonus`)

const committedThisTest = (state, code) => (state.skillTest?.committed || [])
  .some(item => (typeof item === 'string' ? item : item?.code) === code)

export default {
  code: CODE,
  simplified: true,
  note: 'approximation: 揭示诅咒标记后才投入的卡没有 ST.3 图标读点；用 endOfTest 效果 + testWouldFail/wouldSucceedTest 的 context.testBonus 补「卡面获得的 3 个[万能]图标」价值（印刷的 1 个[万能]由 api.commitCards 计入）。autofail 标记不会触发本卡（不是诅咒），因此该缺口不影响本卡；见 primitive-requests/10075.json。',
  abilities: [
    {
      kind: 'commit',
      label: '福倚祸伏：投入本次技能检定（1 个[万能]图标）',
      skill: {},
    },
    {
      kind: 'reaction',
      fromHand: true,
      noPlayCost: true,
      duringOwnSkillTest: true,
      trigger: 'tokenReveal',
      label: '揭示[诅咒]标记后：从手牌投入福倚祸伏（获得 3 个[万能]图标）',
      criteria: [({ state, inv, context }) => {
        if (!state.skillTest || state.skillTest.seat !== inv.seat) return false
        if (context?.when !== 'tokenReveal' || context.token !== 'curse') return false
        if (context.replacementToken || context.cancelled) return false
        if (!(inv.hand || []).includes(CODE)) return false
        return !committedThisTest(state, CODE)
      }],
      resolve: ({ inv, api }) => {
        const added = api.commitCards(inv.seat, [CODE])
        if (!added) {
          api.info(`「福倚祸伏」：${inv.name} 无法把本卡投入本次检定。`)
          return
        }
        api.addEffect({
          duration: 'endOfTest',
          sourceCode: CODE,
          controllerSeat: inv.seat,
          label: '福倚祸伏：因揭示诅咒标记而投入本次检定',
        }, inv.seat)
        api.info(`🍀 「福倚祸伏」：${inv.name} 揭示[诅咒]标记，将本卡投入本次检定（获得 3 个[万能]图标）。`)
      },
    },
    {
      kind: 'forced',
      trigger: ['testWouldFail', 'wouldSucceedTest'],
      label: '因诅咒标记投入的福倚祸伏：卡面获得的 3 个[万能]图标计入本次检定值',
      criteria: [({ state }) => pendingLuck(state) && committedThisTest(state, CODE) && !bonusApplied(state)],
      resolve: ({ inv, context, api }) => {
        context.testBonus = (Number(context.testBonus) || 0) + 3
        api.addEffect({
          duration: 'endOfTest',
          sourceCode: CODE,
          sourceInstanceId: `${CODE}:bonus`,
          controllerSeat: inv.seat,
          label: '福倚祸伏：本次检定的 3 个[万能]图标价值已计入',
        }, inv.seat)
        api.info('🍀 「福倚祸伏」：本次检定值 +3（卡面获得 3 个[万能]图标）。')
      },
    },
  ],
  modifiers: [],
}
