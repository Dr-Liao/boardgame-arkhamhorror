// 05311 混沌见证者
// 卡面：生成于裂口最少的地点；猎手；进入地点后在该地点放 1 裂口。
// 「入场/移动后在所在地点放 1 裂口」是数据 breachOnEnter，章节只按字段统一执行。
export default {
  code: '05311',
  scope: 'enemy',
  implemented: true,
  enemySpawnRule: {
    location: 'fewestBreaches',
  },
  breachOnEnter: 1,
}