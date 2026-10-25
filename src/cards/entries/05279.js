// 05279 黛雅娜·艾丝帕伦斯
// 卡面：使用(3秘密)。
// 卡面：[free]：将你手牌中的一张非弱点法术事件附属到黛雅娜·艾丝帕伦斯上。附属到其上的事件仅限1张。
// 卡面：可以打出附属的事件，如同其在你手牌中。其打出后，不放到你的弃牌堆(其仍附属在原处)。
//       作为打出附属的事件的额外费用，横置黛雅娜·艾丝帕伦斯并花费1秘密。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// R7：本体只保留「[free] 附属一张非弱点法术事件（限 1 张）」。
// 「如同手牌打出 / 打出后仍附属 / 额外费用」全部由引擎声明式读点承担：
//   - 条目字段 playAttachedEvents:true → legalMoves 枚举宿主 attachments 事件、validateMove 同口径；
//   - playAttachedEventCost:{exhaustHost:true, uses:1} → 打出前横置宿主并扣 1 秘密（moves/dispatch 双读点）；
//   - playAttachedEventStaysAttached:true → 结算后把事件从弃牌堆/手牌移回 host.attachments。

import { ALL_CARDS } from '../../cards/cards-data.js'

function isNonWeaknessSpellEvent(code) {
  const def = code ? ALL_CARDS[code] : null
  if (!def || def.type !== 'event') return false
  if (def.subtype === 'weakness' || def.subtype === 'basicweakness') return false
  return (def.traits || []).some(trait => String(trait).toLowerCase() === 'spell')
}

export default {
  code: '05279',
  uses: 3,
  usesType: 'secrets',
  playAttachedEvents: true,
  playAttachedEventCost: { exhaustHost: true, uses: 1 },
  playAttachedEventStaysAttached: true,
  abilities: [
    {
      kind: 'action',
      cost: { action: false },
      label: '[快速] 附属一张非弱点法术事件',
      target: {
        kind: 'cardInHand',
        label: '手牌中的非弱点法术事件',
        query: ({ candidate }) => isNonWeaknessSpellEvent(candidate?.id),
      },
      criteria: [({ source }) => (source?.attachments || []).length < 1],
      resolve: ({ inv, source, target, api }) => {
        if (!source || !target) return
        if (!isNonWeaknessSpellEvent(target.id)) {
          api.info('只能把非弱点的法术事件附属到黛雅娜·艾丝帕伦斯上。')
          return
        }
        source.attachments ||= []
        if (source.attachments.length >= 1) { api.info('黛雅娜·艾丝帕伦斯上已经附属了一张事件。'); return }
        api.moveCard({ code: target.id, from: 'hand', to: 'attached', attachTo: source.id })
        api.info(`${inv.name} 把「${api.cardName(target.id)}」附属到黛雅娜·艾丝帕伦斯上。`)
      },
    },
  ],
  modifiers: [],
}
