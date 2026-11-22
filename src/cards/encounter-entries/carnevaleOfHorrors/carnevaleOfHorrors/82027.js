// 82027 · 恐怖狂欢节（carnevaleOfHorrors）
// 归属：关卡专用 · carnevaleOfHorrors/carnevaleOfHorrors。
export default {
  code: '82027',
  scope: 'enemy',
  implemented: true,
  flags: {"global":true},
  note: "奈达斯奎：幕 1 背面生成且不在任何地点（behavior.actReveal），可如同位于你所在地点攻击（behavior.actions/performAction 的 carnevaleFightCnidathqua）；被击败→结局 2（behavior.enemyDefeated）；「攻击检定失败后找盘绕附肢生成并交战」在 fightCnidathqua 失败分支结算；不能躲避由 definition.cannotBeEvaded 声明。",
  abilities: [],
}
