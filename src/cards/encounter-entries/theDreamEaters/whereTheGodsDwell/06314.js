// 06314 混沌低语 · 北（Whispering Chaos · North）
// 卡面：险境。隐私。
//       显现 - 秘密地将本卡牌加入你的手牌。
//       本卡牌在你手牌中时，如果你将本卡牌揭示，你可以激活北塔上的能力。
//       如果北塔上的能力结算成功，弃掉本卡牌。如果结算失败，将本卡牌混洗回遭遇牌库。
//
// 行为位置：
//   · 「秘密加入手牌」由引擎的 Hidden 幻觉牌分支自动完成（treachery-tokens.js 的 placeHiddenCard）；
//   · 塔能力由章节 behavior.actions / performAction 统一实现（6 座塔共用一个流程），
//     用 `flags.whisperingChaos === <罗盘方向>` 判断塔与低语的对应关系（塔的方向由 act 3 背面随机摆位后写入）。
//   · 成功弃牌 / 失败洗回需要 hidden 手牌移动原语（已提交 primitive request）。
export default {
  code: '06314',
  scope: 'treachery',
  implemented: true,
  flags: { whisperingChaos: 'north' },
}
