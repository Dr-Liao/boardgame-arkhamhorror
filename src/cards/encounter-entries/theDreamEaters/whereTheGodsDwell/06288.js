// 06288 混沌之形（The Shape of Chaos，议程 2，毁灭阈值 5）
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
// 行为位置：与 06287 同一段背面效果，由章节 behavior.agendaReveal 读 `agendaRule.advance.revealNyarlathotepHands`
// 统一实现一次（仅在 act 4 时结算）。
export default {
  code: '06288',
  scope: 'agenda',
  implemented: true,
  agendaRule: { advance: { revealNyarlathotepHands: true } },
}
