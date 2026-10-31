// 06105 冷原海盗（Corsair of Leng，敌人，2 张）
// 归属：战役共用 · theDreamEaters/_shared。遭遇组：corsairs（TSK / DSM）。
// 卡面：Spawn - 最近的[[城市]]或[[月面]]地点。Alert（警戒）。
//       强制 - 冷原海盗通过其警戒关键词攻击后：直到本阶段结束，其躲避值 -3。
// 实现：警戒的「躲避失败后攻击」由引擎 combat.js 以 kind:'alert' 发起；本条目在 onAttackResolved
//   里判断是否警戒攻击（优先读共享层转发的 attack.kind；未转发时按「非敌军阶段」近似）并
//   api.addEnemyStatModifier(enemy,{evade:-3},{until:'endOfPhase'})。
//   生成规则写 flags.spawn，由共享层 spawnLocation 数据分派（见 coordinator request）。
export default {
  code: '06105',
  scope: 'enemy',
  implemented: true,
  flags: { spawn: { kind: 'nearestTrait', traits: ['City', 'Surface'] } },
  note: '共享 enemyAttackResolved 已转发 attack 实参：优先按 attack.kind===\'alert\' 判定；旧调用点按非敌军阶段兜底。生成地点由共享 spawnLocation 读 flags.spawn。',
  enemyScript: {
    onAttackResolved(state, enemy, inv, api, attack) {
      const viaAlert = attack ? attack.kind === 'alert' : state.phase !== 'enemy'
      if (!viaAlert) return
      api.addEnemyStatModifier?.(enemy, { evade: -3 }, { until: 'endOfPhase' })
      api.info?.(`🏴‍☠️ 「冷原海盗」以警戒攻击：直到本阶段结束，其躲避值 -3。`)
    },
  },
}
