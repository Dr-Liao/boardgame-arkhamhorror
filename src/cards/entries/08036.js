// 08036 加入马队
// 卡面：快速。只可在你的回合期间打出。你每控制一张不同职阶的卡牌，本卡牌的费用减 1。
//       移动到任意一个已揭示的地点。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 口径：
//   · 减费：条目级 playCostModifier（turn-flow 的 playCost 对「本卡自己」读取），按你控制的卡牌里
//     不同职阶（faction）数量减费（下限 0 由 playCost 统一 Math.max）；
//   · 只能自己回合打出：playCondition [ownTurn()]；
//   · 移动：api.moveInvestigator 到任意已揭示地点。
import { ownTurn } from '../../engine/matcher.js'
import { ALL_CARDS } from '../../cards/cards-data.js'

const distinctClasses = (state, inv) => {
  const factions = new Set()
  for (const card of inv?.assets || []) {
    const def = ALL_CARDS[card.code] || null
    const list = def?.factions || [def?.klass, def?.klass2, def?.klass3].filter(Boolean)
    for (const faction of list || []) if (faction !== 'neutral') factions.add(faction)
  }
  return factions.size
}

export default {
  code: '08036',
  playCostModifier: ({ state, inv }) => -distinctClasses(state, inv),
  playCondition: [ownTurn()],
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '移动到任意一个已揭示的地点（每控制一张不同职阶的卡牌费用 -1）',
      resolve: ({ state, inv, api }) => {
        const candidates = (state.locations || []).filter(location => location.revealed === true
          && location.id !== inv.location)
        if (!candidates.length) {
          api.info('加入马队：没有其他已揭示的地点。')
          return
        }
        const answer = candidates.length === 1 ? candidates[0].id : api.choice({
          kind: 'location', source: '08036', seat: inv.seat,
          prompt: '加入马队：选择要移动到的已揭示地点。',
          options: candidates.map(location => ({ id: location.id, label: api.locName(location.id) })),
        })
        const target = candidates.find(location => location.id === answer) || candidates[0]
        api.moveInvestigator(inv.seat, target.id)
        api.info(`加入马队：移动到「${api.locName(target.id)}」。`)
      },
    },
  ],
  modifiers: [],
}
