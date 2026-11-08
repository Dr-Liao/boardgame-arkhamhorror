import { ALL_CARDS } from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/src/cards/cards-data.js'
import * as peaks from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/toTheForbiddenPeaks/index.js'
import * as city from 'file:///G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/scenarios/cityOfTheElderThings/index.js'
const out = {}
out.peaksDeck = peaks.scenario.encounterDeck.length
out.cityDeck = city.scenario.encounterDeck.length
out.peaksTreachery08610 = peaks.scenario.treacheries['08610']
out.cityTreachery08644 = city.scenario.treacheries['08644']
const byCode = k => Object.entries(ALL_CARDS).filter(([, c]) => c.encounterCode === k && ['enemy','treachery'].includes(c.type))
const countGroup = k => byCode(k).reduce((s, [, c]) => s + (c.quantity || 1), 0)
for (const g of ['to_the_forbidden_peaks','deadly_weather','elder_things','hazards_of_antarctica','nameless_horrors','tekelili','city_of_the_elder_things','miasma','penguins','shoggoths','locked_doors','creatures_in_the_ice','silence_and_mystery','chilling_cold']) out['group:' + g] = countGroup(g)
const entry = async (dir, code) => (await import('file:///G:/boardgame-hall-ai/games/arkhamhorror/src/cards/encounter-entries/edgeOfTheEarth/' + dir + '/' + code + '.js')).default
for (const code of ['08610','08611','08612','08613']) { try { out['peaksEntry:'+code] = await entry('toTheForbiddenPeaks', code) } catch (e) { out['peaksEntry:'+code] = 'ERR' } }
for (const code of ['08644','08645','08646','08647']) { try { out['cityEntry:'+code] = await entry('cityOfTheElderThings', code) } catch (e) { out['cityEntry:'+code] = 'ERR' } }
console.log(JSON.stringify(out, null, 1).slice(0, 8000))
