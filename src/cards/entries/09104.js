// 09104 道路尽头（End of the Road）· 幸存者事件 · 0 经验
// 卡面：快速。最终密谋在场时才能在你的回合期间打出。
//       抽取 1 张卡牌，获得 1 资源，并获得额外 1 个行动。将道路尽头从游戏中移除。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 快速：played 描述子 fast（无固定触发时机 → 收尾玩家窗口的「⚡ 快速打出」候选，
//     fastHandPlays 会再过一遍 playCondition）；
//   · 「最终密谋在场」：state.agendas 的最后一张且已被推进到（agendaIndex 指向它）；
//   · 移出游戏：played 描述子 exileAfterPlay（doPlay / playReactionCard 同一去向读点）。
import { ownTurn } from '../../engine/matcher.js'

const code = '09104'

const finalAgendaInPlay = state => {
  const agendas = state.agendas || []
  return agendas.length > 0 && state.agendaIndex >= agendas.length - 1
}

export default {
  code,
  playCondition: [
    { when: ownTurn(), message: '「道路尽头」只能在你的回合期间打出' },
    { when: ({ state }) => finalAgendaInPlay(state), message: '「道路尽头」只能在最终密谋在场时打出' },
  ],
  abilities: [
    {
      kind: 'played',
      fast: true,
      exileAfterPlay: true,
      label: '抽 1 张牌、获得 1 资源与 1 个额外行动，然后将本卡移出游戏',
      resolve: ({ inv, api }) => {
        api.drawCardsLogged(inv.seat, 1)
        api.gainResources(inv.seat, 1)
        api.gainAction(inv.seat, 1)
        api.info(`🛤️ 「道路尽头」：${inv.name} 获得 1 资源与 1 个额外行动。`)
      },
    },
  ],
  modifiers: [],
}
