// 05228 机关盒 · 归属：关卡专用 05197《崇高利益》（fgg）
// 规则实现：
//   · 剧情归属/交付/结局进牌组：behavior.js 的 attachPuzzleBox / givePuzzleBoxTo / resolution；
//   · 强制「你被击败时交给另一位调查员」：behavior.js 的 investigatorEliminated 钩子；
//   · [action]（熄灭火盆 / 横置幽灵看守人 / 对已横置的它造成 5 点伤害 / 团队每场游戏限一次）：
//     behavior.js 的 actions/performAction（规则 rule='puzzleBoxAction'，读点见 behavior）。
// 注：本条目保持声明式（非玩家卡 registry 不允许声明玩家发起的 action）；执行路径在章节 behavior。
export default {
  "code": "05228",
  "scope": "storyAsset",
  "implemented": true,
  "note": "behavior.js:attachPuzzleBox/givePuzzleBoxTo/investigatorEliminated/actions(rule=puzzleBoxAction)/resolution(campaignCard)"
};
