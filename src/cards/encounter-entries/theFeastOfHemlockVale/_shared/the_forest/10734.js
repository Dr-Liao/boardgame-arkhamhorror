// 10734 螺旋牡鹿（Cochleal Stag）· 敌人 · 共享遭遇组 the_forest（印刷 1 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/the_forest。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Elusive. (Night [night]) Hunter.
//   Each investigator at Cochleal Stag's location and each connecting location gets -2 to all
//   skills during the mythos phase.
//
// 读点（声明即接线）：
//   · 「逃逸」（无条件印刷）= enemyRule.elusive，读点 src/engine/enemy-keyword-movement.js
//     #resolveElusiveAfterAttack（攻击后解除交战 → 移动到连接地点 → 横置；combat.js 与 enemies.js 的
//     攻击结算共用）。
//   · 猎手持续读取敌人所在地的昼夜。神话阶段技能修正适用于本地和连接地点。
//   · 印刷数值（fight 3 / evade 4 / health 5 / damage 2 / horror 1）由 cards-data 提供，条目只镜像。
import { duringPeriod } from '../../../../../engine/matcher.js'

const isDay = duringPeriod('day')
const isNight = duringPeriod('night')

function nightAtEnemy(state, enemy) {
  const context = { state, source: enemy }
  if (isNight(context)) return true
  if (isDay(context)) return false
  const records = state.campaign?.records || {}
  const recordedDate = typeof records.hemlockDate === 'string' ? records.hemlockDate.split(':')[1] : null
  return String(records.time ?? records.timeOfDay ?? recordedDate ?? '').toLowerCase() === 'night'
}

export default {
  code: '10734',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    elusive: true,
    keywordWhile: (state, enemy, keyword) => keyword === 'hunter' ? nightAtEnemy(state, enemy) : undefined,
    investigatorSkillModifier(state, enemy, inv) {
      if (state.phase !== 'mythos') return 0
      const here = state.locations.find(location => location.id === enemy.location)
      return here && (here.id === inv.location || here.connections?.includes(inv.location)) ? -2 : 0
    },
  },
  flags: {
    encounterGroup: 'the_forest',
    quantity: 1,
    traits: ['Creature', 'Monster', 'Flora', 'Mutated'],
    keywords: ['elusive'],
    nightOnlyKeywords: ['hunter'],
    printedFight: 3,
    printedEvade: 4,
    printedHealth: 5,
    printedDamage: 2,
    printedHorror: 1,
    printedVictory: 0,
    mythosPhaseSkillPenalty: { amount: -2, skills: 'all', scope: 'hereAndConnections', phase: 'mythos' },
  },
  abilities: [],
}
