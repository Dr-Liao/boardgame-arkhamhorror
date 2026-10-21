// 04150 占据先机
// 卡面：只能投入你正在执行的技能检定。
// 卡面：任意调查员在本阶段每完成一个行动，占据先机失去[wild]。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '04150',
  abilities: [
    {
      kind: 'commit',
      label: '占据先机',
      skill: { selfTestOnly: true, wildLosesPerActionsThisPhase: true },
    },
  ],
  modifiers: [

  ],
}
