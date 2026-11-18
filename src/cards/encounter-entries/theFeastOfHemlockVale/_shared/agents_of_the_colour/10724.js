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
//   · 「弃手牌时」= handCardDiscarded 窗口（hand-discard-window.js 唯一派发点，
//     context 带 seat/location/cardCode）；交战 + 立即攻击 = api.engage +
//     api.scenario.attack（scenario-runtime 的剧本攻击入口）；
//   · 「(黑夜) 逃逸」= api.scenario.setEnemyKeywords（enemy-keyword-movement.js 的唯一写入口）。
//     没有 calendar 的章节按 10716 同一优先级取昼夜；每次 enemySpawn / 轮开始同步一次，
//     关键词覆盖只持续到本轮结束（throughRound），因此每个回合都会重新判定；
//   · 猎手/冷漠由章节 encounterDefinitions 从英文正文解析（这里只落 flags）。
//
// 近似：逃逸在「回合中途才转入黑夜」时会延到下一次轮开始/敌人生成才生效（关键词覆盖按轮记账）。
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
    trigger: ['enemySpawn', 'roundStarts'],
    silent: true,
    label: '黑夜：瘴气之影获得「逃逸」',
    criteria: ({ state, source }) => Boolean(source?.id)
      && (state?.enemies || []).some(enemy => enemy.id === source.id),
    resolve: ({ state, source, api }) => {
      const night = isNight(state, source.location)
      api.scenario?.setEnemyKeywords?.(source, ['elusive'], { enabled: night, throughRound: state.round })
      api.info?.(`🌫️ 「瘴气之影」：${night ? '黑夜获得逃逸' : '白日没有逃逸'}。`)
    },
  }, {
    kind: 'forced',
    trigger: 'handCardDiscarded',
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
  note: '伤害来源限制走 enemyRule.allowedDamageSources（含遭遇卡来源）；弃牌触发的交战/攻击走'
    + ' handCardDiscarded + api.engage + api.scenario.attack；黑夜逃逸用 setEnemyKeywords 按轮同步。'
    + 'approximation: 参考实现按「一次弃手牌批次」只攻击一次，引擎的 handCardDiscarded 窗口逐张派发，'
    + '因此同一次弃多张手牌会逐张触发（可能多攻击）；中途入夜时逃逸延到下一次轮开始/生成时生效。'
    + '章节 encounterDefinitions 不合并 enemyRule，内容层如要预读来源限制请读 flags.allowedDamageSources。',
}
