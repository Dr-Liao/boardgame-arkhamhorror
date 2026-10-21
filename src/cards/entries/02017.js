// 02017 嘲讽
// 卡面：快速。只能在你回合期间打出。
// 卡面：与你所在地点任意数量的敌人交战。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '02017',
  playCondition: [
    { when: ownTurn(), message: '只能在自己的回合打出' },
  ],
  abilities: [
    {
      kind: 'played', label: '嘲讽', fast: true,
      resolve: ({ state, inv, api }) => {
        const enemies = state.enemies.filter(enemy => enemy.location === inv.location && enemy.engagedSeat !== inv.seat)
        for (const enemy of enemies) api.engage(enemy, inv.seat)
      },
    },
  ],
  modifiers: [

  ],
}
