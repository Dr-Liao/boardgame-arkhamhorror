// 06088 伊吉若斯之理 · 争端（Law of 'Ygiroth，诡计，1 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：agents_of_nyarlathotep（TSK / WTGD）。
// 卡面：险境。隐私。
//       显现 - 秘密地将本卡牌加入你的手牌。
//       你不能对技能检定投入技能图标总数为奇数的卡牌。
//       [action] 弃掉你手牌中一张技能图标总数为偶数的玩家卡牌：从你的手牌中弃掉本卡牌。
// 实现：Hidden 入手上牌由引擎自动完成；「投入限制」的读数点（hiddenRule）见 06087 的说明。
export default {
  code: '06088',
  scope: 'treachery',
  implemented: true,
  hiddenRule: {
    cannotCommitOddSkillIcons: true,
    discardEvenSkillIconsAction: true,
  },
  // TDE card-data.encounterDefinitions 已合并条目 hiddenRule：投入限制由引擎 hidden-rules 读点解释。
}
