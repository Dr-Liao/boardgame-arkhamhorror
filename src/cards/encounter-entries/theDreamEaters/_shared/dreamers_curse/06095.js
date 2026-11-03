// 06095 沉眠（Deeper Slumber，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：dreamers_curse（DSM / WTGD）。
// 卡面：Revelation - 将沉眠放置入场，放到你的威胁区域。
//       你的手牌上限减少 3 张，并且你每次抽取（1 张或多张）卡牌后检查上限。
//       [action][action]：弃掉沉眠。
// 实现：威胁区的 -3 手牌上限走引擎 handSize 读取的 threatEffect.handSizeModifier；
//   两行动摆脱用 threatAction（共享层通用实现，actions:2/noTest:true）；
//   整批抽牌完成后的 cardsDrawn 窗口触发即时手牌上限检查。
export default {
  code: '06095',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  threatEffect: { handSizeModifier: -3 },
  abilities: [{
    kind: 'forced', trigger: 'cardsDrawn', silent: true,
    label: '抽牌后立即检查手牌上限',
    criteria: [({ inv, context }) => context?.seat === inv?.seat],
    resolve: ({ inv, api }) => api.checkHandSizeNow(inv.seat),
  }],
  threatAction: {
    rule: 'discardDeeperSlumber',
    label: '💤 [行动][行动]：弃掉「沉眠」',
    noTest: true,
    actions: 2,
    target: 'threat',
  },
  encounterResolve(state, inv, card, api) {
    api.threat?.(inv.seat, '06095', { threatEffect: { handSizeModifier: -3 } })
    api.info?.(`💤 ${inv.name} 陷入「沉眠」：手牌上限 -3。`)
    return true
  },
}
