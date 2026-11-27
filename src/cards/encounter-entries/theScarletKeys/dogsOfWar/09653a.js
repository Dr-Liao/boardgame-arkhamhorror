// 09653a 钥匙节点（Key Locus · Defensive Barrier / 防御屏障）· 剧情支援 · dogs_of_war
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。同一张物理卡的另一面是 09653b「最后堡垒」。
// 卡面（中）：你可以攻击钥匙节点，如同它是攻击值为 4 的敌人。
//   [action] 花费 1 个线索：对钥匙节点造成 2 点伤害。
//   强制 - 如果钥匙节点被击败：将其加入胜利区。
//
// 剧情支援身份独立于攻击目标。章节结算线索费用、伤害和被击败后的胜利区转移。
export default {
  code: '09653a',
  name: '钥匙节点（防御屏障）',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    fightAsEnemy: true,
    keyLocus: {
      face: 'defensiveBarrier',
      fight: 4,
      healthPerInvestigator: 3,
      victory: 1,
      defeatedToVictory: true,
      attackableAsEnemy: true,
      action: { kind: 'damage', clueCost: 1, damage: 2 },
    },
  },
}
