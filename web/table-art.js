import { getCardPresentation, renderImage } from './catalog.js'

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

// Runtime art is requested only when a card enters the table viewport. The
// catalog owns language preference, local/remote candidates and failed URLs.
export function tableArt(h, code, name, { landscape = false, face = 'front' } = {}) {
  let preference = ''
  try { preference = localStorage.getItem('arkham.presentation') || '' } catch {}
  const holder = h('div', {
    className: 'ah-table-art' + (landscape ? ' ah-table-art-landscape' : ''),
    'data-art-code': code || '', 'data-art-face': face, 'data-art-preference': preference, 'data-image-state': 'pending',
    'aria-label': name || '卡牌',
  }, h('span', { className: 'ah-table-art-fallback' }, name || '卡牌'))
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
      if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load() }
    }, { rootMargin: '120px' })
    observer.observe(holder)
  })
  return holder
}
