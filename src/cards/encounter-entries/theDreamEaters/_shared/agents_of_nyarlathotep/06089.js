// 06089 伊吉若斯之理 · 喧嚣（Law of 'Ygiroth，诡计，1 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：agents_of_nyarlathotep（TSK / WTGD）。
// 卡面：险境。隐私。
//       显现 - 秘密地将本卡牌加入你的手牌。
//       你不能打出或投入卡牌名称为奇数个词的卡牌（词 = 空格分隔的文本）。
//       [action] 弃掉你手牌中一张名称为偶数个词的玩家卡牌：从你的手牌中弃掉本卡牌。
// 实现：Hidden 入手上牌由引擎自动完成；标题词数限制需要 hiddenRule 接线（见 06087）。
export default {
  code: '06089',
  scope: 'treachery',
  implemented: true,
  hiddenRule: {
    cannotPlayOddWordsInTitle: true,
    cannotCommitOddWordsInTitle: true,
    discardEvenWordsAction: true,
  },
  // TDE card-data.encounterDefinitions 已合并条目 hiddenRule：标题词数限制由引擎 hidden-rules 读点解释。
}
