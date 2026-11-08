// 08061 冥想放空（Meditative Trance）· 秘术师（Mystic）事件。
//
// 卡面：你每有一个法术槽位有支援，治愈 1 点伤害或 1 点恐惧。
//
// 一卡一文件：这张卡的行为只在这里维护。
// 读点：法术槽位按你控制的、印刷槽位含 Arcane 的支援数（同 08060 口径）；
// 每次治愈由 api.healDamage / api.healHorror 结算。
import { ALL_CARDS } from '../../cards/cards-data.js'

const filledArcaneSlots = inv => (inv.assets || []).filter(asset => /arcane/i.test(String(ALL_CARDS[asset.code]?.slot || ''))).length

export default {
  code: '08061',
  abilities: [
    {
      kind: 'played',
      label: '每有一个已填法术槽，治愈 1 点伤害或恐惧',
      resolve: ({ inv, api }) => {
        let remaining = filledArcaneSlots(inv)
        if (remaining <= 0) {
          api.info('「冥想放空」：你没有已填的法术槽位，没有可治愈的伤害/恐惧。')
          return
        }
        while (remaining > 0) {
          const canDamage = (inv.damage || 0) > 0
          const canHorror = (inv.horror || 0) > 0
          if (!canDamage && !canHorror) break
          let choice = canDamage && canHorror ? null : canDamage ? 'damage' : 'horror'
          if (choice == null) {
            choice = api.choice({
              kind: 'effect', source: '08061', seat: inv.seat,
              prompt: `「冥想放空」：治愈 1 点伤害还是 1 点恐惧？（还可治愈 ${remaining} 次）`,
              options: [{ id: 'damage', label: '治愈 1 点伤害' }, { id: 'horror', label: '治愈 1 点恐惧' }],
            })
          }
          if (choice === 'damage') api.healDamage(inv.seat, 1)
          else api.healHorror(inv.seat, 1)
          remaining -= 1
        }
        api.info(`🧘 「冥想放空」结算完成（已填法术槽 ${filledArcaneSlots(inv)} 个）。`)
      },
    },
  ],
  modifiers: [],
}
