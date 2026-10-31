// Bind only public entities and server-issued moves. A visual target never invents an action.
// 玩家可见提示走 web/i18n.js 的 t()；匹配用的协议值保持原样。
import { t } from './i18n.js'

// 回合顺序选择的「开始行动」是引擎下发的中文选项 label（协议值，不是界面文案，也不随界面语言变化）。
// 用 Unicode 转义保存同一个字符串，避免词典完整性测试把它误判成残留中文；比较行为不变。
const TURN_ORDER_START_LABEL = '\u5f00\u59cb\u884c\u52a8'

// 2026-10-31 通用兜底：选项没有 `cardCode` 时，用「完整卡名唯一精确匹配」从展示表挂回卡面。
// 这是给旧内容/只下发卡名的选项的兼容路径：实机「迷失时空」地点候选由内容层直接下发 cardCode，
// 而观察投影的 view.cards 不含 encounterDiscard 里的地点卡，所以名称兜底对那一类选项无效。
// 界面显示整张卡、点详情看卡牌，但**不设 key**：不把选项挂成牌桌实体，提交动作也不变。
// 只在精确同名且唯一时挂卡；重名（重印/异画）或 label 不是卡名时不猜。不做卡牌类型过滤：
// 跨类型同名会因「不唯一」自动跳过，但唯一同名却是别的类型的极端内容仍可能显示成卡面（展示层，低风险）。
function exactCardNames(st) {
  let index = null
  return label => {
    const name = typeof label === 'string' ? label.trim() : ''
    if (!name) return null
    if (!index) {
      index = new Map()
      for (const def of Object.values(st.cards || {})) {
        if (!def || typeof def !== 'object' || typeof def.code !== 'string') continue
        for (const value of new Set([def.name, def.nameZh, def.nameEn])) {
          const key = typeof value === 'string' ? value.trim() : ''
          if (!key) continue
          const codes = index.get(key)
          if (codes) { if (!codes.includes(def.code)) codes.push(def.code) }
          else index.set(key, [def.code])
        }
      }
    }
    const codes = index.get(name)
    return codes && codes.length === 1 ? codes[0] : null
  }
}

export function choicePresentation(st) {
  const choice = st.pendingChoice
  if (!choice) return []
  const owner = st.investigators.find(inv => inv.seat === choice.seat)
  const defs = Object.values(st.cards || {})
  const byName = name => {
    const found = defs.filter(def => [def.name, def.nameZh, def.nameEn].includes(name))
    return found.length === 1 ? found[0] : null
  }
  const cardByLabel = exactCardNames(st)
  return (st.legalMoves || []).filter(m => m.action === 'choose' && m.choiceId === choice.id).map(move => {
    const id = String(move.optionId)
    const option = choice.options?.find(o => String(o.id) === id)
    const item = { move, label: move.label || option?.label || id, key: null, cards: [], targetKey: option?.targetId ? `enemy:${option.targetId}` : null }
    if (['done', 'skip', 'confirm', 'keep', 'cancel'].includes(id)) return { ...item, control: true }
    if ((choice.kind === 'commit' && id === 'help') || (choice.kind === 'turnOrder' && option?.label === TURN_ORDER_START_LABEL)) return { ...item, control: true }
    if (['commit', 'mulligan', 'discard', 'discard-hand'].includes(choice.kind) || (choice.kind === 'reaction' && /^\d+$/.test(id))) {
      const code = owner?.hand?.[Number(id)]
      if (code) return { ...item, key: `hand:${owner.seat}:${id}`, code }
    }
    // 2026-10-27「如同手牌」通道统一原语：服务端在选项上下发 uiKey（hunch:<卡号> / beneath:<卡号> /
    // asset:<宿主 id>），这里直接挂回牌桌实体（直觉区那张、下方那张、宿主支援），与 legalMoves 的
    // move.uiKey 同一协议；点牌即回答当前窗口。旧 id 推导作为兼容回退保留在下面。
    if (option?.uiKey && option.cardCode) {
      return { ...item, key: option.uiKey, code: option.cardCode,
        cards: [{ ...(st.cards?.[option.cardCode] || {}), code: option.cardCode }] }
    }
    // 2026-10-27 修复 05013：银暮匕首「如同其在你的手牌中」——反应窗口（快速事件）、能力窗口
    // （fromHand 反应）与技能检定投入里的 beneath 候选用「beneath:<卡号>」或「…:beneath:<序号>」
    // 作 id，并带 cardCode。这里把它们挂回牌桌「下方」的牌：点下方的牌与点手牌同义，
    // 直接回答当前窗口，而不是像修复前那样只能从底部选项面板里找。
    if (option?.cardCode && (choice.kind === 'commit' ? id.startsWith('beneath:') : id.includes('beneath:'))
      && (owner?.beneath || []).includes(option.cardCode)) {
      return { ...item, key: `beneath:${option.cardCode}`, code: option.cardCode,
        cards: [{ ...(st.cards?.[option.cardCode] || {}), code: option.cardCode }] }
    }
    // 2026-10-27 修复 05002：乔·戴蒙德的直觉牌库揭示牌「如同你的手牌」——快速事件在反应窗口里
    // option id 固定为 'hunch'，在收尾玩家窗口里是 'fast-card:hunch:<卡号>'。挂回牌桌直觉区的
    // 那张牌：点它等于点手牌，直接回答当前窗口（牌桌上没有实体时仍可点底部选项按钮）。
    if (id === 'hunch' && option?.cardCode) {
      const hunch = (st.hunch || []).find(entry => entry.seat === choice.seat)
      if (hunch?.revealed === option.cardCode) {
        return { ...item, key: `hunch:${option.cardCode}`, code: option.cardCode,
          cards: [{ ...(st.cards?.[option.cardCode] || {}), code: option.cardCode }] }
      }
    }
    if (choice.kind === 'playerWindow' && id.startsWith('fast-card:hunch:')) {
      const code = id.slice('fast-card:hunch:'.length)
      const hunch = (st.hunch || []).find(entry => entry.seat === choice.seat)
      if (hunch?.revealed === code) {
        return { ...item, key: `hunch:${code}`, code,
          cards: [{ ...(st.cards?.[code] || {}), code }] }
      }
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
    // 通用「选一张牌」选项：候选卡面由服务端随选项下发 cardCode，
    // 数字下标只属于结算数组，不能当作手牌或场上实体。
    if (choice.kind === 'card') {
      const code = option?.cardCode || (st.cards?.[id] ? id : null)
      if (code) return { ...item, code, cards: [{ ...(st.cards?.[code] || { name: item.label }), code }] }
    }
    // 其余带 cardCode 的选择同样画卡面：`beneath`（黛安娜旧印／赛菲娜下方）、
    // `openingHand`（赛菲娜开局压牌）、`hunchDeck`（乔·戴蒙德的直觉牌库）此前只有一行卡名。
    if (option?.cardCode) {
      const code = option.cardCode
      return { ...item, code, cards: [{ ...(st.cards?.[code] || { name: item.label }), code }] }
    }
    // 通用兜底（放在所有既有绑定之后）：选项 label 就是某张卡的卡名时显示整张卡面。
    // 只影响展示，不改变 key / 提交动作；重名或找不到卡时不猜。
    const linkedCode = cardByLabel(item.label)
    if (linkedCode) {
      return { ...item, code: linkedCode, cards: [{ ...(st.cards?.[linkedCode] || { name: item.label }), code: linkedCode }] }
    }
    return item
  })
}

// 2026-10-28：卡面「快速反应开关」（闪电图标）的准入判定——这张卡是否在玩家可操作的范围里。
// 手牌 / 场上支援 / 威胁区之外，「如同手牌」通道里的卡（直觉区揭示那张、下方、背包/原定计划
// 附属、宿主附属）也要能开/关快速反应；否则反应窗口里只能「本窗口全部关闭」，无法按卡记忆偏好。
// 数据形状与引擎通道一致：`view.hunch[]`（直觉区已揭示）、`inv.beneath`、`asset.attachedCards` /
// `asset.attached` / `asset.attachments`。快速事件本身只有开/关两档（见 card-defs.js 的
// hasAutoReactionFor：auto 会替玩家从手牌打出并付费，所以快速事件不提供自动档）。
export function investigatorHoldsCard(inv, st, code) {
  if (!inv || !code) return false
  if (inv.code === code || (inv.hand || []).includes(code)) return true
  if ([...(inv.assets || []), ...(inv.threat || [])].some(card => card?.code === code)) return true
  const hunch = (st?.hunch || []).find(entry => entry.seat === inv.seat)
  if (hunch?.revealed === code) return true
  if ((inv.beneath || []).includes(code)) return true
  return (inv.assets || []).some(asset =>
    (asset.attachedCards || []).includes(code)
    || (asset.attached || []).includes(code)
    || (asset.attachments || []).some(item => (item?.code ?? item) === code))
}

export function entityMoves(st, key) {
  if (!key) return []
  if (st.pendingChoice) return choicePresentation(st).filter(item => item.key === key).map(item => item.move)
  const [kind, ...parts] = key.split(':'); const id = parts.join(':')
  const inv = st.investigators.find(inv => inv.seat === st.currentSeat)
  return (st.legalMoves || []).filter(move => {
    // 2026-10-27「如同手牌」通道统一原语：legalMoves 带上 move.uiKey（hunch:<卡号> / beneath:<卡号> /
    // asset:<宿主 id>），直接按挂载键挂回牌桌实体；下面各通道字段的分支保留为兼容回退。
    if (move.uiKey && move.uiKey === key) return true
    if (kind === 'hand') return move.action === 'play' && !move.fromDiscard && move.cardId === inv?.hand?.[Number(parts[1])] && String(inv?.seat) === parts[0]
    // 支援身上的能力/威胁，以及「这张支援是打出的载体」的通道：
    // 原定计划 fromPlanAssetId、背包 fromBackpackId、宿主附属 fromAttachedEventOf、
    // 银暮匕首的 beneath 通道 channelAssetId。缺了后半段，附属在卡下面的牌在牌桌上无处可点。
    if (kind === 'asset') return move.assetId === id || move.threatId === id
      || move.fromPlanAssetId === id || move.fromBackpackId === id
      || move.fromAttachedEventOf === id || move.channelAssetId === id
    // 压在调查员底下的牌（戴安娜/赛菲娜/画中世界）：id 是卡号。
    if (kind === 'beneath') return move.fromBeneath === true && move.cardId === id
    // 直觉牌库本阶段揭示的那张（乔·戴蒙德）：id 是卡号。
    if (kind === 'hunch') return move.fromHunch === true && move.cardId === id
    if (kind === 'enemy') return move.enemyId === id
    // 地点附属（卡尔克萨尖柱等）：键是 attachment:<地点 id>:<附属下标>，只挂这条附属自己的行动。
    if (kind === 'attachment') {
      const index = Number(parts.at(-1))
      const locationId = parts.slice(0, -1).join(':')
      return move.locationId === locationId && Number(move.attachmentIndex) === index
    }
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
    const restrictedAlly = id === 'allyRestricted'
    const wanted = restrictedAlly ? 'ally' : id
    return moves.filter(m => {
      const def = st.cards[m.cardId]; if (m.action !== 'play' || def?.type !== 'asset') return false
      // 米奇·布朗的额外盟友槽只接受非独特盟友。
      if (restrictedAlly && def.unique) return false
      const slots = (def.slots?.length ? def.slots : def.slot ? [def.slot] : []).map(s => String(s).toLowerCase().replace(/\s/g, '').replace('handx2', 'hand'))
      return slots.length ? slots.includes(wanted) : wanted === 'other'
    })
  }
  if (target === 'zone:play') return moves.filter(m => !m.targetId && !m.enemyId && !m.locationId)
  return moves.filter(m => m.targetId === id || m.enemyId === id || m.locationId === id)
}

export function handUnavailableReason(session, key, busy = false) {
  const st = session.state, [, seat, index] = (key || '').split(':')
  if (!key?.startsWith('hand:')) return ''
  if (st.status !== 'playing') return t('interaction.hand.ended')
  if (busy) return t('interaction.hand.busy')
  const acting = session.actingSeats ?? [st.pendingChoice?.seat ?? st.currentSeat]
  if (!acting.includes(Number(seat)) || session.players.find(p => p.seat === Number(seat))?.role !== 'human') return t('interaction.hand.waiting')
  if (entityMoves(st, key).length) return ''
  if (st.pendingChoice) return t('interaction.hand.notAccepted')
  const inv = st.investigators.find(inv => inv.seat === Number(seat))
  const def = st.cards?.[inv?.hand?.[Number(index)]]
  if (def?.type === 'skill') return t('interaction.hand.skillOnly')
  return t('interaction.hand.noAction')
}

let cleanupDrag = null
let cleanupPreview = null
export function cancelTableGesture() { cleanupDrag?.(); cleanupDrag = null; cleanupPreview?.(); cleanupPreview = null }

export function mountCardInteractions(root, session, { state, submit, select, inspect, selectedKey, showActions, feedback,
  canInteract = () => true, beginInteraction = () => () => {} }) {
  cancelTableGesture()
  const st = session.state
  const acting = session.actingSeats ?? [st.pendingChoice?.seat ?? st.currentSeat]
  const human = st.status === 'playing' && acting.some(seat => session.players.find(p => p.seat === seat)?.role === 'human')
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
    if (offer.dataset.keepOffer === 'true') continue
    if (!entities.some(el => el.dataset.interaction === offer.dataset.choiceOffer)) continue
    // 链接实体已经在牌桌上：整个选项卡片一起藏（按钮 + 卡面 + 兄弟「详情」按钮）。
    // 只藏按钮会在 .ah-visual-cell 里留一格空位和一颗可点的详情胶囊。
    offer.hidden = true
    const cell = offer.closest('.ah-visual-cell')
    if (cell) cell.hidden = true
  }
  let suppressClick = false
  const selectWithActions = key => {
    select(key)
    // The table re-renders on selection, and a map enemy sits inside a keydown
    // fence. Put focus on the popped action bar so Escape (handled by the
    // table) cancels it and screen readers announce the available actions.
    queueMicrotask(() => {
      if (!root.isConnected) return
      root.querySelector('.ah-card-action-popover .ah-action')?.focus({ preventScroll: true })
    })
  }
  const activate = event => {
    if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; return }
    if (event.target.closest('[data-reaction-mode]')) return
    // 线索/毁灭徽记和剧情标记有自己的点击；带行动的地点附属（卡尔克萨尖柱）要留下来，才能弹出放大镜。
    const marker = event.target.closest('[data-map-info]')
    if (marker && !(marker.dataset.mapInfo === 'attachment' && marker.dataset.interaction)) return
    const el = event.target.closest('[data-interaction]')
    if (!el || !root.contains(el)) return
    if (!allowed()) {
      // Viewing stays available while moves are locked (presentation, AI turn).
      if (el.dataset.inspectDefault === 'true') { event.preventDefault(); event.stopImmediatePropagation(); inspect(el.dataset.interaction) }
      return
    }
    const key = el.dataset.interaction
    const moves = entityMoves(st, key)
    const direct = st.pendingChoice ? moves : []
    const targeted = selected && selected !== key ? movesOnto(selected, el) : []
    // A co-located enemy that can be engaged answers a left click with its
    // action buttons (交战/攻击/躲避) instead of the card dossier. Dragging it
    // to the investigator or the engagement zone keeps working as before.
    const engageable = key.startsWith('enemy:') && moves.some(move => move.action === 'engage')
    if (direct.length || targeted.length) {
      event.preventDefault(); event.stopImmediatePropagation(); commit(direct.length ? direct : targeted)
    } else if (engageable) {
      event.preventDefault(); event.stopImmediatePropagation(); selectWithActions(key)
    } else if (el.dataset.inspectDefault === 'true') {
      event.preventDefault(); event.stopImmediatePropagation(); inspect(key)
    } else if (['asset', 'enemy', 'location', 'attachment', 'investigator', 'discard', 'act', 'agenda', 'beneath', 'hunch'].some(type => key.startsWith(type + ':')) && moves.length) {
      event.preventDefault(); event.stopImmediatePropagation(); selectWithActions(key)
    }
  }
  root.addEventListener('click', activate, true)
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') cancelTableGesture()
    if (['Enter', ' '].includes(event.key) && event.target.matches('[data-interaction]')) activate(event)
  }, true)
  root.addEventListener('contextmenu', event => {
    const el = event.target.closest('[data-interaction]')
    if (el && ['hand:', 'asset:', 'enemy:', 'investigator:', 'location:', 'beneath:', 'hunch:'].some(prefix => el.dataset.interaction.startsWith(prefix))) {
      event.preventDefault(); inspect(el.dataset.interaction)
    }
  })
  let previewTimer, preview, positionPreview
  const hidePreview = () => { clearTimeout(previewTimer); window.removeEventListener('resize', positionPreview); preview?.remove(); preview = null }
  cleanupPreview = hidePreview
  const previewCard = event => {
    if (event.pointerType === 'touch' || event.altKey || cleanupDrag || root.inert || state.busy) return
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
    if (event.target.closest('[data-reaction-mode]')) return
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
      if (!current && dragging) feedback(t('interaction.drag.cancelled'))
      clear()
      if (!dragging) return
      suppressClick = true
      if (!current) return
      if (moves.length) commit(moves)
      else if (target && target !== sourceEl) feedback(t('interaction.drag.invalid'))
    }
    cleanupDrag = cancel
    document.addEventListener('pointermove', move, { passive: false }); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', cancel)
    document.addEventListener('keydown', escape); window.addEventListener('blur', cancel)
  })
}
