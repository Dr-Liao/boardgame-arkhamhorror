// 10739 尸苔（Corpse Lichen）· 敌人 · 共享遭遇组 myconids（印刷 1 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/myconids。
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   (Day [day]) Corpse Lichen cannot move. (Night [night]) Hunter. Alert.
//   Forced - After Corpse Lichen attacks: Heal 1 damage from it.
//
// 读点（声明即接线）：
//   · 「猎手 / 警戒」：encounterDefinitions 从英文正文解析关键词（card-data.js），昼夜差异是
//     P8 关键词昼夜读点，条目只把昼夜数据放进 flags。
//   · 「它攻击后治愈 1 点伤害」= 条目的 forced 描述子，trigger 'enemyAttacked'
//     （读点：src/engine/enemies.js#enemyAttack 的 reactionWindow('enemyAttacked')；
//     非玩家实体来源见 ability-rules.js#nonPlayerAbilitySources，context.enemy 是本敌人）。
//   · 治愈 = api.healEnemy（api-misc.js，写 damageTaken，与 01179 的轮末治愈同口径）。
//   · 白日的不能移动持续读取当前位置的昼夜状态。
import { duringPeriod } from '../../../../../engine/matcher.js'

const isDay = duringPeriod('day')
const isNight = duringPeriod('night')

function periodOf(state, enemy) {
  const context = { state, source: enemy }
  if (isDay(context)) return 'day'
  if (isNight(context)) return 'night'
  const records = state.campaign?.records || {}
  const recordedDate = typeof records.hemlockDate === 'string' ? records.hemlockDate.split(':')[1] : null
  return String(records.time ?? records.timeOfDay ?? recordedDate ?? '').toLowerCase()
}

export default {
  code: '10739',
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    immobileWhile: (state, enemy) => periodOf(state, enemy) === 'day',
    keywordWhile: (state, enemy, keyword) => ['hunter', 'alert'].includes(keyword)
      ? periodOf(state, enemy) === 'night' : undefined,
  },
  flags: {
    encounterGroup: 'myconids',
    quantity: 1,
    traits: ['Humanoid', 'Monster', 'Flora', 'Mutated'],
    nightOnlyKeywords: ['hunter', 'alert'],
    dayCannotMove: true,
    healAfterAttack: 1,
    printedFight: 4,
    printedEvade: 3,
    printedHealth: 4,
    printedDamage: 1,
    printedHorror: 1,
    printedVictory: 0,
  },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyAttacked',
    silent: true,
    label: '强制：尸苔攻击后治愈 1 点伤害',
    criteria: [({ source, context }) => source?.id != null && source.id === context?.enemy?.id],
    resolve: ({ source, api }) => {
      const healed = api.healEnemy(source, 1)
      api.info?.(healed > 0
        ? `💉 「${source.name}」攻击后治愈 ${healed} 点伤害。`
        : `💉 「${source.name}」攻击后没有伤害可治愈。`)
    },
  }],
  note: '攻击结算后治愈 1 点伤害。白日的不能移动在每次移动前检查。',
}
