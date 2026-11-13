// 09628 虚空奇美拉（Void Chimera · Earsplitter / 震耳欲聋）· 敌人 · on_thin_ice
//
// 归属：关卡专用 · theScarletKeys/onThinIce（P7）。
// 卡面（中）：警戒。猎手。虚空奇美拉（震耳欲聋）得到 +1[per_investigator]生命值。
//
// 读点：只声明数据 ——
//   · 「警戒/猎手」由 definition 的印刷关键字进入敌人实例（combat.js 的 alert 反击、turn.js 的猎手移动）；
//   · 「+1[per_investigator] 生命值」→ definition `healthPerPlayerBonus: 1`（spawnEnemy 读点）。
export default {
  code: '09628',
  name: '虚空奇美拉（震耳欲聋）',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    alert: true,
    hunter: true,
    healthPerPlayerBonus: 1,
  },
  note: '本卡没有需要近似的能力：两条关键字 + 每调查员生命值都由印刷数据与 engine 关键字读点直接结算。',
}
