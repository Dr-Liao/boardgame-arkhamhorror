// 09031 援助之手（Helping Hand）· 守卫者技能 · 0 经验。
// 卡面：你可以将援助之手投入任意类型的检定。每次检定最多投入 1 张。
//       援助之手投入到技能检定时，投入该检定的其他每张卡牌技能图标翻倍。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 「任意类型检定 / 每次检定最多 1 张」写在 commit 档案（anySkill / maxPerTest，读点
//     commit-rules.js#canCommitToTest）；
//   · 「其他每张投入卡的图标翻倍」按**最终投入集合**计算：投入顺序不受限（卡面没有「先投入援助之手」
//     的限制）。引擎按每张投入卡各开一次 committedCard 窗口（tests.js:530-534），因此分两段：
//     ① 之后投入的卡：窗口 context.icons 同额再加一次 = 翻倍；
//     ② 援助之手自己投入时：把此前已投入的其他卡的图标合计再补一次 = 翻倍。
//     两段互不重叠，合起来正好覆盖「所有其他投入卡」各一次。P1-8：旧实现只有 ①，援助之手最后
//     投入时此前的卡永不翻倍。
const SOURCE = '09031'
const isSelf = item => (item?.code || item) === SOURCE
const committedCodes = state => (state.skillTest?.committed || []).map(item => item.code)
const otherCommittedIcons = state => (state.skillTest?.committed || [])
  .filter(item => !isSelf(item))
  .reduce((sum, item) => sum + (Number(item.icons) || 0), 0)

export default {
  code: '09031',
  abilities: [
    {
      kind: 'commit',
      label: '可投入任意类型检定（每次检定最多 1 张）；其他投入卡的图标翻倍',
      skill: { anySkill: true, maxPerTest: 1 },
    },
    {
      kind: 'forced',
      trigger: 'committedCard',
      silent: true,
      label: '援助之手已在投入区：其他投入卡的技能图标翻倍',
      criteria: [({ state, context }) => {
        if (!context || !state.skillTest) return false
        if (!committedCodes(state).includes(SOURCE)) return false
        // ② 援助之手自己进入投入区：统一补算此前已投入卡牌的图标。
        if (isSelf({ code: context.cardCode ?? context.card })) return otherCommittedIcons(state) > 0
        // ① 援助之手之后投入的卡：本次投入的图标同额再加一次。
        return (context.icons || 0) > 0
      }],
      resolve: ({ state, context, api }) => {
        if (isSelf({ code: context.cardCode ?? context.card })) {
          const amount = otherCommittedIcons(state)
          if (amount <= 0) return
          api.addCommittedCardIcons(context.seat, amount)
          api.info(`援助之手：此前已投入卡牌的 ${amount} 个图标翻倍。`)
          return
        }
        api.addCommittedCardIcons(context.seat, context.icons)
        api.info(`援助之手：「${api.cardName(context.cardCode)}」的 ${context.icons} 个图标翻倍。`)
      },
    },
  ],
  modifiers: [],
}
