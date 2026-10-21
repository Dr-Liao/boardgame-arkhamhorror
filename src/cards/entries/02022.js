// 02022 捷径
// 卡面：快速。只能在你回合期间打出。
// 卡面：选择你所在地点的1位调查员。将该调查员移动到一个连接地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ownTurn } from '../../engine/matcher.js'

export default {
  code: '02022',
  playCondition: [
    { when: ownTurn(), message: '只能在自己的回合打出' },
  ],
  abilities: [
    {
      kind: 'played',
      label: '捷径',
      fast: true,
      effect: { type: 'targetedEffect', target: 'location', effect: { type: 'moveTo' } },
    },
  ],
  modifiers: [

  ],
}
