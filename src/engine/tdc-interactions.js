import { claimProgress, progressFor, progressOptions } from '../campaign/progress-tracks.js'
import { recordSetAdd, recordSetValues } from '../campaign/record-sets.js'
import { cardDef, cardName } from './card-lookup.js'
import { canRelocateGridCells, relocateGridCells } from './grid-map.js'
import { selectMechanic } from './mechanic-choices.js'

export const TDC_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const track = 'tdcTask'
const routeKey = 'tdcRoute'
const regionKey = 'tdcCrossedRegions'
const glyphKey = 'tdcGlyphs'
const artifactKey = 'tdcArtifactsEarned'
const active = inv => inv && !inv.defeated && !inv.resigned
export const tdcInteractionSpec = state => state.scenario?.mechanics?.tdc
export const currentTdcRoute = state => recordSetValues(state.campaign, routeKey)[0] ?? null
export const crossedTdcRegions = state => recordSetValues(state.campaign, regionKey)
export const translatedTdcGlyphs = state => recordSetValues(state.campaign, glyphKey)
export const earnedTdcArtifacts = state => recordSetValues(state.campaign, artifactKey)
export const tdcTaskFor = (state, seat) => progressFor(state.campaign, track, seat)
export const tdcTaskOptions = (state, seat) => progressOptions(state.campaign, track, seat, tdcInteractionSpec(state)?.tasks || [])
export const tdcRegionAvailable = (state, region) => !crossedTdcRegions(state).includes(region.id)
  && (!region.route || currentTdcRoute(state) === region.route)

export function tdcArtifactControllers(state) {
  const earned = new Set(earnedTdcArtifacts(state))
  return state.investigators.flatMap(inv => inv.assets.flatMap(asset => {
    const code = asset.originalCode || asset.code
    return earned.has(code) ? [{ id: asset.id, code, seat: inv.seat }] : []
  }))
}

const candidate = row => ({ value: row.id, label: row.label, ...(row.code ? { cardCode: row.code } : {}) })
function choose(state, seat, operation, prompt, candidates, { source, optional = true, stage } = {}) {
  if (!candidates.length) return null
  return selectMechanic(state, seat, { operation, prompt, candidates, optional, source, stage })?.[0] ?? null
}

export function chooseTdcArtifactRecipient(state, seat, targets, source, optional = true) {
  return choose(state, seat, 'tdcArtifact', '选择文物的接管调查员', targets.map(target => ({
    value: target.seat, label: target.name, uiKey: `investigator:${target.seat}`,
  })), { source, optional, stage: 'recipient' })
}

export function createTdcInteractions(state, deps) {
  const spec = tdcInteractionSpec(state)
  const lead = seat => active(state.investigators[seat]) && seat === state.campaign.leadSeat
  return {
    claimTask(seat, options) {
      if (!spec || !active(state.investigators[seat])) return false
      const id = choose(state, seat, 'tdcTask', '选择你的任务', tdcTaskOptions(state, seat).map(candidate), options)
      return id != null && claimProgress(state.campaign, track, seat, id)
    },
    chooseRoute(seat, options) {
      if (!spec || !lead(seat) || currentTdcRoute(state)) return false
      const id = choose(state, seat, 'tdcRoute', '选择远征路线', (spec.routes || []).map(candidate), { ...options, stage: 'route' })
      return id != null && recordSetAdd(state.campaign, routeKey, id)
    },
    crossRegion(seat, options) {
      if (!spec || !lead(seat)) return false
      const regions = (spec.regions || []).filter(region => tdcRegionAvailable(state, region))
      const id = choose(state, seat, 'tdcRoute', '选取要划除的地图区域', regions.map(candidate), { ...options, stage: 'region' })
      return id != null && recordSetAdd(state.campaign, regionKey, id)
    },
    translateGlyph(seat, eligible, options) {
      if (!spec || !active(state.investigators[seat])) return false
      const known = new Set(translatedTdcGlyphs(state))
      const choices = [...new Set(eligible)].filter(letter => letter.length === 1 && TDC_GLYPHS.includes(letter)
        && Object.hasOwn(spec.glyphs || {}, letter) && !known.has(letter))
      const letter = choose(state, seat, 'tdcGlyph', '选择要翻译的字形', choices.map(letter => ({ value: letter, label: letter })), options)
      return letter != null && recordSetAdd(state.campaign, glyphKey, letter)
    },
    assignArtifact(seat, options) {
      if (!spec || !lead(seat)) return false
      const assigned = new Set([...tdcArtifactControllers(state).map(row => row.code),
        ...(state.storyAssets || []).map(asset => asset.originalCode || asset.code)])
      const choices = earnedTdcArtifacts(state).filter(code => !assigned.has(code) && cardDef(code)?.type === 'asset')
      const code = choose(state, seat, 'tdcArtifact', '选择已获得的文物', choices.map(code => ({
        value: code, label: cardName(code), cardCode: code,
      })), options)
      if (code == null) return false
      const targets = state.investigators.filter(active)
      const recipient = chooseTdcArtifactRecipient(state, seat, targets, options?.source, options?.optional)
      return recipient != null && !!deps.giveArtifact?.(recipient, code)
    },
    relocate(seat, plans, options = {}) {
      if (!spec || !active(state.investigators[seat])) return false
      const policies = { protectStoryAssets: options.protectStoryAssets ?? false }
      const choices = plans.filter(plan => canRelocateGridCells(state, plan.changes, policies))
      const id = choose(state, seat, 'tdcMap', '选择地点重排方案', choices.map(candidate), options)
      return id != null && relocateGridCells(state, choices.find(plan => plan.id === id).changes, policies)
    },
  }
}
