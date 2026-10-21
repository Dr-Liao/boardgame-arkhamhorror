// 04103 犯罪现场
// 卡面：只能作为你的第一个行动打出。
// 卡面：发现你所在地点的1个线索(如果该地点有敌人，改为发现2个线索)。本行动不会触发趁乱攻击。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// ---- 失落的时代：事件 ----
// 04103 犯罪现场：本回合第一个行动，不引发借机攻击；发现 1 个线索，地点有敌人时 2 个。

import { ownFirstAction } from '../../engine/matcher.js'

export default {
  code: '04103',
  playCondition: [{ when: ownFirstAction(), message: '只能作为本回合的第一个行动打出' }],
  abilities: [
    {
      kind: 'played', noOpportunityAttack: true, label: '发现 1 个线索（有敌人时 2 个）',
      resolve: ({ state, inv, api }) => {
        const enemyHere = state.enemies.some(enemy => enemy.location === inv.location)
        api.discoverClue(inv.seat, enemyHere ? 2 : 1)
      },
    },
  ],
  modifiers: [

  ],
}
