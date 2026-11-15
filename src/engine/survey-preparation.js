import { assertFields, integer } from './mechanic-state.js'

const validId = value => typeof value === 'string' && value.length > 0
const active = inv => !inv.defeated && !inv.resigned && !inv.storyInvestigator
const inPlayFields = [
  'id', 'code', 'originalCode', 'ownerSeat', 'controllerSeat', 'exhausted', 'damage', 'horror',
  'doom', 'clues', 'uses', 'usesType', 'useTokens', 'counters', 'resources', 'ready', 'traits',
  'health', 'sanity', 'slots', 'unique', 'permanent', 'returnCluesOnLeave',
]
const counts = ['damage', 'horror', 'doom', 'clues', 'uses', 'counters', 'resources']

export function normalizeSurveyPreparation(spec) {
  if (spec == null) return null
  assertFields(spec, ['destinations', 'resolutions'])
  for (const key of ['destinations', 'resolutions']) {
    const values = spec[key]
    if (key === 'resolutions' && values == null) continue
    if (!Array.isArray(values) || !values.length || !values.every(validId) || new Set(values).size !== values.length) {
      throw new TypeError('无效勘察整备章节或结局')
    }
  }
  return structuredClone(spec)
}

const startingAssets = rule => rule.startsWith == null ? [] : [rule.startsWith].flat()
const handLimit = rule => rule.openingHandSize ?? 5

function assetSnapshot(asset) {
  return Object.fromEntries(inPlayFields.filter(key => asset[key] != null).map(key => [key, structuredClone(asset[key])]))
}

export function prepareSurvey(state, deps) {
  const spec = normalizeSurveyPreparation(state.scenario?.mechanics?.survey)
  if (!spec || spec.resolutions && !spec.resolutions.includes(state.resolution)) return false
  if (state.campaign.surveyPreparation) throw new Error('已有待使用的勘察整备')
  const seats = {}
  for (const inv of state.investigators.filter(active)) {
    const record = state.campaign.investigators[inv.seat]
    if (!record) continue
    const rule = deps.investigatorRule(inv.code) || {}
    const picked = inv.assets.filter(asset => startingAssets(rule).includes(asset.code) || deps.cardDef(asset.code)?.permanent)
    const others = inv.assets.filter(asset => !picked.includes(asset))
    if (others.length) {
      const id = others.length === 1 ? others[0].id : deps.choose({
        kind: 'asset', source: state.scenario.id, seat: inv.seat, prompt: '选择保留至下一次勘察的支援。',
        options: others.map(asset => ({ id: asset.id, cardCode: asset.code, label: deps.cardDef(asset.code)?.name || asset.code })),
      })
      const asset = others.find(item => item.id === id)
      if (!asset) throw new RangeError('无效整备支援')
      picked.push(asset)
    }
    const hand = [...inv.hand]
    while (hand.length > handLimit(rule)) {
      const choice = deps.choose({ kind: 'card', source: state.scenario.id, seat: inv.seat, prompt: '弃牌至起始手牌数量。',
        options: hand.map((code, index) => ({ id: String(index), cardCode: code, label: deps.cardDef(code)?.name || code })) })
      const index = hand.findIndex((_, position) => String(position) === choice)
      if (index < 0) throw new RangeError('无效整备弃牌')
      hand.splice(index, 1)
    }
    const resourceLimit = record.deck.filter(code => deps.cardDef(code)?.permanent)
      .reduce((total, code) => Math.max(0, total + (deps.entryOf(code)?.startingResources ?? 0)), 5)
    const looseClues = others.filter(asset => !picked.includes(asset)).reduce((sum, card) => sum + (card.clues || 0), 0)
    seats[inv.seat] = { identity: record.id, hand, assets: picked.map(assetSnapshot),
      resources: Math.min(inv.resources, resourceLimit), clues: inv.clues + looseClues }
  }
  const parcel = { version: 1, source: state.scenario.id, destinations: spec.destinations, seats }
  validateSurveyPreparation(state, parcel)
  state.campaign.surveyPreparation = parcel
  state.campaign.upgradesAllowed = false
  return true
}

export function surveyForDestination(state, id) {
  const survey = state.campaign?.surveyPreparation
  return survey?.destinations.includes(id) ? survey : null
}

export function surveyForInvestigator(state, inv, survey) {
  const parcel = survey?.seats[inv.seat]
  const record = state.campaign.investigators[inv.seat]
  return parcel && record?.id === parcel.identity && record.status === 'active' ? parcel : null
}

export function deckAfterSurvey(state, inv, deck, survey) {
  const parcel = surveyForInvestigator(state, inv, survey)
  const reserved = [...(parcel?.hand || [])]
  for (const other of state.investigators) {
    const assets = surveyForInvestigator(state, other, survey)?.assets || []
    reserved.push(...assets.filter(asset => (asset.ownerSeat ?? other.seat) === inv.seat).map(asset => asset.originalCode || asset.code))
  }
  const remaining = [...deck]
  for (const code of reserved) {
    const index = remaining.indexOf(code)
    if (index !== -1) remaining.splice(index, 1)
  }
  return remaining
}

export function restoreSurveyInvestigator(inv, parcel, round) {
  inv.resources = parcel.resources
  inv.clues = parcel.clues
  inv.hand = [...parcel.hand]
  inv.assets = parcel.assets.map(asset => ({ ...structuredClone(asset), enteredRound: round }))
  inv.surveyOpening = true
}

export function validateSurveyPreparation(state, parcel = state.campaign?.surveyPreparation) {
  if (parcel == null) return
  assertFields(parcel, ['version', 'source', 'destinations', 'seats'])
  if (parcel.version !== 1 || !validId(parcel.source)) throw new TypeError('无效勘察整备存档')
  normalizeSurveyPreparation({ destinations: parcel.destinations })
  if (!parcel.seats || typeof parcel.seats !== 'object' || Array.isArray(parcel.seats)) throw new TypeError('无效勘察整备座位')
  const assetIds = new Set()
  for (const [seat, snapshot] of Object.entries(parcel.seats)) {
    if (!/^\d+$/.test(seat) || !state.investigators[Number(seat)]) throw new TypeError('无效勘察整备座位')
    assertFields(snapshot, ['identity', 'hand', 'assets', 'resources', 'clues'])
    if (!validId(snapshot.identity) || !Array.isArray(snapshot.hand) || !snapshot.hand.every(validId) || !Array.isArray(snapshot.assets)) {
      throw new TypeError('无效勘察整备牌区')
    }
    integer(snapshot.resources)
    integer(snapshot.clues)
    for (const asset of snapshot.assets) {
      assertFields(asset, inPlayFields)
      if (!validId(asset.id) || !validId(asset.code) || assetIds.has(asset.id)) throw new TypeError('无效勘察整备支援')
      assetIds.add(asset.id)
      for (const counter of counts) if (asset[counter] != null) integer(asset[counter])
      for (const key of ['ownerSeat', 'controllerSeat']) {
        if (asset[key] != null && (!Number.isSafeInteger(asset[key]) || !state.investigators[asset[key]])) {
          throw new TypeError('无效勘察整备支援归属')
        }
      }
    }
  }
}
