// Bind only public entities and server-issued moves. A visual target never invents an action.
export function choicePresentation(st) {
  const choice = st.pendingChoice
  if (!choice) return []
  const owner = st.investigators.find(inv => inv.seat === choice.seat)
  const defs = Object.values(st.cards || {})
  const byName = name => {
    const found = defs.filter(def => [def.name, def.nameZh, def.nameEn].includes(name))
    return found.length === 1 ? found[0] : null
  }
  return (st.legalMoves || []).filter(m => m.action === 'choose' && m.choiceId === choice.id).map(move => {
    const id = String(move.optionId)
    const option = choice.options?.find(o => String(o.id) === id)
    const item = { move, label: move.label || option?.label || id, key: null, cards: [], targetKey: option?.targetId ? `enemy:${option.targetId}` : null }
    if (['done', 'skip', 'confirm', 'keep', 'cancel'].includes(id)) return { ...item, control: true }
    if ((choice.kind === 'commit' && id === 'help') || (choice.kind === 'turnOrder' && option?.label === '开始行动')) return { ...item, control: true }
    if (['commit', 'mulligan', 'discard', 'discard-hand'].includes(choice.kind) || (choice.kind === 'reaction' && /^\d+$/.test(id))) {
      const code = owner?.hand?.[Number(id)]
      if (code) return { ...item, key: `hand:${owner.seat}:${id}`, code }
    }
    if (['turnOrder', 'investigator', 'prey', 'storyCard'].includes(choice.kind)) {
      const inv = st.investigators.find(inv => String(inv.seat) === id)
      if (inv) return { ...item, key: `investigator:${inv.seat}`, code: inv.code }
    }
    if (id === 'self' && owner) return { ...item, key: `investigator:${owner.seat}`, code: owner.code }
    if (choice.kind === 'scry' && id.startsWith('seat:')) {
      const inv = st.investigators.find(inv => String(inv.seat) === id.slice(5))
      if (inv) return { ...item, key: `investigator:${inv.seat}`, code: inv.code }
    }
    // Numeric search/scry answers are candidate indices, never hand indices.
    if (['search', 'upgradeCard', 'upgradeRemove', 'replacement', 'scry'].includes(choice.kind)) {
      const codes = option?.cardCodes || (option?.cardCode ? [option.cardCode] : st.cards?.[id] ? [id] : [])
      if (codes.length) return { ...item, cards: codes.map(code => ({ ...st.cards?.[code], code })) }
      const cards = item.label.split(' → ').map(byName)
      if (cards.every(Boolean)) return { ...item, cards }
    }
    const source = typeof choice.source === 'string' ? choice.source : choice.source?.id
    for (const inv of st.investigators) {
      for (const asset of [...(inv.assets || []), ...(inv.threat || [])]) {
        if (id === asset.id || (choice.kind === 'playerWindow' && id.startsWith(asset.id + ':')) ||
          (['reaction', 'boost'].includes(choice.kind) && source === asset.id)) {
          return { ...item, key: `asset:${asset.id}`, code: asset.code }
        }
      }
    }
    if (choice.kind === 'reaction' && id === 'trigger' && owner) return { ...item, key: `investigator:${owner.seat}`, code: owner.code }
    if (['target', 'attackOrder', 'spawn', 'hunter', 'move', 'location'].includes(choice.kind)) {
      const enemy = st.enemies?.find(e => e.id === id)
      if (enemy) return { ...item, key: `enemy:${id}`, code: enemy.originalCode || enemy.code }
      const location = st.locations?.find(l => l.id === id)
      if (location) return { ...item, key: `location:${id}`, code: location.originalCode || location.code }
    }
    return item
  })
}

export function entityMoves(st, key) {
  if (!key) return []
  if (st.pendingChoice) return choicePresentation(st).filter(item => item.key === key).map(item => item.move)
  const [kind, ...parts] = key.split(':'); const id = parts.join(':')
  const inv = st.investigators.find(inv => inv.seat === st.currentSeat)
  return (st.legalMoves || []).filter(move => {
    if (kind === 'hand') return move.action === 'play' && !move.fromDiscard && move.cardId === inv?.hand?.[Number(parts[1])] && String(inv?.seat) === parts[0]
    if (kind === 'asset') return move.assetId === id || move.threatId === id
    if (kind === 'enemy') return move.enemyId === id
    if (kind === 'location') return move.locationId === id || (inv?.location === id && ['investigate', 'breakDoor', 'parleyLita'].includes(move.action))
    if (kind === 'investigator') return String(inv?.seat) === id && move.action === 'freeAction'
    if (kind === 'discard') return move.action === 'play' && move.fromDiscard
    if (kind === 'act' || kind === 'agenda') return move.scriptCard === kind
    return false
  })
}

export function targetMoves(st, source, target) {
  const moves = entityMoves(st, source)
  if (st.pendingChoice) {
    const kind = st.pendingChoice.kind
    if (kind === 'prey' && source.startsWith('enemy:') && target.startsWith('investigator:')) {
      const enemy = st.enemies?.find(e => `enemy:${e.id}` === source)
      const cause = st.pendingChoice.source
      if (enemy && (cause?.id ? cause.id === enemy.id : cause?.code === enemy.code)) {
        return choicePresentation(st).filter(item => item.key === target).map(item => item.move)
      }
    }
    const abilityTargets = choicePresentation(st).filter(item => item.key === source && item.targetKey === target)
    if (abilityTargets.length) return abilityTargets.map(item => item.move)
    if (source.startsWith('hand:') && ((kind === 'commit' && target === 'zone:commit') ||
      (['discard', 'discard-hand', 'mulligan'].includes(kind) && target === 'zone:discard') ||
      (kind === 'reaction' && target === 'zone:play'))) return moves
    return []
  }
  const [type, ...parts] = target.split(':'); const id = parts.join(':')
  if (source.startsWith('enemy:')) {
    return target === 'zone:engage' || (type === 'investigator' && id === String(st.currentSeat)) ? moves.filter(m => m.action === 'engage') : []
  }
  if (source.startsWith('investigator:') && String(st.currentSeat) === source.slice(13)) {
    return (st.legalMoves || []).filter(m => type === 'enemy' ? m.action === 'fight' && m.enemyId === id : type === 'location' && m.action === 'move' && m.locationId === id)
  }
  if (type === 'slot') {
    return moves.filter(m => {
      const def = st.cards[m.cardId]; if (m.action !== 'play' || def?.type !== 'asset') return false
      const slots = (def.slots?.length ? def.slots : def.slot ? [def.slot] : []).map(s => String(s).toLowerCase().replace(/\s/g, '').replace('handx2', 'hand'))
      return slots.length ? slots.includes(id) : id === 'other'
    })
  }
  if (target === 'zone:play') return moves.filter(m => !m.targetId && !m.enemyId && !m.locationId)
  return moves.filter(m => m.targetId === id || m.enemyId === id || m.locationId === id)
}

export function handUnavailableReason(session, key, busy = false) {
  const st = session.state, [, seat, index] = (key || '').split(':')
  if (!key?.startsWith('hand:')) return ''
  if (st.status !== 'playing') return '本局已结束，仍可查看卡牌。'
  if (busy) return '正在结算，请稍候。'
  const decisionSeat = st.pendingChoice?.seat ?? st.currentSeat
  if (Number(seat) !== decisionSeat || session.players.find(p => p.seat === decisionSeat)?.role !== 'human') return '等待角色行动，仍可查看卡牌。'
  if (entityMoves(st, key).length) return ''
  if (st.pendingChoice) return '当前待决选择不接受这张牌。'
  const inv = st.investigators.find(inv => inv.seat === Number(seat))
  const def = st.cards?.[inv?.hand?.[Number(index)]]
  if (def?.type === 'skill') return '技能牌仅能在技能检定时投入。'
  return '当前没有可用行动，请检查卡牌费用、行动点与使用时机。'
}

let cleanupDrag = null
let cleanupPreview = null
export function cancelTableGesture() { cleanupDrag?.(); cleanupDrag = null; cleanupPreview?.(); cleanupPreview = null }

export function mountCardInteractions(root, session, { state, submit, select, inspect, selectedKey, showActions, feedback,
  canInteract = () => true, beginInteraction = () => () => {} }) {
  cancelTableGesture()
  const st = session.state
  const human = st.status === 'playing' && session.players.find(p => p.seat === (st.pendingChoice?.seat ?? st.currentSeat))?.role === 'human'
  const allowed = () => human && canInteract() && !state.busy && state.session?.sessionId === session.sessionId && state.session.state.revision === st.revision
  const entities = [...root.querySelectorAll('[data-interaction]')]
  const choices = choicePresentation(st)
  const selected = selectedKey()
  const commit = moves => { if (!allowed() || !moves.length) return; if (moves.length === 1) submit(moves[0], session); else showActions(moves) }
  const movesTo = (source, target) => {
    if (!allowed()) return []
    const filter = state.arkhamTargetAbility
    return targetMoves(st, source, target).filter(m => !filter || filter.sessionId !== session.sessionId || filter.revision !== st.revision ||
      (m.assetId === filter.assetId && m.abilityIndex === filter.abilityIndex && m.optionIndex === filter.optionIndex))
  }
  const movesOnto = (source, element) => {
    if (!element) return []
    const direct = movesTo(source, element.dataset.interaction)
    const slot = element.closest('.ah-equip-slot')
    return direct.length || !slot ? direct : movesTo(source, `slot:${slot.dataset.slot}`)
  }
  for (const el of entities) {
    const key = el.dataset.interaction
    const moves = entityMoves(st, key)
    if (key.startsWith('hand:')) {
      const available = allowed() && moves.length > 0
      el.classList.toggle('ah-card-unavailable', !available)
      el.dataset.cardAvailable = String(available)
      // Inspection remains available even when this card cannot be played.
      const reason = handUnavailableReason(session, key, state.busy)
      el.dataset.unavailableReason = reason
      if (reason) { el.title = reason + '\n\n' + el.title; el.setAttribute('aria-description', reason) }
    }
    if (allowed() && moves.length) el.classList.add(st.pendingChoice ? 'ah-direct-choice' : 'ah-card-ready')
    if (selected && movesOnto(selected, el).length) el.classList.add('ah-drop-valid')
    const bound = choices.find(item => item.key === key)
    if (bound && allowed()) { el.dataset.optionId = bound.move.optionId; el.classList.add('ah-choice-option-direct'); el.title = bound.label }
    if (!el.hasAttribute('tabindex')) el.tabIndex = 0
  }
  // Show candidates outside the player's board (e.g. another investigator's assets)
  // as face-up card offers. Never reconstruct private hands or deck order.
  for (const offer of root.querySelectorAll('[data-choice-offer]')) {
    if (offer.dataset.keepOffer !== 'true' && entities.some(el => el.dataset.interaction === offer.dataset.choiceOffer)) offer.hidden = true
  }
  let suppressClick = false
  const activate = event => {
    if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; return }
    if (event.target.closest('[data-map-info],[data-reaction-toggle]')) return
    const el = event.target.closest('[data-interaction]')
    if (!el || !root.contains(el)) return
    if (!allowed()) {
      // Viewing stays available while moves are locked (presentation, AI turn).
      if (el.dataset.inspectDefault === 'true') { event.preventDefault(); event.stopImmediatePropagation(); inspect(el.dataset.interaction) }
      return
    }
    const key = el.dataset.interaction
    const direct = st.pendingChoice ? entityMoves(st, key) : []
    const targeted = selected && selected !== key ? movesOnto(selected, el) : []
    if (direct.length || targeted.length) {
      event.preventDefault(); event.stopImmediatePropagation(); commit(direct.length ? direct : targeted)
    } else if (el.dataset.inspectDefault === 'true') {
      event.preventDefault(); event.stopImmediatePropagation(); inspect(key)
    } else if (['asset', 'enemy', 'location', 'investigator', 'discard', 'act', 'agenda'].some(type => key.startsWith(type + ':')) && entityMoves(st, key).length) {
      event.preventDefault(); event.stopImmediatePropagation(); select(key)
    }
  }
  root.addEventListener('click', activate, true)
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') cancelTableGesture()
    if (['Enter', ' '].includes(event.key) && event.target.matches('[data-interaction]')) activate(event)
  }, true)
  root.addEventListener('contextmenu', event => {
    const el = event.target.closest('[data-interaction]')
    if (el && ['hand:', 'asset:', 'enemy:', 'investigator:', 'location:'].some(prefix => el.dataset.interaction.startsWith(prefix))) {
      event.preventDefault(); inspect(el.dataset.interaction)
    }
  })
  let previewTimer, preview, positionPreview
  const hidePreview = () => { clearTimeout(previewTimer); window.removeEventListener('resize', positionPreview); preview?.remove(); preview = null }
  cleanupPreview = hidePreview
  const previewCard = event => {
    if (event.pointerType === 'touch' || cleanupDrag || root.inert || state.busy) return
    const el = event.target.closest('[data-card-code],.ah-enemy,.ah-script-card,.ah-reference-card')
    const art = el?.querySelector('.ah-table-art')
    if (!art || el.contains(event.relatedTarget)) return
    hidePreview()
    previewTimer = setTimeout(() => {
      if (!root.isConnected || cleanupDrag || root.inert || state.busy || !el.isConnected) return
      preview = document.createElement('div'); preview.className = 'ah-card-inspection'; preview.append(art.cloneNode(true))
      if (el.dataset.unavailableReason) {
        const reason = document.createElement('p'); reason.className = 'ah-card-inspection-reason'; reason.textContent = el.dataset.unavailableReason; preview.append(reason)
      }
      document.body.append(preview)
      const cardPreview = preview
      positionPreview = () => {
        if (preview !== cardPreview) return
        const img = cardPreview.querySelector('img:not([hidden])')
        const ratio = img?.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight
          : art.classList.contains('ah-table-art-landscape') ? 7 / 5 : 5 / 7
        const width = Math.min(ratio > 1 ? 440 : 260, innerWidth - 16, Math.max(1, innerHeight - 81) * ratio)
        cardPreview.style.width = width + 'px'; cardPreview.style.height = width / ratio + 'px'
        const box = el.getBoundingClientRect(), bounds = cardPreview.getBoundingClientRect()
        cardPreview.style.left = Math.max(8, Math.min(innerWidth - bounds.width - 8, box.x < innerWidth / 2 ? box.right + 12 : box.x - bounds.width - 12)) + 'px'
        cardPreview.style.top = Math.max(65, Math.min(innerHeight - bounds.height - 8, box.y - 100)) + 'px'
      }
      cardPreview.querySelectorAll('img').forEach(img => img.addEventListener('load', positionPreview))
      window.addEventListener('resize', positionPreview)
      positionPreview()
    }, 300)
  }
  root.addEventListener('pointerover', previewCard)
  root.addEventListener('pointerout', event => { if (!event.target.closest('[data-card-code],.ah-enemy,.ah-script-card,.ah-reference-card')?.contains(event.relatedTarget)) hidePreview() })
  root.addEventListener('focusin', previewCard); root.addEventListener('focusout', hidePreview)
  root.addEventListener('pointerdown', event => {
    if (event.target.closest('[data-reaction-toggle]')) return
    hidePreview()
    const sourceEl = event.target.closest('[data-interaction]')
    if (!sourceEl || !allowed() || event.button !== 0 || event.target.closest('.ah-map-node-handle')) return
    const source = sourceEl.dataset.interaction
    if (!['hand:', 'asset:', 'investigator:', 'discard:', 'enemy:'].some(prefix => source.startsWith(prefix))) return
    const preySource = st.pendingChoice?.kind === 'prey' && source.startsWith('enemy:') && entities.some(el => movesTo(source, el.dataset.interaction).length)
    if (!entityMoves(st, source).length && !source.startsWith('investigator:') && !preySource) return
    let releaseRender = null
    const x = event.clientX, y = event.clientY
    let dragging = false, ghost, arrow, line, targetEl, liftedArt, artNext, sourceVisibility
    const clear = () => {
      cleanupDrag = null
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', cancel)
      document.removeEventListener('keydown', escape); window.removeEventListener('blur', cancel)
      if(liftedArt) {
        sourceEl.insertBefore(liftedArt,artNext?.parentNode===sourceEl?artNext:null)
        sourceEl.style.visibility=sourceVisibility
        liftedArt=null
      }
      ghost?.remove(); arrow?.remove(); sourceEl.classList.remove('is-dragging')
      root.classList.remove('is-engaging')
      root.querySelectorAll('.ah-drop-valid,.ah-drop-invalid,.ah-drop-hover').forEach(el => el.classList.remove('ah-drop-valid','ah-drop-invalid','ah-drop-hover'))
      releaseRender?.(); releaseRender = null
    }
    const cancel = () => { if (dragging) suppressClick = true; clear() }
    const escape = e => { if (e.key === 'Escape') cancel() }
    const move = e => {
      if (e.pointerId !== event.pointerId) return
      if (!dragging && Math.hypot(e.clientX-x,e.clientY-y) < 8) return
      e.preventDefault()
      if (!dragging) {
        dragging = true; releaseRender = beginInteraction(); sourceEl.classList.add('is-dragging')
        if (source.startsWith('enemy:')) root.classList.add('is-engaging')
        ghost = document.createElement('div'); ghost.className = 'ah-drag-proxy ah-card-ghost'
        const art = sourceEl.querySelector('.ah-table-art')
        if(art && source.startsWith('hand:')) {
          liftedArt=art;artNext=art.nextSibling;sourceVisibility=sourceEl.style.visibility
          sourceEl.style.visibility='hidden';ghost.append(art)
        } else if (art) ghost.append(art.cloneNode(true)); else ghost.textContent = sourceEl.title
        document.body.append(ghost)
        arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); arrow.classList.add('ah-target-arrow')
        const defs = document.createElementNS(arrow.namespaceURI, 'defs')
        const marker = document.createElementNS(arrow.namespaceURI, 'marker'); marker.id = 'ah-target-tip'
        for (const [key,value] of Object.entries({ viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '4', markerHeight: '4', orient: 'auto' })) marker.setAttribute(key,value)
        const tip = document.createElementNS(arrow.namespaceURI, 'polygon'); tip.setAttribute('points','0,0 10,5 0,10'); tip.setAttribute('fill','#ffe5a0'); marker.append(tip); defs.append(marker)
        line = document.createElementNS(arrow.namespaceURI, 'path'); line.setAttribute('marker-end','url(#ah-target-tip)'); arrow.append(defs,line); document.body.append(arrow)
        for (const el of entities) if (el !== sourceEl) el.classList.add(movesOnto(source, el).length ? 'ah-drop-valid' : 'ah-drop-invalid')
      }
      ghost.style.left = e.clientX + 16 + 'px'; ghost.style.top = e.clientY - 60 + 'px'
      line.setAttribute('d', `M${x},${y} Q${x},${e.clientY} ${e.clientX},${e.clientY}`)
      targetEl?.classList.remove('ah-drop-hover')
      targetEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-interaction]')
      if (targetEl && movesOnto(source, targetEl).length) targetEl.classList.add('ah-drop-hover')
    }
    const up = e => {
      if (e.pointerId !== event.pointerId) return
      const target = document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-interaction]')
      // Empty space within a slot still accepts a card; its own equipped card can be a target too.
      const current = allowed()
      const moves = current ? movesOnto(source, target) : []
      if (!current && dragging) feedback('牌桌已更新，拖动已取消。')
      clear()
      if (!dragging) return
      suppressClick = true
      if (!current) return
      if (moves.length) commit(moves)
      else if (target && target !== sourceEl) feedback('此处不能使用这张牌，已放回原位。')
    }
    cleanupDrag = cancel
    document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel)
    document.addEventListener('keydown', escape); window.addEventListener('blur', cancel)
  })
}
