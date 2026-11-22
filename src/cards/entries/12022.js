// 12022 吸取教训
// 卡面：快速。一个敌人攻击你后打出。
// 卡面：发现你所在地点的1个线索。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 「快速。在……后打出」= played 描述子的 fast + trigger（quickEventView 唯一候选出口，
//     候选在 reactionWindow；执行在 assets.js#playReactionCard）；
//   · 时机「一个敌人攻击你后」= enemyAttacked 窗口（src/engine/enemies.js#enemyAttack 攻击结算后
//     派发；攻击被取消也会开窗，context 带 seat/enemy/attack）；
//   · ownSeat() 把触发限定在「被攻击的是你」；所在地点有线索才可打出（引擎 discoverClue 读点要求）。

import { ownSeat } from '../../engine/matcher.js'

export default {
  code: '12022',
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: 'enemyAttacked',
      label: '你被敌人攻击后：发现你所在地点的 1 个线索',
      criteria: [
        ownSeat(),
        ({ state, inv }) => {
          const here = (state.locations || []).find(location => location.id === inv.location)
          return (here?.clues || 0) > 0
        },
      ],
      effect: { type: 'discoverClue', amount: 1 },
    },
  ],
  modifiers: [
  ],
}
