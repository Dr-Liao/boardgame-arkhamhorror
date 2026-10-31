// 06226 敌人「月蜥」（Moon Lizard · [[怪物]]·[[精英]]）· 月之暗面
// 归属：关卡专用 · darkSideOfTheMoon。卡面：猎手。月蜥只能进入[[洞穴]]地点。
// 月蜥与调查员交战时，X 为该调查员的警报等级。否则，X 为 5。（X 即它的攻击值与躲避值。）
//
// 依据 Haskell Enemy/Cards/.../MoonLizard.hs：
//   · 数值：印刷攻击/躲避是 X，definition 里用 extraRules 把 base 置 5（未交战时的 X），
//     交战时由 enemyStatRule.fightEvadeFromAlarm 数据修正（本章 behavior.enemyStatModifier 转发共享层后求值）；
//   · 「只能进入[[洞穴]]地点」：引擎没有敌人进入限制读点；本章 behavior.hunterMove 对
//     enemyStatRule.huntOnlyCaveLocations 的敌人在洞穴子图上寻路（见 behavior 注释与 simplified）。
export default {
  code: '06226',
  scope: 'enemy',
  implemented: true,
  enemyStatRule: {
    // 交战时 X = 该调查员的警报等级；未交战 X = 5（behavior 用印刷值 5 反推差值）。
    fightEvadeFromAlarm: { whenUnengaged: 5 },
    huntOnlyCaveLocations: true,
  },
  note: 'simplified：引擎没有「敌人只能进入某类地点」的读点，月蜥的移动限制由本章 behavior.hunterMove 的洞穴子图寻路近似；'
    + '被效果移动（api.moveEnemy）当前不拦截。',
}
