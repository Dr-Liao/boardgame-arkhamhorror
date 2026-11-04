// 07293 达贡宣教士 · 达贡巢穴
//
// 印刷（中文）：
//   达贡宣教士得到 +1[每调查员]生命值。
//   强制 - 达贡宣教士入场后：将放在一边的黑色钥匙放在其上。
//   强制 - 在调查员对达贡宣教士造成至少 1 点伤害时：在混乱袋中加入 1 个[诅咒]标记。
//
// 引擎读点：
//   · 生命修正：敌人条目的 modifiers 由 modifiers.js#entityModifierRows 按「实体自己的
//     卡号条目」读取（entityModifierTotal(state, enemy, 'enemyHealth')），amount 函数拿得到
//     state（同 07062b 的 +4[每调查员]生命写法）。
//   · 「入场后」：敌人生成时 enterExistingEnemy（enemies.js）先把实体放进 state.enemies，
//     再开 'enemySpawn' 窗口；条目级 forced 描述子由 ability-exec.js#openAbilityWindow
//     按实体枚举结算，context 带 { enemy, location }。
//   · 黑色钥匙：本章 setup（lateAfterDeckSetup → initKeys）把黑色钥匙以 setAside+已揭示
//     初始化，这里用 api.keys.transfer('black', 'setAside', 'enemy:<id>', { reveal:true })。
//   · 「受到伤害后」：普通战斗（combat.js）与 damageEnemy（enemies.js）两条路径都会派发
//     条目级 'enemyDamaged' 窗口，context 带 { enemy, seat, source, damage }；seat 非空
//     表示伤害记在某位调查员头上。加诅咒标记走 api.chaosTokens.add('curse', 1)。
//
// 一卡一文件：本卡行为只在这里维护；不要写回 encounter-abilities.js。

export default {
  code: '07293', scope: 'enemy', implemented: true,
  modifiers: [
    { target: 'enemyHealth', amount: ({ state }) => state.numInvestigators },
  ],
  abilities: [{
    kind: 'forced', trigger: 'enemySpawn', silent: true,
    label: '入场后：将放在一边的黑色钥匙放在其上',
    criteria: ({ source, context }) => context.enemy?.id === source.id,
    resolve: ({ source, api }) => {
      api.keys.transfer('black', 'setAside', `enemy:${source.id}`, { reveal: true })
    },
  }, {
    kind: 'forced', trigger: 'enemyDamaged', silent: true,
    label: '调查员对其造成至少1点伤害：在混乱袋中加入1个诅咒标记',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ source, context }) => context.enemy?.id === source.id
      // 2026-11-04 合并：main 侧 batch2 的条目级 enemyDamaged 上下文用 `amount`（backup 侧旧写法是
      // `damage`）；两种都接受，保证同一张卡在两条读点写法下都结算。
      && context.seat != null && Number(context.amount ?? context.damage ?? 0) >= 1,
    resolve: ({ api }) => { api.chaosTokens.add('curse', 1) },
  }],
}
