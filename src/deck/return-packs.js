// These cards join explicit deckbuilding and upgrade pools. The published campaign manifests
// still choose which additional weaknesses to draw during regular campaign setup.
export const returnPlayerCards = Object.freeze([
  '50001', '50002', '50003', '50004', '50005', '50006', '50007', '50008', '50009', '50010',
  '51001', '51002', '51003', '51004', '51005', '51006', '51007', '51008', '51009', '51010',
  '52001', '52002', '52003', '52004', '52005', '52006', '52007', '52008', '52009', '52010',
])

export const returnResearchUpgrades = Object.freeze(['51004', '52004'])
export const returnBuildableCards = Object.freeze(returnPlayerCards.filter(code => !returnResearchUpgrades.includes(code)))
export const returnWeaknesses = Object.freeze(['51011', '52011', '52012', '52013'])
