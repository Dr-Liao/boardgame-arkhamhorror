import { investigatorConnections } from '../engine/location-connections.js'
import { gridPosition } from '../engine/grid-map.js'
import { cardDef, cardName } from '../engine/card-lookup.js'
import {
  TDC_GLYPHS, crossedTdcRegions, currentTdcRoute, earnedTdcArtifacts, tdcArtifactControllers,
  tdcInteractionSpec, tdcRegionAvailable, tdcTaskFor, tdcTaskOptions, translatedTdcGlyphs,
} from '../engine/tdc-interactions.js'

export function tdcView(state, observer) {
  const spec = tdcInteractionSpec(state)
  if (!spec) return null
  const route = currentTdcRoute(state)
  const crossed = new Set(crossedTdcRegions(state))
  const translated = new Set(translatedTdcGlyphs(state))
  const earned = earnedTdcArtifacts(state)
  const controllers = tdcArtifactControllers(state)
  const canSeeTask = Number.isInteger(observer) && state.campaign.investigators?.[observer]?.id
  const task = canSeeTask ? tdcTaskFor(state, observer) : null
  const taskOption = task && (spec.tasks || []).find(option => option.id === task.option)
  return {
    ...(canSeeTask ? { task: { seat: observer, ...(task ? {
      label: taskOption?.label || task.option, code: taskOption?.code, progress: task.value,
    } : { remaining: tdcTaskOptions(state, observer).length }) } } : {}),
    route,
    routes: (spec.routes || []).map(({ id, label }) => ({ id, label, selected: route === id })),
    regions: (spec.regions || []).map(region => ({
      id: region.id, label: region.label, crossed: crossed.has(region.id),
      available: tdcRegionAvailable(state, region),
    })),
    glyphs: [...TDC_GLYPHS].map(letter => translated.has(letter)
      ? { letter, translated: true, text: spec.glyphs?.[letter] || '' }
      : { letter, translated: false }),
    artifacts: earned.map(code => {
      const holder = controllers.find(item => item.code === code)
      return { code, name: cardName(code), nameEn: cardDef(code)?.name, holder: holder?.seat ?? null }
    }),
    map: state.locations.flatMap(location => {
      const cell = gridPosition(state, location.id)
      return cell ? [{ id: location.id, x: cell.x, y: cell.y,
        connections: investigatorConnections(state, location.id) }] : []
    }),
  }
}
