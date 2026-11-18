// 10721 水晶寄生虫（Crystal Parasite）· 敌人 · 共享遭遇组 horrors_in_the_rock（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/horrors_in_the_rock。
// 卡面（cards-data 10721）：
//   猎手。反击。
//   (白日[day]) 强制 - 水晶寄生虫攻击后：治愈其 2 点伤害。
//   (黑夜[night]) 水晶寄生虫上每有 2 点伤害，其得到 +2 攻击值和 +1 伤害值。
//
// 读点（声明即接线）：
//   · 猎手/反击/胜利 1/印刷数值由章节 encounterDefinitions 从卡表读取（这里只落 flags 供内容层查）；
//   · 黑夜攻击值 = 条目 modifiers 的 enemyFight 修正（modifiers.js#entityModifierTotal 读点，
//     敌人把自己的声明式修正走同一管线；`amount` 函数读到 damageTaken）；
//   · 白日攻击后治愈 = enemyAttacked 窗口（敌人攻击结算后的既有窗口）+ api.healEnemy；
//   · (白日)/(黑夜) 优先读 duringPeriod，无日历章节按黑暗地点/战役记录回退（与 10716 同口径）。
//
// 近似：黑夜「+1 伤害值」没有实体修正目标（ENTITY_MODIFIER_TARGETS 只有
//   enemyFight/enemyEvade/enemyHealth），条目不新增字段冒充已接线——只在 flags 与 note 披露。
import { duringPeriod } from '../../../../../engine/matcher.js'

const CODE = '10721'

/** 当前是否黑夜：引擎日历 → 本关黑暗地点规则 → 记录时段 → 地点 Dark。 */
function isNight(state, locationId) {
  const location = (state?.locations || []).find(item => item.id === locationId) || null
  if (state?.scenario?.mechanics?.calendar) {
    return Boolean(duringPeriod('night')({ state, source: location, inv: null }))
  }
  if (state?.scenario?.rules?.darkLocations) {
    const dark = location?.dark != null ? location.dark : (location?.traits || []).includes('Dark')
    return Boolean(dark)
  }
  const flags = state?.scenarioFlags || {}
  const records = state?.campaign?.records || {}
  const rawDate = typeof records.hemlockDate === 'string' ? records.hemlockDate.split(':')[1] : null
  const recorded = flags.writtenInRockTime ?? records.time ?? records.timeOfDay ?? rawDate
  const normalized = typeof recorded === 'string' ? recorded.toLowerCase() : null
  if (normalized === 'day' || normalized === 'night') return normalized === 'night'
  if (typeof flags.writtenInRockNight === 'boolean') return flags.writtenInRockNight
  const dark = location?.dark != null ? location.dark : (location?.traits || []).includes('Dark')
  return Boolean(dark)
}

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  modifiers: [{
    target: 'enemyFight',
    amount: ({ state, entity }) => (isNight(state, entity?.location)
      ? 2 * Math.floor((Number(entity?.damageTaken) || 0) / 2)
      : 0),
  }],
  abilities: [{
    kind: 'forced',
    trigger: 'enemyAttacked',
    silent: true,
    label: '白日：水晶寄生虫攻击后治愈其 2 点伤害',
    criteria: ({ state, source, context }) => context?.enemy?.id === source?.id
      && context?.attackCancelled !== true
      && !isNight(state, source?.location),
    resolve: ({ source, api }) => {
      api.healEnemy(source, 2)
      api.info?.(`💎 「水晶寄生虫」：白日攻击后治愈 2 点伤害。`)
    },
  }],
  flags: {
    traits: ['Monster', 'Insect', 'Blight'],
    quantity: 2,
    fight: 2,
    evade: 2,
    health: 6,
    damage: 1,
    horror: 1,
    victory: 1,
    hunter: true,
    retaliate: true,
    day: { healAfterAttack: 2 },
    night: { fightPer2Damage: 2, damagePer2Damage: 1 },
  },
  note: '黑夜攻击值 +2/每 2 点伤害走条目的 enemyFight 修正（entityModifierTotal 读点）；'
    + '黑夜「+1 伤害值」缺实体修正目标，只在 flags.night 声明并在本 note 披露未接线；'
    + '白日攻击后治愈走 enemyAttacked + api.healEnemy。',
}
