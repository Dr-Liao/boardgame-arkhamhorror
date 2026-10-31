// 06087 伊吉若斯之理 · 混沌（Law of 'Ygiroth，诡计，1 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：agents_of_nyarlathotep（TSK / WTGD）。
// 卡面：险境。隐私。
//       显现 - 秘密地将本卡牌加入你的手牌。
//       你不能打出印刷资源费用为奇数的卡牌，也不能触发印刷资源费用为奇数的玩家卡上的能力。
//       [action] 弃掉你手牌中一张印刷资源费用为偶数的玩家卡牌：从你的手牌中弃掉本卡牌。
// 实现：Hidden 的「秘密加入手牌」由引擎 placeHiddenCard 自动完成（definition.hidden 由卡文解析）；
//   费用奇偶限制与摆脱行动被「隐藏牌规则」读点（hiddenRule）解释，但 TDE card-data 尚未把
//   条目 hiddenRule 并进 definition（PTU 有、TDE 没有）→ 已登记 coordinator request。
export default {
  code: '06087',
  scope: 'treachery',
  implemented: true,
  hiddenRule: {
    cannotPlayOddCost: true,
    cannotTriggerOddCost: true,
    discardEvenCostAction: true,
  },
  // TDE card-data.encounterDefinitions 已合并条目 hiddenRule：隐藏牌的费用奇偶限制由引擎 hidden-rules 读点解释。
}
