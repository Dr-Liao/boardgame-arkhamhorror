// 06326 乔伊“老鼠”弗吉尔
// 卡面：[free]花费1资源：选择你手中的一个[[道具]]支援并将其打出(支付其费用)。
//       [free]弃掉场上的一个[[道具]]支援：获得2资源。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 06326 乔伊“老鼠”弗吉尔（[[盟友]]）：两条 [free] 能力（cost.action:false，不耗行动）。
//   · 花 1 资源从手牌打出一个[[道具]]支援：target kind:'cardInHand' 用 query 收窄到道具支援，
//     resolve 走 api.playCard（正常支付该卡费用，入场窗口/槽位/替换照常）；
//   · 弃掉场上一个[[道具]]支援获得 2 资源：target kind:'asset' 收窄到道具支援，
//     resolve 走 api.discardAsset + api.gainResources。

import { ALL_CARDS } from '../../cards/cards-data.js'

function isItemAsset(code) {
  const def = code ? ALL_CARDS[code] : null
  return Boolean(def) && def.type === 'asset'
    && (def.traits || []).some(trait => String(trait).toLowerCase() === 'item')
}

export default {
  code: '06326',
  abilities: [
    {
      kind: 'action',
      label: '[free] 花费 1 资源：打出手中一个[[道具]]支援（支付其费用）',
      cost: { action: false, resources: 1 },
      target: {
        kind: 'cardInHand',
        label: '你手中的[[道具]]支援',
        query: ({ candidate }) => isItemAsset(candidate?.id),
      },
      resolve: ({ inv, api, target }) => {
        const code = target?.id
        if (!code) return
        if (!(inv.hand || []).includes(code)) return
        api.info(`🎩 ${inv.name} 让「${api.cardName('06326')}」帮忙打出「${api.cardName(code)}」。`)
        api.playCard(inv.seat, code)
      },
    },
    {
      kind: 'action',
      label: '[free] 弃掉场上的一个[[道具]]支援：获得 2 资源',
      cost: { action: false },
      target: {
        kind: 'asset',
        label: '场上的[[道具]]支援',
        query: ({ candidate }) => isItemAsset(candidate?.entity?.code ?? candidate?.id),
      },
      resolve: ({ inv, api, target }) => {
        const item = target?.entity
        if (!item) return
        if (!api.discardAsset(inv.seat, item)) return
        api.gainResources(inv.seat, 2)
        api.info(`💰 ${inv.name} 弃掉「${api.cardName(item.code)}」，获得 2 资源。`)
      },
    },
  ],
  modifiers: [],
}
