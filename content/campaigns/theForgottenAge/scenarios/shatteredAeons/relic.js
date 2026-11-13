// 「古代遗物」的版本判定与幕 3a/4a 行动可用性。
//
// 四张印刷版本同名（Relic of Ages），按战役推进顺序换版：
//   04061 某种装置（《埃兹特里的覆灭》找回）→ 04191 阻断未来（《界限彼端》换版）
//   → 04303 重拾往昔（幕间五「终末黎明」）→ 04343 时光涌流（本关放在一边，
//   只在遗物已丢失时由幕 2 背面附属到时间之窗）。
//
// 从 behavior.js 拆出的原因：Phase 3 的 behavior.js 行数预算只减不增
// （同类先例：《界限彼端》relic-swap.js、《天机之城》body-swap.js）。
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { CARRIED_RELIC_VARIANTS, RELIC_AGES_UNLEASH, RELIC_VARIANTS } from './definition.js'

const original = card => card?.originalCode || card?.code
const byId = (state, id) => state.locations.find(location => location.id === id)
const flagsFor = state => (state.scenarioFlags ||= {})

// 场上实例的版本优先：它在幕 3a 被控制后决定幕 4 背面进入结局 1 还是结局 5。
export function relicVersion(state) {
  return state.relicOfAges?.code || flagsFor(state).relicCode || '04061'
}

export function relicControlledBy(state) {
  const relic = state.relicOfAges
  if (!relic || relic.seat == null) return null
  const inv = state.investigators[relic.seat]
  if (!inv || inv.defeated || inv.resigned) return null
  return inv
}

// 兜底：relicOfAges.seat 可能还没写上（例如把 04343/04061 当资产打出），
// 这时以「哪位调查员场上有遗物资产」作为控制者（P2：04320 的卡面条件）。
export function relicHolderFromAssets(state) {
  for (const inv of state.investigators) {
    if (!inv || inv.defeated || inv.resigned) continue
    if ((inv.assets || []).some(asset => RELIC_VARIANTS.includes(original(asset)))) return inv
  }
  return null
}

// 卡面「控制古代遗物」：遗物在场上且被一位在场调查员控制。
export function relicInPlay(state) {
  const relic = state.relicOfAges
  if (relic?.seat != null && relicControlledBy(state)) return true
  if (relic && relic.seat == null && relic.location && byId(state, relic.location)) return true
  return !!relicHolderFromAssets(state)
}

// 幕 3a 的 [action] 只查「你自己的」牌库与弃牌堆（卡面原文：your deck and discard pile）。
function relicInOwnPiles(inv) {
  return [...(inv?.deck || []), ...(inv?.discard || [])].some(code => RELIC_VARIANTS.includes(code))
}

function relicInOwnZones(inv, zone) {
  if (zone === 'hand') return (inv?.hand || []).some(code => RELIC_VARIANTS.includes(code))
  if (zone === 'play') return (inv?.assets || []).some(asset => RELIC_VARIANTS.includes(original(asset)))
  return false
}

// 调查员实际携带的「古代遗物」版本。幕间五之后牌组里应该只有一份；
// 旧存档/旧版本可能同时留下两个版本，按推进顺序取最新的那一个。
function carriedRelicCode(state) {
  for (let index = CARRIED_RELIC_VARIANTS.length - 1; index >= 0; index--) {
    const code = CARRIED_RELIC_VARIANTS[index]
    const held = state.investigators.some(inv =>
      [...(inv?.hand || []), ...(inv?.deck || []), ...(inv?.discard || [])].includes(code)
      || (inv?.assets || []).some(asset => original(asset) === code))
    if (held) return code
  }
  return null
}

function relicAttachedToSocket(state) {
  const relic = state.relicOfAges
  if (!relic || relic.seat != null || !relic.location) return null
  const location = byId(state, relic.location)
  if (!location) return null
  return (location.clues || 0) === 0 ? location : null
}

// 遗物附属在哪个地点（不要求该地点已经没有线索）。用于给「控制古代遗物」行动
// 生成可读的不可用原因——玩家需要知道该去哪里、还差几个线索。
function relicSocketLocation(state) {
  const relic = state.relicOfAges
  if (!relic || relic.seat != null || !relic.location) return null
  return byId(state, relic.location)
}

// 幕 3a「查找你的牌库和弃牌堆」不可用时的原因；可用时返回 null。
export function relicSearchUnavailableReason(state, inv) {
  if (relicInOwnPiles(inv)) return null
  if (relicInOwnZones(inv, 'hand')) return '古代遗物已在你的手牌中'
  if (relicInOwnZones(inv, 'play')) return '古代遗物已在你的场上'
  const holder = relicControlledBy(state) || relicHolderFromAssets(state)
  if (holder) return `古代遗物由 ${holder.name} 控制`
  const socket = relicSocketLocation(state)
  if (socket) return `古代遗物附属在「${socket.name}」`
  const elsewhere = state.investigators.some(other => other !== inv
    && [...(other?.hand || []), ...(other?.deck || []), ...(other?.discard || [])]
      .some(code => RELIC_VARIANTS.includes(code)))
  return elsewhere ? '古代遗物在其他调查员手中' : '古代遗物不在你的牌库或弃牌堆'
}

// 幕 3a「控制附属在你所在地点的古代遗物」不可用时的原因；可用时返回 null。
export function relicTakeUnavailableReason(state, inv) {
  const holder = relicControlledBy(state) || relicHolderFromAssets(state)
  if (holder) return `古代遗物已由 ${holder.name} 控制`
  const socket = relicSocketLocation(state)
  if (!socket) return '古代遗物没有附属在任何地点'
  if (socket.id !== inv.location) return `古代遗物附属在「${socket.name}」`
  const clues = socket.clues || 0
  return clues > 0 ? `需要先取走此地点上的线索（还有 ${clues} 个）` : null
}

export function takeControlOfRelic(state, inv, api) {
  const location = relicAttachedToSocket(state)
  if (!location) return null
  const code = state.relicOfAges?.code || relicVersion(state)
  if (api.moveRelicOfAges) api.moveRelicOfAges({ code, seat: inv.seat })
  else state.relicOfAges = { code, location: inv.location, seat: inv.seat }
  if (!(inv.assets || []).some(asset => original(asset) === code)) api.giveAsset?.(inv.seat, code)
  flagsFor(state).relicWasControlled = true
  api.info?.(`🏺 ${inv.name} 控制了「古代遗物」（${ALL_CARDS[code]?.subnameZh || code}）。`)
  return code
}

// 布置期把调查员区域里的「古代遗物」收敛成一份，并记录本关使用哪个印刷版本。
//   · 遗物已丢失 → 玩家区域里不该有遗物，场上那份由幕 2 背面从放在一边的「时光涌流」取出；
//   · 否则以实际携带的版本为准（幕间五「终末黎明」→ 04303；未走该路线则保留界限彼端
//     换成的 04191，或更早的 04061），其余版本是旧存档残留，必须清掉。
// 旧实现按「找回遗失的遗物」硬编码保留 04061，会把 04191/04303 一起删掉，
// 幕 3a 于是既搜不到也控制不了遗物（玩家报告：场景主动没有交互入口、卡关）。
export function prepareRelicForScenario(state, say) {
  const records = (state.campaign.records ||= {})
  const flags = flagsFor(state)
  const carried = records.theRelicIsMissing ? null : carriedRelicCode(state)
  const keepRelic = records.theRelicIsMissing ? null : carried
  const purged = []
  for (const inv of state.investigators || []) {
    for (const pile of ['hand', 'deck', 'discard']) {
      inv[pile] = (inv[pile] || []).filter(code => {
        const drop = RELIC_VARIANTS.includes(code) && code !== keepRelic
        if (drop) purged.push(code)
        return !drop
      })
    }
    inv.assets = (inv.assets || []).filter(asset => {
      const code = asset?.originalCode || asset?.code
      const drop = RELIC_VARIANTS.includes(code) && code !== keepRelic
      if (drop) purged.push(code)
      return !drop
    })
  }
  if (records.theRelicIsMissing) flags.relicCode = RELIC_AGES_UNLEASH
  else if (carried) flags.relicCode = carried
  else flags.relicCode ||= '04061'
  if (purged.length) {
    const kept = keepRelic
      ? `只保留你们携带的「古代遗物」（${ALL_CARDS[keepRelic]?.nameZh || keepRelic}）`
      : '清掉调查员区域里残留的「古代遗物」'
    say?.(`🏺 ${kept}。`)
  }
  return { carried: keepRelic, purged }
}

// 破碎永世 4a：附属到「古代遗物」的地点，在桌上就是压在遗物卡下面的正面朝下地点卡。
// 观察投影（presentation-state.publicAttachments）与演出快照用这个钩子把附属挂回遗物支援
// 实例：牌桌卡角标与卡牌详情因此能显示「附属 N 张」和清单。规则判定仍以
// flags.relicUnderneath 为准，投影只给桌面公开的卡号/卡名。
// 注意只读：视图生成/演出快照期间不能调用 flagsFor()（它会创建 scenarioFlags）。
export function relicPublicAttachments(state) {
  const underneath = state.scenarioFlags?.relicUnderneath || []
  const empty = { act: [], agenda: [], locations: {}, assets: {} }
  if (!underneath.length) return empty
  const host = [...(state.investigators || []).flatMap(inv => inv.assets || []),
    ...(state.storyAssets || [])].find(card => card?.id != null && RELIC_VARIANTS.includes(original(card)))
  if (!host) return empty
  return {
    ...empty,
    assets: {
      [host.id]: underneath.map(entry => ({
        code: entry.code, originalCode: entry.code, name: entry.name,
        victory: Number(entry.victory) || 0, facedown: true,
      })),
    },
  }
}
