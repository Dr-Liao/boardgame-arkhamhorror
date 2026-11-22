import { registeredEntry } from './ability.js'
import { drawChaosToken, returnChaosToken } from './chaos-bag.js'
import { hasWindowListener } from './window-listeners.js'

export function canChangeChaosToken(state, seat, token) {
  return !state.investigators[seat]?.threat?.some(card =>
    registeredEntry(card.code)?.threatEffect?.prohibitedChaosTokenChanges?.includes(token))
}

export function createChaosReveal(state, events, { reactionWindow, requestChoice, tokenLabel = token => token }) {
  const open = (when, seat, data) => {
    const context = { when, seat, location: state.investigators[seat]?.location, ...data }
    if (hasWindowListener(state, when)) reactionWindow(state, when, context, events, { allowNested: true })
    return context
  }
  const changed = (token, change, tokenOwnerSeat, actorSeat = tokenOwnerSeat) =>
    open('chaosTokenChanged', actorSeat, { token, change, tokenOwnerSeat })

  function draw(context, count, given = []) {
    const plans = context.cancellationPlans || []
    const tokens = [...given]
    const total = Math.min(count + 2 * plans.length, state.chaosBag.length + given.length)
    while (tokens.length < total) tokens.push(drawChaosToken(state))
    const available = new Set(tokens.keys())
    for (const plan of plans) {
      const legal = [...available].filter(index => canChangeChaosToken(state, plan.seat, tokens[index]))
      const regular = legal.filter(index => tokens[index] !== 'autofail')
      const choices = legal.filter(index => tokens[index] === 'autofail').map(index => [index])
      for (let left = 0; left < regular.length; left++) {
        for (const right of regular.slice(left + 1)) choices.push([regular[left], right])
      }
      if (!choices.length) continue
      const options = choices.map(indexes => ({ id: 'cancel:' + indexes.join(','),
        label: '取消 ' + indexes.map(index => tokenLabel(tokens[index])).join('、') }))
      const answer = options.length === 1 ? options[0].id : requestChoice(state, {
        kind: 'token', source: plan.source, seat: plan.seat, prompt: '请选择要取消的混乱标记。', options,
      })
      for (const index of choices[options.findIndex(option => option.id === answer)] || []) {
        available.delete(index)
        returnChaosToken(state, tokens[index])
        changed(tokens[index], 'cancel', context.seat, plan.seat)
      }
    }
    return { revealed: [...available].map(index => tokens[index]),
      cancelled: tokens.filter((_, index) => !available.has(index)) }
  }
  return {
    before: (seat, count, source = null) => open('beforeChaosTokenReveal', seat, { count, source }),
    revealed: (seat, token) => open('chaosTokenPhysicallyRevealed', seat, { token }),
    changed,
    draw,
    keepOne: (seat, source, tokens) => {
      if (tokens.length < 2) return tokens
      const protectedTokens = tokens.flatMap((token, index) => canChangeChaosToken(state, seat, token) ? [] : [index])
      const keep = protectedTokens.length ? protectedTokens : [Number(requestChoice(state, {
        kind: 'token', source, seat, prompt: '选择要结算的混乱标记。',
        options: tokens.map((token, index) => ({ id: String(index), label: tokenLabel(token) })),
      }))]
      const retained = new Set(keep)
      for (const [index, token] of tokens.entries()) {
        if (retained.has(index)) continue
        returnChaosToken(state, token)
        changed(token, 'ignore', seat)
      }
      return tokens.filter((_, index) => retained.has(index))
    },
    resolveCardEffect: (seat, cardCode, resolve) => {
      const context = open('chaosRevealEffectWouldResolve', seat, { cardCode, additional: 0 })
      if (context.cancelled) return false
      for (let repeat = 0; repeat <= context.additional; repeat++) resolve()
      return true
    },
  }
}
