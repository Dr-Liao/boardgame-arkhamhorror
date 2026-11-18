// 10628 猛攻
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 卡面：检查毁灭阈值时，其他卡上的毁灭从总数中减去；卡牌效果要放毁灭到密谋时改放病俘；毁灭放到本密谋后，每位调查员抽取敌人牌库顶；阈值 10；背面：精神创伤或牺牲居民，然后推进幕。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10628',
  scope: 'agenda',
  implemented: true,
  flags: {
    doomThreshold: 10,
    otherDoomSubtractsOnThreshold: true,
    cardEffectDoomToCaptives: true,
    enemyDeckDrawAfterAgendaDoom: true,
    backAdvancesAct: true
  },
  note: '两条强制效果由 behavior.doomPlacementReplacement / doomPlaced（引擎读点）结算；背面由 behavior.agendaReveal 结算。'
}
