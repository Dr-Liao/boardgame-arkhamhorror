import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { changeChaosBag } from '../../../src/engine/chaos-bag.js'
import { campaignCardChange } from '../../../src/campaign/campaign.js'
import { awardStoryCard } from '../../../src/campaign/campaign-effects.js'
import { requestChoice } from '../../../src/engine/resolution.js'
import { chapterSpecs, locationId as L } from './chapters.js'
import { encounterCards, encounterDeck, printed } from './card-data.js'
import { encounterRules } from './encounter-rules.js'
import { dunwichChaosToken, dunwichChaosAfterTest } from './dunwich-chaos.js'

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const original = card => card.originalCode || card.code
const removeCampaign = (state, code) => {
  for (const record of Object.values(state.campaign.investigators)) {
    if (record.deck.includes(code)) campaignCardChange(state.campaign, record.seat, code, 'remove', state.scenario.id)
  }
}
const scholars = [['02040', 'drHenryArmitage'], ['02061', 'professorWarrenRice'], ['02080', 'drFrancisMorgan']]
export const survivors = [...scholars, ['02217', 'zebulonWhateley'], ['02218', 'earlSawyer']]
export function resolveSurvivors(state) {
  const sacrificed = state.campaign.records.sacrificedToYogSothoth || []
  for (const [code, key] of survivors) if (!sacrificed.includes(code)) {
    state.campaign.records[`${key}SurvivedTheDunwichLegacy`] = true
    awardStoryCard(state, code, 'survivors')
  }
  if (scholars.some(([code]) => !sacrificed.includes(code))) awardStoryCard(state, '02219', 'survivors')
}

export function laterBehavior(id) {
  const spec = chapterSpecs[id]
  return {
    ...encounterRules,
    id,
    setupLocations(state, events, { randomValue, shuffle }) {
      const rng = () => randomValue(state), mix = list => shuffle([...list], rng)
      state.scenarioZones = { setAside: [...spec.aside], removed: [], underLocations: {}, sacrificed: [] }
      const zones = state.scenarioZones, records = state.campaign.records
      state.scenarioFlags = {}
      const chooseVariant = (base, alternatives) => {
        const chosen = alternatives[Math.floor(rng() * alternatives.length)]
        state.locationVariants[L(base)] = { ...structuredClone(state.scenario.locations[L(chosen)]), id: L(base) }
        zones.removed.push(...alternatives.filter(c => c !== chosen))
        return L(base)
      }
      let locations = spec.initial.map(L)
      if (id === 'theMiskatonicMuseum') {
        chooseVariant('02128', ['02128', '02129']); chooseVariant('02130', ['02130', '02131'])
        const exhibits = mix(['02132', '02133', '02134', '02135', '02136'])
        // Array pop is the top of all runtime decks; restricted hall is in bottom three.
        zones.exhibits = [...mix(['02137', ...exhibits.slice(0, 2)]), ...exhibits.slice(2)]
        state.acts = state.acts.filter(a => original(a) !== '02124')
        state.acts[0].objective = { type: 'clues', perInvestigator: 2 / state.numInvestigators }
      } else if (id === 'theEssexCountyExpress') {
        const cars = mix(['02167', '02168', '02169', '02170', '02171', '02172', '02173', '02174']).slice(0, 6)
        const engine = ['02175', '02176', '02177'][Math.floor(rng() * 3)]
        // Stable slot IDs keep the starting location independent of the sampled card.
        const slots = spec.initial
        ;[...cars, engine].forEach((code, i) => {
          state.locationVariants[L(slots[i])] = { ...structuredClone(state.scenario.locations[L(code)]), id: L(slots[i]),
            connections: slots.filter((_, j) => Math.abs(i - j) === 1).map(L), blankDuringSetup: i === 0 }
        })
        zones.train = slots.map(L)
        zones.removed = spec.locations.filter(code => !cars.includes(code) && code !== engine)
      } else if (id === 'bloodOnTheAltar') {
        const pairs = ['02202', '02204', '02206', '02208', '02210', '02212']
        const chosen = pairs.map(base => chooseVariant(base, [base, String(Number(base) + 1).padStart(5, '0')]))
        const removed = mix(chosen).pop()
        locations = [L('02201'), ...chosen.filter(loc => loc !== removed)]
        zones.removed.push(original(state.locationVariants[removed]))
        zones.sacrifices = mix(['02217', '02218', ...scholars.filter(([, key]) => records[`${key}WasKidnapped`]).map(([code]) => code)])
        if (records.theInvestigatorsWereDelayedOnTheirWayToDunwich) state.doom++
      } else if (id === 'undimensionedAndUnseen') {
        locations = spec.initial.map(base => chooseVariant(base, [base, String(Number(base) + 1).padStart(5, '0')]))
        const n = (records.sacrificedToYogSothoth || []).length
        zones.brood = { total: n >= 4 ? 2 : n === 3 ? 3 : n === 2 ? 4 : 5,
          initial: n >= 4 ? [] : n >= 2 ? [L('02244')] : [L('02244'), L('02248')] }
        zones.brood.remaining = zones.brood.total - zones.brood.initial.length
        zones.setAside = [...Array(4).fill('02254'), ...Array(zones.brood.remaining).fill('02255')]
        state.acts[0].objective = { type: 'clues', perInvestigator: 2, atLocation: L('02250') }
        // The investigators must calm or warn the townsfolk and record it.
        if (!records.youCalmedTheTownsfolk && !records.youWarnedTheTownsfolk) {
          const answer = requestChoice(state, { kind: 'story', source: '02236', seat: state.campaign.leadSeat,
            prompt: '敦威治的镇民正陷入恐慌。你们要安抚他们，还是警告他们远离荒野？',
            options: [{ id: 'calm', label: '安抚镇民（记录在战役日志）' }, { id: 'warn', label: '警告镇民（记录在战役日志）' }] })
          if (answer === 'calm') records.youCalmedTheTownsfolk = true
          else records.youWarnedTheTownsfolk = true
        }
      } else if (id === 'whereDoomAwaits') {
        zones.divergingPaths = mix(['02285', '02286', '02287', '02288']).slice(0, 3)
        zones.alteredPaths = mix(['02289', '02290', '02291', '02292']).slice(0, 3)
        const variant = records.theInvestigatorsRestoredSilasBishop ? '02278'
          : records.theInvestigatorsFailedToRecoverTheNecronomicon || records.theNecronomiconWasStolen ? '02279' : '02280'
        state.acts = state.acts.filter(a => !['02278', '02279', '02280'].includes(original(a)) || original(a) === variant)
        state.acts[0].objective = { type: 'clues', perInvestigator: 2 }
        state.acts[2].objective = { type: 'clues', perInvestigator: 2, atLocation: L('02284') }
        state.doom = records.noBroodEscapedIntoTheWild ? 0 : records.broodEscapedIntoTheWild || 0
        if (records.naomiHasTheInvestigatorsBacks) state.investigators[state.campaign.leadSeat].clues++
      } else if (id === 'lostInTimeAndSpace') {
        state.acts[0].objective = { type: 'clues', perInvestigator: 2 }
        state.acts[2].objective = { type: 'clues', perInvestigator: 3, atLocation: L('02321') }
      }
      // Random variants retain slot connections rather than referring to removed twins.
      const slotForCode = code => locations.find(slot => original(state.locationVariants[slot] || state.scenario.locations[slot]) === code)
      if (!zones.train) for (const slot of locations) {
        const def = state.locationVariants[slot] || state.scenario.locations[slot]
        const links = def.connections.map(other => slotForCode(other.slice(8)) || other)
        state.locationVariants[slot] = { ...structuredClone(def), connections: [...new Set(links)] }
      }
      if (id === 'whereDoomAwaits') {
        // The printed backs read "Diverging Path" / "Altered Path"; keep the
        // real path identity hidden until the location is revealed.
        for (const def of Object.values(state.scenario.locations)) {
          const code = original(def)
          if (['02285', '02286', '02287', '02288'].includes(code)) {
            def.hiddenIdentity = true; def.unrevealedActualName = def.name; def.name = '分歧之路'
          } else if (['02289', '02290', '02291', '02292'].includes(code)) {
            def.hiddenIdentity = true; def.unrevealedActualName = def.name; def.name = '异变之路'
          }
        }
      }
      return locations
    },
    setupEnemies(state, events, { spawnEnemy }) {
      for (const loc of state.scenarioZones.brood?.initial || []) {
        const enemy = spawnEnemy(state, '02255', loc, null)
        if (enemy) enemy.health = 1 + state.numInvestigators
      }
      if (id === 'whereDoomAwaits' && state.campaign.records.theInvestigatorsPutSilasBishopOutOfHisMisery) spawnEnemy(state, '02103', L('02283'), null)
    },
    modifyDeck(state, deck) {
      if (id === 'whereDoomAwaits' && state.campaign.records.theInvestigatorsPutSilasBishopOutOfHisMisery) {
        const rest = encounterDeck(encounterCards(['hideous_abominations']))
        rest.splice(rest.indexOf('02103'), 1)
        return [...deck, ...rest]
      }
      if (id === 'bloodOnTheAltar' && state.campaign.records.oBannionGangHasABoneToPickWithTheInvestigators) {
        return [...deck, ...encounterDeck(encounterCards(['naomis_crew']))]
      }
      return deck
    },
    resolveChaosToken(state, inv, token, api) { return dunwichChaosToken(id, state, inv, token, api) },
    resolveEncounter(state, inv, card, api) {
      const code = original(card)
      if (id === 'theMiskatonicMuseum' && code === '02142') {
        const horror = state.enemies.find(enemy => enemy.code === '02141')
        if (horror) horror.shadowSpawned = true
        return true
      }
      if (id === 'whereDoomAwaits' && code === '02297') {
        const paths = state.locations.filter(loc => !loc.traits?.includes('Sentinel Hill'))
        const hills = state.locations.filter(loc => loc.traits?.includes('Sentinel Hill'))
        for (const loc of paths) {
          loc.revealed = false; loc.clues = 0
          const distance = target => {
            const queue = [[loc.id, 0]], seen = new Set([loc.id])
            for (const [next, n] of queue) {
              if (next === target) return n
              for (const neighbor of state.locations.find(item => item.id === next)?.connections || [])
                if (!seen.has(neighbor)) { seen.add(neighbor); queue.push([neighbor, n + 1]) }
            }
            return Infinity
          }
          const minimum = Math.min(...hills.map(hill => distance(hill.id)))
          const nearest = hills.filter(hill => distance(hill.id) === minimum)
          const choose = seat => nearest.length === 1 ? nearest[0].id : api.choose({ kind: 'location', source: code, seat,
            prompt: '选择最近的哨兵山地点。', options: nearest.map(hill => ({ id: hill.id, label: hill.name })) })
          for (const target of active(state).filter(item => item.location === loc.id)) api.moveInvestigator(target.seat, choose(target.seat))
          for (const enemy of state.enemies.filter(item => item.location === loc.id)) api.moveEnemy(enemy, choose(state.campaign.leadSeat))
        }
        // The physical card backs still distinguish Diverging Paths from
        // Altered Paths. Shuffle identities only within each matching back.
        const pathGroups = [
          [new Set(['02285', '02286', '02287', '02288']), '02285'],
          [new Set(['02289', '02290', '02291', '02292']), '02289'],
        ]
        const classified = new Set(pathGroups.flatMap(([codes]) => [...codes]))
        pathGroups.push([null, null])
        for (const [codes, artCode] of pathGroups) {
          const group = paths.filter(loc => codes ? codes.has(original(loc)) : !classified.has(original(loc)))
          const shuffled = group.map(loc => structuredClone(loc))
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(api.random() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
          }
          group.forEach((loc, i) => {
            const slot = { id: loc.id, connections: loc.connections }
            for (const key of Object.keys(loc)) delete loc[key]
            Object.assign(loc, shuffled[i], slot)
            loc.hiddenIdentity = true
            if (artCode) loc.artCode = artCode
            loc.unrevealedActualName = loc.name; loc.name = '未知小径'
            state.locationVariants[loc.id] = { ...structuredClone(loc) }
          })
        }
        return false
      }
      if (['bloodOnTheAltar', 'undimensionedAndUnseen'].includes(id) && code === '02089') {
        const loc = state.locations.find(item => item.id === inv.location)
        loc.sordidAndSilent = (loc.sordidAndSilent || 0) + 1
        return true
      }
      if (id === 'theMiskatonicMuseum') {
        const horror = state.enemies.find(enemy => enemy.code === '02141')
        if (code === '02143') {
          if (!horror) api.drawEncounter(inv.seat)
          else {
            horror.exhausted = false
            // The printed ability readies and engages the Horror only where it
            // already is; it does not teleport across the museum.
            if (horror.location === inv.location) {
              api.engage(horror, inv.seat)
              for (const target of active(state).filter(other => other.location === inv.location)) api.attack(horror, target)
            }
          }
          return false
        }
        if (code === '02145') {
          api.test(inv.seat, 'intellect', 3, result => {
            if (!result.success) inv.actionsLeft = Math.max(0, inv.actionsLeft - Math.max(0, 3 - result.value))
          })
          return false
        }
        if (code === '02144') {
          api.test(inv.seat, 'willpower', 3 + (horror?.location === inv.location ? 2 : 0), result => {
            if (result.success) return
            const choice = api.choose({ kind: 'encounter', source: code, seat: inv.seat,
              prompt: '通往异界的道路：弃掉牌库顶 5 张，或受到 1 点直接伤害并使每位盟友受到 1 点伤害。',
              options: [{ id: 'mill', label: '弃掉牌库顶 5 张' }, { id: 'damage', label: '承受直接伤害并伤害盟友' }] })
            if (choice === 'mill') api.discardTop(inv.seat, 5)
            else {
              api.directDamage(inv.seat, 1)
              for (const ally of [...inv.assets].filter(asset => (ALL_CARDS[asset.code]?.traits || [])
                .some(trait => String(trait).toLowerCase() === 'ally'))) {
                api.damageAsset(inv.seat, ally.id, 1)
              }
            }
          })
          return false
        }
        if (code === '02146') {
          if (horror) horror.doom = (horror.doom || 0) + 1
          else {
            const spawned = summonHorror(state, inv.location, api)
            api.engage(spawned, inv.seat)
          }
          api.shuffleEncounterDeck()
          return false
        }
      }
      if (id === 'bloodOnTheAltar') {
        if (code === '02220') {
          const skill = api.choose({ kind: 'skill', source: code, seat: inv.seat, prompt: '绑架：选择意志或敏捷进行检定（4）。',
            options: [{ id: 'willpower', label: '意志' }, { id: 'agility', label: '敏捷' }] })
          api.test(inv.seat, skill, 4, result => {
            if (result.success) { state.encounterDiscard.push(code); return }
            const allies = inv.assets.filter(asset => ALL_CARDS[asset.code]?.traits?.includes('Ally'))
            if (!allies.length) { api.damage(inv.seat, 2); state.encounterDiscard.push(code); return }
            const chosen = api.choose({ kind: 'target', source: code, seat: inv.seat, prompt: '选择被绑架的盟友。',
              options: allies.map(asset => ({ id: asset.id, label: ALL_CARDS[asset.code]?.nameZh || asset.code })) })
            state.scenarioZones.sacrifices.push(api.removeAsset(inv.seat, chosen))
            state.scenarioFlags.kidnapped = (state.scenarioFlags.kidnapped || 0) + 1
          })
          return true
        }
        if (code === '02221') {
          const candidates = active(state)
          const seat = candidates.length === 1 ? String(candidates[0].seat) : api.choose({
            kind: 'investigator', source: code, seat: inv.seat, prompt: '选择承受灵魂之歌的调查员。',
            options: candidates.map(target => ({ id: String(target.seat), label: target.name })),
          })
          const chosen = candidates.find(target => String(target.seat) === seat)
          if (!chosen) throw new Error('必须选择一名调查员')
          api.threat(chosen.seat, code)
          api.drawEncounter(inv.seat)
          return { placed: true, surgeHandled: true }
        }
        if (code === '02222') {
          api.test(inv.seat, 'intellect', 3, result => {
            if (!result.success) {
              const loc = state.locations.find(item => item.id === inv.location)
              if (loc) loc.clues += state.numInvestigators >= 3 ? 2 : 1
            }
          })
          return false
        }
        if (code === '02223') {
          api.test(inv.seat, 'willpower', 3, result => {
            if (!result.success) api.horror(inv.seat, Math.max(0, 3 - result.value))
          })
          return false
        }
      }
      if (id === 'theEssexCountyExpress' && code === '02178') {
        api.discardTop(inv.seat, 3)
        return false
      }
      if (id === 'theEssexCountyExpress' && code === '02180') {
        api.test(inv.seat, 'willpower', 3, result => {
          if (!result.success) { inv.steamImmobileRound = state.round; api.assetsFirstDamage(inv.seat, 2) }
        })
        return false
      }
      if (id === 'theEssexCountyExpress' && code === '02181') {
        for (const target of active(state).filter(other => other.location === inv.location)) {
          target.actionsLeft = Math.max(0, target.actionsLeft - 1)
          if (target.damage >= 4 && target.assets.length) {
            const choice = api.choose({ kind: 'target', source: code, seat: target.seat,
              prompt: '铁轨断裂：选择弃掉一张你控制的支援。',
              options: target.assets.map(asset => ({ id: asset.id, label: ALL_CARDS[asset.code]?.nameZh || asset.code })) })
            api.discardAsset(target.seat, choice)
          }
        }
        return false
      }
      if (id === 'whereDoomAwaits' && code === '02296') {
        for (const target of active(state)) api.discardTop(target.seat, 3)
        for (const target of active(state).filter(other => state.locations.find(loc => loc.id === other.location)
          ?.traits?.some(trait => trait.toLowerCase() === 'altered'))) {
          const weaknesses = target.discard.filter(item => ['weakness', 'basicweakness'].includes(ALL_CARDS[item]?.subtype))
          target.discard = target.discard.filter(item => !weaknesses.includes(item))
          target.deck.push(...weaknesses)
          for (let i = target.deck.length - 1; i > 0; i--) {
            const j = Math.floor(api.random() * (i + 1))
            ;[target.deck[i], target.deck[j]] = [target.deck[j], target.deck[i]]
          }
        }
        return false
      }
      if (id === 'whereDoomAwaits' && code === '02298') {
        for (const target of active(state).filter(other => state.locations.find(loc => loc.id === other.location)
          ?.traits?.some(trait => trait.toLowerCase() === 'sentinel hill'))) {
          api.test(target.seat, 'willpower', 4, result => { if (!result.success) api.damage(target.seat, 2) })
        }
        return false
      }
      if (id === 'lostInTimeAndSpace' && code === '02331') {
        const loc = state.locations.find(item => item.id === inv.location)
        if (loc?.traits?.some(trait => trait.toLowerCase() === 'extradimensional')) {
          discardEncounterLocation(state, loc, api)
          api.damage(inv.seat, 1)
        } else api.damage(inv.seat, 2)
        return false
      }
      if (id === 'lostInTimeAndSpace' && code === '02332') {
        const loc = this.drawEncounterLocation(state, inv.seat, api)
        if (loc) { api.moveInvestigator(inv.seat, loc.id); this.investigatorMovedByEncounterCard(state, inv, api) }
        return false
      }
      if (id === 'lostInTimeAndSpace' && code === '02333') {
        const count = state.locations.filter(loc => loc.traits?.some(trait => trait.toLowerCase() === 'extradimensional')).length
        if (!count) api.drawEncounter(inv.seat)
        else api.test(inv.seat, 'willpower', Math.min(5, count), result => {
          if (!result.success) api.horror(inv.seat, Math.max(0, Math.min(5, count) - result.value))
        })
        return false
      }
      if (id !== 'undimensionedAndUnseen' || !['02256', '02257', '02258', '02259'].includes(code))
        return encounterRules.resolveEncounter(state, inv, card, api)
      const brood = state.enemies.filter(enemy => enemy.code === '02255')
      if (code === '02256') {
        if (!brood.length) return false
        const enemyId = brood.length === 1 ? brood[0].id : api.choose({
          kind: 'target', source: code, seat: inv.seat, prompt: '选择一只子嗣附属「高耸的野兽」。',
          options: brood.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${state.locations.find(loc => loc.id === enemy.location)?.name || enemy.location}）` })),
        })
        const chosen = brood.find(enemy => enemy.id === enemyId)
        if (!chosen) throw new Error('必须选择一只在场的子嗣')
        chosen.toweringBeasts = (chosen.toweringBeasts || 0) + 1
        chosen.health += 1
        chosen.attachedTreacheries = [...(chosen.attachedTreacheries || []), code]
        if (chosen.location === inv.location) api.damage(inv.seat, 1)
        return true
      }
      if (code === '02257') {
        const exposed = active(state).filter(target => brood.some(enemy => enemy.location === target.location))
        if (!exposed.length) api.drawEncounter(inv.seat)
        else for (const target of exposed) api.test(target.seat, 'agility', 3, result => {
          if (!result.success) api.damage(target.seat, Math.max(0, 3 - result.value))
        })
      } else if (code === '02258') {
        const pending = [...brood]
        while (pending.length) {
          const enemyId = pending.length === 1 ? pending[0].id : api.choose({
            kind: 'target', source: code, seat: inv.seat, prompt: '选择下一只朝你移动的子嗣。',
            options: pending.map(enemy => ({ id: enemy.id, label: `${enemy.name}（${state.locations.find(loc => loc.id === enemy.location)?.name || enemy.location}）` })),
          })
          const chosen = pending.find(enemy => enemy.id === enemyId)
          if (!chosen) throw new Error('必须选择一只待移动的子嗣')
          moveBroodToward(state, chosen, inv.location, api)
          pending.splice(pending.indexOf(chosen), 1)
        }
        api.drawEncounter(inv.seat)
        return { placed: false, surgeHandled: true }
      } else {
        const options = [{ id: 'horror', label: '受到 2 点恐惧' }]
        if (state.scenarioZones.brood.remaining > 0) options.push({ id: 'spawn', label: '在随机地点生成一只备用子嗣' })
        const choice = api.choose({ kind: 'encounter', source: code, seat: inv.seat,
          prompt: '生物的踪迹：受到 2 点恐惧，或生成一只备用子嗣。', options })
        if (choice === 'horror') api.horror(inv.seat, 2)
        else {
          const locations = state.locations
          const location = chooseBroodRandomLocation(state, api)
          state.scenarioZones.brood.remaining--
          state.scenarioZones.setAside.splice(state.scenarioZones.setAside.indexOf('02255'), 1)
          const enemy = api.spawn('02255', location.id)
          if (enemy) enemy.health = 1 + state.numInvestigators
        }
      }
      return false
    },
    afterDeckSetup(state, events, api) {
      if (id === 'bloodOnTheAltar') {
        const cards = [state.encounterDeck.pop(), state.encounterDeck.pop(), state.encounterDeck.pop(), '02214', '02215']
        const mixed = api.shuffle(cards, () => api.randomValue(state))
        state.locations.filter(loc => loc.id !== L('02201')).forEach((loc, i) => { state.scenarioZones.underLocations[loc.id] = mixed[i] })
        state.scenarioZones.setAside = state.scenarioZones.setAside.filter(code => code !== '02215')
      }
    },
    afterChaosBagSetup(state) {
      if (id === 'theEssexCountyExpress') changeChaosBag(state, { easy: '-2', standard: '-3', hard: '-4', expert: '-5' }[state.difficulty], 1, { permanent: true })
      if (id === 'whereDoomAwaits') changeChaosBag(state, { easy: '-3', standard: '-5', hard: '-6', expert: '-7' }[state.difficulty], 1, { permanent: true })
    },
    locationRevealed(state, location, api) {
      if (id === 'theEssexCountyExpress') {
        const code = original(location), investigator = active(state).find(inv => inv.location === location.id)
        if (['02173', '02176'].includes(code) && investigator) {
          for (const pile of [state.encounterDeck, state.encounterDiscard]) {
            const index = pile.indexOf('02182')
            if (index >= 0) { pile.splice(index, 1); state.encounterDeck.push('02182'); api.drawEncounter(investigator.seat); break }
          }
          api.shuffleEncounterDeck()
        }
        if (code === '02177' && investigator) for (let i = 0; i < 3; i++) api.drawEncounter(investigator.seat)
      }
      if (id === 'whereDoomAwaits') {
        const code = original(location), lead = active(state).find(inv => inv.location === location.id)
          || state.investigators[state.campaign.leadSeat]
        if (code === '02287') location.doom = (location.doom || 0) + state.numInvestigators
        if (code === '02289') {
          while (state.encounterDeck.length) {
            const drawn = state.encounterDeck.pop()
            if (state.scenario.enemies[drawn]) { api.spawn(drawn, location.id); break }
            state.encounterDiscard.push(drawn)
          }
        }
        if (lead && ['02285', '02286', '02288', '02290', '02291', '02292'].includes(code)) {
          if (code === '02288') api.endTurn(lead.seat)
          if (code === '02285' && !lead.actionsLeft) api.horror(lead.seat, 2)
          if (code === '02286') api.discardTop(lead.seat, 2 * lead.actionsLeft)
          if (code === '02290' && !lead.actionsLeft) api.damage(lead.seat, 2)
          if (code === '02291' && !lead.actionsLeft) api.discardTop(lead.seat, 5)
          if (code === '02292') api.horror(lead.seat, lead.actionsLeft)
        }
      }
      if (id !== 'bloodOnTheAltar') return
      const trait = ({ '02208': 'Humanoid', '02211': 'Nightgaunt' })[original(location)]
      if (!trait) return
      const matches = []
      for (const [pileName, pile] of [['encounterDeck', state.encounterDeck], ['encounterDiscard', state.encounterDiscard]]) {
        pile.forEach((code, index) => {
          if ((state.scenario.enemies[code]?.traits || []).some(item => item.toLowerCase() === trait.toLowerCase())) {
            matches.push({ code, index, pileName })
          }
        })
      }
      if (!matches.length) return
      const chosen = matches.length === 1 ? matches[0] : matches.find(match => match.code === api.choose({
        kind: 'card', source: original(location), seat: state.currentSeat ?? state.campaign.leadSeat,
        prompt: `选择要生成在村公所的 ${trait} 敌人。`,
        options: matches.map(match => ({ id: match.code, cardCode: match.code,
          label: `${ALL_CARDS[match.code]?.nameZh || match.code}（${match.pileName === 'encounterDeck' ? '遭遇牌库' : '遭遇弃牌堆'}）` })),
      }))
      const pile = chosen.pileName === 'encounterDeck' ? state.encounterDeck : state.encounterDiscard
      pile.splice(chosen.index, 1)
      api.spawn(chosen.code, L('02201'))
      api.shuffleEncounterDeck()
    },
    locationEntered(state, inv, loc, api, companions = []) {
      if (!loc) return
      encounterRules.locationEntered(state, inv, loc, api, companions)
      const code = original(loc)
      if (id === 'theMiskatonicMuseum') {
        if (code === '02132') api.endTurn(inv.seat)
        if (code === '02134') api.discardRandom(inv.seat, 2)
      }
      if (id === 'theEssexCountyExpress' && code >= '02167' && code <= '02171') {
        const skill = ({ '02167': 'agility', '02168': 'combat', '02169': 'willpower', '02170': 'intellect', '02171': 'wild' })[code]
        const needed = code === '02171' ? 1 : 2, options = []
        for (let mask = 1; mask < 2 ** inv.hand.length; mask++) {
          const indices = inv.hand.map((_, i) => i).filter(i => mask & (1 << i))
          const value = indices.reduce((sum, i) => sum + (ALL_CARDS[inv.hand[i]]?.icons?.[skill] || 0)
            + (skill === 'wild' ? 0 : ALL_CARDS[inv.hand[i]]?.icons?.wild || 0), 0)
          if (value < needed || indices.some(i => value - (ALL_CARDS[inv.hand[i]]?.icons?.[skill] || 0)
            - (skill === 'wild' ? 0 : ALL_CARDS[inv.hand[i]]?.icons?.wild || 0) >= needed)) continue
          options.push({ id: indices.join(','), label: `弃牌：${indices.map(i => ALL_CARDS[inv.hand[i]]?.nameZh || inv.hand[i]).join('、')}` })
        }
        const answer = api.choose({ kind: 'location', source: code, seat: inv.seat,
          prompt: `旅客车厢：弃掉合计至少 ${needed} 个指定图标，或受到伤害／恐惧。`,
          options: [{ id: 'harm', label: code === '02171' ? '受到 1 伤害与 1 恐惧' : ['02169', '02170'].includes(code) ? '受到 2 恐惧' : '受到 2 伤害' }, ...options] })
        if (answer === 'harm') {
          if (['02167', '02168', '02171'].includes(code)) api.damage(inv.seat, code === '02171' ? 1 : 2)
          if (['02169', '02170', '02171'].includes(code)) api.horror(inv.seat, code === '02171' ? 1 : 2)
        } else for (const index of answer.split(',').map(Number).sort((a, b) => b - a)) inv.discard.push(inv.hand.splice(index, 1)[0])
      }
    },
    encounterDrawn(state, inv, code, api) {
      encounterRules.encounterDrawn(state, inv, code, api)
      if (id === 'whereDoomAwaits' && original(state.locations.find(loc => loc.id === inv.location)) === '02284'
        && ALL_CARDS[code]?.traits?.some(trait => trait.toLowerCase() === 'hex')) api.damage(inv.seat, 1)
    },
    locationLeaveTest(state, inv, loc) {
      return id === 'lostInTimeAndSpace' && original(loc) === '02327'
        ? { skill: 'willpower', difficulty: 2 } : null
    },
    locationLeaveFailed(state, inv, loc, api) {
      if (id !== 'lostInTimeAndSpace' || original(loc) !== '02327') return
      discardEncounterLocation(state, loc, api, true)
    },
    locationLeft(state, inv, loc, api) {
      if (id !== 'lostInTimeAndSpace' || original(loc) !== '02326') return
      const choice = api.choose({ kind: 'location', source: '02326', seat: inv.seat,
        prompt: '离开无尽之桥：放置 1 个毁灭，或弃掉它？',
        options: [{ id: 'doom', label: '放置 1 个毁灭' }, { id: 'discard', label: '弃掉无尽之桥' }] })
      if (choice === 'doom') loc.doom = (loc.doom || 0) + 1
      else discardEncounterLocation(state, loc, api)
    },
    skipUpkeepDraw(state, inv) {
      return id === 'lostInTimeAndSpace' && original(state.locations.find(loc => loc.id === inv.location)) === '02321'
    },
    canGainResources(state, inv) {
      if (!encounterRules.canGainResources(state, inv)) return false
      const code = original(state.locations.find(loc => loc.id === inv.location))
      return !((id === 'theMiskatonicMuseum' && code === '02126')
        || (id === 'bloodOnTheAltar' && code === '02206'))
    },
    enemyStatModifier(state, enemy, stat) {
      const loc = state.locations.find(item => item.id === enemy.location), code = original(loc)
      if (stat === 'fight' && enemy.code === '02255') return (enemy.toweringBeasts || 0) + Number(state.agendaIndex === 2)
      if (stat === 'evade' && id === 'bloodOnTheAltar' && code === '02204') return 1
      if (stat === 'evade' && id === 'undimensionedAndUnseen' && ['02244', '02245'].includes(code)) return -1
      if (id === 'undimensionedAndUnseen' && state.agendaIndex === 2 && enemy.traits?.some(t => t.toLowerCase() === 'abomination')) return 1
      return 0
    },
    enemyAttackModifier(state, enemy) {
      return id === 'bloodOnTheAltar' && original(state.locations.find(loc => loc.id === enemy.location)) === '02202'
        ? { horror: 1 } : null
    },
    canEvadeEnemy(state, inv, enemy) {
      return !(id === 'lostInTimeAndSpace' && enemy.code === '02323')
    },
    canOpportunityAttack(state, enemy) {
      return !((id === 'bloodOnTheAltar' && enemy.code === '02216')
        || (id === 'lostInTimeAndSpace' && enemy.code === '02323'))
    },
    beforeEnemyHarm(state, enemy, inv, harm, api) {
      if (id !== 'lostInTimeAndSpace' || enemy.code !== '02323' || harm.horror <= 0) return null
      const choice = api.choose({ kind: 'reaction', source: '02323', seat: inv.seat,
        prompt: `犹格·索托斯攻击：可弃掉牌库顶的牌，抵消至多 ${harm.horror} 点恐惧。`,
        options: [{ id: 'skip', label: '承受全部恐惧' },
          ...Array.from({ length: harm.horror }, (_, i) => ({ id: String(i + 1), label: `弃掉 ${i + 1} 张牌，抵消 ${i + 1} 点恐惧` }))] })
      if (choice === 'skip') return null
      const prevented = Number(choice)
      api.discardTop(inv.seat, prevented)
      if (!inv.deck.length) {
        state.campaign.investigators[inv.seat].status = 'insane'
        api.defeat(inv, 'horror')
      }
      return { horror: harm.horror - prevented }
    },
    beforeHarm(state, inv, harm) {
      harm = encounterRules.beforeHarm(state, inv, harm)
      if (id !== 'bloodOnTheAltar' || harm.damage <= 0) return harm
      const song = inv.threat.find(item => item.code === '02221')
      if (!song) return harm
      inv.threat.splice(inv.threat.indexOf(song), 1)
      state.encounterDiscard.push(song.code)
      return { ...harm, damage: harm.damage + 2 }
    },
    enemyAttackResolved(state, enemy, inv) {
      encounterRules.enemyAttackResolved(state, enemy, inv)
      if (id === 'whereDoomAwaits' && enemy.code === '02295' && inv.defeated)
        state.campaign.investigators[inv.seat].status = 'killed'
    },
    turnEnded(state, inv, api) {
      encounterRules.turnEnded(state, inv, api)
      if (id === 'undimensionedAndUnseen'
        && state.locations.find(loc => loc.id === inv.location)?.originalCode === '02249') api.damage(inv.seat, 1)
      if (id === 'lostInTimeAndSpace' && original(state.locations.find(loc => loc.id === inv.location)) === '02328') {
        const loc = state.locations.find(item => item.id === inv.location)
        const options = [{ id: 'shuffle', label: '将次元门洗入遭遇牌库' }]
        if (inv.resources >= 2) options.unshift({ id: 'pay', label: '支付 2 资源' })
        const choice = api.choose({ kind: 'location', source: '02328', seat: inv.seat,
          prompt: '回合结束时，支付 2 资源或失去次元门。', options })
        if (choice === 'pay') inv.resources -= 2
        else discardEncounterLocation(state, loc, api, true)
      }
    },
    statModifier(state, inv, skill) {
      const alliesBlank = inv.threat.some(item => item.code === '02088')
      let bonus = encounterRules.statModifier(state, inv, skill)
      if (id === 'theMiskatonicMuseum') {
        const loc = state.locations.find(item => item.id === inv.location)
        if (skill === 'agility' && original(loc) === '02132') bonus += 2
        if (!alliesBlank && state.skillTest?.source?.label === '调查' && skill === 'intellect' && inv.assets.some(asset => asset.code === '02138')
          && loc?.traits?.some(trait => trait.toLowerCase() === 'miskatonic')) bonus += 2
      }
      if (id === 'undimensionedAndUnseen' && skill === 'willpower'
        && ['02250', '02251'].includes(original(state.locations.find(loc => loc.id === inv.location) || {}))) bonus--
      return bonus
    },
    enemyPhaseEnd(state, api) {
      if (id === 'whereDoomAwaits') for (const enemy of [...state.enemies].filter(item => item.code === '02294')) {
        if (enemy.location === L('02284')) {
          state.enemies.splice(state.enemies.indexOf(enemy), 1)
          state.encounterDiscard.push(enemy.code)
          state.doom += 2
        } else moveBroodToward(state, enemy, L('02284'), api)
      }
      if (id !== 'undimensionedAndUnseen' || state.agendaIndex > 2) return
      for (const enemy of state.enemies.filter(item => item.code === '02255')) {
        const destinations = state.locations
        if (!destinations.length) continue
        const target = chooseBroodRandomLocation(state, api)
        moveBroodToward(state, enemy, target.id, api)
      }
    },
    enemyPhaseStart(state, api) {
      if (id !== 'theMiskatonicMuseum') return
      const horror = state.enemies.find(enemy => enemy.code === '02141')
      if (horror && ['skull', 'cultist', 'tablet', 'elderthing', 'autofail'].includes(api.revealToken())) horror.exhausted = false
    },
    roundEnded(state, api) {
      if (['bloodOnTheAltar', 'undimensionedAndUnseen'].includes(id)) {
        for (const loc of state.locations.filter(item => item.sordidAndSilent)) {
          for (const inv of active(state).filter(item => item.location === loc.id)) api.horror(inv.seat, loc.sordidAndSilent)
        }
      }
      if (id === 'lostInTimeAndSpace') for (const loc of [...state.locations].filter(item => original(item) === '02324')) {
        const choice = api.choose({ kind: 'location', source: '02324', seat: state.campaign.leadSeat,
          prompt: '时空裂口：放置 1 个毁灭，或弃掉此地点？',
          options: [{ id: 'doom', label: '放置 1 个毁灭' }, { id: 'discard', label: '弃掉时空裂口' }] })
        if (choice === 'doom') loc.doom = (loc.doom || 0) + 1
        else discardEncounterLocation(state, loc, api)
      }
      if (id !== 'undimensionedAndUnseen') return
      for (const enemy of state.enemies.filter(item => item.code === '02255' && item.rainClues)) {
        enemy.clues = Math.max(0, (enemy.clues || 0) - enemy.rainClues)
        delete enemy.rainClues
      }
    },
    publicAttachments(state) {
      const result = encounterRules.publicAttachments(state)
      result.agenda.push(...Array(state.scenarioFlags?.kidnapped || 0).fill('02220'))
      const key = state.scenarioZones?.keyAttached
      if (id === 'bloodOnTheAltar' && key) result.locations[L('02214')] = [...(result.locations[L('02214')] || []), key]
      return result
    },
    agendaAdvancing(state, agenda, api) {
      for (let i = 0; i < (state.scenarioFlags.kidnapped || 0); i++) {
        const pool = state.scenarioZones.sacrifices
        if (pool.length) state.scenarioZones.sacrificed.push(pool.splice(Math.floor(api.random() * pool.length), 1)[0])
        state.encounterDiscard.push('02220')
      }
      delete state.scenarioFlags.kidnapped
    },
    agendaLeftPlay(state, agenda, api) {
      encounterRules.agendaLeftPlay(state, agenda, api)
      if (!['bloodOnTheAltar', 'undimensionedAndUnseen'].includes(id)) return
      for (const loc of state.locations) if (loc.sordidAndSilent) {
        state.encounterDiscard.push(...Array(loc.sordidAndSilent).fill('02089'))
        delete loc.sordidAndSilent
      }
    },
    cluesGained(state, inv, amount, api) {
      encounterRules.cluesGained(state, inv, amount, api)
      if (id !== 'lostInTimeAndSpace') return
      const loc = state.locations.find(item => item.id === inv.location)
      if (original(loc) === '02325' && loc.clues === 0) discardEncounterLocation(state, loc, api)
    },
    afterTest(state, inv, result, api) {
      encounterRules.afterTest(state, inv, result)
      dunwichChaosAfterTest(id, state, inv, result, api)
      if (result.success && result.skill === 'willpower'
        && !inv.threat.some(item => item.code === '02088') && result.source?.type === 'encounter' && state.scenario.treacheries[result.source.code]) {
        const ally = inv.assets.find(asset => asset.code === '02217' && !asset.exhausted)
        if (ally && api.choose({ kind: 'reaction', source: '02217', seat: inv.seat,
          prompt: '横置泽布伦·沃特雷，抽 1 张牌？',
          options: [{ id: 'yes', label: '横置并抽牌' }, { id: 'no', label: '不触发' }] }) === 'yes') {
          ally.exhausted = true; api.drawCards(inv.seat, 1)
        }
      }
      if (id === 'theMiskatonicMuseum' && !result.success && result.source?.label === '调查') {
        const code = original(state.locations.find(loc => loc.id === inv.location))
        if (code === '02133' && inv.assets.length) {
          const choice = api.choose({ kind: 'target', source: code, seat: inv.seat,
            prompt: '选择弃掉一张受你控制的支援卡。', options: inv.assets.map(asset => ({ id: asset.id, label: asset.name || ALL_CARDS[asset.code]?.nameZh || asset.code })) })
          api.discardAsset(inv.seat, choice)
        }
        if (code === '02135') inv.actionsLeft = Math.max(0, inv.actionsLeft - 1)
        if (code === '02136') api.horror(inv.seat, 1)
      }
      if (id === 'bloodOnTheAltar' && !result.success && result.source?.label === '调查'
        && state.locations.find(loc => loc.id === inv.location)?.originalCode === '02205') {
        const loc = state.locations.find(item => item.id === inv.location)
        if (loc.clues > 0) { loc.clues--; loc.doom = (loc.doom || 0) + 1 }
      }
    },
    afterEvade(state, inv, enemy, result, api) {
      if (inv.threat.some(item => item.code === '02088')) return
      const ally = inv.assets.find(asset => asset.code === '02218' && !asset.exhausted)
      if (ally && api.choose({ kind: 'reaction', source: '02218', seat: inv.seat,
        prompt: '横置厄尔·索耶，抽 1 张牌？',
        options: [{ id: 'yes', label: '横置并抽牌' }, { id: 'no', label: '不触发' }] }) === 'yes') {
        ally.exhausted = true; api.drawCards(inv.seat, 1)
      }
    },
    agendaReveal(state, agenda, api) {
      const code = original(agenda), zones = state.scenarioZones
      if (['02119', '02120'].includes(code)) {
        const enemy = state.enemies.find(e => e.code === '02141')
        if (enemy) enemy.doom++
        else summonHorror(state, L('02127'), api)
        api.shuffleDiscard()
      } else if (code === '02121') {
        for (const inv of active(state)) api.defeat(inv, 'damage')
        api.finish('noResolution')
      } else if (['02160', '02161', '02162', '02163'].includes(code)) {
        const count = ['02162', '02163'].includes(code) ? 2 : 1
        for (const loc of zones.train.splice(0, count)) api.devourLocation(loc)
        for (const inv of active(state)) inv.clues = 0
        state.clues = 0
      } else if (code === '02164') {
        for (const inv of active(state)) api.defeat(inv, 'horror')
        api.finish('r2')
      } else if (['02196', '02197'].includes(code)) {
        const needed = code === '02196' ? 3 : 2
        if (zones.sacrifices.length >= needed) {
          const index = Math.floor(api.random() * zones.sacrifices.length)
          zones.sacrificed.push(zones.sacrifices.splice(index, 1)[0])
        }
      } else if (code === '02198') {
        for (const inv of active(state)) inv.resigned = true
        api.finish('noResolution')
      } else if (['02237', '02238'].includes(code)) {
        api.shuffleDiscard()
        if (zones.brood.remaining) {
          zones.brood.remaining--
          zones.setAside.splice(zones.setAside.indexOf('02255'), 1)
          const lead = state.investigators[state.campaign.leadSeat]
          const loc = code === '02237' ? chooseBroodRandomLocation(state, api).id : lead.location
          const enemy = api.spawn('02255', loc)
          enemy.health = 1 + state.numInvestigators
          if (code === '02238') for (const inv of active(state).filter(i => i.location === loc)) {
            api.test(inv.seat, 'agility', 4, r => { if (!r.success) api.attack(enemy, inv) })
          }
        }
      } else if (code === '02239') api.finish('r1')
      else if (code === '02275') api.shuffleDiscard()
      else if (code === '02276') api.finish('r2')
      else if (['02312', '02313'].includes(code)) {
        api.shuffleDiscard()
        api.drawEncounterLocation(state.campaign.leadSeat)
        if (code === '02312' && state.campaign.records.theInvestigatorsFailedToSaveTheStudents) {
          for (const inv of active(state)) api.horror(inv.seat, 1)
        }
        if (code === '02313') for (const inv of active(state)) {
          const n = (state.campaign.records.sacrificedToYogSothoth || []).length
          if (n) api.test(inv.seat, 'willpower', n, r => { if (!r.success) api.damage(inv.seat, Math.max(0, n - r.value)) })
        }
      } else if (code === '02314') {
        const enemy = api.spawn('02323', state.locations.some(l => l.id === L('02321')) ? L('02321') : L('02320'))
        enemy.health = 4 + 6 * state.numInvestigators
      } else if (code === '02315') {
        const enemy = state.enemies.find(e => e.code === '02323')
        if (enemy) for (const inv of active(state)) api.attack(enemy, inv)
        state.agendas[state.agendaIndex] = { ...agenda } // Replacing the card keeps 4a in play.
      } else throw new Error(`未迁移的密谋：${code}`)
    },
    enemyDefeated(state, enemy, api) {
      encounterRules.enemyDefeated(state, enemy, api)
      if (enemy.attachedTreacheries?.length) state.encounterDiscard.push(...enemy.attachedTreacheries)
      if (enemy.code === '02224') {
        const locations = state.locations.filter(loc => loc.clues > 0)
        if (locations.length) {
          const seat = enemy.defeatedBy ?? state.campaign.leadSeat
          const chosen = api.choose({ kind: 'location', source: '02224', seat,
            prompt: '（可选）选择任意一个有线索的地点，发现 1 个线索。',
            options: [{ id: 'skip', label: '不发现线索' }, ...locations.map(loc => ({ id: loc.id, label: loc.name }))] })
          if (chosen !== 'skip') {
            const loc = locations.find(item => item.id === chosen)
            if (loc) { loc.clues--; api.gainClues(seat, 1) }
          }
        }
      }
      if (id === 'lostInTimeAndSpace' && enemy.code === '02323' && original(state.agendas[state.agendaIndex] || {}) === '02315') api.finish('r3')
      if (enemy.code !== '02141') return false
      state.scenarioZones.void = { code: enemy.code, resources: enemy.shadowResources || 0 }
      return true // Replacement for discard/victory; ordinary defeat reactions still fire.
    },
    enemySpawned(state, enemy, api) {
      encounterRules.enemySpawned(state, enemy, api)
      if (id === 'theMiskatonicMuseum' && enemy.code === '02141') attachShadowSpawned(state, enemy, api)
    },
    cluesRemoved(state, loc, amount, api) {
      if (original(loc) !== '02325' || (loc.clues || 0) > 0) return
      api.remove(loc.id)
      state.encounterDiscard.push('02325')
      api.info('「菱柱瀑布」上的最后 1 个线索被移除，它被弃掉。')
    },
    cluesOnReveal(state, loc) {
      if (id !== 'whereDoomAwaits') return null
      const actCode = original(state.acts[state.actIndex] || {})
      if (!['02278', '02279', '02280'].includes(actCode)) return null
      if ((loc.traits || []).some(trait => String(trait).toLowerCase() === 'altered')) return null
      return 0
    },
    investigatorMovedByEncounterCard(state, inv, api) {
      if (id !== 'lostInTimeAndSpace' || inv.defeated || inv.resigned || inv.location == null) return
      if (['02312', '02313', '02314', '02315'].includes(original(state.agendas[state.agendaIndex] || {}))) api.horror(inv.seat, 1)
    },
    drawStoryAsset(state, inv, code, api) {
      if (id !== 'theEssexCountyExpress' || code !== '02179') throw new Error(`未知剧情资产遭遇卡：${code}`)
      const train = state.scenarioZones.train || []
      const left = train[train.indexOf(inv.location) - 1]
      const location = state.locations.some(loc => loc.id === left) ? left : inv.location
      state.scenarioFlags.passengers = (state.scenarioFlags.passengers || 0) + 1
      state.storyAssets.push({ ...printed('02179'), id: `passenger${state.scenarioFlags.passengers}`, exhausted: false, location, controllerSeat: null })
      api.drawEncounter(inv.seat)
    },
    assetLeftPlay(state, inv, asset, api) {
      encounterRules.assetLeftPlay(state, inv, asset)
      if (asset.code === '02179') this.storyAssetLeftPlay(state, asset, api)
    },
    storyAssetLeftPlay(state, asset, api) {
      if (asset.code !== '02179') return
      asset.removedFromGame = true
      state.encounterDiscard.push(asset.code)
      for (const inv of active(state)) api.horror(inv.seat, 1)
    },
    storyResolutionKey(state, key) {
      if (key !== 'noResolution') return key
      if (id === 'theEssexCountyExpress') return 'r2'
      if (id === 'undimensionedAndUnseen') return 'r1'
      if (id === 'whereDoomAwaits') return 'r2'
      if (id === 'lostInTimeAndSpace') return state.actIndex === 3 ? 'r2' : 'r4'
      return key
    },
    allResigned(state, api) {
      if (id === 'lostInTimeAndSpace' && original(state.acts[state.actIndex] || {}) === '02319') api.finish('r1')
    },
    drawEncounterLocation(state, seat, api) {
      let code
      while (state.encounterDeck.length) {
        code = state.encounterDeck.pop()
        if (ALL_CARDS[code]?.type === 'location') return this.drawLocation(state, seat, code, api)
        state.encounterDiscard.push(code)
      }
      return null
    },
    drawLocation(state, seat, code, api) {
      if (id !== 'lostInTimeAndSpace') throw new Error('当前剧本不使用遭遇地点')
      const loc = api.placeEncounterLocation(code), inv = state.investigators[seat]
      if (code === '02324') api.drawEncounter(seat)
      else if (code === '02325') api.discardRandom(seat, 1)
      else if (code === '02326') inv.resources = Math.max(0, inv.resources - 2)
      else if (code === '02327') {
        const index = inv.discard.findLastIndex(c => ALL_CARDS[c]?.traits?.includes('Madness'))
        if (index >= 0) api.drawDiscard(seat, index)
      } else if (code === '02328') {
        const index = state.encounterDiscard.findLastIndex(c => ALL_CARDS[c]?.traits?.includes('Hex') || state.scenario.treacheries[c]?.traits?.includes('Hex'))
        if (index >= 0) api.drawEncounterDiscard(seat, index)
      }
      return loc
    },
    actReveal(state, act, api) {
      const code = original(act), lead = state.campaign.leadSeat, zones = state.scenarioZones
      if (code === '02122') {
        api.reveal(L('02127'))
        if (state.scenarioFlags.brokeMuseumDoor) state.acts[1] = { ...state.scenario.acts.find(a => original(a) === '02124') }
        else chooseStoryController(state, '02139', api)
      } else if (['02123', '02124'].includes(code)) {
        if (code === '02124') chooseStoryController(state, '02138', api)
        summonHorror(state, L('02137'), api)
      } else if (code === '02125') {
        api.finish(requestChoice(state, { kind: 'story', source: code, seat: lead, prompt: '如何处置死灵之书？',
          options: [{ id: 'r1', label: '销毁' }, { id: 'r2', label: '保管' }] }))
      } else if (code === '02165') {
        const inv = active(state).find(i => i.location === L('02175'))
        const skill = requestChoice(state, { kind: 'story', source: code, seat: inv.seat, prompt: '如何越过煤水车？',
          options: [{ id: 'agility', label: '敏捷（3）：躲避' }, { id: 'combat', label: '战斗（3）：承受高温' }] })
        api.test(inv.seat, skill, 3, r => { if (!r.success) api.trauma(inv.seat, skill === 'agility' ? 'mental' : 'physical', 1) })
      } else if (code === '02166') api.finish('r1')
      else if (code === '02199') {
        for (const loc of state.locations) api.reveal(loc.id)
        const chamber = state.locations.find(l => l.id === L('02214'))
        const n = state.locations.reduce((sum, l) => sum + l.clues, 0) + state.investigators.reduce((sum, i) => sum + i.clues, 0)
        for (const loc of state.locations) loc.clues = 0
        for (const inv of state.investigators) inv.clues = 0
        state.clues = 0; chamber.clues = n
        api.spawn('02216', chamber.id)
      } else if (code === '02200') api.finish(state.investigators.some(i => i.assets.some(a => a.code === '02140')) ? 'r2' : 'r3')
      else if (code === '02240') {
        for (const inv of active(state)) api.giveAsset(inv.seat, '02254')
        zones.setAside = zones.setAside.filter(code => code !== '02254')
        if ((state.campaign.records.sacrificedToYogSothoth || []).includes('02040')) state.doom++
      } else if (code === '02241') api.finish('r2')
      else if (code === '02277') {
        for (const loc of state.locations) loc.clues = 0
        api.reveal(L('02283'))
      } else if (['02278', '02279', '02280'].includes(code)) {
        if (code !== '02278') {
          const enemy = api.spawn('02293', L('02284'))
          if (code === '02280') enemy.damageTaken = state.numInvestigators
        }
      } else if (code === '02281') api.finish('r1')
      else if (code === '02316') api.place(L('02321'))
      else if (code === '02317') { /* No reverse effect. */ }
      else if (code === '02318') {
        // Leaving locations moves their occupants to Another Dimension.
        api.remove(L('02321')); api.place(L('02322'))
      } else if (code === '02319') api.finish('r1')
      else throw new Error(`未迁移的场景：${code}`)
    },
    checkObjectives(state, api) {
      const code = original(state.acts[state.actIndex] || {})
      const entered = c => active(state).some(i => i.location === L(c))
      const empty = c => state.locations.some(l => l.id === L(c) && l.revealed && l.clues === 0)
      if ((['02123', '02124'].includes(code) && entered('02137'))
        || (code === '02125' && empty('02137')) || (code === '02165' && entered('02175'))
        || (code === '02166' && empty('02175')) || (code === '02199' && entered('02214'))
        || (code === '02200' && empty('02214')) || (['02278', '02279', '02280'].includes(code) && entered('02284'))
        || (code === '02317' && entered('02321'))
        || (code === '02241' && !state.scenarioZones.brood.remaining && !state.enemies.some(e => e.code === '02255'))) api.advanceAct()
      if (code === '02200' && state.victoryDisplay.some(c => original(c) === '02216')) api.finish('r1')
    },
    investigatorEntryError(state, loc, inv = state.investigators[state.currentSeat]) {
      if (inv.steamImmobileRound === state.round) return '本轮受到蒸汽之爪影响，不能移动'
      if (state.enemies.some(enemy => enemy.code === '02182' && enemy.engagedSeat === inv.seat)) return '与攫取恐怖交战时不能移动'
      if (id === 'theMiskatonicMuseum' && loc.id === L('02127') && state.actIndex === 0) return '博物馆入口尚未打开'
      if (id === 'theEssexCountyExpress') {
        const train = state.scenarioZones.train, left = state.locations.find(l => l.id === train[train.indexOf(loc.id) - 1])
        if (!loc.revealed && left?.clues > 0) return '先清除左侧车厢的所有线索'
      }
      if (id === 'bloodOnTheAltar' && loc.id === L('02214') && !state.scenarioFlags.chamberUnlocked) return '密室尚未用钥匙打开'
      if (id === 'bloodOnTheAltar' && original(loc) === '02203'
        && active(state).some(other => other.seat !== inv.seat && other.location === loc.id)) return '主教溪已有调查员，其他人不能进入'
      if (id === 'whereDoomAwaits' && loc.id === L('02283') && state.actIndex === 0) return '上山道路仍被遮蔽'
      if (id === 'whereDoomAwaits' && original(loc) === '02284' && !loc.revealed
        && active(state).reduce((sum, target) => sum + target.clues, 0) < 2 * state.numInvestigators) return '首次进入哨兵山顶需共同支付每人 2 个线索'
      if (id === 'lostInTimeAndSpace' && loc.id === L('02321') && inv.clues < 2) return '进入宇宙边缘需要持有至少 2 个线索'
      return null
    },
    beforeMove(state, inv, loc, api) {
      if (id === 'whereDoomAwaits' && original(loc) === '02284' && !loc.revealed) api.payClues(2 * state.numInvestigators)
    },
    investigationError(state, inv, loc) {
      if (id === 'theEssexCountyExpress' && original(loc) === '02174') return '会客车厢不能调查'
      if (id !== 'theMiskatonicMuseum') return null
      const code = original(loc)
      if (code === '02130' && inv.resources <= 4) return '资源不足 5，无法调查管理办公室'
      if (code === '02131' && inv.hand.length <= 4) return '手牌不足 5，无法调查管理办公室'
      if (code === '02137' && state.enemies.some(enemy => enemy.code === '02141' && enemy.location === loc.id)) return '恐惧猎手在此，无法调查'
      return null
    },
    canDiscoverClues(state, inv) {
      if (id !== 'bloodOnTheAltar' || original(state.locations.find(loc => loc.id === inv.location)) !== '02213') return true
      return state.skillTest?.source?.label === '调查'
    },
    canPlayCard(state, inv, card) {
      if (!encounterRules.canPlayCard(state, inv, card)) return false
      return !(id === 'bloodOnTheAltar' && original(state.locations.find(loc => loc.id === inv.location)) === '02210'
        && card.type === 'event')
    },
    canCommitCard(state, inv, code) {
      return !(id === 'bloodOnTheAltar' && original(state.locations.find(loc => loc.id === inv.location)) === '02212'
        && ALL_CARDS[code]?.type === 'skill')
    },
    actions(state, inv) {
      const moves = []
      // reason 说明"此刻还差什么"。带 reason 的条目不会进 legalMoves，只作为 AI 提示，
      // 所以条件判断只需要在 actions() 里写一遍。
      const add = (rule, label, reason) => moves.push({ action: 'scenarioAction', rule, label, reason })
      const zones = state.scenarioZones
      if (inv.assets.some(asset => asset.code === '02140'))
        add('necronomiconResource', '死灵之书：获得 2 资源',
          this.canGainResources(state, inv) ? null : '此地不能获得资源')
      if (id === 'theMiskatonicMuseum') {
        if (original(state.locations.find(loc => loc.id === inv.location)) === '02128'
          && state.scenarioFlags[`security:${inv.seat}`] !== state.round) moves.push({ action: 'scenarioAction', rule: 'searchSecurityOffice', actions: inv.assets.some(asset => asset.code === '02139') ? 1 : 2,
            label: '保安办公室：搜索牌库顶 6 张牌' })
        if (original(state.locations.find(loc => loc.id === inv.location)) === '02129'
          && state.scenarioFlags[`security:${inv.seat}`] !== state.round)
          moves.push({ action: 'scenarioAction', rule: 'inspectSecurityOffice', actions: inv.assets.some(asset => asset.code === '02139') ? 1 : 2,
            label: '保安办公室：查看展厅正面或展厅牌库顶牌',
            reason: zones.exhibits.length || state.locations.some(loc => loc.traits?.includes('Exhibit')) ? null
              : '展厅牌库已空且场上没有展厅' })
        if (state.actIndex === 0 && inv.location === L('02126')) add('breakMuseumDoor', '破开博物馆大门（战斗 5）')
        if (inv.location === L('02127') && zones.exhibits.length) {
          const pooled = active(state).filter(i => i.location === inv.location).reduce((n, i) => n + i.clues, 0)
          add('openExhibit', '共同支付每人 1 线索，打开下一间展厅',
            pooled >= state.numInvestigators ? null : `需要共同支付 ${state.numInvestigators} 个线索（当前 ${pooled}）`)
        }
      }
      if (id === 'theEssexCountyExpress') {
        const here = state.locations.find(loc => loc.id === inv.location)
        const code = original(here)
        if (code === '02172' && !state.scenarioFlags.stolePassengersLuggage)
          add('stealLuggage', '拿走旅客行李：获得 3 资源')
        if (code === '02174') add('parlorClue', '支付 3 资源，发现会客车厢 1 个线索',
          inv.resources < 3 ? `需要 3 资源（当前 ${inv.resources}）`
            : !(here?.clues > 0) ? '会客车厢已经没有线索' : null)
        const passenger = (state.storyAssets || []).find(asset => asset.code === '02179' && asset.location === inv.location && asset.controllerSeat == null)
        if (passenger) moves.push({ action: 'scenarioAction', rule: 'parleyPassenger', assetId: passenger.id, label: '谈判：控制无助的旅客' })
      }
      if (id === 'bloodOnTheAltar') {
        const here = state.locations.find(loc => loc.id === inv.location)
        if (original(here) === '02207') add('searchGeneralStore', '支付 1 资源，搜索牌库顶 3 张物品牌',
          inv.resources >= 1 ? null : `需要 1 资源（当前 ${inv.resources}）`)
        if (original(here) === '02209') add('tradeChurchCard', '弃掉 1 张手牌，获得 2 资源',
          inv.hand.length ? null : '手牌为空')
        if (zones.underLocations[inv.location] && !state.scenarioFlags[`searched:${inv.location}`])
          moves.push({ action: 'scenarioAction', rule: 'searchUnderLocation', actions: 0,
            label: '揭示此地点底下的卡牌',
            reason: here?.clues === 0 ? null : `需要先取走此地点的线索（还剩 ${here?.clues ?? 0} 个）` })
        const chamber = state.locations.find(loc => loc.id === L('02214'))
        if (chamber && !state.scenarioFlags.chamberUnlocked && here?.connections.includes(chamber.id))
          moves.push({ action: 'scenarioAction', rule: 'attachChamberKey', actions: 0,
            label: '将密室钥匙附属到隐藏密室',
            reason: inv.assets.some(asset => asset.code === '02215') ? null : '需要控制密室钥匙' })
      }
      if (id === 'undimensionedAndUnseen') {
        const here = state.locations.find(loc => loc.id === inv.location)
        const brood = state.enemies.filter(enemy => enemy.code === '02255' && enemy.location === inv.location)
        const powder = inv.assets.find(asset => asset.code === '02219')
        const powderClues = powder
          ? (powder.clues ?? survivors.filter(([code]) => !(state.campaign.records.sacrificedToYogSothoth || []).includes(code)).length)
          : 0
        if (powder && powderClues > 0) {
          const ready = brood.filter(item => item.exhausted)
          if (ready.length) for (const enemy of ready)
            moves.push({ action: 'scenarioAction', rule: 'powderBrood', actions: 0, enemyId: enemy.id,
              label: `伊本·加齐之粉：将 1 个线索放到「${enemy.name}」上` })
          else moves.push({ action: 'scenarioAction', rule: 'powderBrood', actions: 0,
            label: '伊本·加齐之粉：将 1 个线索放到一只子嗣上',
            reason: brood.length ? '需要先横置一只子嗣' : '所在地点没有子嗣' })
        }
        if (inv.assets.some(asset => asset.code === '02254')) {
          const abominations = state.enemies.filter(enemy => enemy.location === inv.location && enemy.traits?.includes('Abomination'))
          if (abominations.length) for (const enemy of abominations)
            moves.push({ action: 'scenarioAction', rule: 'castFormula', enemyId: enemy.id,
              label: `深奥的咒文：攻击「${enemy.name}」` })
          else moves.push({ action: 'scenarioAction', rule: 'castFormula', label: '深奥的咒文：攻击异形敌人',
            reason: '所在地点没有[[异形]]敌人' })
        }
        const markLimits = { '02242': 1, '02244': 2, '02246': 1, '02247': state.numInvestigators,
          '02248': 2, '02250': 3, '02252': 2, '02253': state.numInvestigators }
        const site = original(here || {}), limit = markLimits[site]
        const targets = state.enemies.filter(enemy => enemy.traits?.includes('Abomination') && (site === '02242' || enemy.location === inv.location))
        const group = ['02244', '02247', '02248', '02253'].includes(site)
        const available = group ? active(state).filter(other => other.location === inv.location).reduce((n, other) => n + (site === '02247' || site === '02253' ? Number(other.clues > 0) : other.clues), 0)
          : Math.max(0, ...active(state).filter(other => other.location === inv.location).map(other => other.clues))
        if (limit && !state.scenarioFlags[`marked:${inv.location}`]) {
          if (targets.length && (site === '02246' || available > 0)) {
            for (const enemy of targets) for (let amount = 1; amount <= Math.min(limit, site === '02246' ? 1 : available); amount++)
              moves.push({ action: 'scenarioAction', rule: 'markBrood', actions: 0,
                enemyId: enemy.id, amount, label: `将 ${amount} 个线索放在「${enemy.name}」上` })
          } else moves.push({ action: 'scenarioAction', rule: 'markBrood', actions: 0,
            label: '将线索放在子嗣上',
            reason: !targets.length ? (site === '02242' ? '场上没有子嗣' : '所在地点没有子嗣')
              : `需要所在地点有线索（当前 ${available}）` })
        }
        if (original(here || {}) === '02243') moves.push({ action: 'scenarioAction', rule: 'lureBrood',
          label: '引导一只子嗣朝敦威治村移动',
          reason: state.enemies.some(enemy => enemy.code === '02255' && enemy.location !== inv.location) ? null
            : '没有在别处的子嗣' })
        if (original(here || {}) === '02251') moves.push({ action: 'scenarioAction', rule: 'redirectBrood',
          label: '检定智识 4，引导子嗣移动',
          reason: state.enemies.some(enemy => enemy.code === '02255') ? null : '场上没有子嗣' })
      }
      if (id === 'whereDoomAwaits') for (const [code, deck] of [['02282', 'divergingPaths'], ['02283', 'alteredPaths']]) {
        if (inv.location === L(code) && state.scenarioFlags[`${inv.seat}:${deck}`] !== state.round)
          add(deck, '调查：发现一条未知小径（每轮一次）', zones[deck].length ? null : '小径牌库已空')
      }
      if (id === 'whereDoomAwaits' && original(state.locations.find(loc => loc.id === inv.location)) === '02287'
        && state.locations.find(loc => loc.id === inv.location)?.doom > 0) add('clearDestroyedPathDoom', '调查：移除被毁小径上的 1 个毁灭')
      if (id === 'lostInTimeAndSpace'
        && ['02316', '02317', '02318', '02319'].includes(original(state.acts[state.actIndex] || {}))) {
        add('searchEncounterLocations', '弃掉遭遇牌库顶3张，选择其中一个地点并结算其显现',
          state.encounterDeck.length ? null : '遭遇牌库已空')
      }
      if (id === 'lostInTimeAndSpace' && original(state.locations.find(loc => loc.id === inv.location)) === '02322')
        add('resignBeyond', '支付 2 个线索，撤退',
          inv.clues >= 2 ? null : `需要 2 个线索（当前 ${inv.clues}）`)
      return moves
    },
    payScenarioActionCost(state, inv, move, api) {
      const here = state.locations.find(loc => loc.id === inv.location)
      if (move.rule === 'resignBeyond') {
        if (inv.clues < 2) throw new Error('线索不足')
        api.spendClues(inv.seat, 2)
      } else if (move.rule === 'searchGeneralStore' && id === 'bloodOnTheAltar') {
        if (inv.resources < 1) throw new Error('资源不足')
        inv.resources--
      } else if (move.rule === 'parlorClue' && id === 'theEssexCountyExpress') {
        if (original(here || {}) !== '02174' || inv.resources < 3 || !here.clues) throw new Error('无法支付会客车厢费用')
        inv.resources -= 3
      } else if (move.rule === 'openExhibit') api.payClues(state.numInvestigators, inv.location)
    },
    performAction(state, inv, move, api) {
      if (move.rule === 'searchEncounterLocations') {
        const actCode = original(state.acts[state.actIndex] || {})
        if (id !== 'lostInTimeAndSpace' || !['02316', '02317', '02318', '02319'].includes(actCode)
          || !state.encounterDeck.length) throw new Error('当前幕不能搜索遭遇地点')
        const discarded = []
        for (let count = 0; count < 3 && state.encounterDeck.length; count++) {
          const code = state.encounterDeck.pop()
          state.encounterDiscard.push(code)
          discarded.push(code)
        }
        const locations = discarded.filter(code => ALL_CARDS[code]?.type === 'location')
        if (locations.length) {
          const index = locations.length === 1 ? '0' : api.choose({
            kind: 'location',
            source: actCode,
            seat: inv.seat,
            prompt: '选择一个被弃掉的地点，结算其显现能力。',
            options: locations.map((code, optionIndex) => ({
              id: String(optionIndex),
              label: ALL_CARDS[code]?.nameZh || ALL_CARDS[code]?.name || code,
            })),
          })
          const code = locations[Number(index)]
          const discardIndex = state.encounterDiscard.lastIndexOf(code)
          if (discardIndex >= 0) state.encounterDiscard.splice(discardIndex, 1)
          this.drawLocation(state, inv.seat, code, api)
        }
      } else if (move.rule === 'resignBeyond') api.resign(inv.seat)
      else if (move.rule === 'inspectSecurityOffice') {
        const options = state.locations.filter(loc => loc.traits?.includes('Exhibit')).map((loc, i) => ({ id: loc.id, label: `查看展厅 ${i + 1}` }))
        if (state.scenarioZones.exhibits.length) options.push({ id: 'top', label: '查看展厅牌库顶牌' })
        const choice = api.choose({ kind: 'inspect', source: '02129', seat: inv.seat, prompt: '选择要查看的展厅。', options })
        const code = choice === 'top' ? state.scenarioZones.exhibits.at(-1) : original(state.locations.find(loc => loc.id === choice))
        api.choose({ kind: 'inspect', source: '02129', seat: inv.seat, prompt: '查看完毕后确认。',
          options: [{ id: 'done', label: `${ALL_CARDS[code].nameZh || ALL_CARDS[code].name}：${ALL_CARDS[code].textZh || ALL_CARDS[code].text}` }] })
        state.scenarioFlags[`security:${inv.seat}`] = state.round
      } else if (move.rule === 'necronomiconResource') {
        if (!inv.assets.some(asset => asset.code === '02140') || !this.canGainResources(state, inv)) throw new Error('不能使用死灵之书获得资源')
        inv.resources += 2
      } else if (move.rule === 'searchUnderLocation' && id === 'bloodOnTheAltar') {
        const code = state.scenarioZones.underLocations[inv.location]
        if (!code || state.scenarioFlags[`searched:${inv.location}`]) throw new Error('此地点没有可揭示的底牌')
        delete state.scenarioZones.underLocations[inv.location]
        state.scenarioFlags[`searched:${inv.location}`] = true
        if (code === '02214') {
          api.place(L('02214'))
          const here = state.locations.find(loc => loc.id === inv.location)
          const chamber = state.locations.find(loc => loc.id === L('02214'))
          if (!here.connections.includes(chamber.id)) here.connections.push(chamber.id)
          if (!chamber.connections.includes(here.id)) chamber.connections.push(here.id)
        } else if (code === '02215') api.giveAsset(inv.seat, code)
        else { state.encounterDeck.push(code); api.drawEncounter(inv.seat) }
      } else if (move.rule === 'attachChamberKey' && id === 'bloodOnTheAltar') {
        const index = inv.assets.findIndex(asset => asset.code === '02215')
        if (index < 0) throw new Error('没有密室钥匙')
        inv.assets.splice(index, 1)
        state.scenarioFlags.chamberUnlocked = true
        state.scenarioZones.keyAttached = '02215'
      } else if (move.rule === 'castFormula' && id === 'undimensionedAndUnseen') {
        const enemy = state.enemies.find(item => item.id === move.enemyId && item.traits?.includes('Abomination') && item.location === inv.location)
        if (!enemy || !inv.assets.some(asset => asset.code === '02254')) throw new Error('没有合法的深奥咒文目标')
        api.test(inv.seat, 'willpower', enemy.fight + this.enemyStatModifier(state, enemy, 'fight'), result => {
          if (result.success) api.damageEnemy(enemy.id, 1 + (result.damageBonus || 0), inv.seat, '02254')
          else if (enemy.retaliate && !enemy.exhausted) api.attack(enemy, inv)
        }, () => 2 * (enemy.clues || 0), { label: '攻击', name: enemy.name, code: enemy.code, enemyId: enemy.id })
      } else if (move.rule === 'powderBrood' && id === 'undimensionedAndUnseen') {
        const powder = inv.assets.find(asset => asset.code === '02219')
        const enemy = state.enemies.find(item => item.id === move.enemyId && item.code === '02255'
          && item.location === inv.location && item.exhausted)
        if (!powder || !enemy) throw new Error('没有合法的伊本·加齐之粉目标')
        if (powder.clues == null) powder.clues = survivors.filter(([code]) =>
          !(state.campaign.records.sacrificedToYogSothoth || []).includes(code)).length
        if (!powder.clues) throw new Error('伊本·加齐之粉没有线索')
        powder.clues--; enemy.clues = (enemy.clues || 0) + 1
      } else if (move.rule === 'markBrood' && id === 'undimensionedAndUnseen') {
        const enemy = state.enemies.find(item => item.id === move.enemyId && item.traits?.includes('Abomination')
          && (original(state.locations.find(loc => loc.id === inv.location) || {}) === '02242' || item.location === inv.location))
        const here = state.locations.find(loc => loc.id === inv.location)
        if (!enemy || !here || state.scenarioFlags[`marked:${inv.location}`]) throw new Error('没有合法的子嗣标记目标')
        const limit = ({ '02242': 1, '02244': 2, '02246': 1, '02247': state.numInvestigators,
          '02248': 2, '02250': 3, '02252': 2, '02253': state.numInvestigators })[original(here)] || 0
        const site = original(here)
        let moved = Number(move.amount) || 1
        const group = ['02244', '02247', '02248', '02253'].includes(site)
        const participants = active(state).filter(other => other.location === inv.location && other.clues > 0)
        const available = group ? participants.reduce((n, other) => n + (['02247', '02253'].includes(site) ? 1 : other.clues), 0) : Math.max(0, ...participants.map(other => other.clues))
        if (moved > limit || (site !== '02246' && moved > available)
          || (site !== '02242' && enemy.location !== inv.location)) throw new Error('线索放置不符合地点限制')
        if (!moved) throw new Error('没有可放置的线索')
        if (site !== '02246') {
          if (['02247', '02253'].includes(site)) {
            let remaining = moved
            for (const other of participants) {
              if (!remaining) break
              const choice = api.choose({ kind: 'payment', source: site, seat: other.seat,
                prompt: '是否放置你的 1 个线索？', options: [{ id: 'yes', label: '放置 1 个线索' }, { id: 'no', label: '保留线索' }] })
              if (choice === 'yes') { api.spendClues(other.seat, 1); remaining-- }
            }
            moved -= remaining
          } else if (group) {
            let remaining = moved
            for (let i = 0; i < participants.length && remaining; i++) {
              const other = participants[i], min = Math.max(0, remaining - participants.slice(i + 1).reduce((sum, target) => sum + target.clues, 0))
              const max = Math.min(other.clues, remaining)
              const amount = Number(api.choose({ kind: 'payment', source: site, seat: other.seat, prompt: '选择你贡献的线索数量。',
                options: Array.from({ length: max - min + 1 }, (_, n) => ({ id: String(min + n), label: `放置 ${min + n} 个线索` })) }))
              if (amount) api.spendClues(other.seat, amount)
              remaining -= amount
            }
          } else {
            const eligible = participants.filter(other => other.clues >= moved)
            const seat = eligible.length === 1 ? String(eligible[0].seat) : api.choose({ kind: 'investigator', source: site, seat: inv.seat,
              prompt: '选择贡献线索的调查员。', options: eligible.map(other => ({ id: String(other.seat), label: other.name })) })
            const contributor = eligible.find(other => String(other.seat) === seat)
            if (!contributor) throw new Error('必须选择贡献线索的调查员')
            api.spendClues(contributor.seat, moved)
          }
        }
        enemy.clues = (enemy.clues || 0) + moved
        if (site === '02246') enemy.rainClues = (enemy.rainClues || 0) + moved
        state.scenarioFlags[`marked:${inv.location}`] = true
      } else if (move.rule === 'lureBrood' && id === 'undimensionedAndUnseen') {
        const candidates = state.enemies.filter(enemy => enemy.code === '02255' && enemy.location !== inv.location)
        if (!candidates.length) throw new Error('没有可移动的子嗣')
        const picked = api.choose({ kind: 'target', source: '02243', seat: inv.seat,
          prompt: '选择向敦威治村移动的子嗣。', options: candidates.map(item => ({ id: item.id, label: `${item.name}（${state.locations.find(loc => loc.id === item.location)?.name || item.location}）` })) })
        const enemy = candidates.find(item => item.id === picked)
        if (enemy) moveBroodToward(state, enemy, inv.location, api)
      } else if (move.rule === 'redirectBrood' && id === 'undimensionedAndUnseen') {
        const candidates = state.enemies.filter(item => item.code === '02255')
        const picked = api.choose({ kind: 'target', source: '02251', seat: inv.seat,
          prompt: '选择要移动的子嗣。', options: candidates.map(item => ({ id: item.id, label: item.name })) })
        const enemy = candidates.find(item => item.id === picked)
        if (!enemy) throw new Error('没有可移动的子嗣')
        api.test(inv.seat, 'intellect', 4, result => {
          if (!result.success) return
          const here = state.locations.find(loc => loc.id === enemy.location)
          const choices = (here?.connections || []).filter(locationId => state.locations.some(loc => loc.id === locationId))
          if (!choices.length) return
          const next = api.choose({ kind: 'location', source: '02251', seat: inv.seat,
            prompt: '选择子嗣移动的方向。', options: choices.map(locationId => ({ id: locationId, label: state.locations.find(loc => loc.id === locationId)?.name || locationId })) })
          if (choices.includes(next)) api.moveEnemy(enemy, next)
        })
      } else if (move.rule === 'stealLuggage' && id === 'theEssexCountyExpress') {
        if (state.scenarioFlags.stolePassengersLuggage) throw new Error('行李已被拿走')
        state.scenarioFlags.stolePassengersLuggage = true
        state.campaign.records.stolePassengersLuggage = true
        inv.resources += 3
      } else if (move.rule === 'parleyPassenger' && id === 'theEssexCountyExpress') {
        const index = state.storyAssets.findIndex(asset => asset.code === '02179' && asset.location === inv.location && asset.controllerSeat == null
          && (move.assetId == null || asset.id === move.assetId))
        if (index < 0) throw new Error('此地点没有无助的旅客')
        const [asset] = state.storyAssets.splice(index, 1)
        inv.assets.push({ ...asset, location: null, controllerSeat: inv.seat })
      } else if (move.rule === 'parlorClue' && id === 'theEssexCountyExpress') {
        const loc = state.locations.find(item => item.id === inv.location)
        if (loc?.clues) { loc.clues--; api.gainClues(inv.seat, 1) }
      } else if (move.rule === 'searchSecurityOffice' && id === 'theMiskatonicMuseum') {
        if (state.scenarioFlags[`security:${inv.seat}`] === state.round) throw new Error('本轮已搜索保安办公室')
        state.scenarioFlags[`security:${inv.seat}`] = state.round
        choosePlayerDeckCard(state, inv, 6, () => true, api, '保安办公室：从牌库顶 6 张选择 1 张加入手牌')
      } else if (move.rule === 'searchGeneralStore' && id === 'bloodOnTheAltar') {
        choosePlayerDeckCard(state, inv, 3, code => ALL_CARDS[code]?.traits?.some(trait => trait.toLowerCase() === 'item'), api,
          '杂货店：选择一张物品牌加入手牌')
      } else if (move.rule === 'tradeChurchCard' && id === 'bloodOnTheAltar') {
        if (!inv.hand.length) throw new Error('没有可弃的手牌')
        const choice = api.choose({ kind: 'card', source: '02209', seat: inv.seat,
          prompt: '选择一张手牌弃掉，以获得 2 资源。',
          options: inv.hand.map((code, index) => ({ id: String(index), label: ALL_CARDS[code]?.nameZh || code })) })
        inv.discard.push(inv.hand.splice(Number(choice), 1)[0]); inv.resources += 2
      } else if (move.rule === 'clearDestroyedPathDoom' && id === 'whereDoomAwaits') {
        const loc = state.locations.find(item => item.id === inv.location)
        if (original(loc) !== '02287' || !loc.doom) throw new Error('此地点没有毁灭可移除')
        api.test(inv.seat, 'intellect', loc.shroud, result => { if (result.success) loc.doom-- }, 0, { label: '调查', code: original(loc) })
      } else if (move.rule === 'breakMuseumDoor') api.test(inv.seat, 'combat', 5, result => {
        if (result.success) { state.scenarioFlags.brokeMuseumDoor = true; api.advanceAct() }
      })
      else if (move.rule === 'openExhibit') {
        const code = state.scenarioZones.exhibits.pop()
        api.place(L(code))
        const hall = state.locations.find(l => l.id === L('02127'))
        if (!hall.connections.includes(L(code))) hall.connections.push(L(code))
      } else if (['divergingPaths', 'alteredPaths'].includes(move.rule)) {
        const loc = state.locations.find(l => l.id === inv.location)
        state.scenarioFlags[`${inv.seat}:${move.rule}`] = state.round
        api.test(inv.seat, 'intellect', loc.shroud + (loc.shroudMod || 0) + (state.fogMod || 0), result => {
          if (result.success) {
            const path = L(state.scenarioZones[move.rule].pop())
            api.place(path)
            if (!loc.connections.includes(path)) loc.connections.push(path)
          }
        }, 0, { label: '调查', code: original(loc) })
      } else throw new Error('未知剧本行动')
    },
    resolution(state, key, events, api) {
      if (!spec.resolutions.includes(key)) throw new Error(`未知结局：${id}/${key}`)
      const records = state.campaign.records, zones = state.scenarioZones || {}
      if (id === 'theMiskatonicMuseum') {
        records[key === 'r1' ? 'theInvestigatorsDestroyedTheNecronomicon' : key === 'r2'
          ? 'theInvestigatorsTookCustodyOfTheNecronomicon' : 'theInvestigatorsFailedToRecoverTheNecronomicon'] = true
        if (key === 'r2') { awardStoryCard(state, '02140', id); changeChaosBag(state, 'elderthing', 1, { permanent: true }) }
      } else if (id === 'theEssexCountyExpress') {
        if (key !== 'r1') records.theInvestigatorsWereDelayedOnTheirWayToDunwich = true
        for (const inv of state.investigators.filter(i => i.defeated)) {
          const deck = state.campaign.investigators[inv.seat].deck
          for (const [code, record] of [...scholars.map(([c, k]) => [c, `${k}WasKidnapped`]), ['02140', 'theNecronomiconWasStolen']]) {
            if (deck.includes(code)) { records[record] = true; removeCampaign(state, code) }
          }
          campaignCardChange(state.campaign, inv.seat, '02178', 'add', id)
        }
        return { award: true, seatBonus: seat => state.investigators[seat].defeated ? 1 : 0 }
      } else if (id === 'bloodOnTheAltar') {
        records[{ noResolution: 'theRitualWasCompleted', r1: 'theInvestigatorsPutSilasBishopOutOfHisMisery',
          r2: 'theInvestigatorsRestoredSilasBishop', r3: 'theInvestigatorsBanishedSilasBishop' }[key]] = true
        const sacrificed = [...(zones.sacrificed || []), ...(key === 'noResolution' ? zones.sacrifices || [] : [])]
        // Only unique characters are recorded as sacrificed and removed from the
        // campaign decks. A non-unique Ally asset simply returns to its owner.
        const characters = sacrificed.filter(code => ALL_CARDS[code]?.unique)
        records.sacrificedToYogSothoth = [...new Set([...(records.sacrificedToYogSothoth || []), ...characters])]
        for (const code of characters) removeCampaign(state, code)
        if (key !== 'r2' && state.investigators.some(i => i.defeated && state.campaign.investigators[i.seat].deck.includes('02140'))) removeCampaign(state, '02140')
        return { award: true, bonus: 2 }
      } else if (id === 'undimensionedAndUnseen') {
        if (key === 'r2') records.noBroodEscapedIntoTheWild = true
        else records.broodEscapedIntoTheWild = (zones.brood?.remaining || 0) + state.enemies.filter(e => e.code === '02255').length
        removeCampaign(state, '02219')
      } else if (id === 'whereDoomAwaits') {
        if (key === 'r1') records.theInvestigatorsEnteredTheGate = true
        else { endWorld(state); return { award: false } }
      } else if (id === 'lostInTimeAndSpace') {
        for (const inv of state.investigators.filter(i => i.defeated)) state.campaign.investigators[inv.seat].status = 'killed'
        const outcome = key === 'noResolution' ? (state.actIndex === 3 ? 'r2' : 'r4') : key
        if (outcome === 'r1') {
          records.theInvestigatorsClosedTheTearInReality = true
          for (const inv of state.investigators) { api.addTrauma(state, inv.seat, 'physical', 2, events); api.addTrauma(state, inv.seat, 'mental', 2, events) }
          return { award: true, bonus: 5 }
        }
        if (outcome === 'r3') { records.yogSothothHasFledToAnotherDimension = true; for (const record of Object.values(state.campaign.investigators)) record.status = 'killed' }
        if (outcome === 'r4') endWorld(state)
        return { award: false }
      }
      return { award: true }
    },
  }
}

function chooseStoryController(state, code, api) {
  const seat = requestChoice(state, { kind: 'story', source: code, seat: state.campaign.leadSeat,
    prompt: '选择剧情资产的控制者。', options: active(state).map(inv => ({ id: String(inv.seat), label: inv.name })) })
  api.giveAsset(Number(seat), code)
}

function endWorld(state) {
  state.campaign.records.yogSothothToreApartTheBarrierBetweenWorldsAndBecameOneWithAllReality = true
  state.campaign.failed = true
  for (const record of Object.values(state.campaign.investigators)) if (record.status !== 'killed') record.status = 'insane'
}

export function chooseBroodRandomLocation(state, api) {
  let chosen = state.locations[Math.floor(api.random() * state.locations.length)]
  if (original(chosen) !== '02245') return chosen
  const candidates = active(state).filter(inv => inv.location === chosen.id)
  for (const inv of candidates) {
    if (api.choose({ kind: 'reaction', source: '02245', seat: inv.seat, prompt: '进行敏捷（3）检定，成功后重新选择随机地点？',
      options: [{ id: 'skip', label: '不触发' }, { id: 'trigger', label: '进行检定' }] }) !== 'trigger') continue
    let success = false
    api.test(inv.seat, 'agility', 3, result => { success = result.success })
    if (success) {
      const others = state.locations.filter(loc => loc.id !== chosen.id)
      if (others.length) chosen = others[Math.floor(api.random() * others.length)]
      break
    }
  }
  return chosen
}

function moveBroodToward(state, enemy, target, api) {
  const here = state.locations.find(loc => loc.id === enemy.location)
  if (!here || here.id === target) return
  const distance = new Map([[target, 0]]), queue = [target]
  for (const id of queue) {
    const location = state.locations.find(loc => loc.id === id)
    for (const neighbor of location?.connections || []) if (!distance.has(neighbor)
      && state.locations.some(loc => loc.id === neighbor)) {
      distance.set(neighbor, distance.get(id) + 1)
      queue.push(neighbor)
    }
  }
  const adjacent = here.connections.filter(id => distance.has(id))
  if (!adjacent.length) return
  const nearest = Math.min(...adjacent.map(id => distance.get(id)))
  const candidates = adjacent.filter(id => distance.get(id) === nearest)
  const destination = candidates.length === 1 ? candidates[0] : api.choose({
    kind: 'location', source: '02294', seat: state.campaign.leadSeat,
    prompt: `选择「${enemy.name}」的移动方向（等距路线）。`,
    options: candidates.map(id => ({ id, label: state.locations.find(loc => loc.id === id)?.name || id })),
  })
  if (api.moveEnemy) api.moveEnemy(enemy, destination)
  else { const previous = enemy.location; enemy.location = destination; encounterRules.enemyMoved(state, enemy, previous, api) }
}

function choosePlayerDeckCard(state, inv, count, allowed, api, prompt) {
  const top = inv.deck.map((code, index) => ({ code, index })).slice(-count).filter(item => allowed(item.code))
  if (top.length) {
    const choice = api.choose({ kind: 'card', source: 'deck-search', seat: inv.seat, prompt,
      options: top.map(item => ({ id: String(item.index), label: ALL_CARDS[item.code]?.nameZh || item.code })) })
    inv.hand.push(inv.deck.splice(Number(choice), 1)[0])
  }
  for (let i = inv.deck.length - 1; i > 0; i--) {
    const j = Math.floor(api.random() * (i + 1))
    ;[inv.deck[i], inv.deck[j]] = [inv.deck[j], inv.deck[i]]
  }
}

function discardEncounterLocation(state, loc, api, shuffleBack = false) {
  api.remove(loc.id)
  const code = original(loc)
  if (shuffleBack) { state.encounterDeck.push(code); api.shuffleEncounterDeck() }
  else state.encounterDiscard.push(code)
}

export function summonHorror(state, location, api) {
  const zones = state.scenarioZones
  let enemy = state.enemies.find(e => e.code === '02141')
  if (!enemy) {
    for (const pile of [state.encounterDeck, state.encounterDiscard]) { const index = pile.indexOf('02141'); if (index >= 0) pile.splice(index, 1) }
    enemy = api.spawn('02141', location)
    if (!enemy) return null
    // The engine's enemySpawned hook normally attaches Shadow-spawned; stub
    // APIs (tests, custom runtimes) fall back to attaching it here.
    if (!enemy.shadowSpawned) attachShadowSpawned(state, enemy, api)
  } else enemy.location = location
  enemy.exhausted = false
  return enemy
}

// "When Hunting Horror enters play: Attach the set-aside copy of Shadow-spawned
// to it, or add 1 resource to it if it is already attached."
function attachShadowSpawned(state, enemy, api) {
  if (enemy.shadowSpawned) return
  const zones = state.scenarioZones
  let resources = 0
  if (zones.void) {
    resources = (zones.void.resources || 0) + 1
    delete zones.void
  } else {
    const index = (zones.setAside || []).indexOf('02142')
    if (index >= 0) zones.setAside.splice(index, 1)
  }
  enemy.shadowResources = resources
  enemy.shadowSpawned = true
  enemy.fight += resources
  enemy.evade += resources
  enemy.health += resources
  enemy.massive = resources >= 3
  api.info?.(`「追猎恐魔」附属「暗影之子」（${resources} 资源${resources >= 3 ? '，获得巨大' : ''}）。`)
}
