// 10716 干燥地洞（Dry Burrow）· 地点 · 共享遭遇组 horrors_in_the_rock（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/horrors_in_the_rock。
// 卡面（cards-data 10716）：
//   (白日[day])[快速]：移动（至一个连接地点）。（团队每轮仅限一次。）
//   (黑夜[night]) 强制 - 你在干燥地洞结束回合后：受到 1 点恐惧。
//
// 读点（声明即接线）：
//   · 白日「快速移动」= 地点条目的 free/move 描述子：parley.js#entityActionDescriptors 枚举
//     `kind: free` + `actionKind`，执行仍走 ability-exec；`limit { perRound, group }` 是
//     limits.js 的「团队每轮一次」既有读点；noOpportunityAttack 是 DESCRIPTOR_KEYS 既有字段；
//   · (白日)/(黑夜) 的权威读点是引擎 scenario-calendar.js#scenarioPeriod（matcher.duringPeriod）。
//     没有声明 calendar 的章节按同一优先级回退：本关 rules.darkLocations → 战役记录时段 → 地点 Dark；
//   · 黑夜回合结束 = turnEnded 窗口 + api.horror（伤害/恐惧的唯一入口）。
//
// 近似：印刷 [快速] 用 free（0 行动）近似；实体行动不会单独传播 fast 标记。
import { duringPeriod } from '../../../../../engine/matcher.js'

const CODE = '10716'

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
  scope: 'location',
  implemented: true,
  flags: {
    traits: ['Cave', 'Dark'],
    printedShroud: 2,
    printedClues: 1,
    quantity: 2,
    day: { fastMoveToConnecting: true, groupLimitPerRound: 1 },
    night: { endTurnHereHorror: 1 },
  },
  abilities: [{
    kind: 'free',
    actionKind: 'move',
    noOpportunityAttack: true,
    label: '白日[快速]：移动到连接地点（团队每轮仅限一次）',
    limit: { scope: 'perRound', owner: 'group' },
    criteria: [({ state, source, inv, helpers }) => !isNight(state, source?.id)
      && (source?.connections || []).some(id => helpers?.canMoveTo?.(inv.seat, id) !== false)],
    resolve: ({ inv, source, api }) => {
      const destinations = (source?.connections || []).filter(id => api.canMoveTo(inv.seat, id))
      if (!destinations.length) return false
      const answer = destinations.length === 1 ? destinations[0] : String(api.choice({
        kind: 'location', source: CODE, seat: inv.seat,
        prompt: '干燥地洞：选择要移动到的连接地点。',
        options: destinations.map(id => ({ id, label: api.locationName?.(id) || id })),
      }))
      const destination = destinations.find(id => id === answer) || destinations[0]
      api.moveInvestigator(inv.seat, destination)
      api.info?.(`🕳️ ${inv.name} 借助干燥地洞移动到「${api.locationName?.(destination) || destination}」（团队每轮一次）。`)
      return true
    },
  }, {
    kind: 'forced',
    trigger: 'turnEnded',
    silent: true,
    label: '黑夜：在干燥地洞结束回合后受到 1 点恐惧',
    criteria: [({ state, inv, source, context }) => context?.seat === inv.seat
      && inv.location === source?.id && isNight(state, source?.id)],
    resolve: ({ inv, api }) => {
      api.horror(inv.seat, 1)
      api.info?.(`🌑 「干燥地洞」：${inv.name} 在黑夜中结束回合，受到 1 点恐惧。`)
    },
  }],
  note: '白日快速移动走地点 free/move 描述子（团队每轮一次取 limits）；黑夜回合结束恐惧走 turnEnded。'
    + '昼夜优先读 duringPeriod，无日历章节回退本关黑暗规则/战役记录/地点 Dark（与各章现有口径对齐）。'
    + '近似：[快速] 用 free（0 行动）近似，实体行动未单独携带 fast 标记。',
}
