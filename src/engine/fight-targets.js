import { registeredEntry } from './ability.js'

export function isStoryFightTarget(state, asset) {
  return Boolean(asset && state.storyAssets?.includes(asset)
    && registeredEntry(asset.originalCode || asset.code)?.assetRule?.fightAsEnemy === true)
}

export function storyFightTargets(state) {
  return (state.storyAssets || []).filter(asset => isStoryFightTarget(state, asset))
}

export function fightTargetById(state, id) {
  const enemy = state.enemies.find(candidate => candidate.id === id)
  if (enemy) return enemy
  const asset = state.storyAssets?.find(candidate => candidate.id === id)
  return isStoryFightTarget(state, asset) ? asset : null
}
