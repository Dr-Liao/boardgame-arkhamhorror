// 12011 “下一招是……”（"For my next trick..."）· 秘术师 · 事件/法术/诡计 · 0 资源。
// （戴克斯特·德雷克签名卡）
//
// 卡面：戴克斯特·德雷克牌库专用。
//   查找你的牌库，找出 [[法术]] 或 [[道具]] 支援并将其打出，其费用减 2（混洗你的牌库）。
//   本行动不会引起趁乱攻击。
//
// 引擎读点：
//   · 查找：api.searchDeck（deck-ops.js 唯一检索入口；会结算 searchedCardRule、查找窗口与洗牌）。
//     过滤用 traitsAny: ['Spell','Item'] + type: 'asset'。
//   · 「费用减 2 打出」：api.playCardFromHandFree({ discount: 2, noAction: true })——doPlay 的
//     playDiscount 读点把费用 -2 后照常支付剩余费用；noAction 表示这是事件效果不是额外行动。
//   · 「不会引起趁乱攻击」：played 描述子的 noOpportunityAttack（cardPlayFlag 读点）。

const code = '12011'

export default {
  code,
  abilities: [{
    kind: 'played',
    noOpportunityAttack: true,
    label: '查找牌库中的一张 [[法术]] 或 [[道具]] 支援，费用 -2 打出它',
    resolve: ({ inv, api }) => {
      const taken = api.searchDeck(inv.seat, {
        source: code,
        type: 'asset',
        traitsAny: ['Spell', 'Item'],
        choose: 1,
        shuffle: true,
        optional: true,
        prompt: '查找你的牌库，选择一张 [[法术]] 或 [[道具]] 支援。',
      }) || []
      const affordable = taken.find(findCode => findCode
        && api.playCostOf(inv.seat, findCode) - 2 <= (inv.resources || 0))
      if (!affordable) {
        api.info('「下一招是……」：没有可以结算的 [[法术]]/[[道具]] 支援。')
        return
      }
      const played = api.playCardFromHandFree(inv.seat, affordable, { discount: 2, noAction: true })
      if (!played) api.info('「下一招是……」：打出的支援被取消，卡牌留在手中。')
    },
  }],
  modifiers: [],
}
