// 10730 至高光彩（Empyrean Brilliance）· 诡计 · 共享遭遇组 refractions（印刷 2 张）
// 归属：战役共用 · theFeastOfHemlockVale/_shared/refractions。
// 卡面（cards-data 10730）：
//   (白日[day]) 显现 - 检定[意志](2)。如果你有至少 5 张手牌，此次检定的难度提高 2 点。
//               如果你检定失败，选择并弃掉你 2 张卡牌。
//   (黑夜[night]) 显现 - 随机弃掉你 1 张手牌。检定[意志](X)。X 等于该卡牌的印刷费用。
//                 如果你检定失败，受到 2 点恐惧。
//
// 读点（声明即接线）：显现直接在本条目结算（entryRevelation 分支，api = scenarioRuntime）。
//   昼夜优先读引擎日历（duringPeriod），无日历章节按 10716 同一优先级回退；
//   检定/api.discardChosen/api.horror 均为既有入口；黑夜「随机弃掉的那张」用弃牌前后手牌
//   的多重集差分识别（不新增状态字段），X 读卡表的印刷费用。
import { ALL_CARDS } from '../../../_shared.js'
import { duringPeriod } from '../../../../../engine/matcher.js'

const CODE = '10730'

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

/** 随机弃 1 张手牌，返回被弃掉的卡号（用前后手牌多重集差分识别；无可弃牌时返回 null）。 */
function discardOneRandomAndReport(state, seat, api) {
  const owner = state?.investigators?.[seat]
  if (!owner || !(owner.hand || []).length) return null
  const before = [...owner.hand]
  api.discardRandom(seat, 1)
  const after = [...(owner.hand || [])]
  const counts = new Map()
  for (const code of after) counts.set(code, (counts.get(code) || 0) + 1)
  for (const code of before) {
    const count = counts.get(code) || 0
    if (count > 0) counts.set(code, count - 1)
    else return code
  }
  return null
}

export default {
  code: CODE,
  scope: 'treachery',
  implemented: true,
  flags: {
    traits: ['Power', 'Colour'],
    quantity: 2,
    day: { test: { skill: 'willpower', difficulty: 2 }, handAtLeast: 5, difficultyBonus: 2, failDiscardChosen: 2 },
    night: { discardRandom: 1, testSkill: 'willpower', difficultyByPrintedCost: true, failHorror: 2 },
  },
  encounterResolve(state, inv, card, api) {
    const seat = inv?.seat
    if (!Number.isInteger(seat)) return false
    if (!isNight(state, inv.location)) {
      const difficulty = 2 + ((inv.hand || []).length >= 5 ? 2 : 0)
      api.test(seat, 'willpower', difficulty, result => {
        if (result?.success) {
          api.info?.(`✔️ ${inv.name} 通过「至高光彩」检定（意志 ${result.value} vs ${difficulty}）。`)
          return
        }
        api.discardChosen(seat, 2)
        api.info?.(`✨ 「至高光彩」：${inv.name} 检定失败，选择并弃掉 2 张卡牌。`)
      }, 0, { code: CODE, label: '遭遇检定', name: '至高光彩' })
      return false
    }
    const discarded = discardOneRandomAndReport(state, seat, api)
    const difficulty = Math.max(0, Number(ALL_CARDS[discarded]?.cost) || 0)
    api.info?.(`✨ 「至高光彩」：${inv.name} 随机弃掉「${api.cardName?.(discarded) || discarded || '（无手牌可弃）'}」。`)
    api.test(seat, 'willpower', difficulty, result => {
      if (result?.success) {
        api.info?.(`✔️ ${inv.name} 通过「至高光彩」检定（意志 ${result.value} vs ${difficulty}）。`)
        return
      }
      api.horror(seat, 2)
      api.info?.(`✨ 「至高光彩」：${inv.name} 检定失败，受到 2 点恐惧。`)
    }, 0, { code: CODE, label: '遭遇检定', name: '至高光彩' })
    return false
  },
  note: '显现自足实现：白日难度 2（手牌 ≥5 时 +2）、失败选择弃 2；黑夜先随机弃 1（差分识别卡号）'
    + '再以该牌印刷费用为 X 检定。昼夜优先读 duringPeriod，无日历章节回退本关黑暗规则/战役记录。',
}
