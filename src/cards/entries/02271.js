// 02271 鸿运当头
// 卡面：只能投入你正在执行的技能检定。
// 卡面：在本次技能检定揭示混乱标记后，你可以选择放逐鸿运当头。如果你这么做，本次检定自动成功(除非揭示了一个[auto_fail]标记)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 02271 鸿运当头：只能投入你正在执行的技能检定（放逐换自动成功由引擎的检定流程处理）。

export default {
  code: '02271',
  abilities: [
    { kind: 'commit', label: '只能投入自己正在执行的检定', skill: { selfTestOnly: true } },
  ],
  exileForAutoSuccess: true,
  modifiers: [

  ],
}
