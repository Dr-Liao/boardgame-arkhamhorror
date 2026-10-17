// Presentation consumes public state only. Never sends moves or changes rules.
import { preloadChaosTokens, showChaosToken } from './chaos-token.js'
import { createCombatSound } from './combat-sound.js'
import { setRulesText } from './card-text.js'
const ROOT = '/mods/arkhamhorror/'
const SOUNDS = { select: 'click_003', draw: 'card-slide', encounter: 'encounter-reveal', play: 'drop_003', move: 'drop_001',
  clue: 'glass_001', damage: 'error_003', reveal: 'pluck_001', success: 'confirmation_002',
  failure: 'back_002', agenda: 'bong_001' }
const SKILLS = { intellect: '智识', willpower: '意志', combat: '战斗', agility: '敏捷' }
const PHASES = { enemy: ['敌军阶段', '⚔', '猎手逼近，威胁降临'], upkeep: ['整备阶段', '◇', '重整装备，补充物资'], mythos: ['神话阶段', '◉', '黑暗蔓延，遭遇未知'], investigation: ['调查阶段', '⌕', '新的调查即将开始'] }

export function publicSequence(events) {
  const cues = []
  for (const event of events) {
    const cue = event.type === 'presentation' ? event : event.presentation
    if (!cue || !['test', 'chaos', 'play', 'attack', 'phase', 'automatic', 'story', 'location', 'checkpoint'].includes(cue.kind)) continue
    const presented = event.seq == null ? cue : { ...cue, eventSeq: event.seq }
    if (cue.kind === 'automatic') {
      let group = cues.at(-1)
      if (group?.kind !== 'phase' || group.phase !== cue.phase) {
        group = { kind: 'phase', phase: cue.phase, round: cue.round, steps: [] }; cues.push(group)
      }
      group.steps.push({ ...presented, text: cue.text || event.text })
    } else cues.push({ ...presented, ...(cue.kind === 'phase' ? { steps: [{ ...presented }] } : {}) })
  }
  // Scenario setup may reveal its starting location before emitting its opening
  // cards. Keep rule events untouched, but present intro → agenda → location.
  const locationIndex = cues.findIndex(cue => cue.kind === 'location')
  const introIndex = cues.findIndex(cue => cue.kind === 'story' && cue.intro)
  const agendaIndex = cues.findIndex(cue => cue.kind === 'story' && cue.initialAgenda)
  const openingIndexes = [introIndex, agendaIndex].filter(index => index >= 0)
  if (locationIndex >= 0 && openingIndexes.length) {
    const anchor = Math.min(locationIndex, ...openingIndexes)
    const opening = [introIndex, agendaIndex].filter(index => index >= 0).map(index => cues[index])
    for (const index of [...openingIndexes].sort((a, b) => b - a)) cues.splice(index, 1)
    const insertAt = anchor - openingIndexes.filter(index => index < anchor).length
    cues.splice(insertAt, 0, ...opening)
  }
  return cues
}

export function presentationChanges(before, after, events = []) {
  if (!before) return []
  const changes = publicSequence(events)
  if (changes.some(c => c.kind === 'checkpoint')) return changes
  const engagements = new Map()
  for(const inv of after.investigators || []) {
    const old=before.investigators?.find(i=>i.seat===inv.seat)
    if(!old || inv.defeated || inv.resigned)continue
    const engaged=(state,who)=>(state.enemies || []).filter(e=>e.engagedSeat===who.seat || (e.massive && e.location===who.location))
    const enemies=engaged(after,inv)
    if(enemies.length && !engaged(before,old).length)engagements.set(inv.seat,{kind:'engagement',seat:inv.seat,name:inv.name,enemies:enemies.map(e=>e.name).join('、')})
  }
  // Automatic transactions already describe their intermediate changes in
  // order, including effects that cancel out in the final state.
  if (changes.some(c => c.kind === 'phase' || c.kind === 'story')) {
    changes.push(...engagements.values())
    return changes
  }
  for (const inv of after.investigators || []) {
    const old = before.investigators?.find(i => i.seat === inv.seat)
    if (!old) continue
    if (old.location !== inv.location) changes.push({ kind: 'move', seat: inv.seat, from: old.location, to: inv.location, name: inv.name })
    if (engagements.has(inv.seat)) changes.push(engagements.get(inv.seat))
    const remaining = [...(old.hand || [])]
    for (const [handIndex, code] of (inv.hand || []).entries()) {
      const index = remaining.indexOf(code)
      if (index >= 0) remaining.splice(index, 1)
      else changes.push({ kind: 'draw', seat: inv.seat, code, handIndex })
    }
    for (const asset of inv.assets || []) if (!(old.assets || []).some(a => a.id === asset.id) && !changes.some(c => c.kind === 'play' && c.seat === inv.seat && c.code === asset.code)) changes.push({ kind: 'play', seat: inv.seat, code: asset.code })
    const committed = (after.skillTest?.committed || []).filter(c => c.seat === inv.seat).length - (before.skillTest?.committed || []).filter(c => c.seat === inv.seat).length
    if (committed > 0) changes.push({ kind: 'commit', seat: inv.seat, code: remaining[0] })
    for (const [field, kind] of [['clues', 'clue'], ['damage', 'damage'], ['horror', 'damage'], ['resources', 'resource']]) {
      const delta = (inv[field] || 0) - (old[field] || 0)
      if (delta && (field === 'resources' || delta > 0)) changes.push({ kind, field, delta, seat: inv.seat, location: inv.location })
    }
  }
  for (const loc of after.locations || []) if (loc.revealed && before.locations?.some(old => old.id === loc.id && !old.revealed) && !changes.some(c => c.kind === 'location' && c.location === loc.id)) changes.push({ kind: 'location', location: loc.id, name: loc.name, code: loc.originalCode || loc.code, title: '地点揭示', flip: true, shroud: loc.shroud, clues: loc.clues, onEnter: loc.onEnter, text: loc.text || '查看已揭示地点与进入效果。' })
  if (before.agendaIndex !== after.agendaIndex) changes.push({ kind: 'agenda', title: '密谋推进', name: after.agendas?.[after.agendaIndex]?.name || '新的威胁正在逼近' })
  if (before.actIndex !== after.actIndex) changes.push({ kind: 'agenda', title: '调查推进', name: after.acts?.[after.actIndex]?.name || '新的线索浮出水面' })
  return changes
}

export function createTablePresentation({ art, onChange = () => {} } = {}) {
  preloadChaosTokens()
  let prefs = { sound: true, fast: false }
  try { prefs = { ...prefs, ...JSON.parse(localStorage.getItem('arkham-presentation') || '{}') } } catch { /* optional storage */ }
  let last = null, sessionId = null, lastSeq = -1, frame = 0, epoch = 0, layer = null, running = false
  let anchors = new Map(), queue = [], unlocked = false
  let presentedPlays = []
  let blocking = false, cancelScene = null
  let latest = null, displayed = null
  let cardTransits = [], maskedCards = new Set()
  const interaction = key => [...document.querySelectorAll('.ah-table [data-interaction]')].find(el => el.dataset.interaction === key)
  const maskArrivals = changes => {
    for (const c of changes.filter(c=>c.kind==='draw')) {
      const key=`hand:${c.seat}:${c.handIndex}`
      if (interaction(key)) maskedCards.add(key)
    }
    for (const key of maskedCards) { const el=interaction(key); if(el) el.style.visibility='hidden' }
  }
  const transitTarget = transit => {
    const inv=displayed?.state.investigators.find(inv=>inv.seat===transit.seat)
    const asset=inv?.assets?.find(a=>a.code===transit.code && !transit.oldAssets.includes(a.id))
    return asset && interaction('asset:'+asset.id)
  }
  const applyStep = change => {
    if (!displayed || !latest) return
    if (change.tableState) displayed = { ...displayed, state: { ...displayed.state, ...change.tableState,
      revision: latest.state.revision, pendingChoice: null, skillTest: null, legalMoves: [] } }
    if (change.eventSeq != null) displayed = { ...displayed, events: (latest.events || []).filter(e => e.seq <= change.eventSeq) }
    if (change.tableState) { onChange(); maskArrivals([]) }
  }
  const block = value => {
    blocking = value
    if(value) maskArrivals([])
    if(value) for(const transit of cardTransits) {
      const target=transitTarget(transit)
      if(target) target.style.visibility='hidden'
    }
    // The table stays browsable (details, timeline, map) while presenting; game-ui
    // disables every move. Only the hub keeps a full lock.
    for (const root of document.querySelectorAll('.ah-table, .ah-hub')) {
      root.classList.toggle('ah-presenting', value)
      if (root.classList.contains('ah-hub')) root.inert = value
      else if (root.inert) root.inert = false
    }
  }
  const audio = new Map(), activeAudio = new Set()
  const combatSound = createCombatSound()
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  const save = () => { try { localStorage.setItem('arkham-presentation', JSON.stringify(prefs)) } catch { /* optional */ } }
  const sound = kind => {
    if (!prefs.sound || !unlocked || !SOUNDS[kind]) return
    let sample = audio.get(kind)
    if (!sample) { sample = new Audio(ROOT + 'audio/' + SOUNDS[kind] + '.ogg'); sample.preload = 'auto'; audio.set(kind, sample) }
    const voice = sample.cloneNode(); voice.volume = kind === 'select' ? .16 : .3
    activeAudio.add(voice)
    voice.onended = voice.onerror = () => activeAudio.delete(voice)
    voice.play().catch(() => activeAudio.delete(voice))
  }
  const stopAudio = () => { for (const voice of activeAudio) voice.pause(); activeAudio.clear(); combatSound.stop() }
  const unlock = event => {
    if (!event.target.closest?.('.ah-table')) return
    unlocked = true
    if (prefs.sound) combatSound.unlock()
    if (event.target.closest('button, .ah-hand-card, .ah-map-node')) sound('select')
  }
  document.addEventListener('pointerdown', unlock)
  document.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') unlock(event) })
  const rect = element => {
    if (!element) return null
    const r = element.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  }
  const collect = () => {
    const map = new Map()
    document.querySelectorAll('.ah-map-node').forEach(el => map.set('loc:' + el.dataset.locationId, rect(el)))
    document.querySelectorAll('.ah-map-investigator').forEach(el => map.set('inv:' + el.dataset.seat, rect(el)))
    document.querySelectorAll('.ah-hand-card').forEach(el => { if (!map.has('card:' + el.dataset.cardCode)) map.set('card:' + el.dataset.cardCode, rect(el)) })
    for (const [key, selector] of [['hand', '.ah-hand-area'], ['deck', '.ah-dock-deck'], ['player', '.ah-dock-investigator'], ['equip', '.ah-dock-equipment'], ['choice', '.ah-choice']]) map.set(key, rect(document.querySelector(selector)))
    return map
  }
  const ensureLayer = () => {
    if (layer?.isConnected) return layer
    layer = document.createElement('div'); layer.className = 'ah-fx-layer'; layer.setAttribute('aria-live', 'polite'); layer.setAttribute('aria-atomic', 'true')
    document.body.append(layer)
    return layer
  }
  const clear = () => {
    cancelScene?.(); cancelScene = null; block(false)
    epoch++; queue = []; presentedPlays = []; running = false; stopAudio(); cancelAnimationFrame(frame)
    for(const key of maskedCards) { const el=interaction(key);if(el)el.style.visibility='' }
    for(const transit of cardTransits) { const target=transitTarget(transit);if(target)target.style.visibility='' }
    maskedCards.clear();cardTransits=[]
    if (layer) { layer.getAnimations({ subtree: true }).forEach(a => a.cancel()); layer.remove(); layer = null }
  }
  new MutationObserver(() => {
    if (sessionId && !document.querySelector('.ah-table, .ah-hub')) { clear(); last = null; sessionId = null; anchors.clear() }
    else if (blocking) block(true)
  }).observe(document.getElementById('app') || document.body, { childList: true })
  const animate = async (el, frames, duration) => {
    if (!el.isConnected || reduced()) return
    const animation = el.animate(frames, { duration: prefs.fast ? duration * .35 : duration, easing: 'cubic-bezier(.2,.75,.25,1)', fill: 'forwards' })
    try { await animation.finished } catch { /* cancelled on exit */ }
  }
  const node = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls; if (text != null) el.textContent = text; return el }
  const combat = async c => {
    const generation=epoch, incoming=c.direction==='incoming'||c.effect==='attack', miss=c.success===false
    const enemyNodes=[...document.querySelectorAll('.ah-table [data-interaction]')].filter(el=>el.dataset.interaction===`enemy:${c.enemyId}`)
    const enemy=enemyNodes.find(el=>el.closest('.ah-engagement-cards'))||enemyNodes[0]
    const investigator=[...document.querySelectorAll('.ah-map-investigator')].find(el=>Number(el.dataset.seat)===c.seat)
      || interaction(`investigator:${c.seat}`)
    const source=incoming?enemy:interaction(`asset:${c.assetId}`)||investigator
    const target=incoming?investigator:enemy
    const fallback=[...document.querySelectorAll('.ah-map-node')].find(el=>el.dataset.locationId===c.location)
    const a=rect(source)||rect(fallback),b=rect(target)||rect(fallback)
    if(!a||!b)return
    const start=center(a),end=center(b),dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy)||1
    const label=miss?'攻击落空':incoming?`${c.damage||0} 伤害${c.horror?` / ${c.horror} 恐惧`:''}`:`命中 · ${c.damage||0} 伤害${c.defeated?' · 击败':''}`
    const who=displayed?.state.investigators.find(inv=>inv.seat===c.seat)?.name||'调查员'
    const fx=node('div','ah-combat-fx'+(incoming?' is-incoming':'')+(miss?' is-miss':''))
    fx.dataset.direction=incoming?'incoming':'outgoing';fx.dataset.enemyId=c.enemyId;fx.setAttribute('role','status')
    const caption=node('div','ah-combat-caption',incoming?`${who} 受到「${c.name||'敌人'}」攻击 · ${label}`:`${who} → ${c.name||'敌人'} · ${label}`)
    const captionMargin=Math.min(380,innerWidth-28)/2+14
    Object.assign(caption.style,{left:Math.max(captionMargin,Math.min(innerWidth-captionMargin,end.x))+'px',top:Math.max(85,Math.min(innerHeight-100,b.y-54))+'px'})
    const slash=node('div','ah-combat-slash'),burst=node('div','ah-combat-burst')
    Object.assign(slash.style,{left:start.x+'px',top:start.y+'px',width:length+'px',rotate:Math.atan2(dy,dx)+'rad'})
    Object.assign(burst.style,{left:end.x+'px',top:end.y+'px'})
    fx.append(slash,burst,caption);ensureLayer().append(fx)
    const animations=[],timers=new Set()
    let stopped=false
    const pause=ms=>new Promise(resolve=>{const timer=setTimeout(()=>{timers.delete(timer);resolve()},prefs.fast?ms*.35:ms);timers.add(timer);timerResolvers.push(resolve)})
    const timerResolvers=[]
    const motion=async(el,frames,duration)=>{
      if(!el||reduced()||stopped)return
      const anim=el.animate(frames,{duration:prefs.fast?duration*.35:duration,easing:'ease-out'})
      animations.push(anim);try{await anim.finished}catch{}
    }
    const stop=()=>{stopped=true;for(const animation of animations)animation.cancel();for(const timer of timers)clearTimeout(timer);for(const resolve of timerResolvers)resolve()}
    cancelScene=stop
    try {
      if(prefs.sound&&unlocked)combatSound.play('swing')
      await Promise.all([
        motion(source,[{translate:'0 0'},{translate:`${-dx/length*10}px ${-dy/length*10}px`,offset:.3},{translate:`${dx/length*28}px ${dy/length*28}px`,offset:.65},{translate:'0 0'}],360),
        motion(slash,[{scale:'0 1',opacity:0},{scale:'1 1',opacity:1,offset:.65},{scale:'1 1',opacity:0}],360)
      ])
      if(stopped||generation!==epoch)return
      fx.classList.add('is-impact')
      if(prefs.sound&&unlocked){combatSound.play(miss?'miss':'hit');if(!miss&&c.horror)combatSound.play('horror')}
      await Promise.all([
        motion(target,miss?[{translate:'0 0'},{translate:'20px 0'},{translate:'0 0'}]:[{translate:'0 0',filter:'brightness(1)'},{translate:'-7px 0',filter:'brightness(1.8) sepia(.5)',offset:.2},{translate:'7px 0',offset:.45},{translate:'-3px 0',offset:.7},{translate:'0 0',filter:'brightness(1)'}],340),
        motion(burst,[{scale:'.3',opacity:1},{scale:'1.5',opacity:0}],440),pause(reduced()?900:780)
      ])
    } finally {
      stop();fx.remove();if(generation===epoch)cancelScene=null
    }
  }
  const cardBounds = element => {
    const bounds=rect(element)
    if(!bounds)return null
    const card=element.closest('.ah-minicard'), transform=card && getComputedStyle(card).transform
    const matrix=new DOMMatrix(transform && transform!=='none' ? transform : undefined)
    const angle=Math.atan2(matrix.b,matrix.a), rotation=angle*180/Math.PI
    const width=element.offsetWidth,height=element.offsetHeight
    const scale=width ? bounds.width/(width*Math.abs(Math.cos(angle))+height*Math.abs(Math.sin(angle))) : 1
    return {x:bounds.x+(bounds.width-width*scale)/2,y:bounds.y+(bounds.height-height*scale)/2,width:width*scale,height:height*scale,rotation}
  }
  // Transfer the loaded artwork itself. A card is owned by either the table or
  // this moving holder, never both, including when identical copies are in hand.
  const liftCard = (change, source) => {
    const artwork=source?.querySelector('.ah-table-art'), bounds=cardBounds(artwork)
    if(!artwork || !bounds?.width) return null
    const el=node('div','ah-fx-card ah-card-transit')
    el.dataset.fxKind=change.kind;el.dataset.cardCode=change.code
    Object.assign(el.style,{left:bounds.x+'px',top:bounds.y+'px',width:bounds.width+'px',height:bounds.height+'px',transform:`rotate(${bounds.rotation}deg)`})
    el.append(artwork);ensureLayer().append(el)
    return {...change,el,art:artwork,oldAssets:(displayed?.state.investigators.find(inv=>inv.seat===change.seat)?.assets||[]).map(a=>a.id)}
  }
  const moveCard = async (transit, target, duration=550) => {
    if(!target?.width || !transit.el.isConnected) return
    const from=transit.el.style
    const end={left:target.x+'px',top:target.y+'px',width:target.width+'px',height:target.height+'px',transform:`rotate(${target.rotation||0}deg)`}
    await animate(transit.el,[{left:from.left,top:from.top,width:from.width,height:from.height,transform:from.transform},end],duration)
    // Commit final geometry before releasing the animation; no fade or duplicate.
    Object.assign(transit.el.style,end)
    transit.el.getAnimations().forEach(animation=>animation.cancel())
  }
  const handSource = c => [...document.querySelectorAll('.ah-hand-card')].find(el=>
    el.dataset.cardCode===c.code && el.dataset.interaction?.startsWith(`hand:${c.seat}:`))
  const playCard = async (c, lifted=null) => {
    const generation=epoch, source=handSource(c), transit=lifted||liftCard(c,source)
    if(!transit) { if(c.tableState)applyStep(c);return }
    if(!cardTransits.includes(transit))cardTransits.push(transit)
    if(!lifted) {
      if(c.tableState) applyStep(c)
      else {
        // Legacy public play cues may omit their intermediate snapshot.
        const investigators=structuredClone(displayed.state.investigators), inv=investigators.find(i=>i.seat===c.seat)
        const index=inv?.hand?.indexOf(c.code)??-1
        if(index>=0)inv.hand.splice(index,1)
        applyStep({...c,tableState:{investigators}})
      }
    }
    const zone=interaction('zone:play')
    const bounds=rect(zone)
    // The play area has a card-shaped landing spot, while effects resolve.
    if(bounds) await moveCard(transit,bounds)
    else await moveCard(transit,{x:(innerWidth-transit.el.offsetWidth)/2,y:innerHeight*.52,width:transit.el.offsetWidth,height:transit.el.offsetHeight})
    if(generation!==epoch)return
  }
  const finishCards = async () => {
    const generation=epoch
    for(const transit of [...cardTransits]) {
      const target=transitTarget(transit), artwork=target?.querySelector('.ah-table-art')
      if(target)target.style.visibility='hidden'
      const discard=rect(document.querySelector('.ah-dock-equipment'))
      const destination=cardBounds(artwork)||(discard && {x:discard.x+(discard.width-discard.height/1.4)/2,y:discard.y,width:discard.height/1.4,height:discard.height})
      await moveCard(transit,destination,360)
      if(generation!==epoch)return
      // Event cards continue into the discard pile; assets retain the same
      // loaded artwork node in their equipment slot after landing.
      if(artwork?.isConnected) { artwork.replaceWith(transit.art);target.style.visibility='' }
      transit.el.remove();cardTransits.splice(cardTransits.indexOf(transit),1)
    }
  }
  const drawCard = async c => {
    const generation=epoch,key=`hand:${c.seat}:${c.handIndex}`, target=interaction(key)
    const destination=cardBounds(target?.querySelector('.ah-table-art')), transit=liftCard(c,target)
    if(!transit) { maskedCards.delete(key);return }
    const deck=rect(document.querySelector('.ah-dock-deck .ah-deck-back'))
    if(deck)Object.assign(transit.el.style,{left:deck.x+'px',top:deck.y+'px',width:deck.width+'px',height:deck.height+'px',transform:'rotate(0deg)'})
    await moveCard(transit,destination,650)
    if(generation!==epoch)return
    const current=interaction(key)
    if(current) {
      const placeholder=current.querySelector('.ah-table-art')
      if(placeholder)placeholder.replaceWith(transit.art);else current.prepend(transit.art)
      current.style.visibility=''
    }
    maskedCards.delete(key);transit.el.remove()
  }
  const cinematic = async change => {
    const generation = epoch
    const location = change.kind === 'location', story = change.kind === 'story' || location, phase = PHASES[change.phase] || PHASES.investigation
    const el = node('section', story ? 'ah-cinematic is-story' + (location ? ' ah-location-reveal' : '') : 'ah-phase-scene is-' + change.phase)
    if (change.intro) el.classList.add('ah-introduction')
    el.dataset.fxKind = change.kind; el.dataset.phase = change.phase || ''; el.dataset.title = change.title || phase[0]
    el.setAttribute('role', story ? 'dialog' : 'region'); if (story) el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', change.title || phase[0])
    let positionWorld = () => {}, resizeFrame
    const place = () => {
      if (story) return
      const header = document.querySelector('.ah-header-phases')?.getBoundingClientRect()
      const top = Math.max(56, (header?.bottom || 46) + 10)
      el.style.top = top + 'px'
      el.style.left = Math.max(10, (innerWidth - el.getBoundingClientRect().width) / 2) + 'px'
      el.style.maxHeight = Math.max(120, innerHeight - top - 16) + 'px'
      positionWorld()
    }
    const onResize = () => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => { resizeFrame = requestAnimationFrame(place) })
    }
    place(); window.addEventListener('resize', onResize)
    let worldNodes = []
    const clearWorld = () => { for (const item of worldNodes) item.remove(); worldNodes = []; positionWorld = () => {} }
    const worldEffect = async step => {
      clearWorld()
      // The table fits its map in a layout frame after each state render.
      // Anchor effects only after that transform has reached its final position.
      await new Promise(requestAnimationFrame)
      if (generation !== epoch || stopped) return
      const location = id => [...document.querySelectorAll('.ah-map-node')].find(item => item.dataset.locationId === id)
      const investigator = [...document.querySelectorAll('.ah-map-investigator')].find(item => Number(item.dataset.seat) === step.seat)
      const target = step.kind === 'phase' && !step.effect ? document.querySelector(change.phase === 'upkeep' ? '.ah-equipment-battlefield' : '.ah-header-phase.ah-phase-' + change.phase)
        : step.effect === 'doom' ? document.querySelector('.ah-script-status')
        : investigator || location(step.to || step.location) || document.querySelector('.ah-map-node')
      const r = target?.getBoundingClientRect()
      if (!r) return
      const ring = node('div', 'ah-phase-ring is-' + change.phase)
      let token
      positionWorld = () => {
        if (!target.isConnected) return
        const rect = target.getBoundingClientRect()
        Object.assign(ring.style, { left: rect.x - 5 + 'px', top: rect.y - 5 + 'px', width: rect.width + 10 + 'px', height: rect.height + 10 + 'px' })
        if (token) {
          const panel = el.getBoundingClientRect(), x = Math.max(65, Math.min(innerWidth - 65, rect.x + rect.width / 2))
          const overlapsPanel = x + 65 > panel.left && x - 65 < panel.right && rect.y + 20 > panel.top && rect.y - 30 < panel.bottom
          Object.assign(token.style, { left: x + 'px', top: Math.max(60, overlapsPanel ? rect.bottom + 22 : rect.y) + 'px' })
        }
      }
      positionWorld()
      ensureLayer().append(ring); worldNodes.push(ring)
      if (!step.effect) return
      const label = step.effect === 'attack' ? `♥ −${step.damage || 0}  ◈ −${step.horror || 0}`
        : step.effect === 'hunter' ? step.name || '猎手移动' : step.effect === 'draw' ? '抽牌 +1'
          : step.effect === 'resource' ? `资源 +${step.delta || 1}` : step.effect === 'doom' ? `毁灭 +${step.delta || 1}` : '遭遇揭示'
      token = node('div', 'ah-phase-world-cue is-' + change.phase, label)
      token.dataset.effect = step.effect
      const from = step.effect === 'hunter' ? location(step.from)?.getBoundingClientRect()
        : step.effect === 'draw' ? document.querySelector('.ah-dock-deck')?.getBoundingClientRect() : null
      const x = r.x + r.width / 2, y = r.y
      Object.assign(token.style, { left: Math.max(65, Math.min(innerWidth - 65, x)) + 'px', top: Math.max(60, y) + 'px' })
      ensureLayer().append(token); worldNodes.push(token)
      positionWorld()
      await animate(token, [{ transform: `translate(calc(-50% + ${from ? from.x + from.width / 2 - x : 0}px),${from ? from.y - y : 12}px) scale(.7)`, opacity: .25 },
        { transform: 'translate(-50%,-18px) scale(1)', opacity: 1 }], from ? 750 : 450)
    }
    const content = node('div', 'ah-cinematic-content')
    content.append(node('div', 'ah-cinematic-sigil', story ? '✦' : phase[1]),
      node('small', 'ah-cinematic-kicker', story ? change.title : `第 ${change.round || 1} 轮 · 自动结算`),
      node('h1', '', story ? change.name || change.title : phase[0]))
    if (story && change.code && art) {
      const card = node('div', 'ah-cinematic-card' + (change.flip ? ' is-flipping' : ''))
      card.append(art(change.code, change.name, { landscape: !location, face: change.face || 'front' })); content.append(card)
      if (!reduced()) card.animate([{ transform: `perspective(1200px) rotateY(${change.flip ? 100 : -18}deg) scale(.75)`, opacity: 0 }, { transform: 'perspective(1200px) rotateY(0) scale(1)', opacity: 1 }], { duration: prefs.fast ? 200 : 650, fill: 'both' })
    }
    const stepArt = node('div', 'ah-cinematic-step-art')
    if (!story) content.append(stepArt)
    const detail = node('p', 'ah-cinematic-detail'), progress = node('div', 'ah-cinematic-progress')
    if (location) {
      const stats = node('div', 'ah-location-reveal-stats', `帷幕 ${change.shroud ?? '—'}　 ·　线索 ${change.clues ?? 0}`)
      const effect = change.onEnter
      const lines = [effect?.damage ? `进入后受到 ${effect.damage} 点伤害` : '', effect?.horror ? `进入后受到 ${effect.horror} 点恐惧` : '', effect?.test ? `进入后进行${SKILLS[effect.test.skill] || '技能'}检定（${effect.test.difficulty}）` : ''].filter(Boolean)
      stats.append(node('strong', '', lines.join('；') || '没有额外的进入惩罚'))
      content.append(stats)
    }
    detail.setAttribute('aria-live', 'polite')
    content.append(detail, progress)
    const controls = node('div', 'ah-cinematic-controls'), next = node('button', '', '继续'), skip = node('button', '', '跳过演出')
    if (story) controls.append(next)
    controls.append(skip); content.append(controls); el.append(content)
    ensureLayer().append(el); place(); block(true)
    if (!story && displayed) {
      displayed = { ...displayed, state: { ...displayed.state, phase: change.phase, round: change.round || displayed.state.round } }
      onChange()
    }
    sound(story || change.phase === 'mythos' ? 'agenda' : change.phase === 'enemy' ? 'damage' : 'reveal')
    let timer, settle, stopped = false, advanceRequested = false
    const release = () => { clearTimeout(timer); const done = settle; settle = null; done?.() }
    cancelScene = () => { stopped = true; release() }
    next.onclick = () => { if (settle) release(); else advanceRequested = true }
    skip.onclick = () => { queue = []; stopped = true; release() }
    const previousFocus = document.activeElement
    if (story) next.focus({ preventScroll: true })
    el.onkeydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); skip.click() }
      if (event.key === 'Tab') {
        const buttons = story ? [next, skip] : [skip], index = buttons.indexOf(document.activeElement)
        event.preventDefault(); buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus()
      }
    }
    const hold = duration => new Promise(resolve => {
      if (advanceRequested) { advanceRequested = false; resolve(); return }
      settle = resolve
      if (duration === null) return // Story and location pages wait for the reader.
      timer = setTimeout(release, prefs.fast ? duration * .35 : duration)
    })
    const steps = story ? [{ text: change.text || '新的篇章已经展开。' }] : change.steps?.length ? change.steps : [{ text: phase[2] }]
    try {
      for (let index = 0; index < steps.length && !stopped; index++) {
        stepArt.replaceChildren()
        stepArt.classList.toggle('is-encounter', steps[index].effect === 'encounter')
        if (steps[index].code && art) stepArt.append(art(steps[index].code, steps[index].name))
        else if (steps[index].effect === 'encounter') {
          // Public hidden-card cues intentionally omit the real card identity.
          const hidden = node('img', 'ah-encounter-hidden-art')
          hidden.src = ROOT + 'img/backs/hidden-encounter.png'
          hidden.alt = '隐私牌'
          stepArt.append(hidden)
        }
        if (['resource', 'doom'].includes(steps[index].effect)) {
          const token = node('div', 'ah-cinematic-counter', `+${steps[index].delta || 1}`)
          token.append(node('small', '', steps[index].effect === 'doom' ? '毁灭' : '资源')); stepArt.append(token)
          if (!reduced()) token.animate([{ transform: 'scale(.3) rotate(-45deg)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 550, fill: 'both' })
          sound(steps[index].effect === 'doom' ? 'agenda' : 'clue')
        }
        if (steps[index].effect === 'attack') {
          const hit = node('div', 'ah-cinematic-hit', `♥ ${steps[index].damage || 0}  ·  ◈ ${steps[index].horror || 0}`)
          stepArt.append(hit)
          if (!reduced()) hit.animate([{ transform: 'scale(1.8)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 400, fill: 'both' })
          sound('damage')
        }
        const stepText = steps[index].text || phase[2]
        setRulesText(detail, stepText)
        progress.textContent = story ? '阅读完毕后点击继续' : `${phase[2]} · ${index + 1} / ${steps.length}`
        el.dataset.step = String(index + 1)
        if (steps[index].effect === 'encounter') {
          const back = node('img', 'ah-encounter-reveal-back'); back.src = ROOT + 'img/backs/back_encounter.webp'; back.alt = '抽取遭遇卡'
          stepArt.append(back); sound('draw')
          const from = document.querySelector('.ah-encounter-deck img')?.getBoundingClientRect(), to = stepArt.getBoundingClientRect()
          if (from && !reduced()) await animate(stepArt, [
            { transform: `translate(${from.x - to.x}px,${from.y - to.y}px) scale(.2) rotate(-12deg)`, opacity: .5 },
            { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 }], 650)
          if (!stopped) {
            await animate(stepArt, [{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], 220)
            back.remove(); sound('encounter')
            await animate(stepArt, [{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0)' }], 250)
          }
        }
        if (!reduced()) detail.animate([{ opacity: .1, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 250, fill: 'both' })
        if (!story) await worldEffect(steps[index])
        if (stopped || generation !== epoch) break
        await hold(story ? null : steps[index].effect === 'encounter' ? 3600 : Math.min(2400, Math.max(1400, stepText.length * 48)))
        if (!stopped && generation === epoch) {
          const step=steps[index], draws=step.tableState ? presentationChanges(displayed.state,{...displayed.state,...step.tableState}).filter(c=>c.kind==='draw') : []
          applyStep(step);maskArrivals(draws)
          for(const draw of draws) { sound('draw');await drawCard(draw) }
          if(cardTransits.length)await finishCards()
        }
      }
    } finally {
      clearTimeout(timer); el.remove()
      clearWorld(); cancelAnimationFrame(resizeFrame); window.removeEventListener('resize', onResize)
      if (generation === epoch) {
        cancelScene = null
        if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true })
      }
    }
  }
  const center = r => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })
  const fly = async (change, from, to, label) => {
    if (!from || !to) return
    const a = center(from), b = center(to)
    const el = node('div', 'ah-fx-token', label)
    el.dataset.fxKind = change.kind
    el.style.left = a.x + 'px'; el.style.top = a.y + 'px'
    ensureLayer().append(el)
    await animate(el, [{ transform: 'translate(-50%,-50%) scale(.75)', opacity: .4 }, { transform: `translate(calc(-50% + ${(b.x-a.x)*.55}px),calc(-50% + ${(b.y-a.y)*.55-24}px)) scale(1.1)`, opacity: 1, offset: .55 }, { transform: `translate(calc(-50% + ${b.x-a.x}px),calc(-50% + ${b.y-a.y}px)) scale(.8)`, opacity: 0 }], 520)
    el.remove()
  }
  const banner = async change => {
    const generation = epoch
    const test = change.kind === 'test'
    const el = node('div', 'ah-fx-banner' + (test ? (change.success ? ' is-success' : ' is-failure') : ''))
    el.dataset.fxKind = change.kind
    el.append(node('span', 'ah-fx-eyebrow', test ? `${change.name} · ${change.source?.label || ''} ${change.source?.name || ''} · ${SKILLS[change.skill] || change.skill}检定` : '档案更新'))
    if (test) {
      const tokens = node('div', 'ah-fx-tokens')
      await Promise.all((change.drawn || []).map(async value => {
        const token = node('span', 'ah-fx-chaos'); tokens.append(token)
        await showChaosToken(token,value)
      }))
      el.append(tokens, node('strong', '', change.success ? '检定成功' : '检定失败'), node('span', 'ah-fx-equation', `${change.value} / 难度 ${change.difficulty}${change.autoFail ? ' · 自动失败' : ''}`))
    } else el.append(node('strong', '', change.title), node('span', '', change.name))
    if (generation !== epoch) return
    ensureLayer().append(el)
    sound(test ? 'reveal' : 'agenda')
    const duration = reduced() ? 0 : prefs.fast ? 600 : 1550
    if (test && !reduced()) el.querySelectorAll('.ah-fx-chaos').forEach(token => { token.animate([{ transform: 'rotateY(180deg) scale(.6)', opacity: 0 }, { transform: 'rotateY(0) scale(1)', opacity: 1 }], { duration: prefs.fast ? 150 : 400, fill: 'both' }) })
    await animate(el, [{ opacity: 0, transform: 'translate(-50%,12px)' }, { opacity: 1, transform: 'translate(-50%,0)', offset: .15 }, { opacity: 1, transform: 'translate(-50%,0)', offset: .85 }, { opacity: 0, transform: 'translate(-50%,-8px)' }], duration)
    if (test) sound(change.success ? 'success' : 'failure')
    // Reduced motion keeps a readable static result for the same locked sequence.
    if (reduced()) await new Promise(resolve => setTimeout(resolve, 900))
    el.remove()
  }
  const chaosReveal = async change => {
    const generation = epoch, el = node('section', 'ah-chaos-reveal')
    el.dataset.fxKind = 'chaos'; el.dataset.token = change.token
    el.setAttribute('role', 'status'); el.setAttribute('aria-label', '抽取混乱标记')
    const token = node('div', 'ah-chaos-reveal-token')
    await showChaosToken(token,'blank')
    if (generation !== epoch) return
    const skip = node('button', '', '继续')
    el.append(node('small', '', `${change.name || '调查员'} · ${change.source?.label || '技能检定'}`),
      node('strong', '', change.source?.name || '抽取混乱标记'), token,
      node('span', '', change.skill ? `${SKILLS[change.skill]}检定 · 难度 ${change.difficulty}` : '混乱标记揭示'), skip)
    ensureLayer().append(el); block(true)
    let stopped = false, timer, release
    const cancel = () => { stopped = true; clearTimeout(timer); for (const animation of el.getAnimations({subtree:true})) animation.cancel(); release?.() }
    cancelScene = cancel; skip.onclick = cancel
    const previousFocus = document.activeElement
    el.onkeydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); cancel() }
      if (event.key === 'Tab') { event.preventDefault(); skip.focus() }
    }
    const position = () => { el.style.top = Math.max(66, (document.querySelector('.ah-header-phases')?.getBoundingClientRect().bottom || 56) + 12) + 'px' }
    position(); window.addEventListener('resize', position)
    try {
      const bag = document.querySelector('.ah-chaos-bag')?.getBoundingClientRect(), target = token.getBoundingClientRect()
      sound('reveal')
      await animate(token, [{ transform: `translate(${bag ? bag.x - target.x : 0}px,${bag ? bag.y - target.y : 0}px) scale(.3) rotate(-160deg)`, opacity: .1 },
        { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 }], 700)
      await showChaosToken(token,change.token)
      el.dataset.revealed = 'true'
      if (!stopped) await animate(token, [{ transform: 'rotateY(90deg) scale(.8)' }, { transform: 'rotateY(0) scale(1)' }], 300)
      if (!stopped) await new Promise(resolve => { release = resolve; timer = setTimeout(resolve, prefs.fast ? 600 : 1400) })
    } finally {
      clearTimeout(timer); window.removeEventListener('resize', position); el.remove()
      if (generation === epoch) {
        cancelScene = null
        if (previousFocus?.isConnected && !previousFocus.closest('[inert]')) previousFocus.focus({preventScroll:true})
      }
    }
  }
  const play = async item => {
    const { change: c, before, after } = item
    ensureLayer().dataset.lastKind = c.kind
    if (c.kind === 'attack') { await combat(c);applyStep(c);return }
    if (c.kind === 'checkpoint') {
      // Explicit play cues precede their transaction's checkpoint. Do not
      // replay the same asset arrival inferred from that checkpoint's state.
      // Keep this ledger across sync calls, but consume it at each checkpoint
      // so playing another copy in a later transaction still animates.
      const shown = presentedPlays; presentedPlays = []
      const changes = presentationChanges(displayed?.state, c.tableState).filter(change => {
        if (change.kind !== 'play') return true
        const index = shown.findIndex(play => play.seat === change.seat && play.code === change.code)
        if (index < 0) return true
        shown.splice(index, 1); return false
      }), from = collect()
      const lifted=new Map(changes.filter(change=>['play','commit'].includes(change.kind)).map(change=>[change,liftCard(change,handSource(change))]))
      for(const transit of lifted.values())if(transit)cardTransits.push(transit)
      applyStep(c);maskArrivals(changes)
      for(const transit of cardTransits) { const target=transitTarget(transit);if(target)target.style.visibility='hidden' }
      await new Promise(requestAnimationFrame)
      const to = collect()
      for (const change of changes) {
        if (!c.inferReveals && ['location', 'agenda'].includes(change.kind)) continue // explicit reveal cues already ran
        if(['play','commit'].includes(change.kind)) { if(lifted.get(change))await playCard(change,lifted.get(change));continue }
        await play({ change, before: from, after: to })
      }
      await finishCards()
      return
    }
    const viewer = latest?.observerSeat ?? latest?.players.find(p => p.role === 'human')?.seat ?? 0
    if (c.kind === 'location' && c.seat != null && c.seat !== viewer) {
      const generation = epoch
      applyStep(c)
      await new Promise(requestAnimationFrame)
      if (generation !== epoch) return
      const loc = [...document.querySelectorAll('.ah-map-node')].find(el => el.dataset.locationId === c.location)
      const who = latest?.state.investigators.find(inv => inv.seat === c.seat)
      const note = node('div', 'ah-location-notice')
      note.setAttribute('role', 'status')
      note.append(node('strong', '', `${who?.name || '队友'} · ${c.title || '进入地点'}「${c.name}」`))
      const effect = c.onEnter
      const details = [effect?.damage ? `受到 ${effect.damage} 点伤害` : '', effect?.horror ? `受到 ${effect.horror} 点恐惧` : '', effect?.test ? `${SKILLS[effect.test.skill]}检定 ${effect.test.difficulty}` : ''].filter(Boolean)
      if (details.length) note.append(node('span', '', details.join(' · ')))
      ensureLayer().append(note)
      const bounds = loc?.getBoundingClientRect(), box = note.getBoundingClientRect()
      note.style.left = Math.max(12, Math.min(innerWidth - box.width - 12, (bounds?.x ?? innerWidth / 2) + (bounds?.width || 0) / 2 - box.width / 2)) + 'px'
      note.style.top = Math.max(70, Math.min(innerHeight - box.height - 12, (bounds?.bottom ?? 110) + 10)) + 'px'
      loc?.classList.add('ah-location-arrival')
      sound('reveal')
      let timer
      try { await new Promise(resolve => { cancelScene = resolve; timer = setTimeout(resolve, prefs.fast ? 900 : 2200) }) }
      finally { clearTimeout(timer); note.remove(); loc?.classList.remove('ah-location-arrival'); if (generation === epoch) cancelScene = null }
      return
    }
    if (c.kind === 'phase' || c.kind === 'story' || c.kind === 'location') return cinematic(c)
    if (c.kind === 'chaos') return chaosReveal(c)
    if (c.kind === 'engagement') {
      const el=node('div','ah-engagement-alert');el.setAttribute('role','status')
      el.append(node('strong','','进入交战状态'),node('span','',`${c.name} · ${c.enemies}`))
      ensureLayer().append(el);sound('damage')
      if(!reduced())el.animate([{opacity:0,transform:'translate(-50%,-12px)'},{opacity:1,transform:'translate(-50%,0)'}],{duration:260,fill:'both'})
      await new Promise(resolve=>setTimeout(resolve,2600));el.remove();return
    }
    if (c.kind === 'test' || c.kind === 'agenda') return banner(c)
    sound(c.kind === 'commit' ? 'play' : c.kind === 'resource' ? 'clue' : c.kind)
    if (c.kind === 'draw') return drawCard(c)
    if (c.kind === 'play' || c.kind === 'commit') return playCard(c)
    if (reduced()) return
    if (c.kind === 'move') return fly(c, before.get('inv:' + c.seat) || before.get('loc:' + c.from), after.get('inv:' + c.seat) || after.get('loc:' + c.to), '◈')
    if (c.kind === 'clue') return fly(c, after.get('loc:' + c.location), after.get('player'), '+' + c.delta)
    if (c.kind === 'reveal') {
      const loc = [...document.querySelectorAll('.ah-map-node')].find(el => el.dataset.locationId === c.location)
      if (loc) await animate(loc, [{ transform: 'perspective(700px) rotateY(-80deg)', filter: 'brightness(.5)' }, { transform: 'perspective(700px) rotateY(0)', filter: 'brightness(1)' }], 450)
      return
    }
    const r = after.get('inv:' + c.seat) || after.get('player')
    if (!r) return
    const el = node('div', 'ah-fx-number ' + (c.kind === 'damage' ? 'is-damage' : ''), `${c.delta > 0 ? '+' : ''}${c.delta} ${({ damage: '伤害', horror: '恐惧', resources: '资源' })[c.field] || ''}`)
    el.style.left = center(r).x + 'px'; el.style.top = r.y + 'px'; ensureLayer().append(el)
    await animate(el, [{ transform: 'translate(-50%,0)', opacity: 0 }, { transform: 'translate(-50%,-16px)', opacity: 1, offset: .3 }, { transform: 'translate(-50%,-40px)', opacity: 0 }], 650); el.remove()
  }
  const drain = async () => {
    if (running) return
    running = true; block(true); const generation = epoch
    try { while (queue.length && generation === epoch) {
      const item = queue.shift()
      if (item.change.kind === 'play' && item.change.eventSeq != null) presentedPlays.push(item.change)
      await play(item)
    } }
    finally { if (generation === epoch) {
      running = false; displayed = latest; block(false); onChange()
      for(const key of maskedCards) { const el=interaction(key);if(el)el.style.visibility='' }
      maskedCards.clear()
      // A skip or a legacy event stream can end without a checkpoint.
      for(const transit of cardTransits) {
        const target=transitTarget(transit), artwork=target?.querySelector('.ah-table-art')
        if(artwork) { artwork.replaceWith(transit.art);target.style.visibility='' }
        transit.el.remove()
      }
      cardTransits=[]
    } }
  }
  return {
    get isBlocking() { return blocking },
    get preferences() { return prefs },
    toggleSound() { prefs.sound = !prefs.sound; if (!prefs.sound) stopAudio(); save() },
    toggleFast() { prefs.fast = !prefs.fast; save() },
    sync(session) {
        let seq = -1
        for (const event of session.events || []) seq = Math.max(seq, event.seq ?? -1)
        const sameSession = session.sessionId === sessionId
        const sameRevision = sameSession && last && session.state.revision === last.revision && session.state.uiState === last.uiState
        latest = session
        if (sameRevision) {
          lastSeq = Math.max(lastSeq, seq)
          if (queue.length || running) {
            displayed = { ...displayed, state: { ...displayed.state, revision: session.state.revision, pendingChoice: null, skillTest: null, legalMoves: [] } }
            return displayed
          }
          displayed = session
          return session
        }
        const nextAnchors = collect()
        if (session.sessionId !== sessionId || (last && session.state.revision < last.revision)) {
          clear(); last = null; sessionId = session.sessionId; lastSeq = seq
          displayed = session
        }
        // Enter the table shell before playing its introduction. A hub snapshot
        // has no map, cards or act data for the scenario's queued animations.
        const enteringScenario = last && last.uiState !== 'inScenario' && session.state.uiState === 'inScenario'
        if (enteringScenario) displayed = session
        if (last && session.state.revision > last.revision) {
          const events = (session.events || []).filter(e => e.seq > lastSeq)
          const changes=presentationChanges(last, session.state, events)
          // State-only updates use the same handoff as explicit checkpoints,
          // so new hand cards cannot appear before their draw finishes.
          const cues=!changes.length ? [] : changes.some(c=>['checkpoint','phase','story'].includes(c.kind)) ? changes
            : [...publicSequence(events),{kind:'checkpoint',tableState:session.state,inferReveals:!events.some(e=>e.presentation?.kind==='location'||e.kind==='location')}]
          for (const change of cues) queue.push({ change, before: anchors, after: nextAnchors })
        }
        if (!last && session.state.scenario && session.state.round === 1 && (session.state.revision === 0 || session.state.pendingChoice?.kind === 'mulligan')) {
          const act = session.state.acts?.[session.state.actIndex]
          queue.push({ change: { kind: 'story', title: '故事导入', name: act?.name || session.state.scenario.name,
            code: act?.originalCode || act?.code, text: session.state.scenario.intro, intro: true }, before: anchors, after: nextAnchors })
          const agenda = session.state.agendas?.[session.state.agendaIndex]
          if (agenda) queue.push({ change: { kind: 'story', title: '密谋揭示', name: agenda.name,
            code: agenda.originalCode || agenda.code, text: agenda.text || '新的威胁正在逼近。',
            initialAgenda: true }, before: anchors, after: nextAnchors })
        }
        lastSeq = Math.max(lastSeq, seq)
        // Retain only dynamic public fields needed by the presentation diff.
        last = { revision: session.state.revision, uiState: session.state.uiState, investigators: structuredClone(session.state.investigators), enemies: structuredClone(session.state.enemies || []), locations: structuredClone(session.state.locations), skillTest: structuredClone(session.state.skillTest), agendaIndex: session.state.agendaIndex, actIndex: session.state.actIndex }
        anchors = nextAnchors
        if (queue.length || running) {
          block(true)
          displayed = { ...displayed, state: { ...displayed.state, revision: session.state.revision, pendingChoice: null, skillTest: null, legalMoves: [] } }
          if (!running) { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => drain().catch(() => { clear(); displayed = latest; onChange() })) }
        } else displayed = session
        return displayed
    },
  }
}
