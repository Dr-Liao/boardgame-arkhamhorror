// 07164b 魔鬼礁石的骇物（异形抓攫）· 魔鬼礁石（敌人，精英）
//
// 印刷（中文）：
//   生成 - 渔船所在地点。
//   猎手。庞大。反击。
//   魔鬼礁石的骇物不能进入[[洞穴]]地点。
//   魔鬼礁石的骇物得到+3[每调查员]生命值。
// 印刷（英文）：
//   Spawn - Fishing Vessel's location.
//   Hunter. Massive. Retaliate.
//   The Terror of Devil Reef cannot enter [[Cave]] locations.
//   The Terror of Devil Reef gets +3 [per_investigator] health.
//
// 引擎读点：
//   · 「生成 - 渔船所在地点」= 条目级 `spawnAtStoryAsset: '07178'`：读点 enemies.js#spawnEnemy，
//     取 state.storyAssets 里 code=07178 的实例 location 作为生成点；抽牌路径不与抽牌者交战
//     （encounter.js 的 printedSpawnLocation 判据把「剧本指定的生成点」与「默认交战」分开）。
//   · 「不能进入[[洞穴]]地点」= `enemyRule.cannotEnterTraits: ['Cave']`：读点
//     enemy-entry.js#enemyCanEnterLocation（生成校验、猎人移动、搜索候选共用）。
//   · 「+3[每调查员]生命值」= `modifiers: [{ target: 'enemyHealth', amount: 3 × 人数 }]`：
//     读点 modifiers.js#enemyHealthDelta → enemies.js#enemyHealth（唯一生命值读点），
//     与 07292b/07144/07062b 同一写法。
//   · 「猎手 / 庞大 / 反击」由关卡遭遇定义按印刷文本提供（content card-data.encounterDefinitions），
//     条目里不重复声明；07164b 没有「将要被击败时」的替代效果（对照 07165b）。
//
// 共用模板位置：本卡与 07165b 的印刷前四行相同；生命值加成/生成点/洞穴限制三处读点完全一致，
// 差异只在 07165b 的击败替代。参见 _shared.js 顶部的实体修正读点说明。
//
// implemented：条目自身三句印刷规则均有读点与测试（tests/tic-middle-remaining.test.mjs）。
//   ⚠️ 生成调用方（魔鬼礁石议程 1b：07164/07165 的 agendaRule.onReveal）当前不在本 Wave 写盘范围；
//   本条目提供 `spawnAtStoryAsset` 读点后，调用方按 `api.spawn('07164b', 渔船地点)` 生成即可。

export default {
  code: '07164b',
  scope: 'enemy',
  implemented: true,
  spawnAtStoryAsset: '07178',
  enemyRule: { cannotEnterTraits: ['Cave'] },
  modifiers: [{ target: 'enemyHealth', amount: ({ state }) => 3 * state.numInvestigators }],
}
