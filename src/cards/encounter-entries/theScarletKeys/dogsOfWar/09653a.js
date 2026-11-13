// 09653a 钥匙节点（Key Locus · Defensive Barrier / 防御屏障）· 剧情支援 · dogs_of_war
//
// 归属：关卡专用 · theScarletKeys/dogsOfWar（P7）。同一张物理卡的另一面是 09653b「最后堡垒」。
// 卡面（中）：你可以攻击钥匙节点，如同它是攻击值为 4 的敌人。
//   [action] 花费 1 个线索：对钥匙节点造成 2 点伤害。
//   强制 - 如果钥匙节点被击败：将其加入胜利区。
//
// 读点（全部在章节 behavior，条目只声明数据）：
//   · 战斗值 / 生命：definition 的 `enemies` 表（fight 4、3×人数生命）——本章把钥匙节点建模成
//     「可被攻击的敌人实例」（引擎没有「把在场支援当作敌人攻击」的原语，见 09653a.json 请求）；
//   · 「花费 1 个线索造成 2 点伤害」→ behavior.actions 的 `keyLocusDamage` 行动（api.spendClues +
//     api.damageEnemy），费用/目标与卡面一致；
//   · 「被击败加入胜利区」→ behavior.enemyDefeated 对 `defeatedToVictory: true` 的面放行引擎的胜利区结算。
export default {
  code: '09653a',
  name: '钥匙节点（防御屏障）',
  scope: 'storyAsset',
  implemented: true,
  assetRule: {
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
  note: 'approximation: 钥匙节点以「敌人实例」承载（见 behavior.scenarioApproximations）：引擎没有'
    + '「在场支援可被当作敌人攻击」的读点（primitive-requests/09653a.json）；因此它会参与引擎的自动交战'
    + '（伤害/恐惧为 0，不影响结算）。「花费 1 个线索造成 2 点伤害」由章节剧本行动结算。',
}
