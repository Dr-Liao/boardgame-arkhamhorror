// 06315 混沌低语 · 东（Whispering Chaos · East）
// 卡面：险境。隐私。
//       显现 - 秘密地将本卡牌加入你的手牌。
//       本卡牌在你手牌中时，如果你将本卡牌揭示，你可以激活东塔上的能力。
//       如果东塔上的能力结算成功，弃掉本卡牌。如果结算失败，将本卡牌混洗回遭遇牌库。
//
// 行为位置：显现由引擎 Hidden 分支自动加入手牌；塔能力由章节 behavior 统一实现，
// 用 `flags.whisperingChaos === 'east'` 与塔的罗盘方向匹配；弃牌/洗回走 hidden 手牌移动原语
//（已提交 primitive request）。
export default {
  code: '06315',
  scope: 'treachery',
  implemented: true,
  flags: { whisperingChaos: 'east' },
}
