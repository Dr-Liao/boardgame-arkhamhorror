// 03197 重新充能
// 卡面：选择你所在地点的一位调查员控制的一张[[法术]]或[[遗物]]支援，并从混乱袋随机揭示一个混乱标记。如果你揭示了[skull]、[cultist]、[tablet]、[elder_thing]或[auto_fail]符号，弃掉所选支援。否则，为所选支援增加3充能。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03197 充能：为同地点一张法术/遗物支援补 3 点充能；揭示符号标记则弃置它。

import { CHAOS_SYMBOLS } from './_shared.js'

export default {
  code: '03197',
  abilities: [
    {
      kind: 'played', label: '充能',
      resolve: ({ state, inv, api }) => {
        const candidates = api.investigatorsAt(inv.location)
          .flatMap(owner => (state.investigators[owner.seat]?.assets || []))
          .filter(card => api.cardTraits(card.code).some(trait => ['spell', 'relic'].includes(String(trait).toLowerCase())))
        if (!candidates.length) { api.info('这里没有可充能的法术或遗物支援。'); return }
        const chosen = candidates.length === 1 ? candidates[0].id
          : api.choice({ kind: 'target', source: '03197', seat: inv.seat, prompt: '选择要充能的支援。',
            options: candidates.map(card => ({ id: card.id, label: api.cardName(card.code) })) })
        const target = candidates.find(card => card.id === chosen) || candidates[0]
        const token = state.chaosBag[Math.floor(api.random() * state.chaosBag.length)]
        if (CHAOS_SYMBOLS.includes(token)) {
          const owner = state.investigators.find(other => other.assets.some(card => card.id === target.id))
          api.discardAsset(owner?.seat ?? inv.seat, target)
          api.info(`「${api.cardName(target.code)}」因符号标记被弃置。`)
          return
        }
        api.addUses(target, 3)
        api.info(`「${api.cardName(target.code)}」补充 3 点充能。`)
      },
    },
  ],
  modifiers: [

  ],
}
