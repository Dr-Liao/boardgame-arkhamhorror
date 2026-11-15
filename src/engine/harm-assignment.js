import { registeredEntry } from './ability.js'

export function investigatorsWhoCanAbsorbHarm(state, location, original = null) {
  return state.investigators.filter(inv => inv !== original && !inv.defeated && !inv.resigned && inv.location === location
    && registeredEntry(inv.code)?.flags?.assignInvestigatorHarmAtLocation === true)
}

export function redirectAllyHarm(state, owner, asset, amount, kind, deps) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || !deps.cardDef(asset.code)?.traits?.some(trait => trait.toLowerCase() === 'ally')) return amount
  let remaining = amount
  for (const investigator of investigatorsWhoCanAbsorbHarm(state, owner.location)) {
    const room = (kind === 'damage' ? deps.maxHealth(investigator) : deps.maxSanity(investigator)) - (investigator[kind] || 0)
    const max = Math.min(room, remaining)
    if (max <= 0) continue
    const choice = deps.choose({ kind: 'effect', source: asset.id, seat: investigator.seat,
      prompt: '选择替该盟友承受的点数。', options: Array.from({ length: max + 1 }, (_, n) => ({ id: String(n), label: String(n) })) })
    const chosen = Number(choice)
    if (!Number.isSafeInteger(chosen) || chosen < 0 || chosen > max || String(chosen) !== choice) throw new RangeError('无效伤恐承接数量')
    if (chosen) deps.place(investigator, chosen, kind)
    remaining -= chosen
    if (!remaining) break
  }
  return remaining
}
