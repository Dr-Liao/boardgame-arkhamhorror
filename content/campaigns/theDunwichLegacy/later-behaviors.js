import { ALL_CARDS } from '../../../src/cards/cards-data.js'
import { actRuleFor, agendaRuleFor, assetRuleFor, encounterResolveCampaignsFor, encounterResolveFor, enemyRuleFor, enemyScriptFor, foundCardRuleFor, locationRuleFor, threatEffectFor, treacheryRuleFor } from '../../../src/cards/card-rules.js'
// 第 81 轮：跨卡限制统一读条目标志，不再按卡号查资产/威胁。
const hasThreatFlag = (inv, flag) => (inv?.threat || []).some(item => threatEffectFor(original(item))?.[flag] === true)
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
        if (records.naomiHasTheInvestigatorsBacks) state.investigators[state.campaign.leadSeat].clues += state.numInvestigators >= 3 ? 2 : 1
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
      // 第 56 轮：已条目化的诡计直接走条目；章节私有的多卡流程仍在下面按场景分支。
      const entryResolve = encounterResolveFor(code)
      if (entryResolve && encounterResolveCampaignsFor(code).includes('dunwich')) {
        return entryResolve(state, inv, card, api, { location: state.locations.find(loc => loc.id === inv.location) })
      }
      // 第 77 轮：02178 已条目化；未迁移的遭遇统一走共享解析器。
      // 第 63 轮：02332 已条目化；未迁移的遭遇统一走共享解析器。
      // 第 61 轮：02258/02259 已条目化；未迁移的遭遇统一走共享解析器。
      return encounterRules.resolveEncounter(state, inv, card, api)
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
    locationEntered(state, inv, loc, api, companions = []) {
      if (!loc) return
      encounterRules.locationEntered(state, inv, loc, api, companions)
      // 第 68 轮：旅客车厢 02167–02171 的进入规则在地点条目的 onEnter.effect。
    },
    encounterDrawn(state, inv, code, api) {
      encounterRules.encounterDrawn(state, inv, code, api)
      if (id === 'whereDoomAwaits' && original(state.locations.find(loc => loc.id === inv.location)) === '02284'
        && ALL_CARDS[code]?.traits?.some(trait => trait.toLowerCase() === 'hex')) api.damage(inv.seat, 1)
    },
    skipUpkeepDraw(state, inv) {
      return id === 'lostInTimeAndSpace' && original(state.locations.find(loc => loc.id === inv.location)) === '02321'
    },
    canGainResources(state, inv) {
      if (!encounterRules.canGainResources(state, inv)) return false
      // 第 72 轮：02126/02206 的「不能获得资源」在地点条目声明。
      const code = original(state.locations.find(loc => loc.id === inv.location))
      return locationRuleFor(code)?.canGainResources !== false
    },
    enemyStatModifier(state, enemy, stat) {
      const loc = state.locations.find(item => item.id === enemy.location), code = original(loc)
      // 第 66 轮：敌人脚本的 statModifier 与当前地点的 enemyEvadeModifier 走条目声明。
      const scriptModifier = enemyScriptFor(original(enemy))?.statModifier?.(state, enemy, stat)
      const locationModifier = locationRuleFor(code)?.enemyEvadeModifier
      // 多个来源要相加，不能提前 return 把后续修正吞掉（02239 +1 与 02244/02245 -1）。
      let total = scriptModifier || 0
      if (stat === 'evade' && locationModifier) total += locationModifier
      if (id === 'undimensionedAndUnseen' && state.agendaIndex === 2 && enemy.traits?.some(t => t.toLowerCase() === 'abomination')) total += 1
      return total
    },
    enemyAttackModifier(state, enemy) {
      return id === 'bloodOnTheAltar' && original(state.locations.find(loc => loc.id === enemy.location)) === '02202'
        ? { horror: 1 } : null
    },
    canEvadeEnemy(state, inv, enemy) {
      return enemyRuleFor(original(enemy))?.cannotEvade !== true
    },
    canOpportunityAttack(state, enemy) {
      return enemyRuleFor(original(enemy))?.cannotOpportunityAttack !== true
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
      const song = inv.threat.find(item => treacheryRuleFor(original(item))?.song)
      if (!song) return harm
      inv.threat.splice(inv.threat.indexOf(song), 1)
      state.encounterDiscard.push(song.code)
      return { ...harm, damage: harm.damage + 2 }
    },
    enemyAttackResolved(state, enemy, inv) {
      // 第 75 轮：02295 的「击败调查员即死亡」在 enemyScript.onAttackResolved。
      encounterRules.enemyAttackResolved(state, enemy, inv)
    },
    turnEnded(state, inv, api) {
      encounterRules.turnEnded?.(state, inv, api)
      // 第 82 轮：02249 的回合结束伤害在地点条目 turnEndDamage。
      const turnEndDamage = locationRuleFor(original(state.locations.find(loc => loc.id === inv.location)))?.turnEndDamage
      if (turnEndDamage) api.damage(inv.seat, turnEndDamage)
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
      const alliesBlank = hasThreatFlag(inv, 'blanksAllies')
      let bonus = encounterRules.statModifier(state, inv, skill)
      if (id === 'theMiskatonicMuseum') {
        const loc = state.locations.find(item => item.id === inv.location)
        if (skill === 'agility' && original(loc) === '02132') bonus += 2
        if (!alliesBlank && state.skillTest?.source?.label === '调查' && skill === 'intellect' && inv.assets.some(asset => assetRuleFor(original(asset))?.intellectClueAssist)
          && loc?.traits?.some(trait => trait.toLowerCase() === 'miskatonic')) bonus += 2
      }
      if (id === 'undimensionedAndUnseen' && skill === 'willpower'
        && ['02250', '02251'].includes(original(state.locations.find(loc => loc.id === inv.location) || {}))) bonus--
      return bonus
    },
    enemyPhaseEnd(state, api) {
      // 第 82 轮：02294 的「到达山顶移除并加毁灭」在 enemyRule.alteredHerald。
      for (const enemy of [...state.enemies].filter(item => enemyRuleFor(original(item))?.alteredHerald)) {
        if (enemy.location === L('02284')) {
          state.enemies.splice(state.enemies.indexOf(enemy), 1)
          state.encounterDiscard.push(enemy.code)
          state.doom += 2
        } else moveBroodToward(state, enemy, L('02284'), api)
      }
      if (id !== 'undimensionedAndUnseen' || state.agendaIndex > 2) return
      for (const enemy of state.enemies.filter(item => enemyRuleFor(original(item))?.brood)) {
        const destinations = state.locations
        if (!destinations.length) continue
        const target = chooseBroodRandomLocation(state, api)
        moveBroodToward(state, enemy, target.id, api)
      }
    },
    enemyPhaseStart(state, api) {
      if (id !== 'theMiskatonicMuseum') return
      const horror = state.enemies.find(enemy => enemyRuleFor(original(enemy))?.huntingHorror)
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
      for (const enemy of state.enemies.filter(item => enemyRuleFor(original(item))?.brood && item.rainClues)) {
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
        && !hasThreatFlag(inv, 'blanksAllies') && result.source?.type === 'encounter'
        && (state.scenario.treacheries[result.source.code]
          || Object.values(state.scenario.treacheries || {}).some(card =>
            (card.originalCode || card.code) === result.source.code))) {
        const ally = inv.assets.find(asset => assetRuleFor(original(asset))?.cancelEncounterReaction && !asset.exhausted)
        if (ally && api.choose({ kind: 'reaction', source: '02217', seat: inv.seat, canSkip: true,
          prompt: '横置泽布伦·沃特雷，抽 1 张牌？',
          options: [{ id: 'yes', label: '横置并抽牌' }, { id: 'no', label: '不触发' }] }) === 'yes') {
          ally.exhausted = true; api.drawCards(inv.seat, 1)
        }
      }
      if (!result.success && result.source?.label === '调查') {
        // 第 82 轮：02205 的「调查失败把线索转成毁灭」在地点条目 onInvestigateFail。
        const loc = state.locations.find(item => item.id === inv.location)
        locationRuleFor(original(loc))?.onInvestigateFail?.(state, inv, loc)
      }
    },
    afterEvade(state, inv, enemy, result, api) {
      if (hasThreatFlag(inv, 'blanksAllies')) return
      const ally = inv.assets.find(asset => assetRuleFor(original(asset))?.cancelTreacheryReaction && !asset.exhausted)
      if (ally && api.choose({ kind: 'reaction', source: '02218', seat: inv.seat, canSkip: true,
        prompt: '横置厄尔·索耶，抽 1 张牌？',
        options: [{ id: 'yes', label: '横置并抽牌' }, { id: 'no', label: '不触发' }] }) === 'yes') {
        ally.exhausted = true; api.drawCards(inv.seat, 1)
      }
    },
    agendaReveal(state, agenda, api) {
      // 第 64 轮：全部密谋规则已条目化，这里只做注册表分派。
      const entry = agendaRuleFor(original(agenda))
      if (entry?.onReveal) return entry.onReveal(state, agenda, api)
    },
    enemyDefeated(state, enemy, api) {
      encounterRules.enemyDefeated(state, enemy, api)
      if (enemy.attachedTreacheries?.length) state.encounterDiscard.push(...enemy.attachedTreacheries)
      // 第 65 轮：02141 的虚空记录、02224 的线索、02323 的结局都走 enemyScript.onDefeated。
      return enemyScriptFor(original(enemy))?.onDefeated?.(state, enemy, api) === true
    },
    cluesRemoved(state, loc, amount, api) {
      // 第 66 轮：02325 的「最后一个线索被移除」在地点条目的 onCluesRemoved。
      locationRuleFor(original(loc))?.onCluesRemoved?.(state, loc, api, amount)
    },
    cluesOnReveal(state, loc) {
      // 第 66 轮：异变小径的线索归零由当前幕的 actRule.cluesOnReveal 声明。
      const rule = actRuleFor(original(state.acts[state.actIndex] || {}))
      if (rule?.cluesOnReveal == null) return null
      if ((loc.traits || []).some(trait => String(trait).toLowerCase() === 'altered')) return null
      return rule.cluesOnReveal
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
      if (assetRuleFor(original(asset))?.passenger) this.storyAssetLeftPlay(state, asset, api)
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
    drawLocation(state, seat, code, api, meta = {}) {
      if (id !== 'lostInTimeAndSpace') throw new Error('当前剧本不使用遭遇地点')
      const loc = api.placeEncounterLocation(code)
      // 第 69 轮：02324–02328 的「放置后立刻结算」在地点条目的 onDraw。
      locationRuleFor(code)?.onDraw?.(state, loc, api, seat, meta)
      return loc
    },
    actReveal(state, act, api) {
      // 第 64 轮：全部幕规则已条目化，这里只做注册表分派。
      const entry = actRuleFor(original(act))
      if (entry?.onReveal) return entry.onReveal(state, act, api)
    },
    checkObjectives(state, api) {
      const rule = actRuleFor(original(state.acts[state.actIndex] || {}))
      const entered = c => active(state).some(i => i.location === L(c))
      const empty = c => state.locations.some(l => l.id === L(c) && l.revealed && l.clues === 0)
      // 第 71 轮：幕目标条件与结局条件由 actRule.objective / actRule.finish 声明。
      if (rule?.objective?.(state, { entered, empty })) api.advanceAct()
      if (rule?.finish?.when?.(state)) api.finish(rule.finish.resolution)
    },
    investigatorEntryError(state, loc, inv = state.investigators[state.currentSeat]) {
      if (inv.steamImmobileRound === state.round) return '本轮受到蒸汽之爪影响，不能移动'
      if (state.enemies.some(enemy => enemyRuleFor(original(enemy))?.blocksMovementWhileEngaged && enemy.engagedSeat === inv.seat)) return '与攫取恐怖交战时不能移动'
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
      // 第 70 轮：02130/02131/02137/02174 的调查限制在地点条目声明。
      return locationRuleFor(original(loc))?.investigationError?.(state, inv, loc) || null
    },
    // 02213 学校：只能通过调查发现线索。第三个参数是**发现的目标地点**（02224 可以
    // 从任意地点发现线索），缺省时才回落到调查员所在地点。
    canDiscoverClues(state, inv, location = null) {
      const here = location || state.locations.find(loc => loc.id === inv.location)
      if (id !== 'bloodOnTheAltar' || !here || original(here) !== '02213') return true
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
      if (id === 'theMiskatonicMuseum') {
        if (original(state.locations.find(loc => loc.id === inv.location)) === '02128'
          && state.scenarioFlags[`security:${inv.seat}`] !== state.round) moves.push({ action: 'scenarioAction', rule: 'searchSecurityOffice', actions: inv.assets.some(asset => assetRuleFor(original(asset))?.securityKeys) ? 1 : 2,
            label: '保安办公室：搜索牌库顶 6 张牌' })
        if (original(state.locations.find(loc => loc.id === inv.location)) === '02129'
          && state.scenarioFlags[`security:${inv.seat}`] !== state.round)
          moves.push({ action: 'scenarioAction', rule: 'inspectSecurityOffice', actions: inv.assets.some(asset => assetRuleFor(original(asset))?.securityKeys) ? 1 : 2,
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
        // 第 72 轮：02172/02174 的场景行动在地点条目声明。
        locationRuleFor(original(here))?.actions?.({ state, inv, loc: here, add, moves })
        const passenger = (state.storyAssets || []).find(asset => assetRuleFor(original(asset))?.passenger && asset.location === inv.location && asset.controllerSeat == null)
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
            reason: inv.assets.some(asset => assetRuleFor(original(asset))?.chamberKey) ? null : '需要控制密室钥匙' })
      }
      if (id === 'undimensionedAndUnseen') {
        const here = state.locations.find(loc => loc.id === inv.location)
        const brood = state.enemies.filter(enemy => enemyRuleFor(original(enemy))?.brood && enemy.location === inv.location)
        const powder = inv.assets.find(asset => assetRuleFor(original(asset))?.powder)
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
        if (inv.assets.some(asset => assetRuleFor(original(asset))?.formula)) {
          const abominations = state.enemies.filter(enemy => enemy.location === inv.location && enemy.traits?.includes('Abomination'))
          if (abominations.length) for (const enemy of abominations)
            moves.push({ action: 'scenarioAction', rule: 'castFormula', attack: true, enemyId: enemy.id,
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
          reason: state.enemies.some(enemy => enemyRuleFor(original(enemy))?.brood && enemy.location !== inv.location) ? null
            : '没有在别处的子嗣' })
        if (original(here || {}) === '02251') moves.push({ action: 'scenarioAction', rule: 'redirectBrood',
          label: '检定智识 4，引导子嗣移动',
          reason: state.enemies.some(enemy => enemyRuleFor(original(enemy))?.brood) ? null : '场上没有子嗣' })
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
          this.drawLocation(state, inv.seat, code, api, { fromDiscard: true })
        }
      } else if (move.rule === 'resignBeyond') api.resign(inv.seat)
      else if (move.rule === 'inspectSecurityOffice') {
        const options = state.locations.filter(loc => loc.traits?.includes('Exhibit')).map((loc, i) => ({ id: loc.id, label: `查看展厅 ${i + 1}` }))
        if (state.scenarioZones.exhibits.length) options.push({ id: 'top', label: '查看展厅牌库顶牌' })
        const choice = api.choose({ kind: 'inspect', source: '02129', seat: inv.seat, prompt: '选择要查看的展厅。', options })
        const code = choice === 'top' ? state.scenarioZones.exhibits.at(-1) : original(state.locations.find(loc => loc.id === choice))
        const definition = ALL_CARDS[code] || {}
        const stats = `帷幕 ${definition.shroud ?? '?'}，线索 ${definition.clues ?? '?'}`
          + (definition.victory ? `，胜利 ${definition.victory}` : '')
          + (definition.traits?.length ? `，特性 ${definition.traits.join('/')}` : '')
        api.choose({ kind: 'inspect', source: '02129', seat: inv.seat, prompt: '查看完毕后确认。',
          options: [{ id: 'done', label: `${definition.nameZh || definition.name || code}：${stats}。${definition.textZh || definition.text || ''}` }] })
        state.scenarioFlags[`security:${inv.seat}`] = state.round
      } else if (move.rule === 'searchUnderLocation' && id === 'bloodOnTheAltar') {
        const code = state.scenarioZones.underLocations[inv.location]
        if (!code || state.scenarioFlags[`searched:${inv.location}`]) throw new Error('此地点没有可揭示的底牌')
        delete state.scenarioZones.underLocations[inv.location]
        state.scenarioFlags[`searched:${inv.location}`] = true
        // 第 78 轮：02214/02215 翻出时的结算在条目 onFound；其余底牌仍洗回遭遇牌库。
        const found = foundCardRuleFor(code)
        if (found) {
          found(state, inv, api, { sourceLocation: state.locations.find(loc => loc.id === inv.location) })
        } else { state.encounterDeck.push(code); api.drawEncounter(inv.seat) }
      } else if (move.rule === 'attachChamberKey' && id === 'bloodOnTheAltar') {
        const index = inv.assets.findIndex(asset => assetRuleFor(original(asset))?.chamberKey)
        if (index < 0) throw new Error('没有密室钥匙')
        inv.assets.splice(index, 1)
        state.scenarioFlags.chamberUnlocked = true
        state.scenarioZones.keyAttached = '02215'
      } else if (move.rule === 'castFormula' && id === 'undimensionedAndUnseen') {
        const enemy = state.enemies.find(item => item.id === move.enemyId && item.traits?.includes('Abomination') && item.location === inv.location)
        if (!enemy || !inv.assets.some(asset => assetRuleFor(original(asset))?.formula)) throw new Error('没有合法的深奥咒文目标')
        if (api.aloofPreventsAttack?.(enemy, inv)) throw new Error('冷漠敌人未与调查员交战，不能直接攻击')
        // 02254 是[[法术]]支援：02094 鸟之奴仆「被远程/枪械/法术支援攻击时 -3 攻击值」也要作用于咒文攻击，
        // 不能只走 combat.js 的普通攻击路径，否则难度会是 5 而不是 2。
        const spellReduction = enemyRuleFor(original(enemy))?.rangedAttackDifficultyReduction || 0
        const formulaDifficulty = Math.max(0, enemy.fight + this.enemyStatModifier(state, enemy, 'fight') - spellReduction)
        api.test(inv.seat, 'willpower', formulaDifficulty, result => {
          if (result.success) api.damageEnemy(enemy.id, 1 + (result.damageBonus || 0), inv.seat, '02254')
          else if (enemy.retaliate && !enemy.exhausted) api.attack(enemy, inv)
        }, () => 2 * (enemy.clues || 0), { label: '攻击', name: enemy.name, code: enemy.code, enemyId: enemy.id })
      } else if (move.rule === 'powderBrood' && id === 'undimensionedAndUnseen') {
        const powder = inv.assets.find(asset => assetRuleFor(original(asset))?.powder)
        const enemy = state.enemies.find(item => item.id === move.enemyId && enemyRuleFor(original(item))?.brood
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
        const candidates = state.enemies.filter(enemy => enemyRuleFor(original(enemy))?.brood && enemy.location !== inv.location)
        if (!candidates.length) throw new Error('没有可移动的子嗣')
        const picked = api.choose({ kind: 'target', source: '02243', seat: inv.seat,
          prompt: '选择向敦威治村移动的子嗣。', options: candidates.map(item => ({ id: item.id, label: `${item.name}（${state.locations.find(loc => loc.id === item.location)?.name || item.location}）` })) })
        const enemy = candidates.find(item => item.id === picked)
        if (enemy) moveBroodToward(state, enemy, inv.location, api)
      } else if (move.rule === 'redirectBrood' && id === 'undimensionedAndUnseen') {
        const candidates = state.enemies.filter(item => enemyRuleFor(original(item))?.brood)
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
        const index = state.storyAssets.findIndex(asset => assetRuleFor(original(asset))?.passenger && asset.location === inv.location && asset.controllerSeat == null
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
        api.investigate(inv.seat, {
          allowNoClues: true, noClueDiscovery: true,
          onInvestigateSuccess: () => { loc.doom -= 1 },
        })
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
        // 卡面是「调查」行动：走统一调查管线（调查加值/成功失败窗口/地点限制），
        // 成功后改为把小径放入场，而不是发现线索。
        api.investigate(inv.seat, {
          allowNoClues: true, noClueDiscovery: true,
          onInvestigateSuccess: () => {
            const path = L(state.scenarioZones[move.rule].pop())
            if (!path) return
            api.place(path)
            if (!loc.connections.includes(path)) loc.connections.push(path)
          },
        })
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
        else records.broodEscapedIntoTheWild = (zones.brood?.remaining || 0) + state.enemies.filter(e => enemyRuleFor(original(e))?.brood).length
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
  let enemy = state.enemies.find(e => enemyRuleFor(original(e))?.huntingHorror)
  if (!enemy) {
    for (const pile of [state.encounterDeck, state.encounterDiscard]) { const index = pile.indexOf('02141'); if (index >= 0) pile.splice(index, 1) }
    enemy = api.spawn('02141', location)
    if (!enemy) return null
    // The engine's enemySpawned hook normally attaches Shadow-spawned; stub
    // APIs (tests, custom runtimes) fall back to attaching it here.
    if (!enemy.shadowSpawned) attachShadowSpawned(state, enemy, api)
  } else if (api.moveEnemy) api.moveEnemy(enemy, location)
  else enemy.location = location
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

