// 06287 混沌之眼（The Eye of Chaos，议程 1，毁灭阈值 7）
// 正面：无卡面文本。
// 背面：If it is act 4, read the following:
//       Place clues on each Forsaken Tower location until it has clues equal to its clue value.
//       Reveal each copy of Nyarlathotep in each investigator's hand. Each investigator who did not
//       reveal a copy of Nyarlathotep must take either 1 damage or 1 horror. For each copy of
//       Nyarlathotep revealed by an investigator, that investigator must choose:
//       - Nyarlathotep immediately attacks that investigator and is shuffled into the encounter deck.
//       - Nyarlathotep immediately attacks that investigator three times and is returned to that
//         investigator's hand.
//
// 行为位置：`agendaRule.advance.revealNyarlathotepHands` 由章节 behavior.agendaReveal 读取并统一实现
// （06287/06288 同一段背面效果只实现一次；仅当前幕为 act 4 时结算），攻击用印刷伤害/恐惧、
// 洗回遭遇牌库走 hidden 手牌原语（已提交 primitive request）。
export default {
  code: '06287',
  scope: 'agenda',
  implemented: true,
  agendaRule: { advance: { revealNyarlathotepHands: true } },
}
