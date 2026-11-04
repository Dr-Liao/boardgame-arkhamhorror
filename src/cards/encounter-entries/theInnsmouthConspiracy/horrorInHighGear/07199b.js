// 07199b 魔鬼礁石的骇物 · 高度惊魂（敌人，精英）
//
// 印刷（中文）：
//   生成 - 最后方的地点。
//   猎手。庞大。反击。
//   强制 - 在魔鬼礁石的骇物将要被击败时：改为移除其所有伤害并将其横置。
//          它本轮剩余时间内不能重整。
//
// 引擎读点：
//   · 「生成 - 最后方的地点」= 条目级 `spawnRearmost`：读点 enemies.js#spawnEnemy，
//     按 mechanicState.road.columns 的最小列取地点；抽牌路径不与抽牌者交战（encounter.js
//     的 printedSpawnLocation 判据）。
//   · 「将要被击败时改为……」= `enemyWouldBeDefeated` 打断窗口（windows.js 注册、
//     enemy-outcomes.js#begin 打开）→ `api.enemyOutcomes.replace(context, { healAllDamage })`；
//     `limit: perWindow/instance` 防止同一窗口重复结算（与 07084「无毁烬时」同一写法）。
//   · 「横置、本轮剩余时间不能重整」= `api.exhaust(source)` + `api.scenario.preventEnemyReady(source, 1)`
//     （写 `enemy.preventReady = { from: 本轮, rounds: 1 }`，读点是补给阶段的重整判定）。
//   · 「猎手 / 庞大 / 反击」由关卡遭遇定义按印刷文本提供，条目里不重复声明。

export default {
  code: '07199b',
  scope: 'enemy',
  implemented: true,
  spawnRearmost: true,
  abilities: [{
    kind: 'forced',
    trigger: 'enemyWouldBeDefeated',
    label: '将要被击败时：移除所有伤害并横置，本轮剩余时间不能重整',
    limit: { scope: 'perWindow', owner: 'instance' },
    criteria: ({ source, context }) => context?.enemy?.id === source?.id,
    resolve: ({ source, context, api }) => {
      if (!api.enemyOutcomes?.replace(context, { healAllDamage: true })) return
      api.exhaust(source)
      api.scenario.preventEnemyReady(source, 1)
    },
  }],
}
