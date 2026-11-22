// 52056 骑士大厅 · 重返版（重返黑星升起）
// 归属：关卡专用 · returnToBlackStarsRise（重返卡尔克萨之路 · 黑星升起）
// 遭遇组：return_to_black_stars_rise
// 卡面：[action] 如果骑士大厅没有线索：谈判。检定[combat]或[agility](3)。
//       如果成功，记住你「找到了一个向导」。
//
// 行为读点：locationRule.actions / performAction（本章 behavior 复用）。
export default {
  code: '52056',
  name: '骑士大厅',
  scope: 'location',
  locationRule: {
    parley: {
      rule: 'rememberGuide',
      label: '谈判：检定战斗或敏捷（3），成功记住「找到了一个向导」',
      skills: ['combat', 'agility'],
      difficulty: 3,
      remember: '找到了一个向导',
      requiresNoClues: true,
    },
  },
}
