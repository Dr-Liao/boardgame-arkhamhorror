// 03011 黄衣之王
// 卡面：显现 - 将黄衣之王放置入场，放到你的威胁区城。除非通过以下[reaction]能力，否则它不能离场。
// 卡面：你不能在技能检定中投入正好1或2张卡牌。
// 卡面：[reaction]技能检定成功且潘明投入至少6个与该次检定对应的技能图标后：弃掉黄衣之王。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03011 黄衣之王（威胁）：携带它的人会让敏的投入规则改为「必须 3 张或 0 张」（读点见 commit 段）。

export default {
  code: '03011',
  kingInYellowThreat: true,
  cannotLeavePlay: true,
  abilities: [
    { kind: 'weakness', label: '黄衣之王', weakness: { type: 'threat' } },
  ],
  modifiers: [

  ],
}
