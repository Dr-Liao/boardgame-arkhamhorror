// 05328 最后的倒计时（毁灭 8）
// 推进背面：弃异教徒 + 抽魔鬼的笛声（牌库/弃牌堆都查）；有玉米壳娃娃则从阿撒托斯移除 1 毁灭；弃掉本议程
// （此后毁灭直接落到阿撒托斯上，由 behavior.doomPlaced 结算；behavior 置 flags.azathothAbsorbsAllDoom，
// chaos.js 的 azathothDoomOf 从此把场上所有卡牌/当前密谋上的毁灭计入阿撒托斯）。
export default {
  code: '05328',
  scope: 'agenda',
  implemented: true,
  // 卡面「在本密谋推进时，不要移除敌人的毁灭标记。」（引擎 advanceAgenda 读点）
  doomKeptOnAgendaAdvance: 'enemies',
  agendaRule: {
    advance: {
      ritualSuicide: true,
      daemonicPiping: true,
      removeDoomMemento: 'cornHuskDoll',
      discardSelf: true,
    },
  },
}