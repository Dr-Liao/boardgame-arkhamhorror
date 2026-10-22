// 02287 被毁的道路
// 归属：关卡专用 · whereDoomAwaits（毁灭之地）
// 遭遇组：where_doom_awaits
// 卡面：强制 - 在你揭示被毁的道路后：在上面放置1[per_investigator]个毁灭标记。
// 卡面：[action]：调查。如果你检定成功，不发现线索，改为从被毁的道路移除1个毁灭标记。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default {
  code: '02287', scope: 'location',
  locationRule: {
    onReveal(state, loc) { loc.doom = (loc.doom || 0) + state.numInvestigators },
  },
}
