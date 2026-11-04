// 07165b 魔鬼礁石的骇物（深海翻滚）· 魔鬼礁石（敌人，精英）
//
// 印刷（中文）：
//   生成 - 渔船所在地点。
//   猎手。庞大。反击。
//   魔鬼礁石的骇物不能进入[[洞穴]]地点。
//   强制 - 在魔鬼礁石的骇物将要被击败时：改为移除其所有伤害并将其横置。
//          它本轮剩余时间内不能重整(包括补给阶段)。
// 印刷（英文）：
//   Spawn - Fishing Vessel's location.
//   Hunter. Massive. Retaliate.
//   The Terror of Devil Reef cannot enter [[Cave]] locations.
//   Forced - When The Terror of Devil Reef would be defeated: Instead, remove all damage
//   from it and exhaust it. It cannot ready for the remainder of the round (including the upkeep phase).
//
// 引擎读点：
//   · 「生成 - 渔船所在地点」= 条目级 `spawnAtStoryAsset: '07178'`：读点 enemies.js#spawnEnemy，
//     取 state.storyAssets 里 code=07178 的实例 location 作为生成点；抽牌路径不与抽牌者交战
//     （encounter.js 的 printedSpawnLocation 判据）。
//   · 「不能进入[[洞穴]]地点」= `enemyRule.cannotEnterTraits: ['Cave']`（enemy-entry.js#enemyCanEnterLocation）。
//   · 「将要被击败时改为……」= `enemyWouldBeDefeated` 打断窗口（windows.js 注册、
//     enemy-outcomes.js#begin 打开）→ `api.enemyOutcomes.replace(context, { healAllDamage: true })`；
//     `limit: perWindow/instance` 防止同一窗口重复结算（与 07199b / 07084 同一写法）。
//   · 「横置、本轮剩余时间不能重整(包括补给阶段)」= `api.exhaust(source)` +
//     `api.scenario.preventEnemyReady(source, 1)`（写 enemy.preventReady = { from, rounds: 1 }，
//     读点是补给阶段的重整判定）。
//   · 「猎手 / 庞大 / 反击」由关卡遭遇定义按印刷文本提供，条目里不重复声明。
//   · 07164b 与 07165b 印刷前四行完全相同；本文件是 07165b 的击败替代版本。
//
// 共用模板位置：07199b / 07084 的 enemyWouldBeDefeated 写法；生命值加成见 07292b。
//
// implemented：条目自身印刷规则均有读点与测试（tests/tic-middle-remaining.test.mjs）。
//   ⚠️ 生成调用方（魔鬼礁石议程 1b：07164/07165 的 agendaRule.onReveal）当前不在本 Wave 写盘范围；
//   本条目提供 `spawnAtStoryAsset` 读点后，调用方按 `api.spawn('07165b', 渔船地点)` 生成即可。

export default {
  code: '07165b',
  scope: 'enemy',
  implemented: true,
  spawnAtStoryAsset: '07178',
  enemyRule: { cannotEnterTraits: ['Cave'] },
  modifiers: [{ target: 'enemyHealth', amount: ({ state }) => 3 * state.numInvestigators }],
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
