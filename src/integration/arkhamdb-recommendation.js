import { ALL_CARDS } from '../cards/cards-data.js'
import { buildDeckFromList, deckBuilderData, expandedPlayablePool } from '../deck/deckbuilding.js'
import { describeArkhamDbDeck } from './arkhamdb.js'
import { planArkhamDbImport } from '../../web/arkhamdb-import.js'
import recommendedDecks from './recommended-decks.json' with { type: 'json' }

const origin = 'https://arkhamdb.com'
let builder
let playerPool
let packRequest

export async function loadArkhamDbRecommendation(code) {
  const raw = Object.hasOwn(recommendedDecks, code) ? recommendedDecks[code] : await findArkhamDbRecommendation(code)
  return raw ? describeArkhamDbDeck(raw, { kind: 'decklist' }) : null
}

export function planArkhamDbRecommendation(deck, investigatorCode) {
  builder ||= deckBuilderData()
  return planArkhamDbImport(deck, { ...builder, currentCode: investigatorCode })
}

async function get(path, signal, fetchImpl) {
  for (let attempt = 0; ; attempt++) {
    signal.throwIfAborted()
    try {
      const response = await fetchImpl(new URL(path, origin), { signal })
      if (response.ok) return response
      throw new Error('ArkhamDB HTTP ' + response.status + ' ' + path)
    } catch (error) {
      if (signal.aborted || attempt >= 1) throw error
      await new Promise(resolve => setTimeout(resolve, 800))
    }
  }
}

function loadPacks(fetchImpl) {
  return get('/api/public/packs/', AbortSignal.timeout(8000), fetchImpl)
    .then(response => response.json())
    .then(packs => packs.filter(pack => pack.chapter === 1))
}

function getPacks(fetchImpl) {
  if (fetchImpl !== globalThis.fetch) return loadPacks(fetchImpl)
  packRequest ||= loadPacks(fetchImpl)
    .catch(error => { packRequest = undefined; throw error })
  return packRequest
}

async function candidate(id, code, cycle, supportedCycle, request) {
  const raw = await (await request('/api/public/decklist/' + id)).json()
  // ArkhamDB may report null XP for a starting list. Check the cards themselves too.
  if (raw.xp != null && raw.xp !== 0) return null
  const meta = typeof raw.meta === 'string' && raw.meta ? JSON.parse(raw.meta) : raw.meta
  if (Object.entries(meta || {}).some(([key, value]) => {
    if (!value) return false
    if (/^alternate_(front|back)/.test(key)) return true
    // ArkhamDB stores customizable options as index|xp|choice. A planned
    // option with zero checked boxes does not buy an upgrade.
    return key.startsWith('cus_') && (typeof value !== 'string'
      || value.split(',').some(option => !/^\d+\|0(?:\||$)/.test(option)))
  })) return null
  const deck = describeArkhamDbDeck(raw, { kind: 'decklist', id })
  if (deck.investigatorCode !== code || deck.entries.some(entry => {
    const position = supportedCycle(entry.code)
    return position < 1 || position > cycle
  })) return null
  const plan = planArkhamDbRecommendation(deck, code)
  if (!plan.ready || plan.errors.length || plan.codes.some(cardCode => ALL_CARDS[cardCode].xp > 0)) return null
  if (buildDeckFromList(ALL_CARDS[code], plan.codes, { playerPool }).errors.length) return null
  return { id, name: deck.name, investigator_code: code, xp: 0, slots: raw.slots }
}

export async function findArkhamDbRecommendation(code, { signal = AbortSignal.timeout(18000), fetchImpl = globalThis.fetch } = {}) {
  builder ||= deckBuilderData()
  if (!builder.investigators.some(inv => inv.code === code)) return null
  playerPool ||= expandedPlayablePool()
  const packs = await getPacks(fetchImpl)
  const cycles = new Map(packs.map(pack => [pack.code, pack.cycle_position]))
  const supportedCycle = cardCode => Number(cycles.get(ALL_CARDS[cardCode]?.pack)) || Infinity
  const cycle = supportedCycle(code)
  if (!Number.isFinite(cycle) || cycle < 1) return null
  const params = new URLSearchParams({ investigator: code })
  for (const pack of packs.filter(pack => pack.cycle_position >= 1 && pack.cycle_position <= cycle)) {
    params.append('packs[]', pack.id)
  }
  const seen = new Set()
  const request = path => get(path, signal, fetchImpl)
  let failure
  for (let page = 1; page <= 4; page++) {
    const html = await (await request('/decklists/find/' + page + '?' + params)).text()
    const ids = [...new Set(Array.from(html.matchAll(/class="decklist-name" href="\/decklist\/view\/(\d+)\//g), match => match[1]))]
      .filter(id => !seen.has(id))
    if (!ids.length) break
    for (let i = 0; i < ids.length; i += 4) {
      const candidates = await Promise.allSettled(ids.slice(i, i + 4).map(id => candidate(id, code, cycle, supportedCycle, request)))
      signal.throwIfAborted()
      const found = candidates.find(result => result.status === 'fulfilled' && result.value)?.value
      if (found) return found
      failure ||= candidates.find(result => result.status === 'rejected')?.reason
    }
    ids.forEach(id => seen.add(id))
  }
  if (failure) throw failure
  return null
}
