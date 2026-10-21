// 03155 战斗或逃跑
// 卡面：快速。只能在你回合期间打出。
// 卡面：直到本轮结束，你得到+X[combat]和+X[agility]，其中X为你身上的恐惧数量。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03155 战斗或逃跑：快速事件；本轮战斗与敏捷 +当前恐惧值（A1 效果实体）。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '03155',
  playCondition: [{ when: ownTurn(), message: '只能在自己的回合打出' }],
  abilities: [
    {
      kind: 'played', fast: true, label: '本轮战斗与敏捷 +当前恐惧值',
      resolve: ({ inv, api }) => {
        const bonus = inv.horror || 0
        api.addEffect({
          duration: 'endOfRound', controllerSeat: inv.seat, label: '战斗或逃跑：本轮战斗与敏捷加值',
          modifiers: [{ target: 'skill:combat', amount: bonus }, { target: 'skill:agility', amount: bonus }],
        })
        api.info(`${inv.name} 本轮战斗与敏捷 +${bonus}（战斗或逃跑）。`)
      },
    },
  ],
  modifiers: [

  ],
}
