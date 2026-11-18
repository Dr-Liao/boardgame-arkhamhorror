// 10645a 狼形混种
// 归属：关卡专用 · theFeastOfHemlockVale/theLongestNight（P7 最长一夜 · 10626）。
// 生成：外围农田（north）
// 卡面：生成 - 外围农田（north）。反击。巡逻（农庄）。强制 - 攻击后治愈 1 点伤害。
//
// 一张卡一个文件：本条目只声明身份、印刷数值标记与条目级规则键；章节流程在 behavior.js，
// 写入只走 ctx.api（条目不直写 state.* / enemy.* / location.*）。

export default {
  code: '10645a',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    patrolTarget: {
      kind: 'named',
      locationId: 'theFarmhouse'
    },
    discardToScenarioDeck: 'enemyDeck'
  },
  flags: {
    spawnDirection: 'north',
    patrol: 'theFarmhouse',
    healAfterAttack: 1,
    retaliate: true
  },
  note: 'enemyRule.patrolTarget / ignoreDefenses / discardToScenarioDeck 是引擎真实读点（巡逻移动、关键词屏障与进入工事、弃置入敌人牌库）。生成方向由 behavior.spawnLocation 读取 flags.spawnDirection。'
}
