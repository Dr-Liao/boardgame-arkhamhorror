// 03332 哈斯塔
// 归属：关卡专用 · dimCarcosa（卡尔克萨之路 · 卡城幽影）
// 遭遇组：dim_carcosa
// 卡面：除因剧情卡牌效果外不能受到伤害。
// 卡面：强制 - 当敌军阶段开始时，如果哈斯塔处于重整状态：哈斯塔按玩家顺序攻击场上每位调查员(无视他们的所在地点)。如果哈斯塔的攻击造成的恐惧超出你的神智值，你还受到1点伤害。
// 卡面：[action]：检定[willpower](X)，其中X为哈斯塔的攻击值。如果你检定成功，横置哈斯塔。任意调查员均可以触发本行动。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 哈斯塔（黄衣之王，03332）：除剧情卡牌效果（剧本用 source='encounter'）外不能受到伤害；
// 攻击造成的恐惧超过神智时额外 1 点伤害。敌军阶段开始的无视地点攻击在 dimCarcosa 的 enemyPhaseStart。

export default {
  code: '03332', scope: 'enemy', flags: { hastur: true, kingInYellow: true },
  enemyRule: { damageOnlyFrom: 'encounter', excessHorrorDamage: true },
}
