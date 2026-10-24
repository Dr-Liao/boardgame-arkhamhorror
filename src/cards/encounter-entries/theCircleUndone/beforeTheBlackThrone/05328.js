// 05328 最后的倒计时（毁灭 8）
// 推进背面：弃异教徒 + 抽魔鬼的笛声；有玉米壳娃娃则从阿撒托斯移除 1 毁灭；弃掉本议程
// （此后毁灭直接落到阿撒托斯上，由 behavior.doomPlaced 结算）。
export default {
  code: '05328',
  scope: 'agenda',
  implemented: true,
  agendaRule: {
    advance: {
      ritualSuicide: true,
      daemonicPiping: true,
      removeDoomMemento: 'cornHuskDoll',
      discardSelf: true,
    },
  },
}