import { getCardPresentation, renderImage } from './catalog.js'
import { t } from './i18n.js'

// Keep loaded image nodes through host re-renders; card bindings live on their
// parents. Face and preferences must match so a flip/language change stays real.
export function retainTableArt(previous, next) {
  if (!previous || !next) return
  const key = el => JSON.stringify([el.dataset.artCode, el.dataset.artFace, el.dataset.artPreference, el.className, el.getAttribute('aria-label')])
  const owner = el => el.closest('[data-interaction]')?.dataset.interaction || ''
  const available = new Map()
  for (const el of previous.querySelectorAll('.ah-table-art')) {
    const id = key(el)
    if (!available.has(id)) available.set(id, [])
    available.get(id).push(el)
  }
  const pending = []
  // Reserve exact card instances first. Preview art must not steal a hand
  // card's loaded node just because it appears earlier in the document.
  for (const el of next.querySelectorAll('.ah-table-art')) {
    const candidates=available.get(key(el)), identity=owner(el)
    const index=identity ? candidates?.findIndex(candidate=>owner(candidate)===identity) : -1
    if(index>=0)el.replaceWith(candidates.splice(index,1)[0])
    else pending.push(el)
  }
  for(const el of pending) {
    const retained=available.get(key(el))?.shift()
    if(retained)el.replaceWith(retained)
  }
}

const ENCOUNTER_BACK_SRC = '/mods/arkhamhorror/img/backs/back_encounter.webp'

// 没有专用背面图案的未揭示地点。空的 artCode 会变成写着地点名的空白卡，
// 这里改画遭遇牌堆用的同一张牌背。不写 artCode，避免放大镜把它当成一张真实卡去查。
export function encounterBackArt(h, name, { table = true } = {}) {
  const label = name || t('table.encounter.back')
  const image = h('img', { src: ENCOUNTER_BACK_SRC, alt: label, draggable: 'false' })
  if (!table) return h('figure', { className: 'ah-art', 'data-image-state': 'displayable' }, image)
  return h('div', {
    className: 'ah-table-art',
    'data-art-face': 'back',
    'data-art-preference': 'encounter-back',
    'data-image-state': 'displayable',
    'aria-label': label,
  }, h('figure', { className: 'ah-art' }, image))
}

// Runtime art is requested only when a card enters the table viewport. The
// catalog owns language preference, local/remote candidates and failed URLs.
export function tableArt(h, code, name, { landscape = false, face = 'front' } = {}) {
  let preference = ''
  try { preference = localStorage.getItem('arkham.presentation') || '' } catch {}
  const holder = h('div', {
    className: 'ah-table-art' + (landscape ? ' ah-table-art-landscape' : ''),
    'data-art-code': code || '', 'data-art-face': face, 'data-art-preference': preference, 'data-image-state': 'pending',
    'aria-label': name || t('detail.type.card'),
  }, h('span', { className: 'ah-table-art-fallback' }, name || t('detail.type.card')))
  if (!code) { holder.dataset.imageState = 'text-fallback'; return holder }
  let requested = false
  const load = async () => {
    if (requested || !holder.isConnected) return
    requested = true
    try {
      const entry = await getCardPresentation(code)
      if (!holder.isConnected) return
      const image = renderImage(h, entry?.images || entry?.card?.images, face)
      holder.prepend(image)
      const reflect = () => { holder.dataset.imageState = image.dataset.imageState || 'pending' }
      new MutationObserver(reflect).observe(image, { attributes: true, attributeFilter: ['data-image-state'] })
      reflect()
    } catch { holder.dataset.imageState = 'text-fallback' }
  }
  queueMicrotask(() => {
    // A repaint may already have replaced this placeholder with retained art.
    // Only genuinely new, connected cards allocate an observer.
    if (!holder.isConnected) return
    if (typeof IntersectionObserver === 'undefined') { load(); return }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); return }
      // 观察者会一直强引用目标节点。整树重绘把占位节点换掉后如果不主动断开，
      // 一局下来会攒下成百上千个观察者和已离屏的卡图节点（越玩越卡）。
      if (!holder.isConnected) observer.disconnect()
    }, { rootMargin: '120px' })
    observer.observe(holder)
    // 兜底：占位节点在第一次交叉回调之前就被换掉时（重绘频繁发生），上面那条路径不会触发。
    setTimeout(() => { if (!holder.isConnected) observer.disconnect() }, 2000)
  })
  return holder
}
