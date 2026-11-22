// 98005 未解之谜（Mysteries Remain）· 中立 · 事件 · 费用 0 · 洞见 · 替换（罗兰·班克斯）。
// 卡面（cards-data 98005）：
//   罗兰·班克斯牌库专用。替换。
//   快速。只能在你回合期间打出。
//   选择一项：将 1 个线索（来自供应堆）放置在你所在地点；或发现你所在地点的 1 个线索。
//   将未解之谜从游戏中移除。
//
// 引擎读点：
//   · 快速 + 只能在你回合打出 = played 描述子的 fast + playCondition [{ when: ownTurn() }]
//     （与 01036/01085 同一读点）；
//   · 放置供应堆线索 = api.placeClues（locations.js#placeCluesOnLocation）；
//     发现线索 = api.discoverClue（locations.js#discoverClueAt）；
//   · 从游戏中移除 = played 描述子的 exileAfterPlay（actions.js#doPlay 收尾段读点）。
import { ownTurn } from '../../engine/matcher.js'

const code = '98005'

export default {
  code,
  playCondition: [{ when: ownTurn(), message: '只能在你回合期间打出' }],
  abilities: [{
    kind: 'played',
    fast: true,
    exileAfterPlay: true,
    label: '未解之谜：放置供应堆的 1 个线索，或发现 1 个线索',
    resolve: ({ inv, api }) => {
      const choice = api.choice({
        kind: 'effect', source: code, seat: inv.seat,
        prompt: '未解之谜：选择一项。',
        options: [
          { id: 'place', label: '将 1 个线索（来自供应堆）放置在你所在地点' },
          { id: 'discover', label: '发现你所在地点的 1 个线索' },
        ],
      })
      if (choice === 'discover') {
        api.discoverClue(inv.seat, 1)
        api.info('未解之谜：发现你所在地点的 1 个线索。')
      } else {
        api.placeClues(inv.seat, 1)
        api.info('未解之谜：将 1 个线索放置在你所在地点。')
      }
    },
  }],
  modifiers: [],
}
