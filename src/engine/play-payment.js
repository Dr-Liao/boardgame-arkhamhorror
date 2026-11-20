import { registeredEntry } from './ability.js'
import { assetTextBlanked, assetTextBlankedExceptForced } from './card-text.js'
import { hasTrait } from './matcher.js'
import { availableResources } from './resource-bank.js'
import { afterUsesSpent } from './uses.js'

function playUseSources(state, inv, def) {
  if (!def || !inv || inv.location == null) return []
  const sources = state.investigators.flatMap(owner => {
    if (owner.defeated || owner.resigned || owner.location !== inv.location) return []
    return owner.assets.flatMap(asset => {
      const entry = registeredEntry(asset.code)
      const rule = entry?.assetRule?.playCostUses
      if (!rule || (rule.cardType && rule.cardType !== def.type)
        || (asset.usesType != null && asset.usesType !== entry.usesType)
        || (rule.scope === 'self' && owner !== inv) || (rule.trait && !hasTrait(def, rule.trait))
        || assetTextBlanked(asset, owner) || assetTextBlankedExceptForced(asset)) return []
      const candidates = rule.usesFrom === 'controlled'
        ? owner.assets.filter(candidate => (candidate.usesType ?? registeredEntry(candidate.code)?.usesType) === entry.usesType)
        : [asset]
      return candidates.filter(candidate => Number.isSafeInteger(candidate.uses) && candidate.uses > 0)
        .map(asset => ({ owner, asset }))
    })
  })
  return [...new Map(sources.map(source => [source.asset, source])).values()]
}

export function availablePlayResources(state, inv, def, otherPayer = null) {
  const pool = availableResources(inv) + (otherPayer ? availableResources(otherPayer) : 0)
  return pool + playUseSources(state, inv, def).reduce((sum, { asset }) => sum + asset.uses, 0)
}

export function choosePlayUses(state, inv, def, cost, { cardName, requestChoice }) {
  const payments = []
  let remaining = cost
  const sources = cost > 0 ? playUseSources(state, inv, def) : []
  for (const { owner, asset } of sources) {
    if (!remaining) break
    const max = Math.min(remaining, asset.uses)
    const label = cardName(asset.code)
    const token = asset.usesType === 'secrets' ? '秘密' : '标记'
    const picked = requestChoice(state, { kind: 'resource', source: asset.id, seat: owner.seat, canSkip: true,
      prompt: `是否用「${label}」上的${token}为 ${inv.name} 打出「${cardName(def.code)}」支付费用？还需 ${remaining} 资源。`,
      options: [{ id: 'skip', label: '不使用这张支援支付' }, ...Array.from({ length: max }, (_, index) => ({
        id: String(index + 1), label: `花费 ${index + 1} 个${token}，支付 ${index + 1} 资源`,
      }))],
    })
    if (picked === 'skip') continue
    const amount = Number(picked)
    payments.push({ owner, asset, amount })
    remaining -= amount
  }
  return { remaining, payments, offered: sources.length > 0 }
}

export function spendPlayUses(state, payments, events, deps) {
  for (const { asset, amount } of payments) asset.uses -= amount
  for (const { owner, asset, amount } of payments) {
    deps.info(state, events, `${owner.name} 用「${deps.cardName(asset.code)}」上的 ${amount} 个标记支付了 ${amount} 资源。`)
    afterUsesSpent(state, owner, asset, amount, events, deps)
  }
  if (payments.length) deps.abilityApi(state, events).resolveEmptyUses()
}
