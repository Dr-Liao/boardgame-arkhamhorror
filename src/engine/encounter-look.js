import { registeredEntry } from './ability.js'
import { beneathCards, pullBeneath, stashBeneath } from './commit-origins.js'

function cardChoice(deps, state, seat, source, prompt, codes) {
  const selected = deps.requestChoice(state, {
    kind: 'card', source, seat, prompt,
    options: codes.map((code, index) => ({ id: String(index), cardCode: code, label: deps.cardName(code) })),
  })
  return Number(selected)
}

export function offerEncounterLook(state, seat, cards, events, deps) {
  const inv = state.investigators[seat]
  if (!cards.length || !registeredEntry(inv?.code)?.investigator?.encounterLook) return { cards }
  const context = { when: 'encounterCardsLookedAt', seat, location: inv.location, cards, extraLookUsed: false }
  deps.reactionWindow(state, context.when, context, events, { allowNested: true })
  return { cards, putOnTop: context.putOnTop }
}

export function sortEncounterLook(state, seat, context, events, deps) {
  if (context?.seat !== seat || context.when !== 'encounterCardsLookedAt' || context.extraLookUsed) return false
  const inv = state.investigators[seat]
  context.extraLookUsed = true
  const extra = state.encounterDeck.pop()
  if (extra) context.cards.push(extra)
  const cap = 3
  const source = inv.code
  const forcedCards = context.cards.filter(code => registeredEntry(code)?.encounterLookRule?.forceBeneath)
  if (forcedCards.length) {
    for (const code of forcedCards) {
      const rule = registeredEntry(code).encounterLookRule
      const piles = beneathCards(state, seat, source)
      if (piles.length >= cap) {
        const eligible = piles.filter(item => !deps.isWeaknessCode(item))
        if (!eligible.length) continue
        const removed = eligible[cardChoice(deps, state, seat, source, '选择一张非弱点暗置牌弃掉。', eligible)]
        if (!discardStashedEncounter(state, seat, removed)) continue
      }
      if (!stashBeneath(state, seat, source, code, cap)) continue
      context.cards.splice(context.cards.indexOf(code), 1)
      if (!inv.defeated && beneathCards(state, seat, source).filter(item => item === code).length >= rule.defeatCount) {
        deps.defeatInvestigatorWithTrauma(state, inv, rule.mentalTrauma, events)
      }
    }
    return true
  }
  const eligible = context.cards.filter(code => {
    const def = deps.cardDef(code)
    return !def?.elite && !def?.traits?.some(trait => trait.toLowerCase() === 'elite')
  })
  if (!eligible.length) return true
  const code = eligible[cardChoice(deps, state, seat, source, '选择一张查看过的非精英遭遇牌。', eligible)]
  if (!code) return true
  const options = [{ id: 'top', label: '放回遭遇牌库顶' }, { id: 'discard', label: '弃掉' }]
  if (beneathCards(state, seat, source).length < cap) options.push({ id: 'beneath', label: '暗置在调查员下方' })
  const answer = deps.requestChoice(state, { kind: 'card', source, seat, prompt: '如何处理所选遭遇牌？', options })
  context.cards.splice(context.cards.indexOf(code), 1)
  if (answer === 'discard') state.encounterDiscard.push(code)
  else if (answer === 'beneath' && stashBeneath(state, seat, source, code, cap)) return true
  else context.putOnTop = code
  return true
}

export function discardStashedEncounter(state, seat, code) {
  const inv = state.investigators[seat]
  const taken = inv && pullBeneath(state, seat, inv.code, code)
  if (!taken) return false
  state.encounterDiscard.push(taken)
  return true
}

export function drawStashedEncounter(state, seat, options, events, deps) {
  const inv = state.investigators[seat]
  const eligible = beneathCards(state, seat, inv.code).filter(code => !deps.isWeaknessCode(code))
  if (!eligible.length) return false
  const code = eligible[Math.floor(deps.randomValue(state) * eligible.length)]
  if (!pullBeneath(state, seat, inv.code, code)) return false
  deps.drawEncounter(state, inv, events, { ...options, code })
  return true
}
