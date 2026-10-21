// 04149 恢复元气
// 卡面：只能作为你的第一个行动打出。
// 卡面：治愈1点伤害(如果你本轮抽取了一张诡计卡牌，改为治愈2点伤害)。然后，抽取1张卡牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 04149 恢复元气：本回合第一个行动；治疗 1 点伤害（本回合抽到诡计则 2 点）并抽 1 张。

import { ownFirstAction } from '../../engine/matcher.js'

export default {
  code: '04149',
  playCondition: [{ when: ownFirstAction(), message: '只能作为本回合的第一个行动打出' }],
  abilities: [
    {
      kind: 'played', label: '恢复元气',
      resolve: ({ state, inv, api }) => {
        const amount = inv.drewTreacheryRound === state.round ? 2 : 1
        api.healDamage(inv.seat, amount)
        api.info(`${inv.name} 治疗 ${amount} 点伤害。`)
        api.drawCards(inv.seat, 1)
      },
    },
  ],
  modifiers: [

  ],
}
