# TFA Scenario Authoring Cookbook (for authoring 9 TCU scenarios)

Audience: an AI engineer writing `content/campaigns/theCircleUndone/scenarios/<id>/{index,definition,layout,behavior}.js`.
Source of truth studied (repo `games/arkhamhorror`, state 2026-10-24):

- `content/campaigns/theForgottenAge/scenarios/theDoomOfEztli/*` (full),
  plus `theUntamedWilds`, `threadsOfFate`, `theBoundaryBeyond`, `theCityOfArchives` behavior/definition/layout/index.
- `content/campaigns/theForgottenAge/{card-data,encounter-rules,tfa-chaos,keywords,record-labels,manifest,shared}.js`
- `content/{scenario-manifest,registered,registry,schema,scenario-declaration,identities,mechanics}.js`
- `src/engine/**` dispatch sites (all `scenarioBehavior(state).X?.(…)` call sites were enumerated).
- `src/cards/card-rules.js`, `src/cards/encounter-entries/**`
- `tests/tfa-doom-of-eztli.test.mjs`, `tests/tfa-untamed-wilds.test.mjs`, `tests/tfa-engine-setups.test.mjs`,
  `tests/tfa-engine-integration.test.mjs`, `tests/tfa-scenario-acceptance.test.mjs`, `tests/suites.mjs`, `tests/node-suite.mjs`
- `tools/audit-tfa-scenarios.mjs`, `audit/tfa-scenario-acceptance.json`, `audit/tfa-browser-acceptance.json`
- `docs/arkham-content-migration.md` §3/§4.5.1/§5/§5.1/§5.2/§8/§9

Everything below is derived from those files; identifiers are quoted verbatim.

---

## 0. The 60-second mental model

A scenario is **1 data object + 1 layout + 1 behavior object**, packaged by `index.js` into
`{ scenario, identities, layout, behavior, implementedEncounterCodes, manifest }`.
The engine looks the behavior up by **scenario id** and calls optional hooks:

```js
// src/engine/engine.js:159
const scenarioBehavior = state => state.scenario ? contentRegistry.getBehavior(state.scenario.id) || {} : {}
```

So: **every hook is optional** (`?.()`); a missing hook is a silent no-op — except
`actReveal` / `agendaReveal` (throw when `reveal.type === 'campaignRule'`),
`resolveEncounter` (needed for every `effect.kind === 'campaignRule'` treachery),
`performAction` / `performEncounterAction` (needed if `actions()` / `encounterActions()` advertise a move),
and `drawEncounterLocation` (throws if `api.drawEncounterLocation` is used).

`state.scenario` is a **`structuredClone` of the registered definition** (`src/engine/setup.js:510-512`),
so run-time mutation of `state.scenario.*` is per-game and save-safe; module-level objects must never be mutated.

---

## 1. Exact contract of a scenario directory

```
content/campaigns/<campaign>/scenarios/<scenarioId>/
├─ index.js        # packaging + manifest (the only file the registry imports as a module)
├─ definition.js   # `scenario` data object + `identities`
├─ layout.js       # `layout` presentation coordinates/edges
└─ behavior.js     # `behavior` hook object (+ optional named helpers/exports)
```

### 1.1 `definition.js` must export

```js
export const scenario = { … }          // required
export const identities = identitiesFor(scenario); bindScenarioIdentities(scenario, identities)  // required
```

`scenario` fields actually consumed (all verified):

| field | type | consumed by |
|---|---|---|
| `id` | string, `^[a-z][A-Za-z0-9-]*$` | registry identity check (`registry.js:14`) |
| `originalCode` | printed scenario card code, e.g. `'04054'` | `identitiesFor` → `identities.scenario[id].originalCode` |
| `name` | string (used verbatim in UI/logs) | `scenarioManifest` |
| `intro` | string (fallback for `storyText` check) | `setup.js` intro story + audit |
| `setup` | string (human setup text, log/UI only) | content/UI |
| `startLocation` | location **id** (not code) | `manifest.startLocationId`, `setup.js` fallback |
| `locations` | `{ [id]: locationDef }` | manifest, engine, layout |
| `setAsideLocations` | location **ids** | `manifest.zones.setAside` (converted to codes) |
| `acts` | array (`stages([...], 'act')`) | manifest/engine |
| `agendas` | array (`stages([...], 'agenda')`) | manifest/engine |
| `scriptCards` | `{ explore: {card,codes?}, rules: {rule: {card,codes?}} }` | `src/engine/script-cards.js` |
| `storyAssets` | `storyCards([codes])` object | engine `spawnStoryAsset`, zones |
| `encounterDeck` | **flat array of codes** (`encounterDeck(cards)`, duplicates for quantity) | `setup.js` shuffle into `state.encounterDeck` |
| `…definitions` | spread of `encounterDefinitions([...])` → `{ enemies, treacheries }` | engine |
| `resolutions` | `{ noResolution, r1, … }` | `manifest.resolutionIds = Object.keys(resolutions)` |
| `agentSets` | `{ setId: [codes] }` (Only the shipped `theUntamedWilds` uses it) | zone report + `declareScenario` `setup.deck.addAgentSet` |
| `cultistDeck` | `[codes]` (NotZ style) | `setup.js`, zone report `sideAliases` |
| `locationsStartRevealed` | boolean | `locations.js:136` |
| `locationVariants` | `{ slotId: [variantDef…] }` | `state.locationVariants` (MidnightMasks / CityOfArchives pattern) |
| `tokenMeanings` | `{ [difficulty]: { token: {…} } }` | fallback in `treachery-tokens.js` when `resolveChaosToken` returns falsy |
| `chaosBagExtra` | `[tokens]` | `setup.js` pushes after `initializeChaosBag` |
| `storyInvestigators` | `{ codes, … }` | normalized in `registry.js` via `normalizeStoryInvestigatorConfig` |
| `passagewayLocations` | `[ids]` | content helper `connectPassagewaysInEntry` |

`identitiesFor(scenario)` builds `{ scenario, locations, acts, agendas, enemies, treacheries, storyAssets }`
maps of `{ originalCode, linkedOriginalCode? }` keyed by **rule id** (`card.id || card.code`).
`bindScenarioIdentities` then `Object.assign`s `{ ruleId, identityStatus: 'mapped' | 'approximation' }`
onto each definition and freezes the identity objects. The audit requires
`identity.originalCode && identity.identityStatus === 'mapped'` for **every** category entry.

`stages(codes, 'act'|'agenda')` (`card-data.js:134`) produces:
`{code, originalCode, name, text, textEn, traits, subname, flavor, type:'act'|'agenda', id:'act1'|'agenda1', stage:'1a', doomThreshold?, doomThresholdPerInvestigator?, backText, advanceText}`.
`doomThreshold` comes from `card.doom`; `doomThresholdPerInvestigator` is set when `card.doomPerInvestigator`
(engine's `resolveAgendaDoomThresholds` then multiplies by investigator count).

`location(id, code, extra)` (`card-data.js:66`) produces
`{…printed(code), id, type:'location', shroud, cluesPerInvestigator, cluesFixed?, victory, connections, symbols?}`.
Extra keys pass through untouched (`explicitConnections`, `vengeance`, `victory`, `back`, custom flags).

### 1.2 `layout.js` must export

```js
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'
const coordinates = { entryway: { x: 0, y: 2 }, … }
export const layout = layoutFor(scenario, coordinates)   // → { locations:{id:{x,y}}, edges:[{from,to}] }
```

### 1.3 `index.js` must export (verbatim TFA pattern)

```js
import { scenario, identities } from './definition.js'
import { layout } from './layout.js'
import { behavior, implementedEncounterCodes } from './behavior.js'
import { scenarioManifest } from '../../../../scenario-manifest.js'

export { scenario, identities, layout, behavior, implementedEncounterCodes }
export const manifest = scenarioManifest(scenario, identities, {
  campaignId: 'theForgottenAge',
  status: 'playable',              // 'catalog-only' | 'development' | 'playable' | 'verified'
  layout,
  requiredPackIds: ['core', 'tfaCampaign'],
  requiredEncounterGroupIds: ['theDoomOfEztli', 'agentsOfYig', 'venom', 'flux', 'traps', 'ruins', 'poison', 'chillingCold'],
  requiredMechanicIds: ['tfaExploration', 'tfaSupplies', 'tfaVengeance', 'tfaPoisoned', 'tfaRelicOfAges'],
  setAsideLocations: ['chamberOfTime'],            // ids (optional; also read from scenario.setAsideLocations)
  setAsideAliases: ['04061','04062','04102','04102','04102','04102'],  // codes, duplicates allowed
  inPlayAliases: [],                               // only if cards start in play (theLastKing/theHouseAlwaysWins)
  requiredInvestigatorIds: [],
  recordReads: [...], recordWrites: [...],
  behaviorIds: [behavior.id],
  sharedIdentities: {},                            // optional: alias → original code for cross-campaign shared cards
})
manifest.contentVersion = '1.0.0'                  // schema requires semver; scenarioManifest already sets 1.0.0
```

`manifest.zones` is computed by `scenarioManifest`:

```js
const sideAliases = [...(scenario.cultistDeck || []), ...Object.values(scenario.agentSets || {}).flat()]
zones = {
  encounterDeck: countZone(scenario, scenario.encounterDeck, sharedIdentities),   // [{cardCode,count}]
  setAside: countZone(scenario, sideAliases.concat(setAsideLocations, setAsideAliases), sharedIdentities),
  removed: [], victory: [],
  ...(inPlayAliases.length ? { inPlay: countZone(scenario, inPlayAliases, sharedIdentities) } : {}),
}
```

Non-standard manifest extensions are allowed and used by the UI/AI (e.g. `manifest.explorationLocations`,
`manifest.presentDayLocations` in `theBoundaryBeyond/index.js`). `Object.freeze` is *not* applied to the manifest,
so post-assignment works.

### 1.4 `behavior.js` must export

```js
export const implementedEncounterCodes = ['01167', …]   // optional; audit fallback evidence
export const behavior = {
  ...encounterRules,        // campaign-shared hooks (TFA pattern)
  id: 'theDoomOfEztli',     // MUST equal scenario.id and manifest.id
  // data fields
  roundEndActIndex: 2, locationsStartRevealed: true, spawnOverrides: {…}, drawCultistActIndex: 1,
  // hooks (see §2)
}
```

Optional extra named exports (`setupPlan`, `vengeanceEntries`, `totalVengeance`, `actInPlay`, …) are for
tests and other chapters; only `behavior` and `implementedEncounterCodes` are read by `index.js`/audit.

---

## 2. Complete hook catalogue (what the engine actually calls)

Dispatch is always `scenarioBehavior(state).hook?.(state, …)`; the **last argument is normally
`scenarioRuntime(state, events)`** (the "api", see §2.1). Hooks under `engine/setup.js` are the exception
(they receive a small helper object). Grouped by lifecycle; "→" gives return semantics.

### 2.1 The `api` object (`src/engine/scenario-runtime.js`, `createScenarioRuntime`)

Most-used members (all verified in that file):

`info(text)`, `privateInfo(seat,text)`, `cardName(code)`, `tokenLabel(token)`, `locName(id)`, `locationName(id)`,
`random()`, `shuffle(list)`, `choose(request)` (= `requestChoice`, **throws `ChoicePause`**),
`decideSeat()`, `preyTarget(rule, seats)`, `ruleCode(original)`,
`place(id)`, `reveal(id)`, `remove(id)`, `spawn(code, locationId)`, `spawnEngaged(code, locationId, seat)`,
`spawnStoryEnemy(code, location, stats, extra)`, `storyAsset(code, locationId)`,
`moveInvestigator(seat,id)`, `moveEnemy(enemy,id)`, `stepToward(from,to)`, `hunterStep(enemy,opts)`,
`damage(seat,n)`, `horror(seat,n)`, `directDamage`, `directHorror`, `assetsFirstDamage`, `healDamage`, `healHorror`,
`defeat(inv,cause)`, `resign(seat)`, `trauma(seat,kind,n)`, `attack(enemy, inv)`, `autoEngageAll()`,
`test(seat, skill, difficulty, resolve, skillBonus, source, options)`, `investigate(seat,opts)`, `investigateTest`,
`drawEncounter(seat)`, `drawCards(seat,n)`, `discardRandom(seat,n)`, `discardChosen(seat,n,source)`, `discardTop(seat,n)`,
`gainClues(seat,n)`, `discoverClue(seat,amount,locationId)`, `canDiscoverClueAt(seat,id)`, `spendClues(seat,n)`, `payClues(n,loc)`,
`chooseToken`-ish: `revealToken(seat)`, `drawEncounterDiscard`, `shuffleDiscard()`, `shuffleEncounterDeck()`,
`advanceAct()`, `advanceAgenda()`, `addDoom(n)`, `doomOn(card,n)`, `clearDoom()`, `finish(key)`,
`giveAsset(seat,code,extra)`, `playAsset(seat,code)`, `canPlayAsset(seat,code)`, `removeAsset`, `damageAsset`, `horrorAsset`, `discardAsset`,
`threat(seat,code,extra)`, `drawEncounterLocation(seat)`, `placeEncounterLocation(code)`,
`flipLocation(id,seat)`, `flipSpectral(id,seat,opts)`, `isSpectral(id)`, `flipEnemy(enemy,nextCode)`, `enemyFace`, `banish`,
`breach/removeBreach/breachOf/breachTotal/skullValue/locationFlag/setLocationFlag/hasLocationFlag`,
`haunted(seat,opts)`, `hauntedAt(id)`, `hauntedIs(id)`, `grantHaunted`, `clearHauntedGrants`,
`checkEnemyDefeat(enemy,source,seat)`, `damageEnemy(enemyId,amount,seat,source)`, `engage`, `evadeEnemy`, `discardEnemy`,
`removeEnemyFromGame`, `attackFromDiscard`, `devourLocation`, `moveRelicOfAges(payload)`, `relicOfAges()`, `relicOfAgesLocation()`,
`supplies(seat)`, `hasSupply(seat,name)`, `checkSupplies(seat,name)`, `grantSupplies`, `crossOffSupply`, `suppliesAt`,
`vengeance()`, `recordVengeance(n,card)`, `yigsFury()`, `addYigsFury(n)`, `isPoisoned(seat)`, `poison(seat)`,
`expeditionLeader()`, `setExpeditionLeader(seat)`, `buildExplorationDeck(codes)`, `addToExplorationDeck(codes,opts)`,
`explorationDeck()`, `shuffleExploration()`, `explore(seat)`, `extraDeck/extraDeckInfo/extraDecks/addExtra/shuffleExtra/drawExtra/…`,
`cosmos(opts)`, `locationDeck(id)`, `tarot.build/draw/choose/shuffleInto/discard/remaining/info`, `tarotInfo()`,
`campaignCard(code,seat,reason)`, `campaignCardChange(...)`.

Note: `api.choose` requires `state._resolution` (a rules transaction). Unit tests that call behavior hooks
directly must stub `choose`, `test`, `info`, `damage`, … (see §5).

### 2.2 Setup / deck / chaos bag (`src/engine/setup.js`)

| hook | signature (dispatch) | purpose / return |
|---|---|---|
| `preScenarioSetup` | `(state, events, api)` :610 | before locations/enemies/decks; build per-chapter structures (`preScenarioSetup` in threadsOfFate repairs act decks) |
| `setupLocations` | `(state, events, {randomValue, shuffle, info})` :650 | **returns array of location ids to place**; engine falls back to `[state.scenario.startLocation]`. Must also seed `state.scenarioZones`, `state.explorationDeck`, `state.scenarioFlags`, `state.storyAssets`, campaign reads |
| `setupEnemies` | `(state, events, {spawnEnemy, locName, info, choose})` :656 | spawn starting enemies; helper's `choose(options)` → `requestChoice(state, options)` |
| `modifyDeck` | `(state, deck, events, {randomValue, removeCardByCode, info})` :666 | **returns the modified deck array**; called before shuffle |
| `afterDeckSetup` | `(state, events, {info, randomValue, shuffle})` :676 | post-shuffle deck fixes |
| `afterChaosBagSetup` | `(state, events)` :617 | after chaos bag init; TFA applies `+1 per investigator` doom thresholds and replay doom here. **No api arg** |
| `locationsStartRevealed` | data `boolean` (`locations.js:136`) | place locations already revealed |
| `storyInvestigators` | data (scenario-level) | deck-less story investigators (TCU prologue) |
| `chaosBagExtra` | data `[tokens]` | appended to the bag |
| `cultistDeck` | data `[codes]` | NotZ-style separate deck |

### 2.3 Acts / agendas (`act-agenda.js`, `reveal.js`, `phases.js`)

| hook | signature | purpose / return |
|---|---|---|
| `actReveal` | `(state, act, api, revealType?)` `reveal.js:145,149,153` | act front/back resolution. With `reveal.type === 'campaignRule'` it is called with 3 args and **must exist** (throws otherwise). With other types, returning truthy consumes the event. TFA forwards to the card entry: `actRuleFor(String(original(act)))?.onReveal?.(state, act, api)` |
| `agendaReveal` | `(state, agenda, api, revealType?)` `phases.js:172-176` | same contract for agendas (`agendaRuleFor(code, scenarioId)`) |
| `actLeftPlay` | `(state, cur, api)` `act-agenda.js:60` | act leaves play before advancing |
| `actIndexAfterAdvance` | `(state, cur, api)` :63 | → integer to force the next `actIndex`; anything else → default `actIndex++` |
| `roundEndActIndex` | data `number` :92,105 | this act's `objective` is only checkable at round end (`timing:'roundEnd'`) |
| `checkObjectives` | `(state, api)` :141 | called from `checkAct` (action window / round end); call `api.advanceAct()` yourself |
| `agendaWouldAdvance` | `(state, api)` :188 | called for doom-threshold advance **after** a `agendaWouldAdvance` reaction window; truthy → cancel advance |
| `agendaAdvancing` | `(state, cur, api)` :193 | before the agenda back is resolved |
| `agendaLeftPlay` | `(state, cur, api)` :205 | |
| `agendaChain` | `(state, next, api)` :216 | → falsy stops the "advance directly to 2b" loop |
| `agendaForcedEnemyDefeated` | `(state, enemy, api)` :308 | agenda `forced.enemyDefeated` |
| `agendaForced` | `(state, when, api, forcedType)` `reveal.js:171` | generic `agenda.forced[when]` (e.g. `'roundEnd'`) |
| `doomPlaced` | `(state, card, amount, api)` `turn.js:104`, `act-agenda.js:331,340` | after doom is placed on a card |
| `doomCleared` | `(state, api)` `act-agenda.js:200`, `scenario-runtime.js:297` | after `state.doom`/card doom reset |
| `storyResolutionKey` | `(state, key)` `campaign-flow.js:132` | → key used for story lookup (alias old keys) |
| `resolution` | `(state, key, events, api)` `campaign-flow.js:205` | **the only place rewards/records are written.** Returns `{ award?:bool, bonus?:number, seatBonus?(seat), effects?, restarted? }`; `award` default `true`. `api.choose` and `api.restartScenario()` are available |

Act `objective` types understood by the engine (`act-agenda.js:101-160`): `clues` (`perInvestigator`, optional `atLocation`),
`actClues`, `enterLocation` (`location`), `defeatEnemy` (`enemy` code), `uniqueCultists` (`amount`).

### 2.4 Round / turn / mythos / enemy phase (`phases.js`, `turn.js`, `turn-flow.js`)

| hook | signature | purpose / return |
|---|---|---|
| `roundEnded` | `(state, api)` `phases.js:159` | after location/enemy round-end, before `agenda.forced.roundEnd` |
| `turnEnded` | `(state, inv, api)` `turn-flow.js:327` | per investigator end of turn |
| `turnBegins` | `(state, inv, api)` `turn.js:328` | start of investigator turn |
| `phaseBegan` | `(state, phase, api)` `turn.js:309` | any phase start |
| `mythosDoomChecked` | `(state, api)` `turn.js:110` | after mythos doom check |
| `mythosEnded` | `(state, api)` `turn.js:132` | |
| `enemyPhaseStart` | `(state, api)` `turn.js:145` | before hunter moves/attacks (TFA guardian attacks from connected locations here) |
| `hunterMove` | `(state, enemy, api)` `turn.js:152` | → truthy replaces default hunter movement for that enemy |
| `enemyPhaseEnd` | `(state, api)` `turn.js:213` | |
| `enemyConnections` | `(state, enemy, loc)` `turn.js:219` | → extra location ids for hunter pathing |
| `victoryChanged` | `(state, api)` `turn-flow.js:216` | victory display changed (TFA recomputes vengeance-gated enemy keywords) |
| `skipUpkeepIncome` | `(state, inv)` `phases.js:121` | truthy → no resource |
| `skipUpkeepDraw` | `(state, inv)` `phases.js:122` | truthy → no card |
| `handSizePenalty` | `(state, inv)` `phases.js:136` | number subtracted |
| `handSizeModifier` | `(state, inv)` `stats.js:175` | number added |
| `elderSign` | `(state, inv, api)` `turn-flow.js:114` | scenario-level elder sign effect object (same shape as investigator rule) |
| `afterMulligan` | `(state, events, {discardRandomFromHand, info})` `table-decisions.js:359` | |

### 2.5 Exploration (TFA core) (`src/cards/campaign-plugin.js`)

| hook | signature | purpose / return |
|---|---|---|
| `canExplore` | `(state, inv)` `moves.js:290,681` | → `false` hides/blocks the explore move |
| `beforeExplore` | `(state, inv, api)` `campaign-plugin.js:193` | → `false` cancels the explore (action already paid) |
| `exploreConnects` | `(state, fromLocationId, code)` :204 | → `false` = drawn card doesn't connect; engine puts it at deck bottom and calls `afterExplore` with `kind:'blocked'` |
| `afterExplore` | `(state, inv, {code, kind:'location'\|'encounter'\|'blocked', runtime})` :208,232 | post-resolution; `runtime` is the api |
| `scriptCards` (data) | `{ explore: {card:'act'\|'agenda', codes?}, rules: {rule:{card,codes?}} }` | `src/engine/script-cards.js` decides which script card owns the button (§4.5.1 of the migration doc) |

### 2.6 Locations / movement / clues

| hook | signature | purpose / return |
|---|---|---|
| `locationRevealed` | `(state, loc, api, seat)` `locations.js:242` | printed reveal (only when reveal text not ignored) |
| `locationWillFlip` | `(state, loc, api, seat)` `locations.js:158,180` | before face flip |
| `locationStory` | `(state, loc, api, seat)` :159,217 | flip story text |
| `locationFlipped` | `(state, loc, api, seat)` :160,218 | after flip |
| `cluesOnReveal` | `(state, loc, invOrNull)` :234 | → number overrides `loc.maxClues` |
| `ignoreLocationRevealText` | `(state, inv, loc)` `locations.js:240`, `engine.js:540` | → `true` skips reveal text |
| `locationEntered` | `(state, inv, loc, api, companionEnemyIds?)` `movement.js:225`, `locations.js:265` | after moving in (also on relocation from removed location) |
| `locationLeft` | `(state, inv, prevLoc, api)` `movement.js:281` | after leaving |
| `locationLeaveTest` | `(state, inv, prevLoc, destinationId)` `movement.js:272` | → `{ skill, difficulty }` forces a test to leave; failure → `locationLeaveFailed` |
| `locationLeaveFailed` | `(state, inv, prevLoc, api)` :276 | |
| `beforeMove` | `(state, inv, destLoc, api)` `movement.js:256` | |
| `moveError` | `(state, inv, destLoc, destId)` `moves.js:303,653` | → string = illegal-move reason |
| `movementError` | `(state, inv)` `hidden-rules.js:89`, `moves.js` | → string blocks all movement (TFA `04081`) |
| `investigatorEntryError` | `(state, location, inv)` `engine.js:544` | → string blocks entering (`locationRule.entryError` also consulted) |
| `investigatorMovedByEncounterCard` | `(state, inv, api)` `locations.js:277` | |
| `enemyMoved` | `(state, enemy, newLocId, api, seat?)` `movement.js:219,326`, `locations.js:263` | |
| `cluesRemoved` | `(state, loc, amount, api)` `locations.js:301` | |
| `cluesGained` | `(state, inv, n, api)` `locations.js:368`, `scenario-runtime.js:382` | |
| `canDiscoverClues` | `(state, inv, loc)` `locations.js:308,317` | → `false` blocks discovery |
| `investigationError` | `(state, inv, loc)` `actions-extra.js:413`, `moves.js:309,675` | → string blocks investigating |
| `beforeInvestigate` | `(state, inv, loc, api)` `actions.js:325` | → `false` cancels before paying the action |
| `investigateResult` | `(state, inv, loc, result, api)` `actions.js:386` | called **before clue discovery**; returning `false` suppresses clue discovery (`investigationReplaced`) |
| `locationShroudModifier` | `(state, loc, inv)` `actions.js:351`, `moves.js:311` | number |

### 2.7 Enemies / combat / harm

| hook | signature | purpose / return |
|---|---|---|
| `spawnOverrides` | data `{ [code]: {…} }` `enemies.js:209` | per-code spawn override object |
| `spawnLocation` | `(state, code, fallbackLoc, engagedSeat, api)` `enemies.js:264` | → location id override |
| `spawnFailed` | `(state, code, engagedSeat, api)` :267 | no legal spawn location |
| `enemySpawned` | `(state, enemy, api)` `enemies.js:299`, `turn-flow.js:147` | |
| `enemyEngaged` | `(state, enemy, inv, api)` `enemies.js:329` | |
| `enemyDefeated` | `(state, enemy, api)` `enemies.js:371` | → truthy = handled (engine may skip default) |
| `enemyDiscarded` | `(state, enemy, api)` `engine.js:587` | |
| `enemyDamaged` | `(state, enemy, api, seat?, source?)` `combat.js:345`, `enemies.js:426` | two dispatch sites, arg tail differs |
| `enemyDamageAllowed` | `(state, enemy, source, seat)` `combat.js:273`, `enemies.js:421` | → `false` blocks damage |
| `enemyStatModifier` | `(state, enemy, 'fight'\|'evade'\|'health')` `enemies.js:70,83`, `:65` | number |
| `enemyAttackStarted` | `(state, enemy, inv, api, attack)` `enemies.js:135` | |
| `enemyAttackModifier` | `(state, enemy, inv)` :136 | → `{ damage?:n, horror?:n }` extra |
| `beforeEnemyHarm` | `(state, enemy, inv, {damage,horror}, api)` :145 | → `{damage?,horror?}` adjusted |
| `enemyAttackResolved` | `(state, enemy, inv, api, attack)` :172 | |
| `beforeHarm` | `(state, inv, {damage,horror,direct}, api)` `enemies.js:449` | → `{damage,horror,direct}` replaced |
| `enemyAttackedSuccessfully` | `(state, inv, enemy, api)` `combat.js:358` | after a successful fight |
| `afterEvade` | `(state, inv, enemy, result, api)` `actions-extra.js:452` | after evade |
| `enemyCannotAttack` | `(state, enemy)` `hidden-rules.js:109` | → `true` |
| `enemyCannotBeAttacked` | `(state, enemy)` :114 | → `true` |
| `enemyCanBeDefeated` | `(state, enemy, source, seat)` :136 | → `false` blocks defeat |
| `canOpportunityAttack` | `(state, enemy)` :130 | → `false` |
| `canFightEnemy` | `(state, inv, enemy)` `moves.js:325,696` | → `false` |
| `canEvadeEnemy` | `(state, inv, enemy)` `moves.js:327,331,706,715` | → `false` |
| `canDisengage` | `(state, inv, enemy)` `harm-threat.js:306` | → `false` |
| `investigatorEliminated` | `(state, inv, clues, api)` `harm-threat.js:226` | → truthy = handled |
| `investigatorCanBeDefeated` | `(state, inv, 'horror'\|…)` `harm-threat.js:247,275` | → `false` |
| `allResigned` | `(state, api)` `engine.js:1217` | last investigator resigned (engine would otherwise end with `noResolution`) |

### 2.8 Tests / chaos / treacheries / cards / stats

| hook | signature | purpose / return |
|---|---|---|
| `testDifficultyModifier` | `(state, inv, skill, difficulty, source)` `tests.js:126` | number delta applied before reveal |
| `canCommitCard` | `(state, owner, code)` `tests.js:219` | → `false` |
| `commitIconMultiplier` | `(state, owner, commitLocation)` `tests.js:293` | number |
| `chaosTokenRevealed` | `(state, inv, token, api)` `tests.js:560`, `scenario-runtime.js:400` | → replacement token or nothing |
| `resolveChaosToken` | `(state, inv, token, api)` `treachery-tokens.js:298` | → `{delta, autoFail?, drawAnother?, onDraw?:fx[], onFail?:fx[]}` or falsy (fallback to `scenario.tokenMeanings`, then `SYMBOL_DEFAULTS`) |
| `afterTest` | `(state, inv, result, api)` `tests.js:769,930` | **two call sites** (auto-fail path and normal path). `result` = `{success, value, difficulty, skill, token, drawn[], cancelledTokens[], committed[], source, autoFail, damageBonus, clueBonus}` |
| `ignoreTreachery` | `(state, code, treachery)` `treachery-tokens.js:83` | → `true` skips the whole revelation |
| `resolveEncounter` | `(state, inv, treachery, api)` :87 | **required** for any treachery whose `effect.kind === 'campaignRule'` (TFA sets that in `encounterDefinitions`, so effectively required) |
| `encounterGainsSurge` | `(state, code, inv)` `encounter.js:170` | → truthy adds surge |
| `encounterDrawn` | `(state, inv, code, api)` `encounter.js:119` | |
| `drawStoryAsset` | `(state, inv, code, api)` :176 | if present, handles asset-type encounter draws |
| `drawLocation` | `(state, seat, code, api)` :178 | location-type encounter draws |
| `drawEncounterLocation` | `(state, seat, api)` `scenario-runtime.js:496` | required by `api.drawEncounterLocation` |
| `canPlayCard` | `(state, inv, def)` `moves.js:205,502`, `actions-extra.js:72`, `encounter.js:243` | → `false` |
| `canPlayScenarioCard` | `(state, inv, code)` `stats.js:122` | → `true` forces availability |
| `canPlaceAsset` | `(state, inv, code)` `scenario-runtime.js:476`, `api-card.js:305` | → `false` blocks entering play |
| `assetEntered` | `(state, inv, asset, api)` `actions.js:200`, `deck-ops.js:301`, `api-card.js:312`, `scenario-runtime.js:481` | 4 call sites |
| `assetLeftPlay` | `(state, inv, asset, api)` `assets.js:257` | |
| `storyAssetLeftPlay` | `(state, asset, api)` `scenario-runtime.js:580` | |
| `cardDrawn` | `(state, inv, code, api)` `deck-ops.js:387` | |
| `deckEmptied` | `(state, inv, api)` `deck-ops.js:394`, `scenario-runtime.js:469` | |
| `statModifier` | `(state, inv, skill)` `stats.js:133` | number |
| `canGainResources` | `(state, inv)` `moves.js:285`, `phases.js:129`, `harm-threat.js:334`, `actions-extra.js:139`, `ability-rules.js:129`, `skill-effects.js:266` | → `false` |
| `describe` | `(state)` `describe.js:110` | → string[] appended to the UI description |
| `hauntedScript` | `(state, {seat, investigator, locationId, ability, scriptId, code}, api)` `haunted.js:350` | → `false` = unhandled (recorded in `state.hauntedGaps`) |

### 2.9 Player actions (`moves.js`, `dispatch.js`)

| hook | signature | purpose / return |
|---|---|---|
| `actions` | `(state, inv)` `moves.js:165,482`; `turn-flow.js:463`; `describe-ai.js:93` | → move descriptors (`{action:'scenarioAction', rule, label, actions?, skill?, scriptCard?, reason?}`). Moves carrying `reason` are shown disabled. Cost read from `actions` field (default 1) |
| `performAction` | `(state, inv, move, api)` `dispatch.js:416` | execute; TFA throws `未知…行动：${move.rule}` for unknown rules |
| `payScenarioActionCost` | `(state, inv, move, api)` `dispatch.js:219` | right before paying actions |
| `encounterActions` | `(state, inv)` `moves.js:169,496` | threat/attachment actions (`{action:'encounterAction', rule, threatId\|attachmentId, actions, skill?}`) |
| `performEncounterAction` | `(state, inv, move, api)` `dispatch.js:419` | |
| `scenarioActionError` | `(state, inv, rule)` `moves.js:607` | → reason for a specific hard-coded rule |
| `actionKind` | `(state, inv, move)` `table-decisions.js:228` | → action kind override (`'explore'`, `'action'`, …) |
| `sacrificeLitaAction` | `(state, inv, api)` `actions-extra.js:270` | NotZ-specific |
| data: `litaParleyActIndex`, `interruptRitualActIndex`, `drawCultistActIndex`, `houseFateChoice` | numbers/booleans `actions-extra.js:211,252`, `moves.js:351,356`, `reveal.js:155` | legacy core-set gates |

### 2.10 Hooks TFA chapters use that are *not* engine hooks

`setupPlan(state, helper)` — pure TFA convention used by tests and `setupLocations`; returns
`{ explorationDeck, locations, treacheries }`. Keep the same name/shape for TCU if you copy the pattern.

---

## 3. Encounter entries: `actRule` / `agendaRule` / `locationRule` / `enemyRule` / `treacheryRule` / `implemented`

One card = one file (`AGENTS.md` non-negotiable). Locations:
`src/cards/encounter-entries/shared/<group>/<code>.js` (cross-campaign),
`…/<campaign>/_shared/<group>/<code>.js` (campaign-shared),
`…/<campaign>/<scenario>/<code>.js` (scenario-only).
Files are aggregated by the **generated** `src/cards/encounter-entries/index.js`
(`npm run cards:encounter-index` / `cards:encounter-check`); a new file is invisible until the index is rebuilt.

### 3.1 Read points (`src/cards/card-rules.js`)

```js
export function enemyRuleFor(code)      { return entryOf(code)?.enemyRule || null }
export function treacheryRuleFor(code)  { return entryOf(code)?.treacheryRule || null }
export function locationRuleFor(code)   { return entryOf(code)?.locationRule || null }
export function actRuleFor(code)        { return entryOf(code)?.actRule || null }
export function agendaRuleFor(code, scenarioId = null) {
  const entry = entryOf(String(code ?? ''))
  if (scenarioId && entry.agendaRuleByScenario?.[scenarioId]) return entry.agendaRuleByScenario[scenarioId]
  return entry.agendaRule || null
}
export function implementedFor(code)    { return (code && entryOf(code)?.implemented) === true }
export function enemyScriptFor(code)    { return entryOf(code)?.enemyScript || null }
export function encounterResolveFor(code) { return entryOf(code)?.encounterResolve || null }
export function threatActionFor(code)   { … }   // threat-zone "action: test to discard"
export function vengeanceWhileFor(code) { … }   // 'enemyHere' | 'noClues' | 'investigatorHere'
export function enemyStatRuleFor / enemySpawnRuleFor / assetRuleFor / entryFlags / foundCardRuleFor / isPoisonThreat …
```

### 3.2 How `definition.js` merges them

`card-data.js:195 encounterDefinitions(cards, extraRules)` builds, for each enemy/treachery:

```js
// enemy
{ ...printed(code), rulesPending: false, type:'enemy', fight, evade, health, damage, horror,
  healthPerInvestigator?, hunter, aloof, massive, retaliate, alert, victory, elite, prey?,
  ...(extraRules.enemies?.[card.code] || {}),
  ...(enemyRuleFor(card.code) || {}) }          // ← entry last: entry wins
// treachery
{ ...printed(code), rulesPending: false, type:'treachery', surge, peril, hidden,
  effect: { kind: 'campaignRule' },
  ...(extraRules.treacheries?.[card.code] || {}),
  ...(treacheryRuleFor(card.code) || {}) }
```

Consequences you must know:

- **Every** TFA/TCU treachery gets `effect.kind === 'campaignRule'` unless an entry overrides `effect` →
  `treachery-tokens.js` routes it to `behavior.resolveEncounter` (or the per-card `encounterResolve`).
- `rulesPending: false` is set unconditionally, so the audit's `encounterBehaviors` check
  (`!card.rulesPending`) is satisfied by construction — it is **not** evidence of implementation.
- Scenario-local tweaks are applied after the merge, e.g.
  `Object.assign(definitions.enemies[HARBINGER], { healthPerInvestigator: 10 })`.
- `acts`/`agendas`/`locations` are **not** built by `encounterDefinitions`; their rules come from
  `actRuleFor`/`agendaRuleFor`/`locationRuleFor` at call time (behavior forwards; the engine dispatches
  `locationRule.onReveal/onEnter/onLeave/entryError/onRoundEnd/…` itself).

`locationRule` keys consumed **by the engine directly** (no behavior needed):
`onReveal(state, loc, api, seat)` (`locations.js:244`), `onEnter.effect` / `onEnter.test` / `onEnter.failChoice`
(`movement.js:227`), `onLeave.test`/`onLeave.effect`/`onLeave.cancelMessage`/`onLeave.onFail` (`movement.js:283`),
`entryError(state, location)` (`engine.js:542`), `onTestFail` (`tests.js:107`), `onRoundEnd` (`turn.js:263`),
`playDiscount` (`turn-flow.js:384`).
Other keys (`actions`, `performAction`, `beforeExplore`, `afterTest`, `shroudModifier`, `investigationError`,
`scenarioActions`, custom flags) are **only** read where a behavior calls `locationRuleFor(...)`.

### 3.3 Concrete TFA examples (copy these shapes)

**Location** — `src/cards/encounter-entries/theForgottenAge/_shared/eztli/04060.js`

```js
export default {
  code: '04060', scope: 'location',
  locationRule: {
    actions({ moves }) {
      moves.push({ action: 'scenarioAction', rule: 'resignEntryway', label: '🚪 撤退：你暂时……逃出来了。' })
    },
    performAction(state, inv, move, api) {
      if (move.rule === 'resignEntryway') { api.resign(inv.seat); return true }
      return false
    },
  },
}
```

**Act** — `src/cards/encounter-entries/theForgottenAge/theDoomOfEztli/04057.js`

```js
export default {
  code: '04057', scope: 'act',
  actRule: { onReveal(state, act, api) { takeFromSetAsideInEntry(state, '04068'); … api.info?.('…') } },
}
```

**Agenda** (with per-scenario variant) — `…/_shared/eztli/04055.js`

```js
export default {
  code: '04055', scope: 'agenda',
  agendaRule: { onReveal(state, agenda, api) { spawnHarbingerAtDoomInEntry(state, api) } },
  agendaRuleByScenario: { turnBackTime: { onReveal(state, agenda, api) { … } } },
}
```

**Enemy** — `…/_shared/eztli/04062.js`

```js
export default {
  code: '04062', scope: 'enemy',
  enemyRule: { healthPerInvestigator: 10, vengeance: 5, retaliateWhileExhausted: true },
  enemyScript: {
    onSpawn(state, enemy) { harbingerSpawn(state, enemy) },
    onAttackSuccess(state, inv, enemy, api) { harbingerAfterSuccessfulTest(state, enemy, api) },
    onEvade(state, inv, enemy, result, api) { if (result?.success !== false) harbingerAfterSuccessfulTest(state, enemy, api) },
  },
}
```

`enemyScript` sub-hooks dispatched via `encounterRules`:
`onSpawn`, `onAttackSuccess`, `onEvade`, `onAttackResolved`.

**Treachery** — `…/_shared/ruins/04092.js` and `…/_shared/poison/04102.js`

```js
export default {
  code: '04092', scope: 'treachery', implemented: true,
  encounterResolve(state, inv, card, api) { …; return false },
}
// 04102 additionally exercises the "flag" style:
export default {
  code: '04102', implemented: true, scope: 'treachery', poisonThreat: true, poisonWeakness: true,
  flags: { poisoned: true }, treacheryRule: { permanent: true },
  encounterResolve(state, inv, card, api) { api.poison(inv.seat); return false },
}
```

Note the idiom: `encounterResolve` returns `false` (meaning "not fully consumed by return value") in TFA;
`resolveEncounter` in `encounter-rules.js` returns that value to the engine. `implemented: true` is what
`implementedFor()` (and therefore `literalCardBehavior`) reads.

---

## 4. Zones and `scenarioZoneReport` constraints

`state.scenarioZones` (runtime, created by behavior) vs `manifest.zones` (declared, `{cardCode,count}`):

- `manifest.zones.encounterDeck` ← `scenario.encounterDeck` (flat codes, duplicates counted).
- `manifest.zones.setAside` ← `cultistDeck` + `agentSets` values + `setAsideLocations` (mapped to codes via
  `identities.locations[id].originalCode`) + `setAsideAliases` (codes, duplicates allowed).
- `manifest.zones.inPlay` ← `inPlayAliases` **only** (omitted otherwise).
- `removed`/`victory` are always `[]`.

`scenarioManifest(...)` throws:
- `${scenario.id}: 身份别名 ${alias} 不唯一` — alias resolves to >1 original code across
  enemies/treacheries/storyAssets/sharedIdentities.
- `${scenario.id}: 身份别名 ${alias} 缺少目录原卡` — no `ALL_CARDS[code]`.
- `${scenario.id}: 地点 ${id} 缺少原卡身份` / `放在一边的地点 ${id} 缺少身份`.

`scenarioZoneReport(scenario, manifest, sharedIdentities)` throws:
- `${id}: 多个初始区域重复入牌 <code>` — a code appears in **both** `encounterDeck` and (`inPlay` or fixed `setAside`).
- `${id}: 可选遭遇组重复入牌 <setId:code>` — an `agentSets`/optional set card collides with a base zone.
- `${id}: 可选遭遇组超出放在一边区域` — optional set counts exceed declared setAside counts.
- `${id}: 缺少目录原卡 ${code}`.
- `${id}: ${code} 需要 ${count} 张，目录只有 ${quantity} 张` — **quantity cap** (e.g. `04102` has
  `quantity: 4`; the 4 poison copies in `theDoomOfEztli` are exactly at the cap).
Returns `{encounterCards, declaredSetAsideCards, inPlayCards?, cultistDeckCards, optionalSets,
locationCount, identityCount, unresolvedAliases:[], duplicateActiveZoneCodes, optionalZoneCollisions, checkedCatalogCodes}`.

Practical recipe (from `theDoomOfEztli/definition.js`): build the deck **excluding** set-aside codes:

```js
const setAsideCodes = [RELIC_OF_AGES, HARBINGER, '04102','04102','04102','04102']
const setAside = new Set(setAsideCodes)
const gathered = encounterCards(deckGroups).filter(card => !setAside.has(card.code))
```

and keep the runtime zone in `setupLocations`:

```js
state.scenarioZones ||= {}
state.scenarioZones.setAside = [RELIC_OF_AGES, HARBINGER, ...Array(4).fill('04102'), CHAMBER_OF_TIME]
state.scenarioZones.removed = []
```

`state.scenarioZones` keys seen in TFA: `setAside`, `removed`, `explorationLocations`, `locationSeq`,
`harbingerAside`, `pursuit`, `underAct`, `monsters`. They are plain JSON (save-safe).

---

## 5. How tests are written

### 5.1 Registration of a suite

Two independent lists must both be updated (a `suite-manifest.test.mjs` guard enforces that every
`tests/*.test.mjs` is in exactly one tier):

1. `tests/suites.mjs` → `FAST_TESTS` (array of bare filenames, e.g. `'tfa-doom-of-eztli.test.mjs'`).
   Tiers: `FAST_TESTS` / `SLOW_TESTS` / `ASSET_TESTS`.
2. `tests/node-suite.mjs` → `import './tfa-doom-of-eztli.test.mjs'` (side-effect import, ordered list).

`npm run test:fast` = `node tools/run-tests.mjs fast`. Targeted: `npm run test:tfa:scenarios`
(explicit file list in `package.json`) — for TCU you add an equivalent `test:tcu:scenarios`.

### 5.2 Two test styles

**(a) Pure hook harness** (`tfa-doom-of-eztli`, `tfa-untamed-wilds`): no engine, hand-built `state`.

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import * as eztli from '../content/campaigns/theForgottenAge/scenarios/theDoomOfEztli/index.js'
import { scenario as definition, EXPLORATION_LOCATIONS } from '…/theDoomOfEztli/definition.js'

const clone = value => structuredClone(value)

function setupApi(seed = 1) {                       // deterministic LCG, NEVER Math.random
  let value = seed >>> 0
  const randomValue = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 0x100000000 }
  return { randomValue, shuffle(items, rng = randomValue) { /* Fisher–Yates */ return copy } }
}

function stateFor(count = 2) {
  return {
    scenario: clone(definition), acts: clone(definition.acts), agendas: clone(definition.agendas),
    actIndex: 0, agendaIndex: 0,
    investigators: Array.from({length: count}, (_, seat) => ({
      seat, code:'01001', name:`调查员${seat+1}`, location:'entryway',
      damage:0, horror:0, clues:0, resources:5, hand:[], assets:[], threat:[], engaged:[],
      deck:[], discard:[], actionsLeft:3 })),
    locations: [], enemies: [], storyAssets: [], scenarioFlags: {}, scenarioZones: {},
    victoryDisplay: [], encounterDeck: [], encounterDiscard: [],
    campaign: { leadSeat:0, records:{}, investigators: Array.from({length: count}, (_, seat) => ({
      id:`inv${seat}`, deck:[], purchases:[], status:'active', trauma:{physical:0, mental:0} })), chaosBag:[] },
    chaosBag: [], difficulty:'standard', numInvestigators: count, round:1,
    phase:'investigation', status:'playing',
  }
}

function placed(state, ids) { /* push clone(scenario.locations[id]) with revealed:true, doom:0, clues:cluesPerInvestigator*count */ }
const loc = (state, id) => state.locations.find(l => l.id === id)
function setup(state, seed = 1) { eztli.behavior.setupLocations(state, [], setupApi(seed)); return state }
```

Then call hooks directly with a stub api, e.g.:

```js
eztli.behavior.roundEnded(state, { choose: () => 'skip', info: () => {} })
eztli.behavior.actReveal(state, state.acts[0], { random: () => 0.25, info: () => {}, hasSupply: () => false })
eztli.behavior.locationEntered(state, inv, location, { checkSupplies: (s,n) => …, choose: () => 'doom', info(){}, damage(){}, horror(){} })
```

**(b) Real-engine harness** (`tfa-engine-setups`, `tfa-engine-integration`): register a private
`playable` clone via `registerContentBundle` (isolates one chapter without flipping the campaign to playable),
then drive real moves:

```js
import { contentRegistry, registerContentBundle } from '../content/registered.js'
import { manifest as tfaCampaignPack } from '../content/packs/tfaCampaign/manifest.js'
import { manifest as campaignManifest } from '../content/campaigns/theForgottenAge/manifest.js'
import * as wilds from '../content/campaigns/theForgottenAge/scenarios/theUntamedWilds/index.js'

const packId = 'tfaScenarioHarnessPack', campaignId = 'tfaScenarioHarnessCampaign', scenarioId = 'theUntamedWildsHarness'
registerContentBundle({
  packs: [{ ...tfaCampaignPack, id: packId, status: 'playable' }],
  campaigns: [{ ...campaignManifest, id: campaignId, status: 'playable', scenarioIds: [scenarioId],
    unlock: { [scenarioId]: [] }, requiredPackIds: ['core', packId],
    flow: { start: scenarioId, nodes: { [scenarioId]: { type:'scenario', scenarioId, next:'end' }, end:{type:'end'} } } }],
  scenarios: [{
    scenario: { ...wilds.scenario, id: scenarioId },
    behavior: { ...wilds.behavior, id: scenarioId },
    manifest: { ...wilds.manifest, id: scenarioId, campaignId, status: 'playable',
      requiredPackIds: [...new Set([...wilds.manifest.requiredPackIds.map(id => id === 'tfaCampaign' ? packId : id), packId])],
      requiredEncounterGroupIds: [], requiredMechanicIds: [], behaviorIds: [scenarioId] },
  }],
})

const { createGameState, applyMove, legalMoves } = await import('../src/engine/engine.js')

function settle(state) {                       // auto-answer every pending choice
  for (let guard = 0; state.pendingChoice; guard++) {
    assert.ok(guard < 600, `choice loop: ${state.pendingChoice?.kind}`)
    const pending = state.pendingChoice
    const optionId = pending.options.find(o => ['done','skip'].includes(o.id))?.id || pending.options[0].id
    applyMove(state, pending.seat, { action: 'choose', choiceId: pending.id, optionId })
  }
}

const state = createGameState({ campaignId, seed: 'tfa-wilds-engine', playerInvestigator: '01001' }, [{ seat: 0 }])
settle(state)
const explore = legalMoves(state).find(move => move.action === 'explore')
applyMove(state, 0, explore); settle(state)
```

Note: `store`/`seats` argument is `[{ seat: 0 }]`; `playerInvestigator` picks the deck code; `seed` drives
`randomValue(state)`.

### 5.3 Save/replay roundtrip pattern (this is the `saveReplay` acceptance evidence)

The audit only greps the test file for the literals `JSON.stringify` and `deepEqual`
(`tools/audit-tfa-scenarios.mjs:139`). Write at least one test shaped like:

```js
test('同一路线的开始状态在 JSON 往返后完全一致', () => {
  const build = () => { const s = setup(placed(stateFor(2), ['entryway','ancientHall','grandChamber']), 41)
    behavior.actReveal(s, s.acts[0], { random: () => 0.25, info: () => {}, hasSupply: () => false })
    behavior.roundEnded(s, { choose: () => 'skip', info: () => {} }); return s }
  const first = build(), second = build()
  assert.equal(JSON.stringify(first), JSON.stringify(second))          // determinism
  const restored = JSON.parse(JSON.stringify(first))                   // save → load
  assert.deepEqual(restored.explorationDeck, first.explorationDeck)
  assert.deepEqual(restored.scenarioZones, first.scenarioZones)
  assert.deepEqual(restored.relicOfAges, first.relicOfAges)
  assert.deepEqual(restored.locations.map(l => l.doom), first.locations.map(l => l.doom))
})
```

Engine-level variant (`tfa-engine-integration.test.mjs:104-113`): deep-copy one save into `left`/`right`,
apply the same legal move to both, then `assert.deepEqual({ ...left, pendingChoice: null }, { ...right, pendingChoice: null })`.

### 5.4 Assertion style

`assert.equal` for scalars/`originalCode`, `assert.deepEqual` for arrays/objects/sorted connections,
`assert.throws(() => behavior.resolution(state, 'r9', [], api))` for unknown resolutions,
`assert.ok(state.explorationDeck.includes('templeOfTheFang'))` for shuffled pools,
and `entityModifierTotal(state, entity, 'enemyFight' | 'locationShroud')` from
`src/engine/modifiers.js` for declarative entry modifiers (Phase 3 D1 pattern).

---

## 6. Registration in `content/registered.js` + `schema.js` validation

### 6.1 Registry (`content/registered.js`)

```js
import * as theDoomOfEztli from './campaigns/theForgottenAge/scenarios/theDoomOfEztli/index.js'
…
let bundle = {
  packs: [...packs, … , tcuCampaignPack, tcuInvestigators, tcuPlayer],
  campaigns: [nightOfTheZealot, theDunwichLegacy, thePathToCarcosa, theForgottenAge, theCircleUndone],
  scenarios: [ … , theUntamedWilds, theDoomOfEztli, … , ...catalogChapters],
}
export let contentRegistry = createContentRegistry(bundle)
export function registerContentBundle(additions) { /* appends + revalidates, used by tests */ }
```

TCU currently ships **9 catalog-only placeholders** via `content/campaigns/theCircleUndone/chapters.js`
(`catalogChapters = chapters.map(buildCatalogChapter)`), each with
`status:'catalog-only', catalogReferenceOnly:true, referenceCode:<code>, requiredEncounterGroupIds:[chapter.id],
locations:[], zones:{encounterDeck:[],setAside:[],removed:[],victory:[]}, acts:[], agendas:[],
resolutionIds:[], recordReads:[], recordWrites:[], behaviorIds:[chapter.id]`, and
`scenario = { id, originalCode, name, nameEn, migrationStatus:'catalog-only' }`, `behavior = { id }`.

**To promote a chapter you must (a) delete its `...catalogChapters` entry or filter it out, and (b) add the real
`import * as <id> from './campaigns/theCircleUndone/scenarios/<id>/index.js'`.** Otherwise the duplicate id throws
`bundle.scenarios: 重复 ID <id>` (from `assertContentBundle`) before `createContentRegistry`'s own
`重复关卡注册 ID` check.

`createContentRegistry` enforces (before schema):
- `entry.manifest && entry.scenario && entry.behavior` present.
- `manifest.id === scenario.id` and `behavior.id === manifest.id` (`关卡注册 ID 不一致`).
- every `manifest.behaviorIds` entry `=== behavior.id` (`关卡 <id> 缺少行为 <id>`).
- every card code the manifest needs (`referenceCode`, every location `frontCode`/`backCode`, every zone
  `cardCode`) must belong to a declared pack (with `a`-suffix linked faces resolved by card ranges).
- `normalizeScenarioHaunted`, `normalizeScenarioSpectralLocations`, `normalizeStoryInvestigatorConfig`
  run at registration and throw on unknown clauses (TCU must respect `HAUNTED_CLAUSES`).

### 6.2 `content/schema.js` (`assertScenarioManifest`)

Top level: `schemaVersion === 1`, `id` matches `/^[a-z][A-Za-z0-9-]*$/`, `contentVersion` semver,
`minRulesVersion` `/^n(\d+)\.(\d+)$/`, `status ∈ {catalog-only, development, playable, verified}`,
`campaignId` id, `name` non-empty, `requiredPackIds`/`requiredEncounterGroupIds`/`requiredInvestigatorIds`/
`requiredMechanicIds`/`recordReads`/`recordWrites`/`behaviorIds` = **arrays of unique ids**,
`resolutionIds` non-empty.

Catalog-only escape hatch (`catalogReferenceOnly: true`) requires `status === 'catalog-only'`, string
`referenceCode`, and **empty** `locations/acts/agendas/resolutionIds/recordReads/recordWrites` plus empty
`zones.encounterDeck/setAside/removed/victory`.

Full scenario requires:
- `locations`: non-empty, unique `id`s, `frontCode`/`backCode` strings, `connections` = unique ids that
  exist and are not self.
- `startLocationId` ∈ locations (comes from `scenario.startLocation`).
- `zones.encounterDeck|setAside|removed|victory` (+`inPlay` when present) are arrays of
  `{cardCode: string, count: positive safe integer}`, no duplicate `cardCode` per zone.
- `acts`/`agendas`: non-empty arrays of objects with unique ids.
- `layout` via `assertUiLayout` (§8).

`assertContentBundle` additionally requires: every `recordReads`/`recordWrites` key exists in
`campaign.recordSchema`; every `requiredEncounterGroupIds` entry is declared by one of the campaign+scenario
packs; campaign lists the scenario and vice versa; pack dependency graph acyclic.
`assertLaunchableCampaign` additionally requires `status ∈ {playable, verified}`, `minRulesVersion` supported,
and `missingMechanics(requiredMechanicIds).length === 0`
(`content/mechanics.js` — TCU has `tcuHaunted/tcuSpectral/tcuCircle/tcuTarot/…` but **not** `tcuChaos`,
deliberately: "tcuChaos 要等 P8 的 tcu-chaos.js，在那之前不要登记").

### 6.3 TCU promotion gates (verified against the current tree)

Launching **any** TCU scenario currently fails on three independent gates — all must be flipped:

1. `content/campaigns/theCircleUndone/manifest.js`: `status: 'catalog-only'` → `'playable'` (or `'verified'`),
   and `scenarioIds` already lists the 9 chapters; `flow` is `undefined` and `endings: []` today
   (`validateCampaignGraph(campaign)` in `registry.js` tolerates that, but a real flow is needed to advance).
2. `content/packs/tcuCampaign/manifest.js`: `status: 'catalog-only'` → `'playable'`
   (`assertLaunchableCampaign` runs `requireReady` on every required pack, recursively). Its
   `encounterGroupIds` already contain all 21 ids (9 chapter ids + 12 shared), and `cardRanges` is
   `[{from:'05043', to:'05346'}]`, so `requiredEncounterGroupIds` for a TCU scenario can only use those 21 ids.
3. `content/campaigns/theCircleUndone/shared.js`: `recordTypes` currently has only 4 keys
   (`mementosDiscovered`, `youAreBeingHunted`, `wasTakenByTheWatcher`, `missingPersons`, all `string[]`).
   Any `recordReads`/`recordWrites` you add must be registered there first or `assertContentBundle` throws
   `未声明战役记录 <key>`; also add a Chinese label in `manifest.recordLabels` (`RECORD_LABELS`).

---

## 7. The 12 acceptance checks in `tools/audit-tfa-scenarios.mjs`

The ledger is regenerated with `node tools/audit-tfa-scenarios.mjs --write` and drift-checked with `--check`
(`npm run audit:tfa:scenarios[:write]`). `--check` compares the **byte-identical** serialized JSON, so any edit to
`definition.js|layout.js|behavior.js|index.js` (their SHA-256 is stored per chapter) requires a `--write` + commit
of `audit/tfa-scenario-acceptance.json`. Per chapter it computes:

| # | check | exact evidence that satisfies it |
|---|---|---|
| 1 | `sourceLocked` | hard-coded `true`; per-file sha256 recorded in `fileHashes` for the 4 files |
| 2 | `identityRegistered` | every value in every `module.identities` category has `originalCode` and `identityStatus === 'mapped'` |
| 3 | `setupAndZones` | `manifest.zones.encounterDeck.length > 0` && `Array.isArray(manifest.zones.setAside)` && `scenarioZoneReport(...).encounterCards > 0` |
| 4 | `actsAndAgendas` | `scenario.acts.length > 0` && `scenario.agendas.length > 0` && `typeof behavior.actReveal === 'function'` && `typeof behavior.agendaReveal === 'function'` |
| 5 | `locationsAndConnections` | `Object.keys(scenario.locations).length > 0` && **every** location has `Array.isArray(connections) && connections.length > 0` |
| 6 | `encounterBehaviors` | ≥1 enemy/treachery code && no `card.rulesPending` truthy (auto-true: `encounterDefinitions` sets `false`) |
| 7 | `literalCardBehavior` | `pendingEncounterCodes.length === 0` **and** `SCENARIO_GAPS[chapter.id].length === 0`. Implemented = `implementedFor(code)` (entry `implemented: true`) **or** code ∈ `module.implementedEncounterCodes ?? module.behavior.implementedEncounterCodes` |
| 8 | `chaosEffects` | `typeof behavior.resolveChaosToken === 'function'` |
| 9 | `resolutionsAndRecords` | `Object.keys(resolutions).length > 0` && `manifest.resolutionIds.length === that length` && `typeof behavior.resolution === 'function'` |
| 10 | `storyText` | intro: `TFA_STORY_TEXT.introductions[chapterId]` paragraphs join > 20 chars, every paragraph non-empty and **no `<tag>`** — or fallback `scenario.intro.length > 20` when nothing imported. Resolutions: every resolution key has imported paragraphs (>20 chars, no HTML) **or** `scenario.resolutions[key]` is a string > 20 chars without HTML |
| 11 | `saveReplay` | the chapter's test file source contains both `JSON.stringify` and `deepEqual`. Test file is found by scanning `tests/tfa-*.test.mjs` for the literal `scenarios/<chapterId>/` |
| 12 | `browserAcceptance` | `audit/tfa-browser-acceptance.json` exists with `failed === 0 && passed === tests` (written by `npm run test:tfa:rules:browser`; chapter-independent) |

Derived fields:
- `item.status = (all checks except browserAcceptance) ? 'verified' : 'pending'`.
- `report.status = all items verified ? 'verified' : 'pending'`; `report.productionGate = 'playable'`.

`tests/tfa-scenario-acceptance.test.mjs` then asserts: every chapter's productive checks are true,
`item.checks.literalCardBehavior === (pendingEncounterCodes.length === 0 && gaps.length === 0)`,
`item.status` matches, `ledger.status === 'pending'`, `productionGate === 'playable'`, campaign launchable,
and each `testFile` exists. So **`literalCardBehavior` is the only honest gate**: either every encounter card in
the deck has `implemented: true` and `SCENARIO_GAPS[id]` is `[]`, or the chapter must stay `pending`.

---

## 8. Layout: coordinates, edges, constraints

```js
// content/scenario-manifest.js:25
export function layoutFor(scenario, coordinates) {
  const locations = Object.fromEntries(Object.entries(coordinates).map(([id, point]) => [id, { ...point }]))
  const edges = Object.values(scenario.locations).flatMap(location =>
    location.connections.map(to => ({ from: location.id, to })))
  return { locations, edges }
}
```

- Coordinates are **presentation only**; the rule graph is `scenario.locations[*].connections`.
- `edges` are derived 1:1 from `connections`, so they are always legal. If you hand-write a layout object you must
  keep `edges` ⊆ `{from>to}` of declared connections, else `assertUiLayout` throws
  `展示连线不得创建规则连接`.
- Constraints enforced by `assertUiLayout(layout, locationIds, connections)`:
  layout must be an object; `layout.locations` object keys must all be declared location ids;
  each `{x, y}` finite numbers; `layout.edges` array; each edge `from`/`to` must be declared locations and
  `${from}>${to}` must exist in connections; optional `edge.curve` must be a finite number.
- Locations **omitted** from `layout.locations` pass validation (only present keys are checked).
- Coordinate conventions in the repo: `theDoomOfEztli` doubles y because each printed location is two grid cells
  tall (`entryway {x:0,y:2}`, `grandChamber {x:2,y:4}`); `theCityOfArchives` uses negative y upward.
  Duplicated coordinates are allowed but render on top of each other — this is exactly the recorded
  `theBoundaryBeyond` gap (`古代地点与现代格位共用桌面坐标，静态地图上会重叠`). Prefer unique coordinates.
- Runtime rewiring: if a scenario changes `location.connections` during play (TFA `formLocationLine`), also patch
  `state.scenario.layout.locations` (as `formLocationLineInEntry` / `formLocationLine` do) or the map will keep
  the static grid.

---

## 9. Chaos-token module pattern (`content/campaigns/<campaign>/<cycle>-chaos.js`)

TFA's `tfa-chaos.js` is one module with a per-chapter `if (id === '<scenarioId>')` block in two functions:

```js
export function tfaChaosToken(id, state, inv, token, api) {           // per-token value
  if (!['skull','cultist','tablet','elderthing'].includes(token)) return null
  if (id === 'heartOfTheEldersPart1' || id === 'heartOfTheEldersPart2') id = 'heartOfTheElders'
  const hard = ['hard','expert'].includes(state.difficulty)
  if (id === 'theDoomOfEztli') {
    if (token === 'skull') { … return { delta: …, /* extras */ } }
    if (token === 'cultist' || token === 'tablet') return { delta: -count }
    return { delta: 0, drawAnother: true, placeDoomOnFail: true }
  }
  …
  return null
}

export function tfaChaosAfterTest(id, state, inv, result, api) {      // per-token after-test fallout
  const tokens = (result.drawn || []).filter(t => !(result.cancelledTokens || []).includes(t))
  const has = token => tokens.includes(token)
  const failed = !result.success
  const margin = result.success ? (result.value - result.difficulty) : 0
  if (id === 'theDoomOfEztli') {
    if (has('elderthing') && location && (hard || failed)) placeDoom(location)
    return
  }
  …
}

export const TFA_CHAOS_SCENARIOS = Object.freeze([ 'theUntamedWilds', …, 'turnBackTime' ])
```

Plug-in (theDoomOfEztli/behavior.js):

```js
afterTest(state, inv, result, api) {
  encounterRules.afterTest?.(state, inv, result, api)
  tfaChaosAfterTest('theDoomOfEztli', state, inv, result, api)
},
resolveChaosToken(state, inv, token, api) {
  return tfaChaosToken('theDoomOfEztli', state, inv, token, api)
},
```

Facts to respect:
- The engine calls `resolveChaosToken` from `resolveSpecialToken` (`treachery-tokens.js:298`) for non-numeric tokens and
  merges into `{ delta: 0, drawAnother: false, onDraw: [], onFail: [], ...custom }`. **Only `delta`, `autoFail`,
  `drawAnother`, `onDraw[]`, `onFail[]` are consumed.** Extra keys (`placeDoomOnFail`, `notSucceedByOne`,
  `loseClueOnFail`, `doomOnFail`, …) are inert documentation — implement those effects in `afterTest`.
- Returning falsy falls back to `state.scenario.tokenMeanings[difficulty][token]`, then `SYMBOL_DEFAULTS`.
- `afterTest` fires twice in `tests.js` (auto-fail early-return path :769 and normal path :930) — make it idempotent
  and driven purely by `result`.
- `revealToken(seat)` also routes through `resolveChaosToken` (scenario-runtime.js:400).
- Register the mechanic id in `content/mechanics.js` (`tfaExploration`, `tfaChaos`, …) before listing it in
  `requiredMechanicIds`, otherwise `assertLaunchable` fails. TCU's comment forbids registering `tcuChaos`
  before `tcu-chaos.js` exists.

---

## 10. Pitfalls (each one is a real trap found in this codebase)

1. **Identity-alias uniqueness / missing catalog card.** `scenarioManifest.originalCode()` throws
   `身份别名 X 不唯一` when the same alias maps to different original codes across
   enemies/treacheries/storyAssets/sharedIdentities, and `缺少目录原卡` when `ALL_CARDS[code]` is absent.
   Alias keys are the map keys of `scenario.enemies/treacheries/storyAssets`; a scenario-local alias (`'harbinger'`)
   is fine only if it resolves to exactly one code.
2. **Duplicate zones and quantity caps.** A code may not appear in both `encounterDeck` and `setAside`/`inPlay`
   (`多个初始区域重复入牌`), and the total declared count may not exceed `ALL_CARDS[code].quantity`
   (`需要 N 张，目录只有 M 张`). `04102` has quantity 4 — TFA's four poison copies are at the cap; a fifth throws.
   Also note `agentSets` values are auto-counted into `setAside`, so do **not** repeat them in `setAsideAliases`.
3. **Override kills the spread.** `behavior = { ...encounterRules, afterTest(...) {…} }` replaces the shared hook;
   you must call `encounterRules.afterTest?.(state, inv, result, api)` (etc.) inside your override, or the campaign
   rules silently stop working for that chapter. Same for `roundEnded`, `turnEnded`, `enemySpawned`, `canExplore`,
   `resolveEncounter`, `actions`/`performAction` (which end with
   `if (encounterRules.performAction?.(state, inv, move, api)) return; throw new Error(…)`).
4. **Hand-made connections get wiped.** `linkSymbolLocations` rewrites `entry.connections` from
   `entry.explicitConnections` (plus symbol links). Passing `{ connections: [...] }` to `card-data.location()`
   **loses** them; use `explicitConnections: [...]` (see `velmasDiner: location(…, { explicitConnections: ['easttown'] })`).
   Symbol links are bidirectional-inclusive, so declaring `links` on one side is enough. After any runtime rewiring,
   call `syncSymbolConnections(state)` only if you want the printed graph back (TFA skips it once `locationsInLine`).
5. **`choose()` contract and replay.** `requestChoice` rejects non-string/duplicate option ids
   (`选择选项缺少字符串 id` / `选项 id 重复`), deep-clones and deep-compares `source` on replay
   (`选择恢复凭据与规则不一致`), so `source` must be a stable primitive/plain string — never an enemy/asset
   instance or a mutable object. `api.choose` throws `ChoicePause` outside a rules transaction.
6. **Determinism.** All randomness must flow through `helper.randomValue` / `helper.shuffle` (setup) or
   `api.random()` / `api.shuffle` (hooks). `Math.random()` breaks `replay-golden`, `checkpoint-rewind` and the
   `saveReplay` acceptance. Sort tie-breaks deterministically (`String(originalCode).localeCompare(...)`).
7. **Status values.** Campaign investigator records only accept `status: 'active' | 'killed' | …`
   (`resolution` sets `record.status = 'killed'`, `state.campaign.failed = true` for campaign loss). Content
   statuses are the five in `CONTENT_STATUSES`; `playable` is required for launching, and `verified` additionally
   needs the full confirmation report (`content/migration-confirmation.js`).
8. **Story-text shape.** `storyText` requires **paragraph arrays** (or a >20-char summary string), every paragraph
   non-empty, and **no HTML tags** (`/<[^>]+>/` fails). `resolutions` keys must equal `manifest.resolutionIds`
   exactly (it is `Object.keys(scenario.resolutions)`), and the tool also expects an `intro` (>20 chars) when the
   campaign has no imported introduction for that chapter.
9. **New encounter entry ≠ registered.** `implementedFor` reads the *generated* index; run
   `npm run cards:encounter-check` (or `node tools/build-encounter-index.mjs --write`) after adding files, or
   `literalCardBehavior` stays `false` and `encounter-handler-guard.test.mjs` fails.
10. **Ledger drift.** Editing any of the four scenario files changes `fileHashes`; `audit:tfa:scenarios` (`--check`)
    fails until you re-run `--write`. The 9 TCU chapters will need their own `tools/audit-tcu-scenarios.mjs` +
    `audit/tcu-scenario-acceptance.json` + `audit/tcu-browser-acceptance.json` triple, plus a
    `tests/tcu-scenario-acceptance.test.mjs` that asserts the same invariants.

---

## 11. Checklist for each new TCU scenario

1. `content/campaigns/theCircleUndone/scenarios/<id>/definition.js`
   - constants for codes, `deckGroups`, `setAsideCodes` (exclude from deck), `locations` via `location()` +
     `linkSymbolLocations`, `EXPLORATION/LOCATION pools`, `stages(...)` with `reveal: { type: 'campaignRule' }`,
     `objective`, `scriptCards`, `storyAssets`, `encounterDeck: encounterDeck(gathered)`, `resolutions`,
     `identities = identitiesFor(scenario); bindScenarioIdentities(scenario, identities)`.
2. `layout.js` = `layoutFor(scenario, coordinates)`; unique coordinates; omit nothing you can compute.
3. `behavior.js` = `{ ...encounterRules, id, setupPlan?, setupLocations, setupEnemies, afterChaosBagSetup,
   actReveal, agendaReveal, checkObjectives, afterTest, resolveChaosToken, resolveEncounter, actions,
   performAction, encounterActions, performEncounterAction, canExplore, beforeExplore, afterExplore,
   locationEntered, roundEnded, turnEnded, enemySpawned, enemyDefeated, resolution, allResigned }` —
   only the hooks your chapter needs, each returning the documented shape.
4. `index.js` = the manifest block from §1.3 with `campaignId: 'theCircleUndone'`,
   `requiredPackIds: ['core','tcuCampaign']`, `requiredEncounterGroupIds` limited to ids declared in
   `content/packs/tcuCampaign/manifest.js`, `recordReads/recordWrites` ⊆ `recordSchema` (currently only
   `mementosDiscovered / youAreBeingHunted / wasTakenByTheWatcher / missingPersons` — extend `shared.js` first),
   `behaviorIds: [behavior.id]`.
5. Card entries under `src/cards/encounter-entries/theCircleUndone/{<id>|_shared/<group>}/<code>.js`, then
   `node tools/build-encounter-index.mjs --write`.
6. Register in `content/registered.js`: remove the id from `...catalogChapters`, add the import + entry.
7. Tests: pure hook harness + one real-engine `registerContentBundle` case + a `JSON.stringify`/`deepEqual`
   roundtrip; register the file in `tests/suites.mjs` (FAST) and `tests/node-suite.mjs`.
8. Gates: `npm run cards:encounter-check`, `npm run test:fast`,
   `node tools/replay-fixtures.mjs --compare <baseline>`, then the per-campaign audit `--write`/`--check`.
