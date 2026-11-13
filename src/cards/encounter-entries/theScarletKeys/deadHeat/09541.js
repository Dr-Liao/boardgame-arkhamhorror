// 09541 哈立德（挚爱同伴）
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：猎手。强制 - 哈立德入场后：将其地点的每个其他非[[精英]]敌人与平民移到连接地点（尽可能均匀地分配）。
//
// 一张卡一个文件：behavior.enemySpawned 读取 khalid / onEnterMovesNeighbors 调用
// behavior.khalidEnteredPlay；分配按轮转顺序写「尽可能均匀」，不询问玩家（近似，见 note）。
export default {
  code: '09541',
  scope: 'enemy',
  implemented: true,
  flags: {
    khalid: true,
    onEnterMovesNeighbors: true,
  },
  note: '近似：「尽可能均匀地分配」用固定轮转顺序（相邻地点依次分配），不提供玩家/队长选择。',
}
