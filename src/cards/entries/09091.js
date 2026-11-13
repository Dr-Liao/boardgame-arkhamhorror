// 09091 星界映射（Astral Mirror）· 秘术师支援 · 2 经验。
// 卡面：你每有一个法术槽位没有支援，拥有一个额外的手部槽位。
//       你在自己回合期间可以执行一个行动，该行动只能用于打出支援到你的一个手部槽位。
//
// 读点：额外手槽 = add:slot:hand 修正（slotBonus 唯一读点），数量按空法术槽计算；
//       额外行动 = 一个 cost.action:false + limit oncePerTurn 的 action 能力，
//       内部用 api.playCard(noAction:true) 打出手部槽位支援。
//       「你在自己回合期间」= criteria: [ownTurn()]：玩家窗口会向所有调查员询问免费能力，
//       缺 criteria 时额外行动在别人的回合里也会被列出来（与 02108/08098 同一类漏网）。
//
// approximation（已写 primitive-request/09091.json）：引擎没有「额外行动只能用于 X」的行动预算
// 读点；这里用「每回合一次、不消耗行动点的打出」实现同等频次与限制。
import { ALL_CARDS } from '../../cards/cards-data.js'
import { ownTurn } from '../../engine/matcher.js'

const emptyArcaneSlots = inv => Math.max(0, 2 - (inv.assets || []).reduce((total, asset) => {
  const slots = ALL_CARDS[asset.code]?.slots || []
  return total + slots.reduce((sum, slot) => {
    const key = String(slot).trim().toLowerCase()
    return sum + (key === 'arcane x2' ? 2 : key === 'arcane' ? 1 : 0)
  }, 0)
}, 0))

const handSlotAssets = code => (ALL_CARDS[code]?.slots || [])
  .some(slot => String(slot).trim().toLowerCase().startsWith('hand'))

export default {
  code: '09091',
  simplified: true,
  note: 'approximation: 见 primitive-request/09091.json（「额外行动只能用于打出手部槽位支援」用每回合一次免行动打出近似）',
  modifiers: [
    {
      target: 'add:slot',
      value: 'hand',
      amount: ({ inv }) => emptyArcaneSlots(inv),
    },
  ],
  abilities: [
    {
      kind: 'action',
      label: '额外行动：打出一张手部槽位的支援（每回合一次）',
      cost: { action: false },
      limit: 'oncePerTurn',
      criteria: [ownTurn()],
      resolve: ({ state, inv, api }) => {
        const candidates = [...new Set((inv.hand || []).filter(code => handSlotAssets(code)))]
        if (!candidates.length) {
          api.info('「星界映射」：手里没有可打到手部槽位的支援。')
          return
        }
        const picked = candidates.length === 1 ? candidates[0] : api.choice({
          kind: 'card', source: '09091', seat: inv.seat,
          prompt: '选择要打到手部槽位的支援。',
          options: candidates.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        if (!picked) return
        api.playCard(inv.seat, picked, { noAction: true })
        api.info(`🪞 「星界映射」：额外打出了「${api.cardName(picked)}」。`)
        void state
      },
    },
  ],
}
