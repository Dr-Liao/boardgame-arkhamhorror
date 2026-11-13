// 09630 虚空奇美拉（Void Chimera · Fellhound / 凶狠猎犬）· 敌人 · on_thin_ice
//
// 归属：关卡专用 · theScarletKeys/onThinIce（P7）。
// 卡面（中）：猎手。虚空奇美拉（凶狠猎犬）得到 +1[per_investigator]生命值。
//   你攻击或尝试躲避虚空奇美拉（凶狠猎犬）时，如果有任何放在一边的空洞归你所有，它获得警戒和反击。
//
// 读点：behavior.enemyPhaseStart / 空洞写入点调 behavior.syncFellhoundKeywords：
//   · 条目声明 `gainsAlertRetaliateWhileHollowsOwned`（唯一声明处）；
//   · 结算口径：只要空洞区有卡（team 或任一 investigator），就把该敌人的实例 `retaliate`/`alert`
//     置真；空洞全部被回收/抹除后置假；
//   · 「+1[per_investigator] 生命值」→ definition `healthPerPlayerBonus: 1`；「猎手」→ 印刷关键字。
export default {
  code: '09630',
  name: '虚空奇美拉（凶狠猎犬）',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    hunter: true,
    healthPerPlayerBonus: 1,
    gainsAlertRetaliateWhileHollowsOwned: true,
  },
  note: 'approximation: 引擎没有「战斗进行中的敌方关键词授予」读点（combat.js 的 grantRetaliate 只接受'
    + '本次检定的一次性授予，`r.grantedEnemyKeywords` 只来自投入卡），因此本实现把「攻击/躲避期间」'
    + '近似为「空洞区非空期间」，并且在每次空洞变化与敌人阶段开始时重算该敌人的实例关键字。'
    + '请求见 artifacts/migration/tsk/primitive-requests/09630.json。',
}
