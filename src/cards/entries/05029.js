// 05029 金钱万能
// 卡面：快速。在你发动技能检定时打出。
// 卡面：本次检定不是其标识的技能类型([willpower]、[intellect]、[combat]或[agility])，
//       而是改为资源技能检定。本次检定你的基础技能值等于你资源池内资源数的一半(向下取整)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05029 金钱万能：testBegins 窗口的快速事件——把本次检定的基础技能值替换为 floor(资源/2)。
// 读点：state.skillTest.pendingBonus（检定主流程在 test.beforeCommit 之后把它并进本次检定），
// 因此调整量 = 目标基础值 - 当前检定值。
// 显式简化：检定的「技能类型」仍按原本的技能结算（显示、可投入图标都还是原技能），
// 只把基础技能值换成了资源数的一半。

export default {
  code: '05029',
  simplified: true,
  note: '未实现：把本次检定的技能类型改为「资源技能检定」（没有替换技能类型/投入图标的读点）。已实现基础技能值改为 floor(资源/2)。',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'testBegins',
      label: '金钱万能：本次检定基础技能值改为资源数的一半',
      resolve: ({ state, inv, api }) => {
        const test = state.skillTest
        if (!test) return
        const target = Math.floor((inv.resources || 0) / 2)
        const current = Number(test.value ?? test.baseValue ?? 0)
        api.addPendingTestBonus(target - current)
        api.info(`💰 ${inv.name} 打出「${api.cardName('05029')}」：本次检定的基础技能值改为 ${target}（资源 ${inv.resources} 的一半）。`)
      },
    },
  ],
  modifiers: [

  ],
}
