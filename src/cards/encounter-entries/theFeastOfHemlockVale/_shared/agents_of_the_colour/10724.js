// 10724 瘴气之影（Miasmatic Shadow）· 敌人 · 共享遭遇组 agents_of_the_colour（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/agents_of_the_colour。
// 卡面（cards-data 10724）：
//   冷漠。猎手。(黑夜[night]) 逃逸。
//   除因[[法术]]、[[遗物]]、[[科学]]和遭遇卡牌外，不能受到伤害。
//   强制 - 在你位于瘴气之影的地点弃掉手牌时，如果它为重整状态：
//           它与你交战并立即进行一次攻击。
//
// 读点（声明即接线）：
//   · 「只能被[[法术]]/[[遗物]]/[[科学]]或遭遇卡牌伤害」= 条目
//     enemyRule.allowedDamageSources（effect-provenance.js#damageSourceMatches 的既有读点，
//     形状 { traits, encounter } 由注册期校验）；
//   · 每次弃掉一张或多张手牌只触发一次交战和攻击。逃逸按敌人当前位置的昼夜计算。
import { duringPeriod } from '../../../../../engine/matcher.js'

const CODE = '10724'

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
  enemyRule: {
    allowedDamageSources: { traits: ['Spell', 'Relic', 'Science'], encounter: true },
    keywordWhile: (state, enemy, keyword) => keyword === 'elusive' ? isNight(state, enemy.location) : undefined,
  },
  flags: {
    traits: ['Monster', 'Colour'],
    quantity: 2,
    fight: 3,
    evade: 3,
    health: 3,
    damage: 1,
    horror: 1,
    victory: 0,
    aloof: true,
    hunter: true,
    elusiveAtNight: true,
    allowedDamageSources: { traits: ['Spell', 'Relic', 'Science'], encounter: true },
  },
  abilities: [{
    kind: 'forced',
    trigger: 'handCardsDiscarded',
    silent: true,
    label: '你在此地弃掉手牌时，若它重整：与你交战并立即攻击',
    criteria: ({ state, source, context }) => {
      if (!source || source.defeated || source.removedFromGame || source.exhausted) return false
      const who = context?.seat
      const inv = Number.isInteger(who) ? state?.investigators?.[who] : null
      return Boolean(inv) && !inv.defeated && !inv.resigned && inv.location === source.location
    },
    resolve: ({ state, source, context, api }) => {
      const inv = state?.investigators?.[context?.seat]
      if (!inv) return
      api.engage?.(source, inv.seat)
      api.scenario?.attack?.(source, inv)
      api.info?.(`🌫️ 「瘴气之影」：${inv.name} 在此地弃牌，它立即攻击。`)
    },
  }],
}
