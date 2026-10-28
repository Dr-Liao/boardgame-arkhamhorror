// 01050 逃避隐藏
// 卡面：快速。只能在你回合期间打出。
// 卡面：和每个与你交战的敌人解除交战，并移动到一个没有敌人的已揭示地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '01050',
  playCondition: [{ when: ownTurn(), message: '只能在你回合期间打出' }],
  abilities: [
    {
      kind: 'played',
      label: '逃避隐藏',
      fast: true,
      effect: {
        type: 'sequence',
        effects: [{ type: 'disengageAll' }, { type: 'moveTo', anyRevealed: true, noEnemies: true }],
      },
    },
  ],
  modifiers: [

  ],
}
