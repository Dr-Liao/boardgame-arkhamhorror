// 11727 珊瑚星之眷族（Coral Star Spawn）· 敌人 · 共享遭遇组 star_spawn（印刷 1 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/star_spawn。
// 卡面（cards-data 11727）：
//   猎手。无情。猎物 - [willpower]最高者。
//   珊瑚星之眷族上有伤害时，其获得警戒和反击。
//   强制 - 你攻击或躲避本敌人时揭示[elder_thing]标记：受到1点伤害。
//
// 读点（声明即接线）：
//   · 「有伤害时获得警戒和反击」= 条目级条件关键词声明 `enemyRule.whileDamagedKeywords: ['alert','retaliate']`
//     （第八轮读点：enemy-keyword-movement.js#enemyHasAttackKeyword —— 读关键词时按 `enemy.damageTaken > 0`
//     现场判定，伤害清零立即失效；damageEnemy / healEnemy 都不需要同步，attack/evade/hunter/relentless 共用）；
//   · 「揭示 elder_thing 时受 1 伤害」= chaosTokenRevealed 窗口 + api.damage；
//   · 猎手/无情/猎物来自章节 encounterDefinitions 解析印刷正文。
const CODE = '11727'
const TOKEN = 'elderthing'

const testingThisEnemy = (state, source) => {
  const test = state?.skillTest
  if (!test || test.target?.kind !== 'enemy' || test.target.id !== source?.id) return false
  return ['fight', 'evade'].includes(test.actionKind)
}

export default {
  code: CODE,
  name: '珊瑚星之眷族',
  scope: 'enemy',
  implemented: true,
  // 印刷「无情」：读点 turn.js#resolveEnemyPhase 的 registeredEntry(...).enemyRule.relentless。
  // 「有伤害时获得警戒/反击」：条目级条件关键词（读点 enemyHasAttackKeyword，按 damageTaken 现场判定）。
  enemyRule: {
    relentless: true,
    whileDamagedKeywords: ['alert', 'retaliate'],
  },
  flags: {
    traits: ['Monster', 'Star Spawn', 'Elite'],
    quantity: 1,
    fight: 3,
    evade: 3,
    health: 5,
    damage: 1,
    horror: 0,
    victory: 1,
    hunter: true,
    relentless: true,
    prey: 'highestWillpower',
    damagedGains: ['alert', 'retaliate'],
  },
  abilities: [{
    kind: 'forced',
    trigger: 'chaosTokenRevealed',
    silent: true,
    label: '攻击/躲避它时揭示 elder_thing：受到 1 点伤害',
    criteria: ({ state, source, context }) => context?.token === TOKEN
      && context?.seat === state?.skillTest?.seat
      && Boolean(source?.id) && (state?.enemies || []).some(enemy => enemy.id === source.id)
      && testingThisEnemy(state, source),
    resolve: ({ context, api }) => {
      api.damage?.(context.seat, 1)
      api.info?.(`🪸 「珊瑚星之眷族」：揭示旧神标记，检定者受到 1 点伤害。`)
    },
  }],
  note: '「有伤害时获得警戒/反击」= 条目 enemyRule.whileDamagedKeywords: [\'alert\', \'retaliate\']'
    + '（第八轮条目级条件关键词读点 enemy-keyword-movement.js#enemyHasAttackKeyword：读取关键词时按该敌人'
    + ' damageTaken > 0 现场判定 → 受伤后立即生效、治疗清零立即失效，无需任何窗口同步）；'
    + '真实用例：damageTaken 1 → alert/retaliate 为真，清零 → 为假。'
    + '猎手/无情/猎物来自印刷正文解析。无近似项。',
}
