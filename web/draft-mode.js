import { t } from './i18n.js'

export function renderDraftPane({ h, s, g, record, moves, action, art, inspectCard, selection, render }) {
  const draft = record?.draftMode
  const cards = new Map(Object.entries(s.state.cards || {}).filter(([, card]) => ['asset', 'event', 'skill'].includes(card.type) && !card.subtype && !card.signatureFor && !card.story))
  for (const card of g.clientData?.deckBuilder?.cardPool || []) cards.set(card.code, card)
  const card = code => ({ ...s.state.cards?.[code], ...cards.get(code) })
  const name = code => card(code).name || code
  const initial = draft?.phase === 'initial'
  const refill = draft?.phase === 'refill'
  const status = s.state.draftDeckStatus
  const deck = record?.deck || []
  const ordinary = deck.filter(code => cards.has(code))
  const size = ordinary.filter(code => !card(code).permanent && !card(code).ignoreDeckLimit).length
  const costs = new Map()
  for (const code of ordinary) {
    const cost = card(code).cost
    const bucket = typeof cost === 'number' ? cost >= 5 ? '5+' : String(cost) : 'X/—'
    costs.set(bucket, (costs.get(bucket) || 0) + 1)
  }
  const typeKeys = ['asset', 'event', 'skill', 'weakness', 'treachery', 'enemy', 'other']
  const typeOf = code => ['weakness', 'basicweakness'].includes(card(code).subtype) ? 'weakness'
    : typeKeys.includes(card(code).type) ? card(code).type : 'other'
  const typeLabel = type => t(['asset', 'weakness', 'other'].includes(type) ? `draft.type.${type}` : `hub.cardKind.${type}`)
  const groups = typeKeys.map(type => ({ type, codes: deck.filter(code => typeOf(code) === type) }))
  const button = move => action(s, move)
  return h('section', { className: 'ah-hub-pane ah-draft-pane', 'data-draft-phase': draft?.phase || 'unselected' },
    h('h2', {}, t('draft.title')),
    h('p', { role: 'status' }, !draft ? t('draft.chooseInvestigator') : initial
      ? t('draft.initialStatus', { count: size, free: draft.freeRerolls })
      : refill ? t('draft.refillStatus', { count: status?.count ?? size, size: status?.size ?? size, missing: status?.missing ?? 0 })
      : t('draft.upgradeStatus', { xp: record.xp })),
    status?.missing > 0 ? h('p', { className: 'ah-draft-notice', role: 'status' },
      t('draft.deckRequirement', { count: status.count, size: status.size, missing: status.missing })) : null,
    draft?.locked ? h('p', { className: 'ah-draft-notice', role: 'status' }, t('draft.locked')) : null,
    h('div', { className: 'ah-draft-options' }, (draft?.options || []).map((code, index) => {
      if (!code) return h('article', { className: 'ah-draft-option' }, h('h3', {}, t('draft.slot', { slot: index + 1 })), h('p', {}, t('draft.noCandidate')))
      const picks = moves.filter(move => move.action === 'hubDraftPick' && move.code === code)
      const buys = moves.filter(move => move.action === 'hubDraftBuy' && move.added === code)
      const selected = buys.find(move => (move.removed || '') === selection[code]) || buys[0]
      return h('article', { className: 'ah-draft-option', 'data-draft-code': code },
        h('h3', {}, name(code)),
        h('button', { type: 'button', className: 'ah-draft-art', onclick: () => inspectCard(code), 'aria-label': t('draft.inspect', { name: name(code) }) }, art(code, name(code))),
        h('p', {}, t('draft.cardCost', { xp: card(code).xp || 0, cost: card(code).cost ?? '—' })),
        picks.map(button),
        !initial && !refill ? h('div', { className: 'ah-draft-buy' },
          buys.length ? h('label', {}, t('draft.replace'),
            h('select', { 'aria-label': t('draft.replaceFor', { name: name(code) }), onchange: event => { selection[code] = event.target.value; render() } },
              buys.map(move => h('option', { value: move.removed || '', selected: move === selected },
                `${move.removed ? name(move.removed) : t('draft.noReplacement')} · ${move.cost} XP`)))) : null,
          selected ? button(selected) : h('p', { role: 'status' }, t('draft.unavailable'))) : null)
    })),
    draft && !draft.options.length ? h('p', {}, draft.phase === 'ready' ? t('draft.initialDone') : t('draft.consumed')) : null,
    h('div', { className: 'ah-hub-actions' }, moves.filter(move => ['hubDraftRefill', 'hubDraftRefresh', 'hubDraftLock', 'hubDoneSeat', 'hubResumeDraft'].includes(move.action)).map(button)),
    refill ? h('p', { className: 'ah-draft-note' }, t('draft.refillNote')) : null,
    draft?.phase === 'upgrade' ? h('p', { className: 'ah-draft-note' }, t('draft.upgradeNote')) : null,
    h('section', { className: 'ah-draft-summary' }, h('h3', {}, t('draft.deckTitle', { count: size })),
      h('div', { className: 'ah-draft-distributions' },
        h('section', { className: 'ah-draft-distribution' }, h('h4', {}, t('draft.costCurve')),
          h('div', { className: 'ah-draft-curve', 'aria-label': t('draft.costCurve') }, [...costs].sort(([a], [b]) => a.localeCompare(b)).map(([cost, count]) =>
            h('div', {}, h('span', {}, cost), h('meter', { min: 0, max: Math.max(1, size), value: count, 'aria-label': `${cost}: ${count}` }), h('b', {}, count))))),
        h('section', { className: 'ah-draft-distribution' }, h('h4', {}, t('draft.typeDistribution')),
          h('div', { className: 'ah-draft-types', 'aria-label': t('draft.typeDistribution') }, groups.filter(group => group.codes.length || ['asset', 'event', 'skill', 'weakness'].includes(group.type)).map(group =>
            h('div', { className: 'ah-draft-type', 'data-card-type': group.type, 'data-type-count': String(group.codes.length) },
              h('span', {}, typeLabel(group.type)), h('b', {}, group.codes.length),
              h('meter', { min: 0, max: Math.max(1, deck.length), value: group.codes.length, 'aria-label': `${typeLabel(group.type)}: ${group.codes.length}` })))),
          h('small', {}, t('draft.typeScope')))),
      h('section', { className: 'ah-draft-deck', 'aria-label': t('draft.fullDeck'), 'data-deck-count': String(deck.length) },
        h('h3', {}, t('draft.fullDeckTitle', { count: deck.length })),
        groups.filter(group => group.codes.length).map(group => h('section', { className: 'ah-draft-deck-group', 'data-deck-type': group.type },
          h('h4', {}, `${typeLabel(group.type)} · ${group.codes.length}`),
          h('div', { className: 'ah-draft-deck-gallery' }, [...new Set(group.codes)].map(code => h('button', {
            type: 'button', className: 'ah-draft-deck-card', 'data-deck-code': code,
            'data-zoom-code': code, 'data-zoom-name': name(code),
            onclick: () => inspectCard(code), 'aria-label': t('draft.inspect', { name: `${name(code)} ×${group.codes.filter(item => item === code).length}` }),
          }, art(code, name(code)),
          h('span', { className: 'ah-draft-copy-count' }, `×${group.codes.filter(item => item === code).length}`),
          h('strong', {}, name(code))))))))))
}
