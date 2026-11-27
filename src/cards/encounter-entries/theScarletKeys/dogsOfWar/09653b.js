// 09653b 钥匙节点（Key Locus · Last Bastion / 最后堡垒）· 剧情支援 · dogs_of_war
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。同一张物理卡的另一面是 09653a「防御屏障」。
// 卡面（中）：[action] 花费 1 个线索：检定[意志](2)。治愈钥匙节点的 1 点伤害；你检定成功且每高于难度 1 点，
//   额外治愈 1 点伤害。强制 - 如果钥匙节点被击败：将其从游戏中移除（不加入胜利区）。
//
// 章节将四张本面放入剧情支援区。治愈和敌军攻击都修改对应支援的伤害计数。
export default {
  code: '09653b',
  name: '钥匙节点（最后堡垒）',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    keyLocus: {
      face: 'lastBastion',
      health: 6,
      victory: 1,
      defeatedToVictory: false,
      defeatedRemovedFromGame: true,
      action: { kind: 'heal', clueCost: 1, difficulty: 2, skill: 'willpower', heal: 1, perSuccess: 1 },
    },
  },
}
