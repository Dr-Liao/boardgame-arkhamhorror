// 60154 过度自信（Overconfident，基础弱点）
// 卡面：显现 - 将过度自信放入你的威胁区域。强制 - 你技能检定失败后：受到 1 伤害。[action][action]：弃掉过度自信。
// 读点：weakness 档案 type:threat + discardCost（weakness.js 威胁区分支，弃掉费用由引擎统一读）；
// 强制失败受伤走 forced + trigger skillTestFail（windows.js 已注册的检定失败后窗口）。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '60154',
  abilities: [
    {
      kind: 'weakness',
      label: '放入威胁区域；可用两个行动弃掉',
      weakness: { type: 'threat', discardCost: { action: 2 } },
    },
    {
      kind: 'forced',
      trigger: 'skillTestFail',
      label: '技能检定失败后受到 1 点伤害',
      criteria: [ownSeat()],
      resolve: ({ inv, api }) => api.damage(inv.seat, 1),
    },
  ],
  modifiers: [],
}
