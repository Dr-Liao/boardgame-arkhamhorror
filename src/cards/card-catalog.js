import { readFileSync } from 'node:fs'
import { ALL_CARDS, CARDS_BY_TYPE, META } from './cards-data.js'
import { EFFECTS } from './card-effects.js'
import { SCENARIO_CARD_IDENTITIES } from './scenarios-data.js'
import { imageDescriptor, imageResolution, LOCALIZED_ART_SOURCE } from '../../presentation/images.js'
import { getAvailability } from '../deck/availability.js'
import { filterCards } from '../../web/card-filters.js'

const sourceFiles = Object.freeze({ en: 'en', 'zh-cn': 'zh-cn', zh: 'zh', legacy: 'legacy' })
const cache = new Map()
function load(relative) {
  if (!cache.has(relative)) cache.set(relative, JSON.parse(readFileSync(new URL(`../../catalog/${relative}.json`, import.meta.url), 'utf8')))
  return cache.get(relative)
}

function scenarioPlayerBack(code) {
  const face = imageDescriptor('01016').back
  return {
    code,
    art: null,
    doubleSided: false,
    hasBackArt: false,
    front: structuredClone(face),
    back: structuredClone(face),
  }
}

const SCENARIO_DISPLAY_CARDS = Object.freeze({
  xcourage: Object.freeze({
    code: 'xcourage',
    name: 'Courage',
    nameZh: '胆量',
    type: 'asset',
    typeName: 'Asset',
    klass: 'neutral',
    factionName: '中立',
    cost: 0,
    sanity: 2,
    icons: Object.freeze({}),
    traits: Object.freeze([]),
    traitsZh: Object.freeze([]),
    text: 'This is a facedown asset with cost 0, 2 sanity, and no skill icons. If it leaves play for any reason, discard it.',
    textZh: '这是一张正面朝下的支援卡，费用为0，神智值为2且无技能图标。当这张卡以任何理由离场时，将它弃掉。',
    effectStatus: 'verified',
    availability: 'strict',
    strictAccepted: true,
    differenceNotes: Object.freeze([]),
    imageNote: '这张剧本支援卡保持正面朝下，并使用通用玩家卡背。',
    images: Object.freeze(scenarioPlayerBack('xcourage')),
  }),
})

function scenarioDisplayCard(code) {
  return Object.hasOwn(SCENARIO_DISPLAY_CARDS, code) ? structuredClone(SCENARIO_DISPLAY_CARDS[code]) : null
}

export function getCatalogCard(code, { includeRaw = true } = {}) {
  if (!Object.hasOwn(ALL_CARDS, code)) return null
  const provenance = load('provenance')[code]
  const raw = includeRaw ? Object.fromEntries(provenance.rawSources.map(source => [source, load(`sources/${sourceFiles[source]}`)[code]])) : undefined
  return structuredClone({ ...ALL_CARDS[code], provenance, ...(includeRaw ? { raw } : {}) })
}

function filteredCards({ type, pack, packCode = pack, faction, klass = faction, cost, xp, campaign, sort, availability, effectStatus, query = '', q = query, code = '', name = '', offset = 0, limit = 50 } = {}) {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new RangeError('目录分页范围无效')
  const normalize = value => String(value || '').trim().toLowerCase()
  const needle = normalize(q)
  const codeNeedle = normalize(code)
  const nameNeedle = normalize(name)
  const source = type ? Object.hasOwn(CARDS_BY_TYPE, type) ? CARDS_BY_TYPE[type] : {} : ALL_CARDS
  const cards = filterCards(Object.values(source),{type,pack:packCode,klass,cost,xp,campaign,sort,search:needle}).filter(card =>
    (!packCode || card.pack === packCode) &&
    (!klass || [card.klass, card.faction2, card.faction3].includes(klass)) &&
    (!availability || getAvailability(card.code).availability === availability) &&
    (!effectStatus || card.effectStatus === effectStatus) &&
    (!codeNeedle || normalize(card.code).includes(codeNeedle)) &&
    (!nameNeedle || [card.name, card.nameZh].some(value => normalize(value).includes(nameNeedle))))
  return { cards, offset, limit }
}

export function queryCatalog(options = {}) {
  const { cards, offset, limit } = filteredCards(options)
  return { resourceVersion: META.resourceVersion, total: cards.length, offset, limit, cards: structuredClone(cards.slice(offset, offset + limit)) }
}

const SUMMARY_FIELDS = Object.freeze([
  'code', 'originalCode', 'name', 'nameZh', 'subname', 'subnameZh', 'type', 'typeName',
  'klass', 'faction2', 'faction3', 'pack', 'packName', 'xp', 'cost', 'localeStatus',
  'effectStatus', 'availability', 'availabilityScope', 'imageStatus', 'doubleSided',
  'linkedCardCode', 'linkedToCode',
])
const DETAIL_FIELDS = Object.freeze([
  'text', 'textZh', 'backName', 'backNameZh', 'backText', 'backTextZh',
  'flavor', 'flavorZh', 'backFlavor', 'backFlavorZh', 'customizationText',
  'customizationTextZh', 'customizationChange', 'customizationChangeZh',
  'factionName', 'subtype', 'slot', 'position', 'quantity', 'deckLimit',
  'encounterCode', 'encounterName', 'encounterPosition', 'stage', 'doom',
  'clues', 'cluesFixed', 'shroud', 'fight', 'evade', 'damage', 'horror',
  'health', 'healthPerInvestigator', 'sanity', 'willpower', 'intellect', 'combat',
  'agility', 'victory', 'vengeance', 'unique', 'permanent', 'exceptional',
  'exile', 'hidden', 'myriad', 'illustrator', 'dataStatus',
])
const IDENTITY_FIELDS = Object.freeze([
  'ruleId', 'originalCode', 'identityStatus', 'approximation', 'identityReason',
  'variant', 'linkedOriginalCode',
])

function pickScalars(value, fields) {
  return Object.fromEntries(fields.filter(field => Object.hasOwn(value, field) &&
    (value[field] === null || ['string', 'number', 'boolean'].includes(typeof value[field])))
    .map(field => [field, value[field]]))
}

function cardSummary(card) {
  const resolution = imageResolution(card.code)
  return {
    ...pickScalars(card, SUMMARY_FIELDS),
    availability: getAvailability(card.code).availability,
    packCode: card.pack || '',
    hasBack: !!(card.doubleSided || card.backText || card.backimagesrc || card.linkedCardCode || card.linkedToCode),
    imageStatus: resolution.imageStatus,
    localizedImage: resolution.localizedFront,
    hasBackArt: resolution.hasBackArt,
    images: imageDescriptor(card.code),
  }
}

const identitiesByCode = new Map()
for (const [scenarioId, categories] of Object.entries(SCENARIO_CARD_IDENTITIES)) {
  for (const [category, entries] of Object.entries(categories)) {
    for (const identity of Object.values(entries)) {
      if (!identitiesByCode.has(identity.originalCode)) identitiesByCode.set(identity.originalCode, [])
      identitiesByCode.get(identity.originalCode).push({ scenarioId, category, ...pickScalars(identity, IDENTITY_FIELDS) })
    }
  }
}

// 关联面在目录中经常只由背面记录指向正面；反向索引让地点正面也能取到
// 背面的名称、规则与剧情文字。直接声明始终优先于反向关系。
const reverseLinkedCodes = new Map()
for (const card of Object.values(ALL_CARDS)) {
  for (const linkedCode of new Set([card.linkedCardCode, card.linkedToCode].filter(Boolean))) {
    if (!Object.hasOwn(ALL_CARDS, linkedCode) || reverseLinkedCodes.has(linkedCode)) continue
    reverseLinkedCodes.set(linkedCode, card.code)
  }
}

export function getCatalogCardView(code) {
  const scenarioCard = scenarioDisplayCard(code)
  if (scenarioCard) return scenarioCard
  if (!Object.hasOwn(ALL_CARDS, code)) return null
  const card = ALL_CARDS[code]
  const view = { ...cardSummary(card), ...pickScalars(card, DETAIL_FIELDS) }
  for (const field of ['traits', 'traitsZh', 'slots']) {
    view[field] = Array.isArray(card[field]) ? card[field].filter(value => typeof value === 'string') : []
  }
  view.icons = pickScalars(card.icons || {}, ['willpower', 'intellect', 'combat', 'agility', 'wild'])
  view.effectNote = Object.hasOwn(EFFECTS, code) && typeof EFFECTS[code].note === 'string' ? EFFECTS[code].note : ''
  view.scenarioIdentities = structuredClone(identitiesByCode.get(code) || [])
  view.differenceNotes = [...new Set([view.effectNote, ...view.scenarioIdentities.map(identity => identity.identityReason)].filter(Boolean))]
  view.imageNote = '默认 CDN 卡图首次显示后会按资源包目录缓存到本地；候选路径不代表远程已存在，中文缺图会回退英文或文字。'
  view.strictAccepted = getAvailability(code).strictAccepted
  return view
}

export function getLinkedCatalogCardView(code) {
  if (Object.hasOwn(SCENARIO_DISPLAY_CARDS, code)) return null
  if (!Object.hasOwn(ALL_CARDS, code)) return null
  const card = ALL_CARDS[code]
  const linkedCode = card.linkedCardCode || card.linkedToCode || reverseLinkedCodes.get(code)
  return linkedCode ? getCatalogCardView(linkedCode) : null
}

export function queryCatalogView(options = {}) {
  const { cards, offset, limit } = filteredCards(options)
  if (!options.sort) cards.sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
  return { total: cards.length, offset, limit, cards: cards.slice(offset, offset + limit).map(cardSummary) }
}

export function getCatalogMeta() {
  const groups = { types: new Map(), packs: new Map(), classes: new Map(), effectStatuses: new Map(), availabilityStatuses: new Map() }
  function add(group, code, name) {
    if (!code) return
    if (!group.has(code)) group.set(code, { code, name: name || code, count: 0 })
    group.get(code).count++
  }
  for (const card of Object.values(ALL_CARDS)) {
    add(groups.types, card.type, card.typeName)
    add(groups.packs, card.pack, card.packName)
    for (const klass of new Set([card.klass, card.faction2, card.faction3].filter(Boolean))) add(groups.classes, klass)
    add(groups.effectStatuses, card.effectStatus)
    add(groups.availabilityStatuses, getAvailability(card.code).availability)
  }
  return { total: META.total, images: { localizedLanguage: 'zh', source: { ...LOCALIZED_ART_SOURCE }, verifiedRemoteImages: 0 }, ...Object.fromEntries(Object.entries(groups).map(([key, group]) =>
    [key, [...group.values()].sort((a, b) => a.code < b.code ? -1 : a.code > b.code ? 1 : 0)])) }
}
