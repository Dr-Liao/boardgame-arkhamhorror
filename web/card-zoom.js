import { getCardPresentation, cardFaceText, typeLabel, cardDisplayName, cardDisplayText, cardDisplayFlavor, cardDisplaySubname, cardDisplayTraits } from './catalog.js'
import { renderRulesText } from './card-text.js'
import { tableArt } from './table-art.js'
import { t } from './i18n.js'

// 职业标签只存 key，取词发生在渲染期：模块顶层不能调用 t()（导入时求值会让英文不生效）。
const CLASS_LABEL_KEYS = { guardian: 'game.class.guardian', seeker: 'game.class.seeker', rogue: 'game.class.rogue', mystic: 'game.class.mystic', survivor: 'game.class.survivor', neutral: 'game.class.neutral', mythos: 'game.class.mythos' }
const classLabel = klass => (CLASS_LABEL_KEYS[klass] ? t(CLASS_LABEL_KEYS[klass]) : klass)
const LANDSCAPE_TYPES = ['investigator', 'location', 'act', 'agenda']
// Elements that own a card picture; a hovered container only zooms the art it owns
// directly, so a location never borrows an investigator standing on it.
const OWNERS = '[data-zoom-code],[data-card-code],[data-interaction],.ah-enemy,.ah-script-card,.ah-reference-card,button,[role="button"],li'
let installed = false

function resolve(el) {
  if (!el?.closest || el.closest('.ah-card-zoom')) return null
  const tagged = el.closest('[data-zoom-code]')
  if (tagged?.dataset.zoomCode) {
    const art = tagged.querySelector('.ah-table-art')
    return { owner: tagged, art, code: tagged.dataset.zoomCode, face: art?.dataset.artFace || 'front',
      name: tagged.dataset.zoomName || art?.getAttribute('aria-label') }
  }
  let art = el.closest('.ah-table-art')
  let owner = art && (art.parentElement?.closest(OWNERS) || art)
  if (!art) {
    owner = el.closest(OWNERS)
    art = owner && [...owner.querySelectorAll('.ah-table-art')].find(item => item.parentElement.closest(OWNERS) === owner)
  }
  if (!art?.dataset.artCode) return null
  return { owner, art, code: art.dataset.artCode, face: art.dataset.artFace || 'front', name: art.getAttribute('aria-label') }
}

// Hold Alt over any card picture to see it enlarged beside its rules text.
// Alt alone never triggers browser actions while a card is under the pointer.
export function installCardZoom(h) {
  if (installed || typeof document === 'undefined') return
  installed = true
  let pointer = null, target = null, zoom = null, sequence = 0
  const hide = () => {
    sequence++; zoom?.remove(); zoom = null; target = null
    document.body.classList.remove('ah-card-zoom-active')
  }

  const describe = (panel, card, linked, face, fallbackName) => {
    // cardFaceText 负责背面关联面与卡背占位文本；名称/文本再统一走 cardDisplay*（§8.7 第二步）。
    const text = cardFaceText(card, linked, face)
    const traits = cardDisplayTraits(text).join(' · ')
    const meta = face === 'back' ? t('card.zoom.back') : [typeLabel(text.type), classLabel(text.klass),
      text.cost != null ? t('game.zoom.resources', { cost: text.cost }) : null, text.xp ? t('game.zoom.level', { xp: text.xp }) : null, text.slot || null].filter(Boolean).join(' · ')
    const rules = cardDisplayText(text)
    const flavor = cardDisplayFlavor(text)
    const subname = cardDisplaySubname(text)
    panel.replaceChildren(...[
      h('h3', {}, cardDisplayName(text) || fallbackName),
      subname ? h('small', { className: 'ah-card-zoom-subname' }, subname) : null,
      meta ? h('small', { className: 'ah-card-zoom-meta' }, meta) : null,
      traits ? h('p', { className: 'ah-card-zoom-traits' }, traits) : null,
      h('p', { className: 'ah-card-zoom-rules' }, rules ? renderRulesText(h, rules, { links: false }) : t('card.zoom.noRules')),
      flavor ? h('p', { className: 'ah-card-zoom-flavor' }, flavor) : null].filter(Boolean))
  }

  const position = () => {
    if (!zoom || !target?.owner.isConnected) return
    const box = target.owner.getBoundingClientRect(), bounds = zoom.getBoundingClientRect()
    const right = box.right + 14, left = box.left - bounds.width - 14
    const x = right + bounds.width <= innerWidth - 8 ? right : left >= 8 ? left : innerWidth - bounds.width - 8
    zoom.style.left = Math.max(8, x) + 'px'
    zoom.style.top = Math.max(8, Math.min(innerHeight - bounds.height - 8, box.top + box.height / 2 - bounds.height / 2)) + 'px'
  }

  const show = found => {
    target = found
    const { code, face, art: source } = found
    const name = found.name || t('detail.type.card')
    const landscape = source?.classList.contains('ah-table-art-landscape')
    const art = source?.dataset.imageState === 'displayable' ? source.cloneNode(true) : tableArt(h, code, name, { face, landscape })
    const panel = h('div', { className: 'ah-card-zoom-text' }, h('h3', {}, name), h('p', { className: 'ah-card-zoom-loading' }, t('card.zoom.loading')))
    zoom = h('div', { className: 'ah-card-zoom' + (landscape ? ' is-landscape' : ''), role: 'tooltip', 'data-zoom-for': code, 'data-zoom-face': face },
      h('div', { className: 'ah-card-zoom-art' }, art), panel)
    const fit = () => {
      const img = zoom?.querySelector('.ah-card-zoom-art img:not([hidden])')
      if (img?.naturalWidth && img.naturalHeight) zoom.classList.toggle('is-landscape', img.naturalWidth > img.naturalHeight)
      position()
    }
    zoom.addEventListener('load', fit, true)
    document.body.append(zoom)
    document.body.classList.add('ah-card-zoom-active')
    fit()
    const ticket = ++sequence
    getCardPresentation(code).then(entry => {
      if (ticket !== sequence || !entry?.card) throw new Error()
      describe(panel, entry.card, entry.linkedCard, face, name)
      if (LANDSCAPE_TYPES.includes(entry.card.type)) zoom.classList.add('is-landscape')
      fit()
    }).catch(() => {
      if (ticket !== sequence) return
      panel.querySelector('.ah-card-zoom-loading')?.replaceChildren(t('card.zoom.unavailable'))
    })
  }

  const update = (el, altKey) => {
    const next = altKey ? resolve(el) : null
    if (next?.owner === target?.owner && next?.code === target?.code) return
    // A host re-render swaps the node under a still pointer; keep the open zoom.
    if (next && target && !target.owner.isConnected && next.code === target.code && next.face === target.face) { target = next; position(); return }
    hide()
    if (next) show(next)
  }

  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return
    pointer = { x: event.clientX, y: event.clientY }
    update(event.target, event.altKey)
  }, true)
  document.addEventListener('keydown', event => {
    if (event.key !== 'Alt' || !pointer) return
    const el = document.elementFromPoint(pointer.x, pointer.y)
    if (!resolve(el)) return
    event.preventDefault()
    update(el, true)
  }, true)
  document.addEventListener('keyup', event => {
    if (event.key !== 'Alt') return
    if (target) event.preventDefault()
    hide()
  }, true)
  document.addEventListener('pointerdown', hide, true)
  document.addEventListener('scroll', () => { if (zoom) position() }, true)
  window.addEventListener('blur', hide)
  window.addEventListener('resize', position)
}
