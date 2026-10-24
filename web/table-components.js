// Small monochrome UI marks stay crisp at every zoom level.
// 标记文案在 cardMarkerData()/placedCardMarkers() 调用期取 t()（模块顶层不调用 t()）。
import { t } from './i18n.js'
const paths = {
  health: 'M12 20 3.6 11.6C-1 5 7 1 12 7c5-6 13-2 8.4 4.6Z',
  sanity: 'M12 3 3 12l9 9 9-9ZM12 7v10M7 12h10',
  clue: 'M15.5 15.5 21 21M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z',
  resource: 'M12 2 21 7v10l-9 5-9-5V7ZM3 7l9 5 9-5M12 12v10',
  action: 'm14 2-9 12h6l-1 8 9-12h-6Z',
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
}
export function tableIcon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('class', 'ah-icon')
  const path = document.createElementNS(svg.namespaceURI, 'path')
  path.setAttribute('d', paths[name] || paths.star); path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor'); path.setAttribute('stroke-width', '1.65'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round')
  svg.append(path); return svg
}
export const classIcon = klass => ({ guardian: 'shield', seeker: 'book', mystic: 'star', rogue: 'sword', survivor: 'leaf', mythos: 'eye' })[String(klass).toLowerCase()] || 'star'
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
