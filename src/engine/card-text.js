import { registeredEntry } from './ability.js'

export function assetTextBlankedExceptForced(asset) {
  return asset?.attachments?.some(card => registeredEntry(card.originalCode || card.code)
    ?.treacheryRule?.blankHostExceptForced) === true
}
