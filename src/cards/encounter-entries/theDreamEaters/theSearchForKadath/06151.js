// 06151 一群乌尼斯（theSearchForKadath）· 敌人（生物 / 怪物，蜂拥1，印刷 2 张）
// 卡面：蜂拥1。
// 卡面：当头领「一群乌尼斯」上没有附属蜂拥卡牌时，它得到攻击值+2与躲避值+2。
//
// 一卡一文件：规则数据在这里声明；章节 behavior.enemyStatModifier 读取并接线。
export default {
  code: '06151', scope: 'enemy', implemented: true,
  enemyRule: { fightEvadeBonusWithoutSwarm: 2 },
}
