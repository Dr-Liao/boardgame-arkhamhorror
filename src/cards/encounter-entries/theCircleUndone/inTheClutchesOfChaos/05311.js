// 05311 混沌见证者
// 卡面：生成于裂口最少的地点；猎手；进入地点后在该地点放 1 裂口
// （进入效果由 behavior.enemySpawned/enemyMoved 读取该条目的 spawn 数据与卡面关键词结算）。
export default {
  code: '05311',
  scope: 'enemy',
  implemented: true,
  enemySpawnRule: {
    location: 'fewestBreaches',
  },
}