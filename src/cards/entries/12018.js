// 12018 洛根·黑斯廷斯
// 卡面：你得到+1[combat]。
// 卡面：[reaction]在你击败一个敌人后，横置[洛根·黑斯廷斯]：获得1资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · +1[combat] = modifiers 的 skill:combat（statPipeline 统一叠加）；
//   · 「击败敌人后」= defeatEnemy 窗口（src/engine/enemies.js#defeatEnemy 派发，
//     context 带 seat=击败者；ownSeat() 限定本人）；横置费用 = cost.exhaust。

import { ownSeat } from '../../engine/matcher.js'
import { skillModifier } from './_shared.js'

export default {
  code: '12018',
  modifiers: [
    skillModifier('combat', 1),
  ],
  abilities: [
    {
      kind: 'reaction',
      trigger: 'defeatEnemy',
      label: '你击败一个敌人后，横置本牌：获得 1 资源',
      criteria: [ownSeat()],
      cost: { exhaust: true },
      resolve: ({ inv, api }) => {
        api.gainResources(inv.seat, 1)
        api.info(`${inv.name} 横置「洛根·黑斯廷斯」，获得 1 资源。`)
      },
    },
  ],
}
