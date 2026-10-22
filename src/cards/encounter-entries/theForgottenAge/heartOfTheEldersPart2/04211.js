// 04211 孤独的洞穴群
// 归属：关卡专用 · heartOfTheEldersPart2（久远腹地（下））
// 遭遇组：knyan
// 卡面：[action]如果你所在地点没有线索：探索。抽取探索牌库顶的一张卡牌。如果该卡牌是一个连接地点，将其放置入场，并移动到该地点。
// 卡面：强制 - 在本密谋推进时：不要从场上任何地点移除毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 密谋 04211 背面：剧本日志里预示者还活着时让它重新入场。

export default {
  code: '04211', scope: 'agenda',
  agendaRule: {
    onReveal(state, agenda, api, hooks) {
      hooks.spawnHarbinger()
    },
  },
}
