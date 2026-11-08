// 七循环《地球边缘》（Edge of the Earth）P4 引擎交互事务层。
//
// 定位：把 P1 目录里 5 个交互机制（interaction.frostReveal / partnerSetup / sealPlacement /
// tekeliShuffle / deckTopReveal）以及 P4 需要的 crossSeat / discipline / supply 变体，收敛成
// **规则侧选择事务**：候选只从权威状态枚举，选择统一走 `mechanic-choices.js#selectMechanic`
// 的 opaque `pick:N` / `confirm` / `cancel` 选项，写入统一走 P2 原语；本文件不复制任何状态、
// 不写卡号、不碰 UI。
//
// 事务契约（与 `resolution.js` 配合）：
//   · 所有有玩家决策的入口必须在规则事务内调用；`selectMechanic` 通过 `requestChoice` 暂停事务，
//     恢复时由 resolution 用同一 execute 重放，因此**任何写入都必须发生在最后一个选择之后**，
//     取消 / 空候选在写入前返回（不会产生半写状态）；
//   · 空强制候选集在进入 `requestChoice` 之前就返回 false/null，不产生 pending choice / 软锁；
//   · 伪造或过期 option id 由 `requestChoice` 的恢复凭据校验拒绝（见 resolution.js）；
//   · 隐私：本层不返回隐藏牌序；`tekeli.draw` 只有调用方显式传 deps.revealCode=true 才返回卡号；
//     选择标签不包含其他座位的手牌卡号（crossSeat 用 uiKey 定位，cardCode 仅在已揭示的选项上）；
//     deckTop 的卡号只存在于权威状态与本层内部读点，观察投影由 integration/mechanic-view.js 负责。
import { investigatorAt } from './mechanic-state.js'
import { selectMechanic } from './mechanic-choices.js'
import { addFrost, frostPoolRoom, payFrost } from './frost.js'
import { heldSeals, sealsOf, activateSeal, placeSeal, recoverSeal, unplaceSeal } from '../campaign/eote-seals.js'
import { cityscapes, keyOnLocation, moveKey, placeKey, swapKeys, takeKey } from './eote-city.js'
import { eoteScenarioState } from './eote-state.js'
import { tekeliDeckSize, tekeliDraw, tekeliReturn, tekeliShuffleIn } from './eote-tekeli.js'
import { deckTopCard, playDeckTop, revealDeckTop } from './eote-deck-top.js'
import { clearCrossSeatGrant, crossSeatData, grantCrossSeat } from './play-channels.js'
import { flipDiscipline, selectDisciplines } from './eote-disciplines.js'
import { assignSupply, carriedSupplies, droppedSupplies, dropSupplyAt, recoverSupply } from '../campaign/eote-supplies.js'

const TEKELI_RETURN_DESTINATIONS = Object.freeze(['bottom', 'deck', 'anyDeck', 'discard'])
const SEAL_LABEL = Object.freeze({ A: '封印 A', B: '封印 B', C: '封印 C', D: '封印 D', E: '封印 E' })
const isNonEmptyString = value => typeof value === 'string' && value.length > 0
const integer = (value, min, label, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(`${label} 必须是 ${min}–${max} 的整数`)
  return value
}
const assertSeat = (state, seat) => investigatorAt(state, seat)
const assertOptional = value => {
  if (typeof value !== 'boolean') throw new TypeError('optional 必须是布尔值')
  return value
}
const assertLocationId = value => {
  if (!isNonEmptyString(value)) throw new TypeError('地点 id 必须是非空字符串')
  return value
}
const locationLabel = (state, locationId) => {
  const location = (state.locations || []).find(item => String(item.id) === String(locationId))
  if (!location) return String(locationId)
  return location.revealed === false ? String(locationId) : location.name || String(locationId)
}
// 当前能力来源（卡/资产实体 id）。由 createEoteInteractions 的公开方法包装器临时设置，
// 让所有 selectMechanic 选择带上 `source`，浏览器端据此在取消/结算后把焦点还给来源实体
//（web/game-ui.js 的通用恢复逻辑读 `choice.source.id`）。没有来源时为 null，行为不变。
let pendingSource = null
const chooseOne = (state, seat, { operation, stage = 'items', prompt, candidates, optional = true, source = null }) => {
  if (!candidates.length) return null
  const chosen = selectMechanic(state, seat, { operation, stage, prompt, candidates, min: 1, max: 1, optional, source: source ?? pendingSource })
  return chosen?.[0] ?? null
}
const chooseMany = (state, seat, { operation, stage = 'items', prompt, candidates, min, max = min, optional = false, source = null }) => {
  if (candidates.length < min) return null
  return selectMechanic(state, seat, { operation, stage, prompt, candidates, min, max, optional, source: source ?? pendingSource })
}

/**
 * 创建 EotE 交互事务集合。`state` 是当前规则事务的 draft；`deps` 只放可注入的确定性依赖：
 *   · deps.shuffle(cards) —— 确定性洗牌回调（不提供时原语内部走 randomValue(state)）；
 *   · deps.revealCode —— tekeli.draw 是否把受信任卡号返回给调用方（默认 false，只返回布尔值）。
 */
export function createEoteInteractions (state, deps = {}) {
  // 与其它 ctx.api 域一致：创建阶段不做 eager 校验（P0 的 API 覆盖测试会用缺省/最小状态构造 api）；
  // 每个方法在执行时通过 assertSeat / 读取状态字段自行失败，非法 deps 也在使用时才发现。
  void state
  void deps

  // ── 寒霜标记：有限实物池的加入 / 支付（interaction.frostReveal 的引擎侧事务）──────────────
  const frost = {
    /** 加入寒霜：满池返回 false 且不写状态；没有选择，不需要事务。 */
    add (seat, count = 1) {
      assertSeat(state, seat)
      integer(count, 1, '寒霜数量', 10)
      if (frostPoolRoom(state) <= 0) return false
      return addFrost(state, count) > 0
    },
    /** 支付寒霜：优先支付已封印的实体，否则从袋内支付；多选 min=max=count。 */
    pay (seat, count = 1, { optional = false } = {}) {
      assertSeat(state, seat)
      integer(count, 1, '寒霜数量', 10)
      assertOptional(optional)
      const sealedFrosts = (state.chaos?.sealed || []).flatMap((item, index) => item.token === 'frost'
        ? [{ value: `sealed:${index}`, zone: 'sealed', index, label: `寒霜标记（封印 ${index + 1}）`, uiKey: `frost:sealed:${index}` }] : [])
      const bagFrosts = (state.chaosBag || []).flatMap((token, index) => token === 'frost'
        ? [{ value: `bag:${index}`, zone: 'bag', index, label: `寒霜标记（袋内 ${index + 1}）`, uiKey: `frost:bag:${index}` }] : [])
      // 先支付封印区里的实体（规则要求优先处理已封印标记），数量不足时才退回袋内。
      const candidates = sealedFrosts.length >= count ? sealedFrosts : bagFrosts
      if (candidates.length < count) return false
      const chosen = chooseMany(state, seat, {
        operation: 'eoteFrost', prompt: '选择要支付（移除）的寒霜标记', candidates, min: count, max: count, optional,
      })
      if (chosen == null) return false
      const selection = chosen.map(value => {
        const [zone, index] = String(value).split(':')
        return { zone, index: Number(index) }
      })
      return payFrost(state, count, { sealed: true, selection }) === count
    },
  }

  // ── 探险队伙伴：开局选派（interaction.partnerSetup；伙伴初始化由 P7 调用方写入战役状态）──
  const partners = {
    setup (seat, { roster, count = 1, optional = false } = {}) {
      assertSeat(state, seat)
      if (!Array.isArray(roster) || !roster.length) throw new TypeError('伙伴名册必须是非空数组')
      integer(count, 1, '伙伴数量', 10)
      assertOptional(optional)
      const seen = new Set()
      const candidates = roster.map((raw, index) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError(`伙伴名册第 ${index + 1} 项必须是对象`)
        if (!isNonEmptyString(raw.code)) throw new TypeError('伙伴卡号必须是非空字符串')
        if (seen.has(raw.code)) throw new TypeError(`伙伴名册卡号重复 ${raw.code}`)
        seen.add(raw.code)
        const label = isNonEmptyString(raw.label) ? raw.label : raw.code
        return { value: raw.code, label, uiKey: `partner:${raw.code}` }
      })
      const chosen = chooseMany(state, seat, {
        operation: 'eotePartner', prompt: '选择加入探险队的伙伴', candidates, min: count, max: count, optional,
      })
      return chosen == null ? null : [...chosen]
    },
  }

  // ── 封印：取回 / 激活 / 放置 / 取下（interaction.sealPlacement；状态在 campaign.eote.seals）──
  const sealCandidates = entries => entries.map(entry => ({
    value: entry.kind,
    label: SEAL_LABEL[entry.kind] || `封印 ${entry.kind}`,
    uiKey: `seal:${entry.kind}`,
  }))
  const chooseSeal = (seat, entries, { optional, stage = 'seals', prompt }) => chooseOne(state, seat, {
    operation: 'eoteSeal', stage, prompt, optional, candidates: sealCandidates(entries),
  })
  const choosePlacementLocation = (seat, { optional, prompt = '选择放置封印的地点' }) => {
    const locations = (state.locations || []).filter(location => location && isNonEmptyString(location.id))
    if (!locations.length) return null
    return chooseOne(state, seat, {
      operation: 'eoteSeal', stage: 'destination', prompt, optional,
      candidates: locations.map(location => ({ value: location.id, label: locationLabel(state, location.id), uiKey: `location:${location.id}` })),
    })
  }
  const seals = {
    place (seat, { locationId = null, optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (locationId != null) assertLocationId(locationId)
      const held = heldSeals(state, seat).filter(entry => entry.active)
      if (!held.length) return false
      const kind = chooseSeal(seat, held, { optional, prompt: '选择要放置的已激活封印' })
      if (kind == null) return false
      const target = locationId ?? choosePlacementLocation(seat, { optional })
      if (target == null) return false
      return placeSeal(state, kind, { seat, locationId: target })
    },
    recover (seat, { optional = true, locationId = null } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (locationId != null) assertLocationId(locationId)
      const dormant = sealsOf(state, entry => entry.locationId != null && entry.placedBySeat == null
        && (locationId == null || entry.locationId === locationId))
      if (!dormant.length) return false
      const kind = chooseSeal(seat, dormant, { optional, prompt: '选择要取回控制的休眠封印' })
      return kind == null ? false : recoverSeal(state, kind, { seat })
    },
    activate (seat, { optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      const dormant = heldSeals(state, seat).filter(entry => !entry.active)
      if (!dormant.length) return false
      const kind = chooseSeal(seat, dormant, { optional, prompt: '选择要激活的封印' })
      return kind == null ? false : activateSeal(state, kind)
    },
    assign (seat, { locationId = null, towerId = null, optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      const targetId = towerId ?? locationId
      if (targetId != null) assertLocationId(targetId)
      const held = heldSeals(state, seat).filter(entry => entry.active)
      if (!held.length) return false
      const kind = chooseSeal(seat, held, { optional, prompt: '选择要放置到高塔的封印' })
      if (kind == null) return false
      const target = targetId ?? choosePlacementLocation(seat, { optional, prompt: '选择封印放置的高塔/地点' })
      if (target == null) return false
      return placeSeal(state, kind, { seat, locationId: target })
    },
    unplace (seat, { optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      const placed = sealsOf(state, entry => entry.locationId != null && entry.placedBySeat === seat)
      if (!placed.length) return false
      const kind = chooseSeal(seat, placed, { optional, prompt: '选择要取下的封印' })
      return kind == null ? false : unplaceSeal(state, kind)
    },
  }

  // ── 城市钥匙：取得 / 放置 / 移动 / 交换（eote-city.js 的钥匙簿记）──────────────────────────
  const cityKeys = () => eoteScenarioState(state)?.city?.keys || null
  const cityReady = () => Boolean(eoteScenarioState(state)?.city?.cityscapes)
  const cityKeyCandidates = () => {
    const entries = cityscapes(state) || []
    return entries.map(entry => ({
      value: entry.locationId,
      label: locationLabel(state, entry.locationId),
      uiKey: `location:${entry.locationId}`,
    }))
  }
  const keyLocationOf = keyId => {
    const keys = cityKeys() || {}
    const found = Object.entries(keys).find(([, value]) => value === keyId)
    return found ? found[0] : null
  }
  const keys = {
    take (seat, { locationId = null, optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (!cityReady()) return false
      let candidates
      if (locationId != null) {
        assertLocationId(locationId)
        if (keyOnLocation(state, locationId) == null) return false
        candidates = [{ value: locationId, label: locationLabel(state, locationId), uiKey: `location:${locationId}` }]
      } else {
        candidates = cityKeyCandidates().filter(candidate => keyOnLocation(state, candidate.value) != null)
      }
      if (!candidates.length) return false
      const chosen = chooseOne(state, seat, { operation: 'eoteKey', stage: 'location', prompt: '选择取得钥匙的城市景观', candidates, optional })
      return chosen == null ? false : takeKey(state, chosen) != null
    },
    place (seat, { keyId = null, locationId = null, optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (!cityReady()) return false
      if (!isNonEmptyString(keyId)) throw new TypeError('放置钥匙需要 keyId')
      if (keyLocationOf(keyId)) return false
      const candidates = cityKeyCandidates().filter(candidate => keyOnLocation(state, candidate.value) == null)
      let target = locationId
      if (target != null) {
        assertLocationId(target)
        if (!candidates.some(candidate => candidate.value === target)) return false
      } else {
        if (!candidates.length) return false
        target = chooseOne(state, seat, { operation: 'eoteKey', stage: 'destination', prompt: '选择放置钥匙的城市景观', candidates, optional })
        if (target == null) return false
      }
      return placeKey(state, target, keyId) != null
    },
    move (seat, { keyId = null, locationId = null, optional = true } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (!cityReady()) return false
      if (!isNonEmptyString(keyId)) throw new TypeError('移动钥匙需要 keyId')
      const fromId = keyLocationOf(keyId)
      if (!fromId) return false
      let target = locationId
      if (target != null) {
        assertLocationId(target)
        if (target === fromId || keyOnLocation(state, target) != null) return false
      } else {
        const candidates = cityKeyCandidates().filter(candidate => candidate.value !== fromId && keyOnLocation(state, candidate.value) == null)
        if (!candidates.length) return false
        target = chooseOne(state, seat, { operation: 'eoteKey', stage: 'destination', prompt: '选择钥匙移动到的城市景观', candidates, optional })
        if (target == null) return false
      }
      return Boolean(moveKey(state, fromId, target))
    },
    swap (seat, { keyIdA = null, keyIdB = null } = {}) {
      assertSeat(state, seat)
      if (!cityReady()) return false
      if (!isNonEmptyString(keyIdA) || !isNonEmptyString(keyIdB) || keyIdA === keyIdB) throw new TypeError('交换钥匙需要两个不同的 keyId')
      const first = keyLocationOf(keyIdA)
      const second = keyLocationOf(keyIdB)
      if (!first || !second || first === second) return false
      return Boolean(swapKeys(state, first, second))
    },
  }

  // ── 忒咳哩-哩弱点牌库：不看内容洗入 / 受信任抽取 / 结算去向（interaction.tekeliShuffle）──
  const tekeli = {
    shuffle (seat, { count = 1, destination = undefined } = {}) {
      assertSeat(state, seat)
      integer(count, 1, '洗入张数', 99)
      if (tekeliDeckSize(state) < count) return false
      let target = destination
      if (target === null) {
        // 选择「结算去向」是 UI 的处置步骤；洗入本身不看内容，也不因去向改变牌序。
        target = chooseOne(state, seat, {
          operation: 'eoteTekeli', stage: 'destination', prompt: '选择忒咳哩-哩结算后的去向', optional: false,
          candidates: TEKELI_RETURN_DESTINATIONS.map(value => ({ value, label: value, uiKey: `tekeli:${value}` })),
        })
        if (target == null) return false
      } else if (target !== undefined && !TEKELI_RETURN_DESTINATIONS.includes(target)) {
        throw new TypeError(`未知的忒咳哩-哩结算去向 ${String(target)}`)
      }
      const shuffled = tekeliShuffleIn(state, seat, count, { shuffle: deps.shuffle })
      return shuffled !== false
    },
    /** 受信任抽取：默认只返回布尔值；deps.revealCode===true 才把卡号交给调用方。 */
    draw (seat) {
      assertSeat(state, seat)
      const drawn = tekeliDraw(state)
      if (!drawn) return false
      return deps.revealCode === true ? drawn : true
    },
    returnTo (seat, code, { destination = 'bottom', seat: targetSeat = null } = {}) {
      assertSeat(state, seat)
      if (!isNonEmptyString(code)) throw new TypeError('忒咳哩-哩 code 必须是非空字符串')
      if (!TEKELI_RETURN_DESTINATIONS.includes(destination)) throw new TypeError(`未知的忒咳哩-哩去向 ${destination}`)
      const finalSeat = destination === 'bottom' ? null : (targetSeat ?? seat)
      if (finalSeat != null) assertSeat(state, finalSeat)
      return tekeliReturn(state, code, { destination, seat: finalSeat, shuffle: deps.shuffle }) !== false
    },
  }

  // ── 牌库顶：常驻揭示 / 折扣打出（interaction.deckTopReveal / investigator.deckTop）────────
  const deckTop = {
    reveal (seat, { public: isPublic = false } = {}) {
      assertSeat(state, seat)
      if (typeof isPublic !== 'boolean') throw new TypeError('public 必须是布尔值')
      return Boolean(revealDeckTop(state, seat, { public: isPublic }))
    },
    play (seat, { discount = 0, cost = 0 } = {}) {
      assertSeat(state, seat)
      integer(discount, 0, '牌库顶折扣', 10)
      integer(cost, 0, '牌库顶费用', 99)
      return Boolean(playDeckTop(state, seat, { discount, cost }))
    },
    /** 牌库顶读数：只给本人/引擎的受信任读点，观察投影由 mechanic-view 负责。 */
    card (seat) {
      assertSeat(state, seat)
      return deckTopCard(state, seat)
    },
  }

  // ── 跨座位代打：登记 / 清除授权，枚举真实手牌（investigator.crossSeatPlay，08016）──────
  const crossSeat = {
    grant (seat, { fromSeat = null, codes = null, costSplit = null } = {}) {
      assertSeat(state, seat)
      if (fromSeat == null) throw new TypeError('跨座位代打需要来源座位')
      assertSeat(state, fromSeat)
      if (!Array.isArray(codes) || !codes.length) throw new TypeError('跨座位代打卡号列表必须是非空数组')
      if (codes.some(code => !isNonEmptyString(code))) throw new TypeError('跨座位代打卡号必须是非空字符串')
      if (new Set(codes).size !== codes.length) throw new TypeError('跨座位代打卡号不能重复')
      const hand = state.investigators[fromSeat].hand || []
      for (const code of codes) if (!hand.includes(code)) throw new TypeError(`来源座位手中没有卡牌 ${code}`)
      return grantCrossSeat(state, seat, { fromSeat, codes, ...(costSplit != null ? { costSplit } : {}) })
    },
    clear (seat) {
      assertSeat(state, seat)
      return clearCrossSeatGrant(state, seat)
    },
    choose (seat, { fromSeat = null } = {}) {
      assertSeat(state, seat)
      const grant = crossSeatData(state)?.grants?.[seat]
      if (!grant) return null
      if (fromSeat != null && fromSeat !== grant.fromSeat) throw new TypeError('来源座位与已登记授权不一致')
      const hand = state.investigators[grant.fromSeat].hand || []
      const candidates = []
      const seen = new Set()
      for (let index = 0; index < hand.length; index++) {
        const code = hand[index]
        if (!grant.codes.includes(code) || seen.has(code)) continue
        seen.add(code)
        // 只标出「队友手中有这件道具」；卡号通过 cardCode（已由能力揭示）提供，不进标签。
        candidates.push({ value: code, cardCode: code, label: '队友手中已揭示的道具', uiKey: `hand:${grant.fromSeat}:${index}` })
      }
      if (!candidates.length) return null
      const chosen = chooseOne(state, seat, { operation: 'eoteCrossSeat', stage: 'hand', prompt: '选择要代打的队友手牌', candidates, optional: true })
      return chosen == null ? null : { code: chosen, ownerSeat: grant.fromSeat, costSplit: grant.costSplit ?? null }
    },
  }

  // ── 演武：按经验选择（确定性 random）/ 翻面（investigator.discipline）────────────────────
  const discipline = {
    select (seat, { sets = null, count = 2, random = null } = {}) {
      assertSeat(state, seat)
      if (!Array.isArray(sets) || !sets.length) throw new TypeError('可选演武必须是非空数组')
      integer(count, 0, '演武选择数量', 10)
      if (typeof random !== 'function') throw new TypeError('演武选择需要注入确定性 random 函数')
      return selectDisciplines(state, { available: sets, count, random })
    },
    flip (seat, { code = null, to = null } = {}) {
      assertSeat(state, seat)
      if (!isNonEmptyString(code)) throw new TypeError('演武翻面需要卡号')
      if (to != null && !['unbroken', 'broken'].includes(to)) throw new TypeError('非法演武面')
      return flipDiscipline(state, code, { to })
    },
  }

  // ── 探险物资：交给队友 / 失败掉落 / 回收（campaign.supplies 的交互变体）────────────────────
  const supply = {
    assign (seat, { code = null, targetSeat = null, optional = false } = {}) {
      assertSeat(state, seat)
      assertOptional(optional)
      if (code != null && !isNonEmptyString(code)) throw new TypeError('物资卡号必须是非空字符串')
      const candidates = carriedSupplies(state, seat)
        .filter(item => code == null || item.code === code)
        .map(item => ({ value: item.code, label: item.label, uiKey: `supply:${item.code}` }))
      if (!candidates.length) return false
      const chosen = chooseOne(state, seat, { operation: 'eoteSupply', stage: 'items', prompt: '选择要交出的探险物资', candidates, optional })
      if (chosen == null) return false
      let recipient = targetSeat
      if (recipient == null) {
        const others = state.investigators.filter(inv => inv.seat !== seat && !inv.defeated && !inv.resigned)
        if (!others.length) return false
        recipient = chooseOne(state, seat, {
          operation: 'eoteSupply', stage: 'recipient', prompt: '选择物资的接收者', optional,
          candidates: others.map(inv => ({ value: inv.seat, label: inv.name || `调查员 ${inv.seat + 1}`, uiKey: `investigator:${inv.seat}` })),
        })
        if (recipient == null) return false
      } else {
        assertSeat(state, recipient)
      }
      return assignSupply(state, chosen, recipient)
    },
    drop (seat, { code = null, locationId = null, optional = true } = {}) {
      const inv = assertSeat(state, seat)
      assertOptional(optional)
      if (code != null && !isNonEmptyString(code)) throw new TypeError('物资卡号必须是非空字符串')
      const candidates = carriedSupplies(state, seat)
        .filter(item => code == null || item.code === code)
        .map(item => ({ value: item.code, label: item.label, uiKey: `supply:${item.code}` }))
      if (!candidates.length) return false
      const chosen = chooseOne(state, seat, { operation: 'eoteSupply', stage: 'items', prompt: '选择要掉落的探险物资', candidates, optional })
      if (chosen == null) return false
      const target = locationId ?? inv.location
      if (!isNonEmptyString(target)) return false
      return dropSupplyAt(state, chosen, target)
    },
    recover (seat, { code = null, optional = true } = {}) {
      const inv = assertSeat(state, seat)
      assertOptional(optional)
      if (code != null && !isNonEmptyString(code)) throw new TypeError('物资卡号必须是非空字符串')
      const candidates = droppedSupplies(state)
        .filter(item => item.locationId === inv.location && (code == null || item.code === code))
        .map(item => ({ value: item.code, label: item.label, uiKey: `supply:${item.code}` }))
      if (!candidates.length) return false
      const chosen = chooseOne(state, seat, { operation: 'eoteSupply', stage: 'items', prompt: '选择要回收的探险物资', candidates, optional })
      return chosen == null ? false : recoverSupply(state, chosen)
    },
  }

  // 公开方法统一包装：允许调用方在选项对象里传 `source`（来源实体 id），
  // 期间设置 pendingSource 供 chooseOne/chooseMany 写入待决选择的 source 元数据。
  const groups = { frost, partners, seals, keys, tekeli, deckTop, crossSeat, discipline, supply }
  const sourced = {}
  for (const [groupName, group] of Object.entries(groups)) {
    sourced[groupName] = {}
    for (const [method, fn] of Object.entries(group)) {
      sourced[groupName][method] = function (...args) {
        const options = args[1]
        const source = options && typeof options === 'object' && !Array.isArray(options) && typeof options.source === 'string'
          ? options.source : null
        const previous = pendingSource
        pendingSource = source
        try { return fn.apply(group, args) } finally { pendingSource = previous }
      }
    }
  }
  return sourced
}
