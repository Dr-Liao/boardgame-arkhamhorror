// 03012 画中世界
// 卡面：赛菲娜·卢梭牌库专用。
// 卡面：不能放在赛菲娜·卢梭底下。
// 卡面：将画中世界作为赛菲娜·卢梭底下的一张非卓越事件打出。不要弃掉画中世界，改为将其从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03012 彩绘世界：可以从牌库下方「复制」事件打出（读点散在 reaction/play 流程，共 7 处）。

export default {
  code: '03012',
  copiesBeneathEvents: true,
  abilities: [

  ],
  modifiers: [

  ],
}
