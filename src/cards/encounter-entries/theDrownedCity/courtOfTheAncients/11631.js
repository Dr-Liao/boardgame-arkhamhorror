// 11631 议庭守护者[tdc_rune_j] · 敌人（已翻译 ≥10 符文时获得警戒和反击；击败时发现符文 rune_j「睡眠」）。
// 归属：关卡专用 · theDrownedCity/courtOfTheAncients（TDC P7）。
// 读点：
//   · behavior.enemyDefeated（击败时翻译符文、恢复常规胜利区结算）；
//   · 动态关键词 = behavior.syncKeeperKeywords：已翻译 ≥10 符文时用
//     api.scenario.setEnemyKeywords(enemy, ['alert','retaliate'], { enabled, throughRound }) 授予，跌破后取消；
//     同步时机 enemySpawned / phaseBegan('mythos') / victoryChanged / translateGlyph 之后。
export default {
  code: '11631',
  scope: 'enemy',
  implemented: true,
  flags: {"glyphRune":"rune_j","victoryGlyph":true},
  note: "击败发现符文在 behavior.enemyDefeated；「已翻译 ≥10 符文时获得警戒和反击」由 behavior.syncKeeperKeywords 经 setEnemyKeywords(alert/retaliate) 动态同步（enemySpawned / phaseBegan / victoryChanged / translateGlyph）。",
  abilities: [],
}
