// 11747 长老深潜者（Elder Deep One）· 敌人 · 共享遭遇组 deep_ones（印刷 1 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/deep_ones。
// 卡面（cards-data 11747）：
//   猎手。反击。
//   每名其他[[深潜者]]敌人获得无情。
//   强制 - 长老深潜者与你交战后：治愈场上每名其他[[深潜者]]敌人1点伤害。
//
// 读点（声明即接线）：
//   · 猎手/反击 = 印刷关键词（flags + 章节 encounterDefinitions 解析）；
//   · 「每名其他深潜者敌人获得无情」= api.scenario.setEnemyKeywords 的 relentless 覆盖
//     （enemy-keyword-movement.js 的可编辑关键词含 relentless；覆盖按轮记账、到点自动失效）；
//     在敌人生成/轮开始/本卡重整时同步一次；
//   · 「交战后治愈场上每名其他深潜者 1 点伤害」= enemyEngaged 窗口 + api.healEnemy
//     （敌人实例自愈的唯一写点，不触发击败/胜利结算）。
const CODE = '11747'
const TRAIT = 'deep one'

const isDeepOne = enemy => (enemy?.traits || []).some(trait => String(trait).toLowerCase() === TRAIT)

export default {
  code: CODE,
  name: '长老深潜者',
  scope: 'enemy',
  implemented: true,
  flags: {
    traits: ['Humanoid', 'Monster', 'Deep One'],
    quantity: 1,
    fight: 3,
    evade: 4,
    health: 4,
    damage: 2,
    horror: 0,
    hunter: true,
    retaliate: true,
    deepOneAura: { relentless: true },
  },
  abilities: [{
    kind: 'forced',
    trigger: ['enemySpawn', 'roundStarts', 'enemyReadied'],
    silent: true,
    label: '其他深潜者敌人获得无情（每轮同步）',
    criteria: ({ state, source }) => Boolean(source?.id) && (state?.enemies || []).some(enemy => enemy.id === source.id),
    resolve: ({ state, source, api }) => {
      for (const enemy of state.enemies || []) {
        if (enemy === source || !isDeepOne(enemy)) continue
        api.scenario?.setEnemyKeywords?.(enemy, ['relentless'], { enabled: true, throughRound: state.round })
      }
      api.info?.('🦑 「长老深潜者」：其他深潜者敌人获得无情。')
    },
  }, {
    kind: 'forced',
    trigger: 'enemyEngaged',
    silent: true,
    label: '与你交战后：治愈场上每名其他深潜者敌人 1 点伤害',
    criteria: ({ state, source, context }) => Boolean(source?.id) && context?.enemy?.id === source.id,
    resolve: ({ state, source, api }) => {
      for (const enemy of state.enemies || []) {
        if (enemy === source || !isDeepOne(enemy) || !(enemy.damageTaken > 0)) continue
        api.healEnemy?.(enemy, 1)
      }
      api.info?.('🦑 「长老深潜者」交战：治愈其他深潜者敌人的 1 点伤害。')
    },
  }],
  note: '「其他深潜者获得无情」用 setEnemyKeywords 的 relentless 覆盖实现（按轮记账，生成/轮开始/重整时同步；'
    + '「猎手/反击」由印刷正文解析提供）。交战后的群体治愈走 enemyEngaged + api.healEnemy。',
}
