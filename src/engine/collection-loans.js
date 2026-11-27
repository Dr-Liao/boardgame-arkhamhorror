import { filterHand } from './hand-icons.js'
import { splicePlayerDiscard } from './player-zones.js'

const loanPrefix = 'collectionLoan:'

export function collectionLoanCode(id, printedCode) {
  return `${loanPrefix}${id}:${printedCode}`
}

export function collectionLoanPrintedCode(code) {
  if (typeof code !== 'string' || !code.startsWith(loanPrefix)) return null
  return /^collectionLoan:c\d+:([^:]+)$/.exec(code)?.[1] ?? null
}

export function returnCollectionLoans(state) {
  if (!state.collectionLoans?.length) return
  const loans = new Set(state.collectionLoans)
  const isLoan = card => loans.has(typeof card === 'string' ? card : card?.code)
  // A borrowed card can change controllers or move between ordinary and attached zones.
  const removeLoans = (object, handledKeys = []) => {
    if (!object || typeof object !== 'object') return
    for (const [key, value] of Object.entries(object)) {
      if (handledKeys.includes(key)) continue
      if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index--) {
          if (isLoan(value[index])) value.splice(index, 1)
          else removeLoans(value[index])
        }
      } else if (value && typeof value === 'object') {
        if (isLoan(value)) delete object[key]
        else removeLoans(value)
      }
    }
  }
  for (const inv of state.investigators) {
    filterHand(inv, code => !isLoan(code))
    for (let index = inv.discard.length - 1; index >= 0; index--) {
      if (isLoan(inv.discard[index])) splicePlayerDiscard(inv, index, 1)
    }
    removeLoans(inv, ['hand', 'discard'])
  }
  removeLoans({
    locations: state.locations,
    enemies: state.enemies,
    playerLocationAttachments: state.playerLocationAttachments,
    storyAssets: state.storyAssets,
    removedFromGame: state.removedFromGame,
    exiled: state.exiled,
    exiledBySeat: state.exiledBySeat,
    victoryDisplay: state.victoryDisplay,
    scenarioZones: state.scenarioZones,
    beneath: state.scenarioFlags?.mechanics?.beneath,
    bondedSets: state.bondedSets,
  })
  for (const code of loans) if (state.cards) delete state.cards[code]
  delete state.collectionLoans
}
