// 09653b 钥匙节点（Key Locus · Last Bastion / 最后堡垒）· 剧情支援 · dogs_of_war
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。同一张物理卡的另一面是 09653a「防御屏障」。
// 卡面（中）：[action] 花费 1 个线索：检定[意志](2)。治愈钥匙节点的 1 点伤害；你检定成功且每高于难度 1 点，
//   额外治愈 1 点伤害。强制 - 如果钥匙节点被击败：将其从游戏中移除（不加入胜利区）。
//
// 读点（全部在章节 behavior）：
//   · 生命 6（固定）：definition 的 `enemies` 表；
//   · 治愈行动 → behavior.actions 的 `keyLocusHeal`（api.spendClues + api.test(willpower, 2) + api.healEnemy，
//     治愈量 = 1 + successBy）；
//   · 「被击败移出游戏」→ behavior.enemyDefeated 返回 true（阻止胜利区结算）并 api.removeFromGameCards。
export default {
  code: '09653b',
  name: '钥匙节点（最后堡垒）',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
    keyLocus: {
      face: 'lastBastion',
      fight: 4,
      health: 6,
      victory: 1,
      defeatedToVictory: false,
      defeatedRemovedFromGame: true,
      action: { kind: 'heal', clueCost: 1, difficulty: 2, skill: 'willpower', heal: 1, perSuccess: 1 },
    },
  },
  note: 'approximation: 钥匙节点以「敌人实例」承载（同 09653a）：治愈走引擎的 healEnemy 读点，'
    + '「被击败移出游戏」由 behavior.enemyDefeated 拦截 victory 并写 removedFromGame；'
    + '引擎没有「在场支援被击败」的独立路径（primitive-requests/09653a.json）。',
}
