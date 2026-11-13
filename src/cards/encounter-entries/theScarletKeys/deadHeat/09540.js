// 09540 古代劫掠者
// 归属：关卡专用 · theScarletKeys/deadHeat（P7 死亡酷暑）。
// 卡面：猎手。反击。强制 - 古代劫掠者攻击你后：你所在地点 1 名平民被杀害。
//
// 一张卡一个文件：behavior.enemyAttackResolved 读取 ancientRaider / attackSlaysCivilian，
// 在攻击结算后用章节的平民唯一写入口 slayCivilian。
export default {
  code: '09540',
  scope: 'enemy',
  implemented: true,
  flags: {
    ancientRaider: true,
    attackSlaysCivilian: true,
  },
}
