// 11727 珊瑚星之眷族（Coral Star Spawn）· 敌人 · 共享遭遇组 star_spawn（印刷 1 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/star_spawn。
// 卡面（cards-data 11727）：
//   猎手。无情。猎物 - [willpower]最高者。
//   珊瑚星之眷族上有伤害时，其获得警戒和反击。
//   强制 - 你攻击或躲避本敌人时揭示[elder_thing]标记：受到1点伤害。
//
// 读点（声明即接线）：
//   · 「有伤害时获得警戒和反击」= api.setEnemyKeywords 的 alert/retaliate 覆盖
//     （enemy-keyword-movement.js 的可编辑关键词含 alert/retaliate；combat.js 的
//     enemyHasAttackKeyword 先读覆盖再读印刷值）；在敌人受伤/生成/重整/轮开始时同步一次；
//   · 「揭示 elder_thing 时受 1 伤害」= chaosTokenRevealed 窗口 + api.damage；
//   · 猎手/无情/猎物来自章节 encounterDefinitions 解析印刷正文。
const CODE = '11727'
const TOKEN = 'elderthing'
const KEYWORDS = ['alert', 'retaliate']

const testingThisEnemy = (state, source) => {
  const test = state?.skillTest
  if (!test || test.target?.kind !== 'enemy' || test.target.id !== source?.id) return false
  return ['fight', 'evade'].includes(test.actionKind)
}

const syncKeywords = (state, source, api) => {
  const damage = Number(source?.damageTaken) || 0
  api.scenario?.setEnemyKeywords?.(source, KEYWORDS, { enabled: damage > 0, throughRound: state.round })
}

export default {
  code: CODE,
  name: '珊瑚星之眷族',
  scope: 'enemy',
  implemented: true,
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
    trigger: ['enemySpawn', 'enemyDamaged', 'enemyReadied', 'roundStarts'],
    silent: true,
    label: '有伤害时获得警戒和反击（每轮同步）',
    criteria: ({ state, source }) => Boolean(source?.id) && (state?.enemies || []).some(enemy => enemy.id === source.id),
    resolve: ({ state, source, api }) => {
      syncKeywords(state, source, api)
      if ((source.damageTaken || 0) > 0) api.info?.('🪸 「珊瑚星之眷族」有伤害：获得警戒和反击。')
    },
  }, {
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
  note: '「有伤害时获得警戒/反击」用 setEnemyKeywords 的 alert/retaliate 覆盖实现，按轮记账并在'
    + ' enemySpawn/enemyDamaged/enemyReadied/roundStarts 同步；关键词覆盖只持续到本轮结束，'
    + '因此每轮会重算（中途治疗掉伤害时最迟到下一次同步才失效）。猎手/无情/猎物来自印刷正文解析。',
}
