// 11747 长老深潜者（Elder Deep One）· 敌人 · 共享遭遇组 deep_ones（印刷 1 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/deep_ones。
// 卡面（cards-data 11747）：
//   猎手。反击。
//   每名其他[[深潜者]]敌人获得无情。
//   强制 - 长老深潜者与你交战后：治愈场上每名其他[[深潜者]]敌人1点伤害。
//
// 读点（声明即接线）：
//   · 猎手/反击 = 印刷关键词（flags + 章节 encounterDefinitions 解析）；
//   · 「每名其他深潜者敌人获得无情」= 条目级关键词光环声明
//     `enemyRule.grantsKeywordsToTraits: { traits: ['Deep One'], keywords: ['relentless'] }`
//     （第八轮读点：enemy-keyword-movement.js#enemyHasAttackKeyword —— 读关键词时扫描在场敌人，
//     按目标敌人 flags.traits 匹配、**不含自身**；本卡在场即生效、离场（击败/放回/移出）立即失效，无需同步）；
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
  // 印刷「其他深潜者获得无情」：条目级关键词光环（读点 enemyHasAttackKeyword，按 traits 匹配、不含自身）。
  enemyRule: {
    grantsKeywordsToTraits: { traits: ['Deep One'], keywords: ['relentless'] },
  },
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
  },
  abilities: [{
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
  note: '「其他深潜者获得无情」= 条目 enemyRule.grantsKeywordsToTraits: { traits: [\'Deep One\'], '
    + 'keywords: [\'relentless\'] }（第八轮条目级关键词光环读点 enemy-keyword-movement.js#enemyHasAttackKeyword：'
    + '读取关键词时扫描在场敌人、按目标 flags.traits 匹配，默认不含自身；本卡在场即生效、离场立即失效，无需同步）。'
    + '真实用例：在场时其他深潜者 relentless 为真、非深潜者为假、本卡自身为假；把本卡移出 state.enemies 后'
    + '其他深潜者恢复为假。「猎手/反击」由印刷正文解析提供。交战后的群体治愈走 enemyEngaged + api.healEnemy。无近似项。',
}
