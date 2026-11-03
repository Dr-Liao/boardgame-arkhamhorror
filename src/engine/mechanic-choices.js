// Rule-side choices. Opaque option ids, exact legal candidates, no browser rule duplication.
import { requestChoice } from './resolution.js'
import { investigatorAt, mechanicState } from './mechanic-state.js'
import { sealPoolTokens, releasePoolTokens } from './chaos-token-pool.js'
import { KEY_COLORS, canClaimKey, claimKey, giveKeys, spendKey } from './scenario-keys.js'
import { vehicleAccessError, enterVehicle, leaveVehicle, moveVehicle, vehicleName } from './vehicles.js'
import { beneathCards, commitFromOrigin, withdrawCommitment } from './commit-origins.js'
import { cardDef } from './card-lookup.js'

export const MECHANIC_OPERATIONS = Object.freeze(['seal', 'release', 'claimKey', 'giveKeys', 'spendKey', 'enterVehicle', 'leaveVehicle', 'driveVehicle', 'commitOrigin', 'returnCommitment'])
export function selectMechanic(state, seat, { operation, prompt, candidates, min = 1, max = 1, optional = true, source = null, stage = 'items' }) {
  investigatorAt(state, seat)
  if (!MECHANIC_OPERATIONS.includes(operation) || !Array.isArray(candidates)
      || !Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min < 1 || max < min || max > 10) throw new TypeError('无效机制选择')
  if (candidates.length < min) return null // Never create an empty mandatory choice/soft lock.
  const selected = new Set(), limit = Math.min(max, candidates.length)
  for (;;) {
    const options = candidates.flatMap((candidate, index) => selected.has(index) || selected.size < limit ? [{
      id: `pick:${index}`, label: candidate.label,
      ...(candidate.token != null ? { token: candidate.token } : {}),
      ...(candidate.keyColor != null ? { keyColor: candidate.keyColor } : {}),
      ...(candidate.cardCode ? { cardCode: candidate.cardCode } : {}),
      ...(candidate.uiKey ? { uiKey: candidate.uiKey } : {}), selected: selected.has(index),
    }] : [])
    if (selected.size >= min) options.push({ id: 'confirm', label: '确认选择' })
    if (optional) options.push({ id: 'cancel', label: '取消，保留原状态' })
    const id = requestChoice(state, { kind: 'mechanic', seat, canSkip: optional,
      source: { type: 'mechanic', operation, stage, min, max: limit, selectedCount: selected.size, ...(source ? { id: source } : {}) },
      prompt: `${prompt}（已选 ${selected.size}，需要 ${min === limit ? min : `${min}–${limit}`}）`, options })
    if (id === 'cancel') return null
    if (id === 'confirm') return [...selected].map(index => candidates[index].value)
    const index = Number(id.slice(5))
    if (selected.has(index)) selected.delete(index)
    else selected.add(index)
  }
}

export function createMechanicChoices(state, deps = {}) {
  const select = (seat, spec) => selectMechanic(state, seat, spec)
  const one = (seat, spec) => select(seat, spec)?.[0] ?? null
  return {
    seal(seat, source, { tokens = null, count = 1, optional = true } = {}) {
      const candidates = (state.chaosBag || []).flatMap((token, index) => !tokens || tokens.includes(token)
        ? [{ value: token, token, label: `${token} · 袋内 ${index + 1}` }] : [])
      const chosen = select(seat, { operation: 'seal', source, prompt: '选择要封印的实体混乱标记', candidates, min: count, max: count, optional })
      if (!chosen) return false
      for (const token of chosen) if (sealPoolTokens(state, source, token, 1) !== 1) throw new Error('封印选择已失效')
      return true
    },
    release(seat, source, { count = 1, optional = true } = {}) {
      const candidates = (state.chaos?.sealed || []).filter(item => item.source === source)
        .map((item, index) => ({ value: item.token, token: item.token, label: `${item.token} · 封印 ${index + 1}` }))
      const chosen = select(seat, { operation: 'release', source, prompt: '选择要释放回袋的封印标记', candidates, min: count, max: count, optional })
      if (!chosen) return false
      for (const token of chosen) if (releasePoolTokens(state, source, token, 1) !== 1) throw new Error('释放选择已失效')
      return true
    },
    chooseKey(seat, colors, { optional = true, source = null } = {}) {
      if (!Array.isArray(colors) || new Set(colors).size !== colors.length || colors.some(color => !KEY_COLORS.includes(color))) throw new TypeError('Invalid key alternatives')
      return one(seat, { operation: 'claimKey', optional, source, prompt: '选择一把钥匙',
        candidates: colors.filter(color => mechanicState(state)?.keys?.[color]?.revealed).map(color => ({ value: color, keyColor: color, label: color })) })
    },
    keys(seat, operation, { optional = true, max = 1, destination = 'reference' } = {}) {
      if (!['claimKey', 'giveKeys', 'spendKey'].includes(operation)) throw new TypeError('无效钥匙操作')
      const inv = investigatorAt(state, seat), data = mechanicState(state)?.keys || {}
      const holder = operation === 'claimKey' ? `location:${inv.location}` : `investigator:${seat}`
      const location = state.locations.find(item => item.id === inv.location)
      if (inv.defeated || inv.resigned || (operation === 'claimKey' && !canClaimKey(state, seat))) return false
      const recipients = state.investigators.filter(other => other.seat !== seat && !other.defeated && !other.resigned && other.location === inv.location)
      if (operation === 'giveKeys' && !recipients.length) return false
      const candidates = Object.entries(data).filter(([, item]) => item.holder === holder).map(([color, item], index) => ({
        value: color, keyColor: item.revealed ? color : 'unrevealed',
        label: item.revealed ? `${color} 钥匙` : `未揭示钥匙 ${index + 1}`,
      }))
      const chosen = select(seat, { operation, prompt: '选择钥匙', candidates, min: 1, max: operation === 'claimKey' ? 1 : max, optional })
      if (!chosen) return false
      if (operation === 'claimKey') return claimKey(state, seat, chosen[0])
      if (operation === 'spendKey') {
        for (const color of chosen) if (!spendKey(state, seat, color, destination)) throw new Error('钥匙支付选择已失效')
        return true
      }
      const recipient = one(seat, { operation, stage: 'recipient', prompt: '选择同地点的接收者', candidates: recipients.map(other => ({ value: other.seat, label: other.name || `调查员 ${other.seat + 1}`, uiKey: `investigator:${other.seat}` })), optional })
      return recipient == null ? false : giveKeys(state, seat, recipient, chosen)
    },
    vehicle(seat, operation, { optional = true, id = null } = {}) {
      if (!['enterVehicle', 'leaveVehicle', 'driveVehicle'].includes(operation)) throw new TypeError('无效载具操作')
      const data = mechanicState(state)?.vehicles || {}
      const vehicles = Object.entries(data).filter(([key, vehicle]) => (!id || key === id) && (operation === 'driveVehicle'
        ? vehicle.driver === seat && vehicle.running && vehicle.passengers.includes(seat)
        : !vehicleAccessError(state, seat, key, operation === 'enterVehicle')))
      const chosen = one(seat, { operation, prompt: '选择载具', optional,
        candidates: vehicles.map(([key]) => ({ value: key, label: vehicleName(state, key), uiKey: `asset:${key}` })) })
      if (chosen == null) return false
      if (operation === 'enterVehicle') return enterVehicle(state, seat, chosen)
      const vehicle = data[chosen]
      if (operation === 'leaveVehicle') {
        const remaining = vehicle.passengers.filter(value => value !== seat && !state.investigators[value].defeated && !state.investigators[value].resigned)
        let nextDriver = null
        if (vehicle.driver === seat && remaining.length > 1) {
          nextDriver = one(seat, { operation, stage: 'driver', prompt: '选择接任驾驶者', optional,
            candidates: remaining.map(value => ({ value, label: state.investigators[value].name, uiKey: `investigator:${value}` })) })
          if (nextDriver == null) return false
        }
        return leaveVehicle(state, seat, chosen, { nextDriver })
      }
      const from = state.locations.find(loc => loc.id === vehicle.location)
      const destinations = state.locations.filter(loc => from?.connections?.includes(loc.id)
        && !vehicle.passengers.some(passenger => deps.entryError?.(passenger, loc.id)))
      const destination = one(seat, { operation, stage: 'destination', prompt: '选择载具前往的相邻地点', optional,
        candidates: destinations.map(loc => ({ value: loc.id, label: loc.name || loc.id, uiKey: `location:${loc.id}` })) })
      return destination == null ? false : moveVehicle(state, chosen, destination, deps)
    },
    commit(seat, { host, from = 'beneath', retain = true, optional = true, cardType = null } = {}) {
      if (!state.skillTest) return false
      if (typeof deps.commit !== 'function' || typeof deps.canCommitOrigin !== 'function') throw new TypeError('特殊投入交互需要权威投入及资格检查入口')
      const inv = investigatorAt(state, seat)
      const codes = from === 'beneath' ? beneathCards(state, seat, host) : from === 'discard' ? inv.discard : []
      const candidates = codes.flatMap(code => {
        if (cardType && cardDef(code)?.type !== cardType) return []
        // Validate on an isolated copy through the same authoritative commit callback.
        return !deps.canCommitOrigin || deps.canCommitOrigin(seat, code, from, host)
          ? [{ value: code, cardCode: code, label: code, uiKey: `origin:${seat}:${host || from}:${code}` }] : []
      })
      const code = one(seat, { operation: 'commitOrigin', source: host, prompt: '选择从原区投入的卡牌', candidates, optional })
      return code == null ? false : !!commitFromOrigin(state, seat, { host, from, code, retain }, deps.commit)
    },
    returnCommitment(seat, { optional = true, cardType = null } = {}) {
      const candidates = (state.skillTest?.committed || []).flatMap((item, index) => item.seat === seat && (!cardType || cardDef(item.code)?.type === cardType)
        ? [{ value: index, cardCode: item.code, label: item.code }] : [])
      const index = one(seat, { operation: 'returnCommitment', prompt: '选择收回手牌的已投入卡牌', candidates, optional })
      return index == null ? false : withdrawCommitment(state, seat, index)
    },
  }
}
