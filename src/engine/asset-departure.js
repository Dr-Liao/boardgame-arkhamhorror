import { registeredEntry } from './ability.js'
import { ALL_CARDS } from '../cards/cards-data.js'

const printedAsset = asset => ALL_CARDS[asset.originalCode || asset.code] || ALL_CARDS[asset.code]

export function canLeaveControlledAsset(state, inv, asset) {
  if (!asset || !inv?.assets.includes(asset)) return false
  const entry = registeredEntry(asset.code)
  return !printedAsset(asset)?.permanent && !asset.cannotLeavePlay
    && !entry?.cannotLeavePlay && !entry?.flags?.partner
    && entry?.cannotLeavePlayWhile?.(state, inv, asset) !== true
}

export function canDiscardControlledAsset(state, inv, asset) {
  if (!canLeaveControlledAsset(state, inv, asset)) return false
  const entry = registeredEntry(asset.code)
  return !entry?.cannotDiscard && !entry?.passive?.cannotDiscard
}

export function discardControlledAsset(state, inv, asset, events, leaveAsset, info) {
  if (!canDiscardControlledAsset(state, inv, asset)) {
    if (info && asset && inv?.assets.includes(asset)) {
      const card = printedAsset(asset)
      info(state, events, `「${card?.nameZh || card?.name || asset.code}」当前不能离场。`)
    }
    return false
  }
  if (leaveAsset(state, inv, asset, events) === false || inv.assets.includes(asset)) return false
  if (!asset.removedFromGame && !asset.returnedToHand) inv.discard.push(asset.code)
  return true
}
