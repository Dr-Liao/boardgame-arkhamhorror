// 05279 黛雅娜·艾丝帕伦斯
// 卡面：使用(3秘密)。
// 卡面：[free]：将你手牌中的一张非弱点法术事件附属到黛雅娜·艾丝帕伦斯上。附属到其上的事件仅限1张。
// 卡面：可以打出附属的事件，如同其在你手牌中。其打出后，不放到你的弃牌堆(其仍附属在原处)。
//       作为打出附属的事件的额外费用，横置黛雅娜·艾丝帕伦斯并花费1秘密。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 05279 黛雅娜·艾丝帕伦斯：两段能力。
// 1) [快速] 附属：target cardInHand 收窄到「非弱点法术事件」，用 api.moveCard 把这张牌搬到 attachments。
// 2) 打出附属事件：引擎没有「附属区当手牌」的通用通道，这里改用卡面能力通道 —— 支付横置 + 1 秘密
//    （资源费按附属事件印刷费用另付），再用 api.replayPlayedCode 重放这张事件的打出效果；
//    事件本身仍留在 attachments（对应卡面「打出后不放进弃牌堆」）。
// simplified 说明见条目 note（快速窗口与需要预选目标的 played 事件在该通道下不完整）。

export default {
  code: '05279',
  uses: 3,
  usesType: 'secrets',
  simplified: true,
  note: '「附属事件可当作手牌打出」改用能力通道实现（横置黛雅娜 + 1 秘密 + 印刷资源费 → replayPlayedCode）；'
    + '因此不能在该事件的快速反应窗口里打出，且需要预选目标的 played 事件不会自动选目标。其余效果（附属、限 1 张、打出后仍附属）已实现。',
  abilities: [
    {
      kind: 'action',
      cost: { action: false },
      label: '[快速] 附属一张非弱点法术事件',
      target: { kind: 'cardInHand', label: '手牌中的非弱点法术事件' },
      resolve: ({ inv, source, target, api }) => {
        if (!source || !target) return
        const traits = api.cardTraits(target.id) || []
        if (api.cardType(target.id) !== 'event' || !traits.includes('spell') || !api.isNonWeakness(target.id)) {
          api.info('只能把非弱点的法术事件附属到黛雅娜·艾丝帕伦斯上。')
          return
        }
        source.attachments ||= []
        if (source.attachments.length >= 1) { api.info('黛雅娜·艾丝帕伦斯上已经附属了一张事件。'); return }
        api.moveCard({ code: target.id, from: 'hand', to: 'attached', attachTo: source.id })
        api.info(`${inv.name} 把「${api.cardName(target.id)}」附属到黛雅娜·艾丝帕伦斯上。`)
      },
    },
    {
      kind: 'action',
      cost: { action: false, exhaust: true, uses: 1 },
      label: '打出附属的事件（横置黛雅娜并花 1 秘密）',
      resolve: ({ inv, source, api }) => {
        const attached = source?.attachments || []
        if (!attached.length) { api.info('黛雅娜·艾丝帕伦斯上没有附属的事件。'); return }
        const entry = attached[attached.length - 1]
        const cost = api.cardCost(entry.code)
        if (inv.resources < cost) { api.info(`资源不足，无法打出附属的「${api.cardName(entry.code)}」。`); return }
        if (cost) api.loseResources(inv.seat, cost)
        api.info(`${inv.name} 横置黛雅娜并花 1 秘密，打出附属的「${api.cardName(entry.code)}」。`)
        api.replayPlayedCode(inv.seat, entry.code)
      },
    },
  ],
  modifiers: [

  ],
}
