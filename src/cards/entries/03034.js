// 03034 星界旅行
// 卡面：移动。移动到任意一个已揭示的地点并从混乱袋随机揭示一个标记。如果你揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，你必须弃掉一张你控制的[[道具]]或[[盟友]]支援(如果你不能这么做，受到1点伤害)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03034 星界旅行：移动到任一已揭示地点；揭示符号标记则弃置一件物品/盟友，否则受到 1 点伤害。

import { CHAOS_SYMBOLS } from './_shared.js'

export default {
  code: '03034',
  abilities: [
    {
      kind: 'played', label: '星界旅行',
      resolve: ({ state, inv, api }) => {
        const locations = state.locations.filter(location => location.revealed
          && location.id !== inv.location && !location.locked)
        if (!locations.length) { api.info('没有可前往的已揭示地点。'); return }
        const destination = locations.length === 1 ? locations[0].id
          : api.choice({ kind: 'location', source: '03034', seat: inv.seat, prompt: '选择星界旅行的目的地。',
            options: locations.map(location => ({ id: location.id, label: api.locationName(location.id) })) })
        api.moveInvestigator(inv.seat, destination)
        const token = state.chaosBag[Math.floor(api.random() * state.chaosBag.length)]
        if (!CHAOS_SYMBOLS.includes(token)) return
        const candidates = inv.assets.filter(card => api.cardTraits(card.code)
          .some(trait => ['item', 'ally'].includes(String(trait).toLowerCase())))
        if (!candidates.length) { api.damage(inv.seat, 1); return }
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'target', source: '03034', seat: inv.seat,
            prompt: '选择弃置一件物品或盟友；若没有则受到 1 点伤害。',
            options: candidates.map(card => ({ id: card.id, label: api.cardName(card.code) })) })
        const target = candidates.find(card => card.id === chosen) || candidates[0]
        api.discardAsset(inv.seat, target)
      },
    },
  ],
  modifiers: [

  ],
}
