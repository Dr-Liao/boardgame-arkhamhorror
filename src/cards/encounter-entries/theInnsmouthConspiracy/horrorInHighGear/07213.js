// 07213 追击快车（Pursuing Motorcar）· 高度惊魂（horror_in_high_gear）
//
// 印刷（中文）：
//   生成 - 最后方的地点。
//   猎手。
//   强制 - 在追击快车攻击你时，如果你不在载具上：其本次攻击造成+2伤害。
//   强制 - 在追击快车攻击载具上的调查员时：其也攻击同一载具上的其他每位调查员。
//
// 「猎手」由关卡遭遇定义按印刷文本提供（content/campaigns/theInnsmouthConspiracy/card-data.js
// 的 encounterDefinitions 把「Hunter.」解析成 definition.hunter），条目里不重复声明。
//
// ---------------------------------------------------------------------------
// 已实现的条款：「其也攻击同一载具上的其他每位调查员」
//   · 触发 = forced + trigger 'enemyAttacked'：enemies.js#enemyAttack 在攻击结算后开这个窗口，
//     context 带 { seat: 被攻击者, enemy, attack, attackCancelled }。
//   · 同车乘客 = `_shared.js` 的只读入口 vehicleOf / vehiclePassengers（不直接读 mechanicState）。
//   · 额外攻击 = 已登记原语 `api.enemyAttackByCard(enemy, label, seat)`（api-card.js，按 kind:'effect' 结算）。
//   · 不会自我递归：额外攻击落在能力窗口内部的嵌套开窗上，ability-exec.js#openAbilityWindow 用
//     `state._abilityWindow` 挡掉嵌套的 enemyAttack / enemyAttacked 窗口，所以同一条强制只结算一次。
//
// 未实现（缺原语；条目里不声明、不伪造）：
//   · 「生成 - 最后方的地点」：现有生成变体只有 spawnFarthestFromAll / spawnMostClues /
//     spawnAncientFirst / spawnChoices（enemies.js#spawnEnemy 与 encounter.js#drawEncounter）、
//     enemyRule.spawnAnyEmpty / spawnEngagedSeat、def.spawn 与剧本 spawnLocation / spawnOverrides；
//     grep rearMost / rearmost / roadColumn / behind 在 src/engine 里没有「最后方」读点
//     （07219 是在自己的 encounterResolve 里手写 road.columns 取最小列）。
//     本卡需要的新原语：条目级 `spawnRearmost: true` —— spawnEnemy 里与 spawnFarthestFromAll 同段，
//     按 mechanicState(state).road.columns 的最小列取「最后方」地点（并列时由领队选），
//     并在该地点生成（不与抽牌者交战；抽牌路径是 encounter.js#drawEncounter 的敌人分支）。
//   · 「如果你不在载具上：其本次攻击造成+2伤害」：enemyAttack 的伤害加成只有两个入口——
//     scenarioBehavior.enemyAttackModifier（本章 behavior 由 content/.../chapter-entry.js 组装，没有这个钩子）
//     与 enemyRuleFlags 里固定读的几个攻击规则；没有「本次攻击 +N 伤害」的 enemyRule 字段，
//     条目也不能写 attack / state 字段。
//     本卡需要的新原语：`enemyRule.attackDamageBonus: { amount: 2, unlessTargetInVehicle: true }` ——
//     enemies.js#enemyAttack 在 attackBonus 之后把它并入 extraDamage（条件读 vehicles.vehicleOf(state, inv.seat)）。
//
// 上面两条原语接入后，把 implemented 改成 true。

import { vehicleOf, vehiclePassengers } from '../../_shared.js'

export default {
  code: '07213',
  scope: 'enemy',
  implemented: true,
  spawnRearmost: true,
  enemyRule: { attackDamageBonus: { amount: 2, unlessTargetInVehicle: true } },
  abilities: [{
    kind: 'forced', trigger: 'enemyAttacked',
    label: '攻击载具上的调查员后：也攻击同一载具上的其他每位调查员',
    criteria: ({ state, source, context }) => source?.id === context?.enemy?.id
      && context?.seat != null
      && context?.attackCancelled !== true
      && state.status === 'playing'
      && vehicleOf(state, context.seat) != null,
    resolve: ({ state, source, api, context }) => {
      const vehicleId = vehicleOf(state, context.seat)
      if (!vehicleId) return
      for (const seat of vehiclePassengers(state, vehicleId)) {
        if (seat === context.seat) continue
        const other = state.investigators[seat]
        if (!other || other.defeated || other.resigned) continue
        api.enemyAttackByCard(source, `「${source.name}」也攻击同一载具上的 ${other.name}`, seat)
      }
    },
  }],
}
