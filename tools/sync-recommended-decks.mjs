// Run from the Mod with node tools/sync-recommended-decks.mjs [investigator codes...].
import { readFile, writeFile } from 'node:fs/promises'
import { deckBuilderData } from '../src/deck/deckbuilding.js'
import { findArkhamDbRecommendation } from '../src/integration/arkhamdb-recommendation.js'

const target = new URL('../src/integration/recommended-decks.json', import.meta.url)
const requested = process.argv.slice(2)
const investigators = deckBuilderData().investigators.filter(({ code }) => !requested.length || requested.includes(code))
if (requested.some(code => !investigators.some(inv => inv.code === code))) throw new Error('Unknown investigator')

let decks = {}
try { decks = JSON.parse(await readFile(target, 'utf8')) } catch (error) {
  if (error.code !== 'ENOENT') throw error
}
for (let i = 0; i < investigators.length; i += 3) {
  await Promise.all(investigators.slice(i, i + 3).map(async inv => {
    try {
      const deck = await findArkhamDbRecommendation(inv.code)
      if (deck) decks[inv.code] = deck
      console.log(inv.code, inv.name, deck?.id ?? 'No matching deck')
    } catch (error) {
      console.error(inv.code, inv.name, error.cause?.code || error.message)
      process.exitCode = 1
    }
  }))
  const ordered = Object.fromEntries(Object.entries(decks).sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(target, JSON.stringify(ordered, null, 2) + '\n')
}
