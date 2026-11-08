// 08095 防护服
// 卡面：[reaction]在你抽取一张[[危险]]诡计时，对防护服造成1点伤害和1点恐惧：取消该卡牌的显现效果。
//
// 读点：treachery 窗口（显现前 interrupt）；自身 1 伤害走费用 cost.assetDamage（能力费用入口），
// 1 恐惧用 api.addAssetHorror；取消显现走 api.playerTools.cancelRevelation(context)。
//
// 一张卡一个文件：这张卡的行为只在这里维护。

export default {
  code: '08095',
  abilities: [
    { kind: 'reaction', trigger: 'treachery', label: '危险诡计显现前：自身受 1 伤害 1 恐惧，取消显现',
      cost: { assetDamage: 1 },
      criteria: ({ inv, source, context }) => Boolean(source) && context?.seat === inv.seat,
      resolve: ({ source, context, api }) => {
        if (!source || !context) return
        if (api.cardType(context.cardCode) !== 'treachery') return
        if (!api.cardTraits(context.cardCode).some(trait => String(trait).toLowerCase() === 'hazard')) return
        api.addAssetHorror(source, 1)
        api.playerTools.cancelRevelation(context)
      } },
  ],
  modifiers: [],
}
