// 60174 健身（Physical Fitness）
// 卡面：移动。本次移动后，治愈 3 点伤害。
// 读点：played 描述子 countsAs move + api.moveInvestigator + api.healDamage。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

const CODE = '60174'

export default {
  code: CODE,
  playCondition: [({ state, inv }) => (state.locations.find(loc => loc.id === inv.location)?.connections || [])
    .some(id => state.locations.some(loc => loc.id === id))],
  abilities: [{
    kind: 'played',
    countsAs: 'move',
    label: '移动；移动后治愈 3 点伤害',
    resolve: ({ state, inv, api }) => {
      const here = state.locations.find(loc => loc.id === inv.location)
      const destinations = (here?.connections || []).filter(id => state.locations.some(loc => loc.id === id))
      if (!destinations.length) return
      const id = destinations.length === 1 ? destinations[0] : api.choice({
        kind: 'location', source: CODE, seat: inv.seat, prompt: '选择移动目的地。',
        options: destinations.map(locationId => ({ id: locationId, label: api.locName(locationId) })),
      })
      if (!destinations.includes(id)) return
      api.moveInvestigator(inv.seat, id)
      api.healDamage(inv.seat, 3)
    },
  }],
  modifiers: [],
}
