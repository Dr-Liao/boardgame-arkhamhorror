// 03232 捷径
// 卡面：快速。只能在你回合期间打出。
// 卡面：附属到你所在地点。被附属地点获得：“[free]横置捷径：移动(到一个连接地点)。”位于该地点的所有调查员均可以触发此能力。(FAQ，v1.4)
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03232 捷径：快速事件，只能在自己回合打出；附属到所在地点（提供一次不花行动的移动）。

import { ownTurn } from '../../engine/matcher.js'
import { attachToChosenLocation } from './_shared.js'

export default {
  code: '03232',
  playCondition: [{ when: ownTurn(), message: '只能在自己的回合打出' }],
  abilities: [
    {
      kind: 'played', fast: true, label: '附属到所在地点',
      resolve: ({ state, inv, api }) => attachToChosenLocation(state, inv, api, { code: '03232', source: 'shortcut2' }),
    },
  ],
  grantsShortcutMove: true,
  modifiers: [

  ],
}
