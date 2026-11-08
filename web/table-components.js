// Small monochrome UI marks stay crisp at every zoom level.
// 标记文案在 cardMarkerData()/placedCardMarkers() 调用期取 t()（模块顶层不调用 t()）。
import { t } from './i18n.js'
import { CARD_GLYPHS, SYMBOL_ALIASES, symbolFont } from './game-symbols.js'
// 生命/理智过去用参考项目的心形/脑部插画 PNG 做 CSS 蒙版：原图 2000px 宽，缩小到
// 13–18px 后内部细节全糊成一团，还带着半透明的灰边。这里改成由同一张插画描摹出的
// 单色矢量路径（32×32 网格、偶奇填充保留镂空），任意尺寸都清晰且保留卡面图形识别度。
const FILLED_ICONS = {
  health: 'M8.21 0 14.31 0.04 17.36 3.37 22.25 4.69 21.59 7.74 19.32 8.5 19.83 21.47 18.13 23.95 14.31 24 6.68 20.9 2.87 16.12 4.07 7.74 1.75 3.92 6.68 2.69 8.21 0Z M8.97 2.05 6.62 3.92 7.45 5.89 5.92 4.12 3.19 4.69 5.35 7.74 3.6 15.37 7.45 20.25 17.36 23.19 18.58 21.47 18.13 11.84 17.36 16.78 14.31 16.39 12.79 19.95 10.5 15.96 8.97 18.06 7.77 16.89 10.14 12.32 8.97 2.05Z M12.02 4.68 10.82 6.21 11.26 9.82 15.07 6.71 18.13 7.3 21.52 5.45 12.02 4.68Z M16.6 4.27 16.6 5.2 19.02 4.69 16.6 4.27Z M15.84 7.36 13.89 10.03 15.84 11.82 15.84 7.36Z M6.68 8.61 8.57 10.79 5.92 15.09 4.89 12.32 6.68 8.61Z',
  sanity: 'M8.52 1.89 17.61 2.65 22.33 6.66 24 13.48 20.64 19.74 13.07 22.11 6.25 16.29 0.45 13.48 0 7.42 3.22 4.08 8.52 1.89Z M9.28 2.72 4.74 4.07 1.23 7.42 1.47 13.48 7.01 15.44 13.82 21.28 15.34 19.33 19.88 19.1 23.16 13.48 22.36 8.18 16.85 3.3 9.28 2.72Z M10.04 3.41 12.31 4.93 13.82 3.44 16.85 4.16 20.7 7.42 21.82 9.69 20.55 11.96 22.07 13.48 20.64 15.68 16.69 11.96 17.26 9.69 15.34 7.15 12.31 7.7 12.59 6.66 7.56 4.39 10.04 3.41Z M5.49 4.86 8.59 6.66 6.25 6.84 4.74 8.93 10.04 7.18 10.04 8.52 13.82 8.73 15.78 10.45 15.34 11.73 10.14 9.69 13.41 14.24 13.07 18.02 11.72 16.51 12.31 14.48 11.55 18.38 10.04 15.6 9.28 16.66 8.62 15.75 9.01 12.72 10.94 11.21 9.28 11.57 9.28 10.1 7.01 11.61 5.89 9.69 7.76 14.54 2.17 12.72 1.72 8.18 5.49 4.86Z M3.98 9.01 3.43 10.45 5.49 13.28 3.98 9.01Z M13.82 11.75 16.77 14.24 15.34 17.12 17.19 17.27 16.47 15.75 18.37 15.41 19.81 18.02 16.85 19.03 14.34 17.27 13.82 11.75Z',
}
const paths = {
  clue: 'M15.5 15.5 21 21M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
  resource: 'M12 2 21 7v10l-9 5-9-5V7ZM3 7l9 5 9-5M12 12v10',
  hourglass: 'M6 2h12M6 22h12M7 2v4l5 6 5-6V2M7 22v-4l5-6 5 6v4',
  doom: 'M12 2 3 20h18ZM12 8v6M12 17v1',
  book: 'M12 5C8 2 5 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-3-1-6-2-10 1ZM12 5v15',
  shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z',
  star: 'm12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z',
  sword: 'm5 19 14-14 3-3v6L8 22M3 14l7 7M2 22l4-4',
  leaf: 'M4 20C0 6 9 2 21 3c1 12-6 18-17 17Zm0 0L17 7',
  lock: 'M6 10V7a6 6 0 0 1 12 0v3M4 10h16v12H4ZM12 14v4',
  hand: 'M8 22v-2l-5-7c-1-2 1-3 2-2l3 3V5c0-2 3-2 3 0v6-8c0-2 3-2 3 0v8-6c0-2 3-2 3 0v7-3c0-2 3-2 3 0v6c0 3-2 4-2 7ZM11 14v4M14 13v5M17 14v3',
  ally: 'M8 7a4 4 0 1 1 8 0 4 4 0 0 1-8 0ZM3 22v-3c0-5 18-5 18 0v3ZM8 15l4 5 4-5',
  arcane: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM12 5l6 11H6ZM6 8h12l-6 11ZM12 9v6M9 12h6',
  accessory: 'M4 3c0 10 16 10 16 0M8 3c0 5 8 5 8 0M12 11v3M12 14l4 4-4 4-4-4Z',
  body: 'M8 3 2 6l2 8 3-2v10h10V12l3 2 2-8-6-3-4 3ZM8 3l4 8 4-8M12 11v11',
  tarot: 'M5 2h14v20H5ZM12 6l2 4 3 2-3 2-2 4-2-4-3-2 3-2ZM8 5h1M15 19h1',
  supply: 'M5 8h14v13H5ZM3 5h18v3H3ZM12 8v13M8 5C2 0 12 0 12 5c0-5 10-5 4 0',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Zm15 0a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.1-3.5c0-.44-.05-.87-.13-1.3l2.02-1.57-2-3.46-2.38.96a7 7 0 0 0-2.25-1.3L14 2h-4l-.36 2.33a7 7 0 0 0-2.25 1.3l-2.38-.96-2 3.46 2.02 1.57A7 7 0 0 0 4.9 12c0 .44.05.87.13 1.3L3 14.87l2 3.46 2.38-.96a7 7 0 0 0 2.25 1.3L10 22h4l.36-2.33a7 7 0 0 0 2.25-1.3l2.38.96 2-3.46-2.02-1.57c.08-.43.13-.86.13-1.3Z',
}
export function tableIcon(name) {
  name = SYMBOL_ALIASES[name] || name
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'ah-icon')
  if (Object.hasOwn(FILLED_ICONS, name)) {
    // 生命/理智：实心矢量剪影（偶奇填充保留原插画的镂空），不再缩放位图蒙版。
    svg.classList.add('ah-symbol-vector', 'ah-symbol-' + name)
    svg.dataset.gameSymbol = name
    const path = document.createElementNS(svg.namespaceURI, 'path')
    path.setAttribute('d', FILLED_ICONS[name])
    path.setAttribute('fill', 'currentColor')
    path.setAttribute('fill-rule', 'evenodd')
    svg.append(path)
    return svg
  }
  if (Object.hasOwn(CARD_GLYPHS, name)) {
    svg.classList.add('ah-game-symbol')
    svg.dataset.gameSymbol = name
    const glyph = document.createElementNS(svg.namespaceURI, 'text')
    glyph.setAttribute('x', '12'); glyph.setAttribute('y', '12')
    glyph.setAttribute('text-anchor', 'middle'); glyph.setAttribute('dominant-baseline', 'central')
    glyph.setAttribute('font-family', symbolFont(name)); glyph.setAttribute('font-size', '22')
    glyph.textContent = CARD_GLYPHS[name]
    svg.append(glyph)
    return svg
  }
  const path = document.createElementNS(svg.namespaceURI, 'path')
  path.setAttribute('d', paths[name] || paths.star); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.65'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round')
  svg.append(path); return svg
}
export const classIcon = klass => ({ guardian: 'guardian', seeker: 'seeker', mystic: 'mystic', rogue: 'rogue', survivor: 'survivor', neutral: 'neutral', mythos: 'eye' })[String(klass).toLowerCase()] || 'neutral'
export function tableCounter(h, kind, label, value) {
  return h('span', { className: 'ah-dock-token ah-counter-' + kind, 'aria-label': `${label} ${value}`, title: label },
    h('span', { className: 'ah-counter-face' }, tableIcon(kind), h('strong', {}, String(value))), h('small', {}, label))
}

// 第 127 轮：剧情标记的卡号由 web/ui-cards.js 声明。
import { UI_CARDS } from './ui-cards.js'

export function cardAttachmentReferences(card = {}) {
  const storyCode = role => UI_CARDS.story[role]
  const references = []
  for (const value of [card.attachedTreacheries, card.attachedCards, card.attachments, card.attached]) {
    if (Array.isArray(value)) references.push(...value)
  }
  const hasCode = code => references.some(item => (typeof item === 'string' ? item : item?.code) === code)
  if (card.smiteTheWickedSeat != null && !hasCode(storyCode('smiteTheWicked'))) {
    references.push({ code: storyCode('smiteTheWicked'), ownerSeat: card.smiteTheWickedSeat })
  }
  if (card.searchingForIzzieSeat != null && !hasCode(storyCode('searchingForIzzie'))) {
    references.push({ code: storyCode('searchingForIzzie'), ownerSeat: card.searchingForIzzieSeat })
  }
  if (card.bindMonster?.code && !hasCode(card.bindMonster.code)) references.push(card.bindMonster)
  if (card.snareTrap?.code && !hasCode(card.snareTrap.code)) references.push(card.snareTrap)
  // The Miskatonic Museum tracks Shadow-spawned as a flag plus a resource
  // count instead of an attachment array; derive the card so it and its
  // resource tokens stay visible.
  if (card.shadowSpawned && !hasCode(storyCode('shadowSpawned'))) {
    const code = storyCode('shadowSpawned')
    references.push({ code, originalCode: code, resources: card.shadowResources || 0 })
  }
  return references
}

// Enemy damage is its attack value; only damageTaken is a token on that card.
export function cardMarkerData(card, { enemy = false, attachmentCount } = {}) {
  const counterType = {
    clue: ['clue', t('table.marker.clue')], clues: ['clue', t('table.marker.clue')],
    horror: ['sanity', t('table.marker.horror')], resource: ['resource', t('table.marker.resource')], resources: ['resource', t('table.marker.resource')],
    doom: ['doom', t('table.marker.doom')], damage: ['health', t('table.marker.damage')],
  }[card.counterType]
  const attached = attachmentCount ?? card.attachmentCount ?? cardAttachmentReferences(card).length
  return [
    ['doom', 'doom', t('table.marker.doom'), card.doom],
    ['damage', 'health', t('table.marker.damage'), enemy ? card.damageTaken : card.damage],
    ['horror', 'sanity', t('table.marker.horror'), enemy ? 0 : card.horror],
    ['clues', 'clue', t('table.marker.clue'), card.clues],
    ['resources', 'resource', t('table.marker.resource'), card.resources],
    ['uses', 'supply', t('table.marker.uses'), card.uses],
    ['counters', counterType?.[0] || 'star', counterType?.[1] || t('table.marker.counter'), card.counters],
    ['attached', 'book', t('table.marker.attached'), attached],
  ].filter(([, , , value]) => Number.isFinite(value) && value > 0)
}

export function placedCardMarkers(h, card, options = {}) {
  const markers = cardMarkerData(card, options)
  if (!markers.length) return null
  return h('span', { className: 'ah-card-markers', 'aria-label': t('table.marker.cardAria') },
    markers.map(([kind, icon, label, value]) => h('span', {
      className: 'ah-card-marker ah-card-marker-' + kind,
      'data-card-marker': kind, title: `${label} ${value}`, 'aria-label': `${label} ${value}`,
    }, tableIcon(icon), h('b', {}, String(value)))))
}
