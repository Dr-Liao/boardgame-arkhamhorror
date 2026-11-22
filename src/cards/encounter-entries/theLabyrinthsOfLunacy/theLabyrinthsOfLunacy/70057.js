// 70057 可怕的机关
// 归属：关卡专用 · theLabyrinthsOfLunacy（疯狂迷宫）
// 遭遇组：in_the_labyrinths_of_lunacy
// 卡面：显现 - 将可怕的机关放置入场，放到你的威胁区域。
// 卡面：强制 - 你执行下方[action]能力以外的一次行动后：受到1点伤害，弃掉一个占用至少1个手部槽位的支援，并弃掉可怕的机关。
// 卡面：[action]：检定[combat](2)。如果你成功，弃掉可怕的机关。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '70057',
  scope: 'treachery',
  // TODO: 按卡面实现（abilities / modifiers / 规则字段）。只通过 ctx.api 改状态。
}
