// 06095 沉眠（Deeper Slumber，诡计，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：dreamers_curse（DSM / WTGD）。
// 卡面：Revelation - 将沉眠放置入场，放到你的威胁区域。
//       你的手牌上限减少 3 张，并且你每次抽取（1 张或多张）卡牌后检查上限。
//       [action][action]：弃掉沉眠。
// 实现：威胁区的 -3 手牌上限用声明式修正（modifierTotal 的 handSize 目标，来源含 inv.threat）；
//   两行动摆脱用 threatAction（共享层通用实现，actions:2/noTest:true）；
//   「每次抽牌后检查上限」缺抽牌后的手牌检查读点 → simplified。
export default {
  code: '06095',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  modifiers: [{ target: 'handSize', amount: -3 }],
  threatAction: {
    rule: 'discardDeeperSlumber',
    label: '💤 [行动][行动]：弃掉「沉眠」',
    noTest: true,
    actions: 2,
    target: 'threat',
  },
  encounterResolve(state, inv, card, api) {
    api.threat?.(inv.seat, '06095')
    api.info?.(`💤 ${inv.name} 陷入「沉眠」：手牌上限 -3。`)
    return true
  },
  simplified: true,
  note: '「每次抽牌后检查手牌上限」缺引擎抽牌后钩子（CheckHandSizeAfterDraw 无对应读点）。',
}
