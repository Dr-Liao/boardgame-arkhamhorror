// 60309 朗尼·里特纳
// 卡面：你得到+1[combat]。
// 卡面：[fast]横置朗尼·里特纳并花费1资源：选择你所在地点的一位调查员控制的一张[[道具]]支援。治愈该支援的1点伤害和朗尼·里特纳的1点恐惧。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

import { ALL_CARDS } from '../cards-data.js'

function itemsAtLocation(state, inv) {
  return state.investigators
    .filter(other => !other.defeated && !other.resigned && other.location === inv.location)
    .flatMap(other => other.assets.filter(asset =>
      ALL_CARDS[asset.code]?.traits?.some(trait => trait.toLowerCase() === 'item')))
}

export default {
  code: '60309',
  modifiers: [{ target: 'skill:combat', amount: 1 }],
  abilities: [{
    kind: 'free',
    label: '横置并花费 1 资源：治愈同地点道具 1 伤害，并治愈本牌 1 恐惧',
    cost: { exhaust: true, resources: 1 },
    criteria: ({ state, inv, source }) => itemsAtLocation(state, inv)
      .some(asset => asset.damage > 0 || source.horror > 0),
    resolve: ({ state, inv, source, api }) => {
      const items = itemsAtLocation(state, inv).filter(asset => asset.damage > 0 || source.horror > 0)
      if (!items.length) return
      const id = items.length === 1 ? items[0].id : api.choice({
        kind: 'card', source: '60309', seat: inv.seat, prompt: '选择要治疗的道具。',
        options: items.map(item => ({ id: item.id, cardCode: item.code, label: api.cardName(item.code) })),
      })
      const item = items.find(candidate => candidate.id === id)
      if (!item) return
      api.healAsset(item, { damage: 1 })
      api.healAsset(source, { horror: 1 })
    },
  }],
}
