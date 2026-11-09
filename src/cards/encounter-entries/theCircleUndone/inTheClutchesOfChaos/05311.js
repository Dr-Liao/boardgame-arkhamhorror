// 05311 混沌见证者
// 卡面：生成于裂口最少的地点；猎手；进入地点后在该地点放 1 裂口。
// 「入场/移动后在所在地点放 1 裂口」是数据 flags.breachOnEnter：章节读 entryFlags(...).breachOnEnter，
// 因此必须写在条目 flags 下（写在顶层永远不会被读到——2026-11-09 P1 修复）。
export default {
  code: '05311',
  scope: 'enemy',
  implemented: true,
  enemySpawnRule: {
    location: 'fewestBreaches',
  },
  flags: { breachOnEnter: 1 },
}
