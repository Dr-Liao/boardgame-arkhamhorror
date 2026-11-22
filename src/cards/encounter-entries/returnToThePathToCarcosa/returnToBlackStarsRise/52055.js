// 52055 回廊 · 重返版（重返黑星升起）
// 归属：关卡专用 · returnToBlackStarsRise（重返卡尔克萨之路 · 黑星升起）
// 遭遇组：return_to_black_stars_rise
// 卡面：[action] 如果回廊没有线索：谈判。检定[willpower]或[intellect](4)。
//       如果成功，记住你「找到了塔楼的钥匙」。
//
// 行为读点：locationRule.actions / performAction（carcosa encounter-rules 与本章 behavior 复用）。
export default {
  code: '52055',
  name: '回廊',
  scope: 'location',
  locationRule: {
    parley: {
      rule: 'rememberTowerKey',
      label: '谈判：检定意志或智力（4），成功记住「找到了塔楼的钥匙」',
      skills: ['willpower', 'intellect'],
      difficulty: 4,
      remember: '找到塔楼的钥匙',
      requiresNoClues: true,
    },
  },
}
