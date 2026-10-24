# The Circle Undone (TCU, campaign 05) — reference file map

Companion manifest: `reference-files.json` (machine-readable, one record per file with `bytes` + `sha256`).

- Reference root: `参考资源/ArkhamHorror-main` (read-only).
- Target repo: `games/arkhamhorror` (card faces in `src/cards/cards-data.js`, mechanism scan in `artifacts/migration/tcu/mechanism-scan.json`).
- Path prefix `lib/` below = `backend/arkham-api/library/Arkham/`; other paths are repo-relative to the reference root.
- Chapter keys are the lowerCamel ids used by `mechanism-scan.json` (`scenario:*` tokens, `encounterGroups[].chapters`).

## Totals (computed with node:crypto over file bytes)

| bucket | files | bytes |
|---|---|---|
| TCU Haskell core (`lib/**` path match `TheCircleUndone`) | 430 | 854,090 |
| frontend / backend data + locale files | 28 | 507,450 |
| TCU investigator & weakness behaviour outside the TCU tree | 16 | 50,021 |
| shared tarot infrastructure (`lib/Tarot.hs`, `lib/Helpers/Tarot.hs`) | 2 | 2,006 |
| **total** | **476** | **1,413,567** |

By category: `card-behavior` 319 / 610,755 · `scenario-rule` 29 / 147,445 · `card-def` 60 / 93,637 · `encounter-set` 23 / 10,538 · `campaign-flow` 9 / 26,111 · `story` 5 / 14,633 · `chaos` 1 / 992 · `locale` 24 / 430,933 · `scenario-settings` 3 / 28,779 · `ui` 1 / 47,738 · `other` 2 / 2,006.

Reference files per chapter (chapter-tagged files only; shared encounter-set files are counted separately in `shared:*` buckets):

| chapter | files | bytes |
|---|---|---|
| disappearanceAtTheTwilightEstate | 12 | 75,772 |
| theWitchingHour | 23 | 87,627 |
| atDeathsDoorstep | 30 | 81,641 |
| theSecretName | 38 | 112,019 |
| theWagesOfSin | 56 | 130,403 |
| forTheGreaterGood | 40 | 105,399 |
| unionAndDisillusion | 44 | 150,692 |
| inTheClutchesOfChaos | 39 | 108,415 |
| beforeTheBlackThrone | 32 | 124,535 |
| campaign | 20 | 195,211 |
| playerCards (TCU player investigators/cards) | 15 | 68,742 |
| returnTo:* (9 chapter buckets) + returnToCampaign | 1+7+7+1+4+8+6+15+9+5 = 63 | 103,192 |
| returnToSet:* (7 replacement sets) + shared:* (10 sets) + all | 22+38+2 = 62 | 67,913 |

(Chapter rows include their locale JSONs; `returnTo:*` rows are variant content that is **not** part of the 9-scenario base port.)

## How the map was built

1. Recursive walk of `backend/arkham-api/library/Arkham/**`, keeping `.hs` files whose path matches `TheCircleUndone|CircleUndone` (case-sensitive; the earlier loose `TCU` match produced false positives such as `PastCurfew.hs`/`Shortcut.hs`, discarded).
2. Category/chapter assigned from the path: `CardDefs` → `card-def` (or `encounter-set`/`story` for shared sets / story cards), `*/Cards/**` → `card-behavior`, `Scenario/Scenarios`+`Scenarios` → `scenario-rule`, `Campaign*` → `campaign-flow`, `ChaosBag` → `chaos`.
3. 16 behaviour files that live outside the TCU tree but belong to the TCU card set were added explicitly (13 investigator files incl. the 4 prologue story investigators, 3 player-weakness behaviour files).
4. 28 data/locale files added from `frontend/src` + the campaign settings JSON; `backend/arkham-api/data/cards.json` is noted only (see `notes` in the JSON: 815-record legacy dump, no usable TCU records).
5. Per-card inventory computed by joining `src/cards/cards-data.js` (`ALL_CARDS`, 377 codes `05xxx`) with `mechanism-scan.json` `cards[]` + `encounterGroups[]`.

# 0. Campaign shell — read in this order

1. `lib/Campaign/Campaigns/TheCircleUndone.hs` — campaign entity, `nextStep` chain, prologue, interludes 2/3/4, epilogue, campaign options, initial `MissingPersons` log.
2. `lib/Campaigns/TheCircleUndone/CampaignSteps.hs` — 9 base `ScenarioStep` patterns (05043/05050/05065/05120/05161/05197/05238/05284/05325) + 9 ReturnTo steps (54016/54017/54024/54029/54034/54042/54046/54049/54056).
3. `lib/Campaigns/TheCircleUndone/Key.hs` — 64 record constructors (`MissingPersons`, `WasTakenByTheWatcher`, `MementosDiscovered`, `ThePathWindsBeforeYou`, `DoomDrawsEverCloser`, `AzathothSlumbersForNow`, …).
4. `lib/Campaigns/TheCircleUndone/Memento.hs` — 10 mementos (`MesmerizingFlute`, `StrangeIncantation`, `RitualComponents`, `ScrapOfTornShadow`, `Gilman'sJournal`, `Keziah'sFormulae`, `WornCrucifix`, `WispOfSpectralMist`, `CornHuskDoll`, `BloodyTreeCarvings`).
5. `lib/Campaigns/TheCircleUndone/Memento/Helpers.hs` — `discoverMemento` (set-insert into `MementosDiscovered`), `getMementosDiscoveredCount`.
6. `lib/Campaigns/TheCircleUndone/ChaosBag.hs` — 13-token bag per difficulty (2 Skull, 1 ElderSign, 1 AutoFail; Easy 4×0/+1 …).
7. `lib/Campaigns/TheCircleUndone/Helpers.hs` — `allPrologueInvestigators` (the 4 story investigators) + haunted-ability runners.
8. `lib/Campaigns/TheCircleUndone/I18n.hs` + `Import.hs` — campaign i18n helper and umbrella re-export.
9. `lib/Campaign/Campaigns/TheCircleUndone/Achievements.hs` — `runCircleAchievements` wired into every campaign message (achievement list for 05).
10. `lib/Campaign/Campaigns/ReturnToTheCircleUndone.hs` — ReturnTo campaign (id `54`; `isReturnTo = attrs.id == "54"`).
11. `lib/Tarot.hs` + `lib/Helpers/Tarot.hs` (shared infra, outside the TCU tree) — 22 arcana enum, upright/reversed, `TarotReading` (`Chaos|Balance|Choice|Destiny`), `tarotDeck = [minBound..maxBound]`, `LoadTarotDeck`, `DrawAndChooseTarot`, `SetPerformTarotReadings`, `PickDestiny`.
12. Data: `frontend/src/arkham/data/theCircleUndone.json` (scenario ids + ReturnTo ids + U&D/BBT settings), `frontend/src/arkham/data/scenarios.ts`, `frontend/src/arkham/types/Scenario.ts` (campaign-id switch + per-code locale key), `frontend/src/arkham/components/CampaignLog.vue` (`theCircleUndone.key.mementosDiscovered` rendering).

Campaign flow (from `nextStep`): `PrologueStep → DisappearanceAtTheTwilightEstate → ChooseDecksStep(TheWitchingHour) → TheWitchingHour → AtDeathsDoorstep → Interlude 2 (The Price of Progress) → TheSecretName → TheWagesOfSin → ForTheGreaterGood → UnionAndDisillusion → Interlude 3 (The Inner Circle) → InTheClutchesOfChaos → Interlude 4 (Twist of Fate) → BeforeTheBlackThrone → EpilogueStep`.

Campaign creation seeds the log with `MissingPersons = {05046,05047,05048,05049}` as recorded card codes — reproduce this or At Death's Doorstep / Union and Disillusion break.

# 1. Disappearance at the Twilight Estate — prologue (05043)

Files, in order:

1. `lib/Scenario/Scenarios/TheCircleUndone/DisappearanceAtTheTwilightEstate.hs` — scenario entity (code 05043), 3×5 grid layout, `gather` list, spectral locations, story-investigator choice, 22-card tarot draw, `MissingPersons` writes, `noResolution` + `PiecesOfEvidenceWereLeftBehind`.
2. `lib/Scenarios/TheCircleUndone/DisappearanceAtTheTwilightEstate/Helpers.hs` — scenario text/flavor helpers (289 B).
3. `lib/Act/CardDefs/TheCircleUndone/DisappearanceAtTheTwilightEstate.hs` — act 05045 “The Disappearance”.
4. `lib/Act/Cards/TheCircleUndone/DisappearanceAtTheTwilightEstate/TheDisappearance.hs` — act behaviour (end-of-round/agenda-driven prologue clock).
5. `lib/Agenda/CardDefs/TheCircleUndone/DisappearanceAtTheTwilightEstate.hs` — agenda 05044 “JUDGEMENT · XX”.
6. `lib/Agenda/Cards/TheCircleUndone/DisappearanceAtTheTwilightEstate/JudgementXX.hs` — agenda behaviour (doom threshold, “no way out” step).
7. `lib/Location/CardDefs/TheCircleUndone/AtDeathsDoorstep.hs` — 7 locations reused here in their **spectral** form.
8. `lib/Location/Cards/TheCircleUndone/AtDeathsDoorstep/*Spectral.hs` (7 files: EntryHall, VictorianHalls, Office, BilliardsRoom, TrophyRoom, MasterBedroom, Balcony) — the prologue places only these backs.
9. `lib/Investigator/Cards/GavriellaMizrah.hs` + `JeromeDavids.hs` + `ValentinoRivas.hs` + `PennyWhite.hs` (outside the TCU tree) — story investigators 05046–05049; fixed `startsWith` decks, `CannotDrawCards`/`CannotManipulateDeck`/`StartingResources -4` in setup.
10. `lib/Campaigns/TheCircleUndone/Helpers.hs` — `allPrologueInvestigators` ordering used for the pick list.
11. `lib/Tarot.hs`, `lib/Helpers/Tarot.hs` — deck + draw messages.

Encounter groups gathered: own group `05043–05049`; plus shared `inexorable_fate`, `realm_of_death`, `spectral_predators`, `trapped_spirits`, `the_watcher`; plus core `ChillingCold` (01xxx); plus the 7 spectral At Death’s Doorstep locations (scan does **not** model this cross-chapter gather).

Special subsystems: 22-card tarot; 4 story investigators; `MissingPersons` 4 buckets; evidence counter.
Tarot → record mapping (one upright arcana per player, arcana is removed from the deck after use):

| arcana | record bucket | evidence added |
|---|---|---|
| The Fool 0 | DisappearedIntoTheMist | 2 |
| The Magician I / The High Priestess II | DisappearedIntoTheMist | 0 |
| The Empress III / The Emperor IV / The Hierophant V / The Lovers VI | WasClaimedBySpecters | 3 |
| The Chariot VII / Strength VIII / The Hermit IX | WasClaimedBySpecters | 5 |
| Wheel of Fortune X / Justice XI / The Hanged Man XII | WasPulledIntoTheSpectralRealm | 2 |
| Death XIII / Temperance XIV / The Devil XV / The Tower XVI | WasPulledIntoTheSpectralRealm | 4 |
| The Star XVII / The Moon XVIII | WasPulledIntoTheSpectralRealm | 6 |
| The Sun XIX / Judgement XX | WasTakenByTheWatcher | 3 |
| The World XXI | WasTakenByTheWatcher | 5 |

Unpicked prologue investigators are crossed out of `MissingPersons` at `LoadScenario` (`crossOutRecordSetEntries`).

# 2. The Witching Hour (05050)

Files, in order:

1. `lib/Scenario/Scenarios/TheCircleUndone/TheWitchingHour.hs` — scenario 05050; gather list; 5-of-7 Witch-Haunted Woods placement; Arkham Woods set-aside; accept/reject fate pre-setup; ReturnTo destiny tarot; 5 resolutions.
2. `lib/Scenarios/TheCircleUndone/TheWitchingHour/Helpers.hs` — helpers (255 B).
3. `lib/Act/CardDefs/TheCircleUndone/TheWitchingHour.hs` — acts 05053–05056 (+ 05055b Witches’ Circle as the act’s other side).
4. `lib/Act/Cards/TheCircleUndone/TheWitchingHour/{LostInTheWoods,WitchHauntings,PathsIntoTwilight,ACircleUnbroken}.hs` — act behaviours.
5. `lib/Agenda/CardDefs/TheCircleUndone/TheWitchingHour.hs` — agendas 05051 “TEMPERANCE · XIV”, 05052 “The Night Howls”.
6. `lib/Agenda/Cards/TheCircleUndone/TheWitchingHour/{TemperanceXIV,TheNightHowls}.hs` — agenda behaviours.
7. `lib/Enemy/CardDefs/TheCircleUndone/TheWitchingHour.hs` — 05057 Anette Mason (“The High Priestess”, unique, victory 2).
8. `lib/Enemy/Cards/TheCircleUndone/TheWitchingHour/AnetteMason.hs` — her behaviour.
9. `lib/Location/CardDefs/TheCircleUndone/TheWitchingHour.hs` — 7 `locationWithUnrevealed` woods (05058–05064) + `witchesCircle` 05055b (`otherSideIs "05055"`).
10. `lib/Location/Cards/TheCircleUndone/TheWitchingHour/*.hs` (8 files) — location behaviours.
11. `lib/Location/CardDefs/NightOfTheZealot/TheDevourerBelow.hs` (core, outside TCU tree) — the Arkham Woods locations that are set aside/used as the woods’ flip side.

Encounter groups gathered: own `05050–05055b`; shared `anettes_coven`, `city_of_sins`, `witchcraft`; core `AncientEvils`, `StrikingFear`; set aside `AgentsOfShubNiggurath` + `AgentsOfAzathoth`.

Special subsystems: fate choice (accept → `YouHaveAcceptedYourFate`, 2 Tablet tokens, campaign cards `The Tower XVI` + `Ace of Rods`; reject → `YouHaveRejectedYourFate`, 1 ElderThing token); ReturnTo “perform tarot reading” assigns a `Destiny` arcana to the 8 remaining scenarios (Temperance XIV→Witching Hour, Justice XI→At Death’s Doorstep, The Hermit IX→Secret Name, The Hanged Man XII→Wages of Sin, The Hierophant V→Greater Good, The Lovers VI→U&D, The Chariot VII→ICoc, Wheel of Fortune X→BBT).

# 3. At Death’s Doorstep (05065)

Files, in order:

1. `lib/Scenario/Scenarios/TheCircleUndone/AtDeathsDoorstep.hs` — scenario 05065; gather + gather-and-set-aside; 7 mortal locations placed; clues seeded from `MissingPersons`; 3 resolutions.
2. `lib/Scenarios/TheCircleUndone/AtDeathsDoorstep/Helpers.hs` — helpers (257 B).
3. `lib/Act/CardDefs/TheCircleUndone/AtDeathsDoorstep.hs` — acts 05068–05070 (`Hidden Agendas`, `The Spectral Realm`, `Escape the Cage`).
4. `lib/Act/Cards/TheCircleUndone/AtDeathsDoorstep/{HiddenAgendas,TheSpectralRealm,EscapeTheCage}.hs`.
5. `lib/Agenda/CardDefs/TheCircleUndone/AtDeathsDoorstep.hs` — agendas `Justice XI`, `Over the Threshold`.
6. `lib/Agenda/Cards/TheCircleUndone/AtDeathsDoorstep/{JusticeXI,OverTheThreshold}.hs`.
7. `lib/Enemy/CardDefs/TheCircleUndone/AtDeathsDoorstep.hs` — 05083/05085-level defs, incl. Josef Meiger (`doubleSided "05085b"`).
8. `lib/Enemy/Cards/TheCircleUndone/AtDeathsDoorstep/JosefMeiger.hs`.
9. `lib/Location/CardDefs/TheCircleUndone/AtDeathsDoorstep.hs` — 14 location defs (7 mortal + 7 spectral).
10. `lib/Location/Cards/TheCircleUndone/AtDeathsDoorstep/*.hs` (14 files, `*Spectral` twins).
11. `lib/Story/CardDefs/TheCircleUndone/AtDeathsDoorstep.hs` — story card 05085b “Josef’s Plan”.
12. `lib/Story/Cards/TheCircleUndone/AtDeathsDoorstep/JosefsPlan.hs`.

Encounter groups gathered: own `05065–05085b`; shared `silver_twilight_lodge`, `spectral_predators`, `trapped_spirits`, `inexorable_fate`; core `ChillingCold`; **set aside** `realm_of_death` + `the_watcher`.

Special subsystems: MissingPersons→clue seeding (6 clues on entryHall/office/billiardsRoom/balcony for each still-missing prologue investigator); `PiecesOfEvidenceWereLeftBehind` removes that many clues via a choose-or-run split; spectral location twins are set aside until the spectral realm act; Josef Meiger flips to a story card (05085b).

# 4. The Secret Name (05120)

Files, in order:

1. `lib/Scenario/Scenarios/TheCircleUndone/TheSecretName.hs` — scenario 05120; gather; 4 agendas; 3 acts; unknown-places deck; Nahab out of play; Lodge record branch; 2 resolutions.
2. `lib/Scenarios/TheCircleUndone/TheSecretName/Helpers.hs` — helpers (251 B).
3. `lib/Act/CardDefs/TheCircleUndone/TheSecretName.hs` — acts 05137–05139 (`Investigating the Witch House`, `Beyond the Witch House`, `Stopping the Ritual`).
4. `lib/Act/Cards/TheCircleUndone/TheSecretName/{InvestigatingTheWitchHouse,BeyondTheWitchHouse,StoppingTheRitual}.hs`.
5. `lib/Agenda/CardDefs/TheCircleUndone/TheSecretName.hs` — agendas 05121–05124 (`The Hermit IX`, `The Familiar`, `The Witch Light`, `Marked for Sacrifice`).
6. `lib/Agenda/Cards/TheCircleUndone/TheSecretName/{TheHermitIX,TheFamiliar,TheWitchLight,MarkedForSacrifice}.hs`.
7. `lib/Enemy/CardDefs/TheCircleUndone/TheSecretName.hs` — 05148 Brown Jenkin, 05149 Nahab.
8. `lib/Enemy/Cards/TheCircleUndone/TheSecretName/{BrownJenkin,Nahab}.hs`.
9. `lib/Location/CardDefs/TheCircleUndone/TheSecretName.hs` — 15 defs incl. 6 unknown places + `strangeGeometry` ×2 + `witchHouseRuins`.
10. `lib/Location/Cards/TheCircleUndone/TheSecretName/*.hs` (15 files).
11. `lib/Treachery/CardDefs/TheCircleUndone/TheSecretName.hs` + `lib/Treachery/Cards/TheCircleUndone/TheSecretName/{DisquietingDreams,ExtradimensionalVisions,GhostlyPresence,MeddlesomeFamiliar,PulledByTheStars}.hs`.
12. `lib/Campaigns/TheCircleUndone/Memento.hs` + `Memento/Helpers.hs` — mementos granted by resolution 2.

Encounter groups gathered: own `05120–05150`; shared `city_of_sins`, `inexorable_fate`, `realm_of_death`, `witchcraft`; core `Rats`.

Special subsystems: `UnknownPlacesDeck` (6 base locations, ReturnTo drops 4 and adds 4; 3 split to the bottom; `witchHouseRuins` shuffled into the bottom group); “decrepit door” group (3 rooms); Nahab set aside out of play; `The Black Book` asset 05150; record branch `TheInvestigatorsToldTheLodgeAboutTheCoven` vs `…HidTheirKnowledgeOfTheCoven`; mementos `Gilman'sJournal`, `Keziah'sFormulae`, `WornCrucifix` (resolution 2).

# 5. The Wages of Sin (05161)

Files, in order:

1. `lib/Scenario/Scenarios/TheCircleUndone/TheWagesOfSin.hs` — scenario 05161; gather; The Watcher set aside; 4-of-6 heretics + 4 spectral webs; spectral encounter deck; numbered single-sided locations; 3 resolutions.
2. `lib/Scenarios/TheCircleUndone/TheWagesOfSin/Helpers.hs` — helpers (5,355 B: spectral/heretic helpers — read fully).
3. `lib/Act/CardDefs/TheCircleUndone/TheWagesOfSin.hs` — acts 05164 `In Pursuit of the Dead`, 05165 `In Pursuit of the Living`.
4. `lib/Act/Cards/TheCircleUndone/TheWagesOfSin/{InPursuitOfTheDead,InPursuitOfTheLiving}.hs`.
5. `lib/Agenda/CardDefs/TheCircleUndone/TheWagesOfSin.hs` — 05162 `THE HANGED MAN · XII`, 05163 `Death's Approach`.
6. `lib/Agenda/Cards/TheCircleUndone/TheWagesOfSin/{TheHangedManXII,DeathsApproach}.hs`.
7. `lib/Enemy/CardDefs/TheCircleUndone/TheWagesOfSin.hs` — 6 `doubleSided` heretics (`heretic_A` 05178a↔05178b … `heretic_K` 05178k↔05178l; `heretic_G` also has `InDiscardEffect`), plus 05179 Vengeful Witch, 05180 Malevolent Spirit.
8. `lib/Enemy/Cards/TheCircleUndone/TheWagesOfSin/{Heretic_A,Heretic_C,Heretic_E,Heretic_G,Heretic_I,Heretic_K,MalevolentSpirit,VengefulWitch}.hs`.
9. `lib/Location/CardDefs/TheCircleUndone/TheWagesOfSin.hs` — 22 defs: 4 numbered pairs (169/170 gallows, 171/172 graves, 173/174 crypt, 175/176 attic) + spectral twins + `hangmansBrook`, `hauntedFields`, `abandonedChapel`.
10. `lib/Location/Cards/TheCircleUndone/TheWagesOfSin/*.hs` (22 files).
11. `lib/Story/CardDefs/TheCircleUndone/TheWagesOfSin.hs` — 6 `Unfinished Business` story cards (b-faces 05178b/d/f/h/j/l).
12. `lib/Story/Cards/TheCircleUndone/TheWagesOfSin/UnfinishedBusiness_{B,D,F,H,J,L}.hs`.
13. `lib/Treachery/CardDefs/TheCircleUndone/TheWagesOfSin.hs` + `lib/Treachery/Cards/TheCircleUndone/TheWagesOfSin/{BaneOfTheLiving,BurdensOfThePast,GraveLight,GraveLightSpectral,OminousPortents,Punishment}.hs` (note `x05184` spectral Grave-Light uses `cdArt = "05184"`).

Encounter groups gathered: own `05161–05185`; shared `anettes_coven`, `city_of_sins`, `inexorable_fate`, `realm_of_death`, `trapped_spirits`, `witchcraft`; set aside `the_watcher` (ReturnTo also sets aside Erynn MacAoidh).

Special subsystems: heretic faces (6 enemies × 2 faces = 12 records + 6 Unfinished Business story faces = 18 faces); `SpectralEncounterDeck` = `amongGathered (SingleSidedCard <> Spectral <> not location)`; single-sided locations with numbered variants (`placeOneOf` pairs) and separate spectral twins; record `HereticsWereUnleashedUntoArkham` (count) and `TheInvestigatorsSurvivedTheWatchersEmbrace`; memento `BloodyTreeCarvings`; ReturnTo adds Erynn (`ErynnWantsToMeet`) and a 3rd act (`In Pursuit of Answers`/`In Pursuit of the Beyond`).

# 6. For the Greater Good (05197)

Files, in order:

1. `lib/Scenario/Scenarios/TheCircleUndone/ForTheGreaterGood.hs` — scenario 05197; gather; member/non-member layout swap; 4 chaos-token keys; Puzzle Box; 4 resolutions.
2. `lib/Scenarios/TheCircleUndone/ForTheGreaterGood/Helpers.hs` — helpers (858 B).
3. `lib/Act/CardDefs/TheCircleUndone/ForTheGreaterGood.hs` — acts 05200 `Warm Welcome`, 05201 `Infiltrating the Lodge`, 05202 `Obtaining the Device`, 05203 `The Four Keys`.
4. `lib/Act/Cards/TheCircleUndone/ForTheGreaterGood/{WarmWelcome,InfiltratingTheLodge,ObtainingTheDevice,TheFourKeys}.hs`.
5. `lib/Agenda/CardDefs/TheCircleUndone/ForTheGreaterGood.hs` — 05198 `THE HIEROPHANT · V`, 05199 `Ends and Means`.
6. `lib/Agenda/Cards/TheCircleUndone/ForTheGreaterGood/{TheHierophantV,EndsAndMeans}.hs`.
7. `lib/Enemy/CardDefs/TheCircleUndone/ForTheGreaterGood.hs` — 05217/05217b Nathan Wick (double-sided), Lodge Jailor, Cell Keeper, Summoned Beast, Knight of the Inner/Outer Circle, plus acolyte/wizard of the order.
8. `lib/Enemy/Cards/TheCircleUndone/ForTheGreaterGood/*.hs` (7 files).
9. `lib/Location/CardDefs/TheCircleUndone/ForTheGreaterGood.hs` — 13 base defs incl. the `Members Only` / `We've Been Expecting You` variants + ReturnTo lounge.
10. `lib/Location/Cards/TheCircleUndone/ForTheGreaterGood/*.hs` (14 files, incl. `ReturnToLounge`).
11. `lib/Treachery/CardDefs/TheCircleUndone/ForTheGreaterGood.hs` + `lib/Treachery/Cards/TheCircleUndone/ForTheGreaterGood/{CallToOrder,Expulsion,BeneathTheLodge,MarkOfTheOrder}.hs`.
12. `lib/Asset/Cards/TheCircleUndone.hs` — `August Lindquist` (05227) and `Puzzle Box` (05228) defs (campaign card 05228 is added by the campaign option `TakePuzzleBox`).
13. `lib/Campaign/Campaigns/TheCircleUndone.hs` — `HandleOption TakePuzzleBox / TakeBlackBook`.

Encounter groups gathered: own `05197–05228`; shared `city_of_sins`, `silver_twilight_lodge`; core `AncientEvils`, `DarkCult`, `LockedDoors`.

Special subsystems: layout swap on `TheInvestigatorsAreMembersOfTheLodge` (Warm Welcome + “We’ve Been Expecting You” locations + Acolyte/Wizard/Knight/Cell Keeper vs Infiltrating the Lodge + “Members Only” locations + Neophyte/Keeper of Secrets/Knights/Lodge Jailor); 4 created chaos tokens set aside as keys (`setAsideKeys [skull,cultist,tablet,elderthing]`); `Puzzle Box` + `August Lindquist`; `TheGuardianOfTheTrapEmerged` record.

# 7. Union and Disillusion (05238)

Files, in order:

1. `lib/Scenario/Scenarios/TheCircleUndone/UnionAndDisillusion.hs` — scenario 05238; gather + big set-aside; MissingPersons story assets/fates; Unvisited Isle shuffle; brazier lighting; act3/act4 selection matrix; heretic doom; 10 resolutions.
2. `lib/Scenarios/TheCircleUndone/UnionAndDisillusion/Helpers.hs` — helpers (2,052 B: brazier/lighting helpers).
3. `lib/Act/CardDefs/TheCircleUndone/UnionAndDisillusion.hs` — 8 acts: 05241 `The Unvisited Isle`, 05242 `Fated Souls`, 05243–05246 `Beyond the Mist` v.I–v.IV, 05247 `The Binding Rite`, 05248 `The Broken Rite` (v.V is ReturnTo-only).
4. `lib/Act/Cards/TheCircleUndone/UnionAndDisillusion/{TheUnvisitedIsle,FatedSouls,BeyondTheMistV1..V4,TheBindingRite,TheBrokenRite}.hs`.
5. `lib/Agenda/CardDefs/TheCircleUndone/UnionAndDisillusion.hs` — 05239 `THE LOVERS · VI`, 05240 `Crossroads of Fate`.
6. `lib/Agenda/Cards/TheCircleUndone/UnionAndDisillusion/{TheLoversVI,CrossroadsOfFate}.hs`.
7. `lib/Enemy/CardDefs/TheCircleUndone/UnionAndDisillusion.hs` — 4 double-sided fate enemies (`05262b`–`05265b`) + Spectral Raven 05267 + Whippoorwill 05266.
8. `lib/Enemy/Cards/TheCircleUndone/UnionAndDisillusion/{GavriellaMizrah,JeromeDavids,PennyWhite,ValentinoRivas,SpectralRaven,Whippoorwill}.hs`.
9. `lib/Location/CardDefs/TheCircleUndone/UnionAndDisillusion.hs` — 9 defs (Miskatonic River, Forbidding Shore, Geist-Trap, 6 Unvisited Isle variants).
10. `lib/Location/Cards/TheCircleUndone/UnionAndDisillusion/*.hs` (9 files).
11. `lib/Story/CardDefs/TheCircleUndone/UnionAndDisillusion.hs` — 4 fate story cards 05262–05265.
12. `lib/Story/Cards/TheCircleUndone/UnionAndDisillusion/{GavriellasFate,JeromesFate,PennysFate,ValentinosFate}.hs`.
13. `lib/Treachery/CardDefs/TheCircleUndone/UnionAndDisillusion.hs` + `lib/Treachery/Cards/TheCircleUndone/UnionAndDisillusion/{EagerForDeath,PsychopompsSong,DeathApproaches,MarkedForDeath,WatchersGaze}.hs`.
14. `lib/Asset/Cards/TheCircleUndone.hs` — story allies 05258–05261 (Gavriella/Jerome/Penny/Valentino).

Encounter groups gathered (own `05238–05272`): own `05238–05272`; shared `inexorable_fate`, `realm_of_death`, `spectral_predators`; core `AncientEvils`, `ChillingCold`; **set aside** `anettes_coven`, `silver_twilight_lodge`, `the_watcher`.

Special subsystems: MissingPersons drives both the story assets (05258–05261) and the fate cards (05262–05265), which are `placeUnderScenarioReference` and flip into enemies; Unvisited Isle: 6 locations shuffled, 2 placed + 4 set aside; braziers (`lightBrazier`) lit when `TheInvestigatorsSidedWithTheCoven`; act3/act4 matrix (`sidedWithLodge && erynnJoined → V5+Binding`, `sidedWithLodge → V1+Binding`, `coven && deceiving && inducted → V2+Broken`, `coven && ≥2 of {deceiving, hidKnowledge, keptMementos} → V3+Broken`, else `V4+Broken`); doom on agenda = `HereticsWereUnleashedUntoArkham` count; ReturnTo adds `BrazierEnchantment` and `54016b` reference.

# 8. In the Clutches of Chaos (05284)

Files, in order:

1. `lib/Scenario/Scenarios/TheCircleUndone/InTheClutchesOfChaos.hs` — scenario 05284; conditional gathers by record; 6 one-of location pairs; Where-It-All-Ends vs Shrouded-in-Mystery; act variant; breach/incursion; 4 resolutions.
2. `lib/Scenarios/TheCircleUndone/InTheClutchesOfChaos/Helpers.hs` — helpers (2,177 B: breach/incursion helpers).
3. `lib/Act/CardDefs/TheCircleUndone/InTheClutchesOfChaos.hs` — defines the 4 acts (05286a/05287/05288a/05289) whose `CardDef` encounter sets are `MusicOfTheDamned` / `SecretsOfTheUniverse`.
4. `lib/Act/Cards/TheCircleUndone/InTheClutchesOfChaos/{DarkKnowledgeV1,DarkKnowledgeV2,BeyondTheGrave,NewWorldOrder}.hs`.
5. `lib/Agenda/CardDefs/TheCircleUndone/InTheClutchesOfChaos.hs` — 05285 `THE CHARIOT · VII`.
6. `lib/Agenda/Cards/TheCircleUndone/InTheClutchesOfChaos/TheChariotVII.hs`.
7. `lib/Enemy/CardDefs/TheCircleUndone/InTheClutchesOfChaos.hs` — Anette Mason (Reincarnated Evil), Carl Sanford (Deathless Fanatic), Lodge Enforcer, Witness of Chaos (+ the shared-set cards from Music/Secrets).
8. `lib/Enemy/Cards/TheCircleUndone/InTheClutchesOfChaos/{AnetteMasonReincarnatedEvil,CarlSanfordDeathlessFanatic,LodgeEnforcer,WitnessOfChaos}.hs`.
9. `lib/Location/CardDefs/TheCircleUndone/InTheClutchesOfChaos.hs` — 12 defs: 6 district pairs (_290/_291, _292/_293, _294/_295, _296/_297, _298/_299, _300/_301) + Hangman’s Hill / Silver Twilight Lodge `…WhereItAllEnds` vs `…ShroudedInMystery`.
10. `lib/Location/Cards/TheCircleUndone/InTheClutchesOfChaos/*.hs` (16 files).
11. `lib/Treachery/CardDefs/TheCircleUndone/InTheClutchesOfChaos.hs` + `lib/Treachery/Cards/TheCircleUndone/InTheClutchesOfChaos/{ChaosManifest,PrimordialGateway,SecretsOfTheBeyond,TerrorUnleashed,ToilAndTrouble}.hs`.

Encounter groups gathered: own `05284–05308` (17 codes; **no acts in the chapter group**); shared `agents_of_azathoth`; core `Nightgaunts`; conditional: `AnetteMasonIsPossessedByEvil` → `music_of_the_damned`, `anettes_coven`, `city_of_sins`, `witchcraft`; `CarlSanfordPossessesTheSecretsOfTheUniverse` → `secrets_of_the_universe`, `silver_twilight_lodge`, `StrikingFear`, plus `MidnightMasks` only `huntingShadow`+`falseLead`.

Special subsystems: breach/incursion token subsystem (locations 05290–05305, treacheries 05306–05308); 6 location pairs chosen one-of; Hangman’s Hill / Lodge double-faced variant; act deck = `[darkKnowledgeV1, beyondTheGrave]` (Anette possessed) or `[darkKnowledgeV2, newWorldOrder]`; `DoomDrawsEverCloser`; Piper of Azathoth set aside.

# 9. Before the Black Throne (05325)

Files, in order:

1. `lib/Scenario/Scenarios/TheCircleUndone/BeforeTheBlackThrone.hs` — scenario 05325; cosmos deck construction; empty-space cards; Azathoth global; Path Winds count; 5 numbered resolutions (1–3, 5, 6).
2. `lib/Scenarios/TheCircleUndone/BeforeTheBlackThrone/Cosmos.hs` (~9.2 KB) — cosmos grid type, `initCosmos`, `cosmosToGrid`, placement/adjacency rules.
3. `lib/Scenarios/TheCircleUndone/BeforeTheBlackThrone/Cosmos/Types.hs` — `CosmosLocation`/`EmptySpace` JSON types.
4. `lib/Scenarios/TheCircleUndone/BeforeTheBlackThrone/Helpers.hs` (~7.4 KB) — cosmos/empty-space/azathoth helpers.
5. `lib/Act/CardDefs/TheCircleUndone/BeforeTheBlackThrone.hs` — 05334 `The Cosmos Beckons`, 05335 `In Azathoth's Domain`, 05336 `What Must Be Done`.
6. `lib/Act/Cards/TheCircleUndone/BeforeTheBlackThrone/{TheCosmosBeckons,InAzathothsDomain,WhatMustBeDone}.hs` (ReturnTo: `WhatMustBeDoneV2`).
7. `lib/Agenda/CardDefs/TheCircleUndone/BeforeTheBlackThrone.hs` — 05331 `Wheel of Fortune X`, 05332 `It Awaits`, 05333 `The Final Countdown`.
8. `lib/Agenda/Cards/TheCircleUndone/BeforeTheBlackThrone/{WheelOfFortuneX,ItAwaits,TheFinalCountdown}.hs`.
9. `lib/Enemy/CardDefs/TheCircleUndone/BeforeTheBlackThrone.hs` — 05346 Azathoth (global), 05341 Mindless Dancer.
10. `lib/Enemy/Cards/TheCircleUndone/BeforeTheBlackThrone/{Azathoth,MindlessDancer}.hs`.
11. `lib/Location/CardDefs/TheCircleUndone/BeforeTheBlackThrone.hs` — 9 defs: Cosmic Ingress, 3× Infinity of Darkness, Cosmic Gate, 2× Pathway into Void, 3× Dancer’s Mist, 3× Flight into Oblivion, Hideous Palace, Court of the Great Old Ones, The Black Throne.
12. `lib/Location/Cards/TheCircleUndone/BeforeTheBlackThrone/*.hs` (9 files).
13. `lib/Treachery/CardDefs/TheCircleUndone/BeforeTheBlackThrone.hs` + `lib/Treachery/Cards/TheCircleUndone/BeforeTheBlackThrone/{UltimateChaos,WhisperedBargain,TheEndIsNigh,AWorldInDarkness}.hs`.

Encounter groups gathered: own `05325–05346`; shared `agents_of_azathoth`; core `AncientEvils`, `DarkCult`.

Special subsystems: `CosmosDeck` of 12 cards (3× Infinity of Darkness, 1× Cosmic Gate, 2× Pathway into Void, 3× Dancer’s Mist, 3× Flight into Oblivion; ReturnTo adds Nightmare Breach / Interstellar Abyss / Winding Gulf); first cosmos card shuffled with Hideous Palace; 6 cards drawn from the lead investigator’s deck become `EmptySpace` locations at fixed grid positions; `PlaceCosmos` / `setUsesGrid` / layout from `cosmosToGrid`; Azathoth placed `Global`; `ThePathWindsBeforeYou` count becomes resource tokens on the scenario reference; 5 numbered resolutions (1–3, 5, 6 — there is no 4) plus investigator-defeat flavor: 1 = Azathoth devours the universe, 2 = lead joins the Pipers, 3/5 = Azathoth slumbers (black book signed), 6 = incantation reversed.

# 10. The 12 shared encounter groups (chapter-scoped gather sets)

Shared groups are chapter-agnostic card pools; each scenario gathers a subset. Counts from `cards-data.js` joined with `mechanism-scan.json` (`scope:"shared"`):

| group id | codes | cards by type | gathered by |
|---|---|---|---|
| agents_of_azathoth | 05088–05089 | 1 enemy, 1 treachery | inTheClutchesOfChaos, beforeTheBlackThrone |
| anettes_coven | 05090–05091 | 2 enemies | theWitchingHour, theWagesOfSin, unionAndDisillusion, inTheClutchesOfChaos |
| city_of_sins | 05098–05099 | 2 treacheries | theWitchingHour, theSecretName, theWagesOfSin, forTheGreaterGood, inTheClutchesOfChaos |
| inexorable_fate | 05107–05108 | 2 treacheries | disappearance, atDeathsDoorstep, theSecretName, theWagesOfSin, unionAndDisillusion, beforeTheBlackThrone |
| music_of_the_damned | 05286a–05287, 05302–05303, 05311–05312 | 2 acts, 2 locations, 2 enemies, 1 treachery | inTheClutchesOfChaos |
| realm_of_death | 05105–05106 | 2 treacheries | disappearance, atDeathsDoorstep, theSecretName, theWagesOfSin, unionAndDisillusion |
| secrets_of_the_universe | 05288a–05289, 05304–05305, 05309–05310 | 2 acts, 2 locations, 2 enemies, 1 treachery | inTheClutchesOfChaos |
| silver_twilight_lodge | 05095–05097 | 2 enemies, 1 treachery | atDeathsDoorstep, forTheGreaterGood, unionAndDisillusion, inTheClutchesOfChaos |
| spectral_predators | 05100–05102 | 2 enemies, 1 treachery | disappearance, atDeathsDoorstep, unionAndDisillusion |
| the_watcher | 05086–05087 | 1 enemy, 1 treachery | disappearance, atDeathsDoorstep, theWagesOfSin, unionAndDisillusion |
| trapped_spirits | 05103–05104 | 1 enemy, 1 treachery | disappearance, atDeathsDoorstep, theWagesOfSin |
| witchcraft | 05092–05094 | 3 treacheries | theWitchingHour, theSecretName, theWagesOfSin, inTheClutchesOfChaos |

12 groups = 37 cards. Chapter-scoped groups = 234 cards. Player cards outside any group = 106 cards. 234 + 37 + 106 = 377 printed records.

# 11. Per-chapter card inventory (own, i.e. chapter-scoped group)

`own` = codes in the chapter’s own `encounterGroups` entry; `faces` = records with `face:true` (b-side / spectral / linked face); `gathered` = distinct codes the scenario actually gathers (own + shared groups + core sets excluded).

| chapter | code | loc | act | ag | enemy | treach | asset | story | inv | scen | own | faces | gathered |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| disappearanceAtTheTwilightEstate | 05043 | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 4 | 1 | 7 | 0 | 18 |
| theWitchingHour | 05050 | 8 | 4 | 2 | 1 | 0 | 0 | 0 | 0 | 1 | 16 | 1 | 23 |
| atDeathsDoorstep | 05065 | 14 | 3 | 2 | 1 | 0 | 0 | 1 | 0 | 1 | 22 | 1 | 36 |
| theSecretName | 05120 | 15 | 3 | 4 | 2 | 5 | 1 | 0 | 0 | 1 | 31 | 0 | 40 |
| theWagesOfSin | 05161 | 22 | 2 | 2 | 8 | 5 | 1 | 6 | 0 | 1 | 47 | 23 | 62 |
| forTheGreaterGood | 05197 | 13 | 4 | 2 | 7 | 4 | 2 | 0 | 0 | 1 | 33 | 1 | 38 |
| unionAndDisillusion | 05238 | 9 | 8 | 2 | 6 | 5 | 4 | 4 | 0 | 1 | 39 | 4 | 53 |
| inTheClutchesOfChaos | 05284 | 12 | 0 | 1 | 0 | 3 | 0 | 0 | 0 | 1 | 17 | 0 | 43 |
| beforeTheBlackThrone | 05325 | 9 | 3 | 3 | 2 | 4 | 0 | 0 | 0 | 1 | 22 | 0 | 26 |

Notes:
- `disappearance` own group includes the 4 story investigators (05046–05049); its “gathered” number excludes the 7 spectral At Death’s Doorstep locations it really uses, and excludes core `ChillingCold`.
- `inTheClutchesOfChaos` own group has **no acts**; its 4 acts sit in `music_of_the_damned` (05286a, 05287) and `secrets_of_the_universe` (05288a, 05289).
- `theWitchingHour` “1 face” is `05055b` Witches’ Circle, which is a **location** and the other side of act 05055.
- `atDeathsDoorstep` “1 face” is `05085b` Josef’s Plan, a **story** card and the other side of enemy 05085.
- `theWagesOfSin` has 23 faces: 11 spectral location backs + 12 heretic/Unfinished-Business faces.

# 12. Records outside the 21 encounter groups (106)

All are player-side cards (no encounter code): `tcu` 05001–05042 (42), `tsn` 05109–05119 (11), `wos` 05151–05160 (10), `fgg` 05186–05196 (11), `uad` 05229–05237 (9), `icc` 05273–05283 (11), `bbt` 05313–05324 (12). They are implemented via `lib/Asset/Cards/TheCircleUndone.hs`, `lib/Event/Cards/TheCircleUndone.hs`, `lib/Skill/CardDefs/TheCircleUndone.hs` and the 13 `lib/Investigator/Cards/*.hs` files listed in the manifest (`chapter: playerCards`).

# 13. ReturnTo / 54xxx (variant content, not in the base port)

- 9 ReturnTo scenarios: `lib/Scenario/Scenarios/ReturnToTheCircleUndone/ReturnTo*.hs` (54016, 54017, 54024, 54029, 54034, 54042, 54046, 54049, 54056).
- ReturnTo card defs/behaviours live under `*/ReturnToTheCircleUndone/**` (54xxx codes, e.g. ReturnTo Heretics 38/39, `WhatMustBeDoneV2`, `BeyondTheMistV5`, `ReturnToACircleUnbroken`, `BrazierEnchantment`, `Witchweed`).
- 7 ReturnTo replacement sets are stored **inside the base TCU CardDefs dirs** but use 54xxx codes: `ChillingMists` (54072–54073), `BloodthirstySpirits` (54075), `CityOfTheDamned` (54070–54071), `Hexcraft` (54062–54064), `ImpendingEvils` (54065), `UnspeakableFate` (54066–54067), `UnstableRealm` (54068–54069). Do not count them as 05 content.
- Every scenario uses `whenReturnTo` / `orWhenReturnTo` to swap sets (`InexorableFate→UnspeakableFate`, `RealmOfDeath→UnstableRealm`, `TrappedSpirits→BloodthirstySpirits`, `ChillingCold→ChillingMists`, `AncientEvils→ImpendingEvils`, `CityOfSins→CityOfTheDamned`, `Witchcraft→Hexcraft`) and to add `addAdditionalReferences ["540xx"]`.
- Campaign id `54` flips `isReturnTo` and changes Interlude 4 (arrested Anette −1, arrested Sanford −1, plus lodge-usurped setup modifiers on 54056).

# 14. Frontend / backend data files

- `frontend/src/locales/zh/theCircleUndone/base.json` (35,544 B) + `scenarios/*.json` ×9 — Chinese scenario text (act/agenda/resolution/labels) consumed by `is`/`i18n` keys.
- `frontend/src/locales/en/theCircleUndone/base.json` (40,102 B) + `scenarios/*.json` ×9 — English (source of truth for text keys).
- `frontend/src/locales/{zh,en}/theCircleUndone.ts` — barrels importing base + 9 scenario JSONs.
- `frontend/src/locales/{zh,en}.ts` — campaign mounted under `theCircleUndone`.
- `frontend/src/arkham/data/theCircleUndone.json` (5,283 B) — 9 scenario ids (`05043…05325`), `returnTo` ids, `campaign:"05"`, and **scenario settings**: U&D records (`MissingPersons` toggle set keyed by 05046–05049, four `ChooseRecord` fate options + trail toggles, lodge toggles) and BBT `ThePathWindsBeforeYou` (`ChooseNum`, max 6).
- `frontend/src/arkham/data/scenarios.ts` — merges the TCU list into the scenario registry.
- `frontend/src/arkham/types/Scenario.ts` — `case "5"` → `theCircleUndone`, per-code locale keys for 05043/05050/05065/05120/05161/05197/05238/05284/05325 and their 540xx ReturnTo twins.
- `frontend/src/arkham/components/CampaignLog.vue` — special-cases `theCircleUndone.key.mementosDiscovered` (comma list, capitalized).
- `backend/arkham-api/data/cards.json` — exists (1,495,623 B, 815 records) but is a legacy partial dump with no usable TCU records; kept as a note only (not hashed as a source).

# 15. Gotchas (things easy to miss)

1. **Initial log state**: campaign creation writes `MissingPersons = {05046,05047,05048,05049}` as recorded card codes; identity, not a count. At Death’s Doorstep and U&D both read it.
2. **Prologue is not a normal scenario**: 1 act + 1 agenda, 7 spectral locations borrowed from At Death’s Doorstep, `noWayOut` flavor, `endOfScenario` forced after the tarot step, and only `noResolution` with an evidence count.
3. **Tarot draw is per player, no repeats**: one upright arcana per player, `tarotDeckL %~ filter (/= arcana)`, `LoadTarotDeck` when empty; mapping above (bucket + evidence) is required for the later clue seeding.
4. **Untaken prologue investigators are crossed out** (`crossOutRecordSetEntries MissingPersons`) at `LoadScenario` DoStep 4 — otherwise At Death’s Doorstep seeds clues for investigators nobody played.
5. **Story investigators are fixed decks, not deckbuilding**: `startsWith`/`startsWithInHand`, `CannotDrawCards`, `CannotManipulateDeck`, `StartingResources (-4)`, `AdditionalStartingUses (-2)` on the .45 Automatic.
6. **Linked faces are real records**: 34 `face:true` codes (e.g. 05055b act→location, 05085b enemy→story, 05217b enemy→enemy, 05262b–05265b story→enemy, 11 spectral location backs in Wages). Scan gate says 377 printed / 343 main / 34 linked.
7. **At Death’s Doorstep clue seeding** is 6 clues on each location tied to a missing investigator, then `PiecesOfEvidenceWereLeftBehind` removes clues one at a time via `chooseOrRunNM` split evenly.
8. **Wages of Sin is not a fixed deck**: 4 of 6 heretics are picked (`pickN 4`) and 4 `Spectral Web` assets are set aside; ReturnTo adds 2 more heretics (38/39). A port that hardcodes all 6 breaks the “only 4 graves” rule.
9. **Wages locations are single-sided by design** (comment in code): no unrevealed side, numbered variants placed `oneOf` (`_169/_170` etc.), plus separate `*Spectral` twins; `SpectralEncounterDeck` is a second encounter deck built by matcher (`SingleSidedCard <> Spectral <> not location`).
10. **Grave-Light has a hidden spectral variant** (`x05184`, `cdArt = "05184"`) — an internal code that is not a printed record; don’t search cards-data for it.
11. **U&D act selection is a 5-way matrix** on records, and V5 is ReturnTo-only; act 3 is `Beyond the Mist v.X` and act 4 is Binding/Broken Rite. Also 4 of the 8 acts are never in play at once.
12. **U&D set-aside is record-driven**: story allies 05258–05261 only if the matching code is still in `MissingPersons`; fate cards 05262–05265 go under the scenario reference and flip to enemies 05262b–05265b when the ally dies/is taken.
13. **Braziers are scenario state, not card text**: `lightBrazier` on Forbidding Shore + the placed Unvisited Isles only when `TheInvestigatorsSidedWithTheCoven`; ReturnTo `BrazierEnchantment` (54046b) interacts with them.
14. **U&D doom on agenda** = count of `HereticsWereUnleashedUntoArkham` from Wages of Sin; that record is written by Wages resolutions (`recordCount`, 1 or n).
15. **TGG layout is two decks in one**: member vs non-member swaps act 1, 3 location pairs (Lodge Gates / Lobby / Lodge Cellar, with the unused six removed) and the enemy pool (Neophytes/Keeper of Secrets/Knights of the Outer Void/Lodge Jailor vs Acolytes/Wizard of the Order/Knights of the Inner Circle/Cell Keeper); the `removeOneOfEach` list must match the chosen branch exactly.
16. **TGG keys are chaos tokens**: 4 tokens are created, set aside as keys, and later placed/returned; they are not cards.
17. **ICoC acts belong to other encounter sets**: chapter group has 0 acts; `Dark Knowledge v1/v2` and `Beyond the Grave`/`New World Order` are in `music_of_the_damned`/`secrets_of_the_universe` groups. Any per-chapter count that ignores shared groups will show 0 acts.
18. **ICoC gathers are conditional**: two record flags add ~15 cards each (Anette → Music/Coven/CityOfSins/Witchcraft; Sanford → Secrets/Lodge/StrikingFear + exactly 2 Midnight Masks treacheries). Standalone setup asks the player to pick one.
19. **ICoC location pairs**: each district has two versions and only one is placed; Hangman’s Hill / Lodge are double-faced “Where It All Ends” vs “Shrouded in Mystery”, chosen by the same record.
20. **BBT cosmos deck has duplicates and a swap**: 3× Infinity of Darkness, 3× Dancer’s Mist, 3× Flight into Oblivion, 2× Pathway into Void (12 total); the top card is shuffled with Hideous Palace before the first two cosmos cards are placed; the remaining 10 become the `CosmosDeck` extra deck.
21. **BBT empty spaces** are 6 cards taken from the **lead investigator’s deck** at fixed grid positions `(0,1)(0,-1)(1,1)(1,0)(1,-1)(2,0)` — they are not locations from the encounter deck.
22. **BBT ThePathWindsBeforeYou**: interlude 4 sums 10 weighted conditions (accepted fate 1, Anette 2, Sanford 2, mementos ≥3/≥6/≥9 each 1, Black Book 1, doom 2, ReturnTo: arrested Anette −1, arrested Sanford −1), floored at 0, recorded as a **count**, then turned into resource tokens on the scenario reference. It is also used for the Nightgaunt Steed choice (≥2, ReturnTo only).
23. **Mementos are a record set**, not counters: `recordSetInsert MementosDiscovered [memento]`; Interlude 3 crosses out mementos when you tell the truth to the Inner Circle, and the Twist of Fate thresholds read the remaining count.
24. **Chaos bag is fixed at 13 tokens** with two Skulls; Skull values are scenario-defined (`toChaosTokenValue`), and token effects (Tablet/Cultist/ElderThing) are per-scenario code, not global. Fate choice adds 2 Tablet or 1 ElderThing; Interlude 2 adds Cultist; Interlude 4 adds a difficulty-scaled negative token if you asked Anette/Sanford for help.
25. **Interludes are option-driven state machines**: Interlude 2 has 9 parts (4/5/6 gate on `ThePriceOfProgress4/5/6`), Interlude 3 has 7, Interlude 4 computes the score and offers the black book / puzzle box options via `HandleOption`.
26. **ReturnTo is `id == "54"`**, not a separate step list: the same scenario modules branch internally; the 9 ReturnTo steps are only listed in `CampaignSteps.hs`.
27. **`Scenarios/TheCircleUndone/*/Helpers.hs` are not optional** — e.g. Wages (5.4 KB) and BBT (7.4 KB) hold core rules helpers that the scenario module imports.
28. **Core-set dependencies outside the 377 TCU records**: `ChillingCold`, `AncientEvils`, `DarkCult`, `LockedDoors`, `Rats`, `StrikingFear`, `Nightgaunts`, `MidnightMasks`, `AgentsOfShubNiggurath` (plus Arkham Woods locations from `NightOfTheZealot/TheDevourerBelow.hs` for The Witching Hour). These are not in the manifest and must exist in the target repo (scan `reuseChecks` says they do).
29. **Player-card reprints/variants**: 05186–05196 are class/level variants of earlier player cards (`.45 Thompson` guardian 05186 / rogue 05187, Scroll of Secrets, Tennessee Sour Mash, Enchanted Blade, Grisly Totem, plus the unique neutral `The Council's Coffer` 05196) — they are 05-code records but not new mechanisms.
30. **`The Black Book` (05150) and `Puzzle Box` (05228)** are campaign assets obtained through `HandleOption`/`addCampaignCardToDeck`, not normal deckbuilding.

# 16. Biggest missing / uncertain pieces for porting

- **Prologue story-investigator setup** is the largest single gap: 4 fixed decks (`startsWith` lists), 22-arcana tarot mapping (table in §1), tarot deck depletion, and the `MissingPersons` write/cross-out semantics. The target repo has only card faces for 05046–05049; the fixed deck contents are in the reference investigator modules and in `frontend/src/locales/*/theCircleUndone/scenarios/disappearanceAtTheTwilightEstate.json`.
- **Tarot system**: 22 arcana, upright/reversed, 4 reading types (`Chaos|Balance|Choice|Destiny`), plus the ReturnTo “destiny” assignment for 8 scenarios. No tarot data exists in cards-data (scan: `tarotDeck: 0`, `tarotSlot: 8`); it must be authored as campaign-level data (`tarot.js`).
- **Heretic faces / Unfinished Business**: 6 heretics × 2 faces + 6 story backs, randomly 4-of-6, plus 4 Spectral Webs. The b-face story cards exist in the reference (`Story/Cards/TheCircleUndone/TheWagesOfSin/UnfinishedBusiness_*`) but their abilities are nontrivial; the scan records 18 `hereticMultiface` cards, the target only has faces.
- **Brazier flags (U&D)**: brazier state lives on locations plus the ReturnTo `BrazierEnchantment`; the exact brazier counts/effects are in `Scenarios/TheCircleUndone/UnionAndDisillusion/Helpers.hs` and the location behaviours, not in card text alone.
- **Cosmos deck (BBT)**: grid geometry, empty-space cards from the lead’s deck, and cosmos placement rules live in `Cosmos.hs` + `Helpers.hs` (16.6 KB combined); the scan flags 11 `cosmos` cards but the engine primitives (grid layout, extra deck, placed-under cards) are the hard part.
- **Breach / incursion (ICoC)**: token placement on locations, location-pair selection, and the conditional encounter-set construction (by record) are only in the scenario module + `Helpers.hs` (2.2 KB).
- **Watchers**: The Spectral Watcher is gathered in 4 scenarios and set aside in 2 (ADtD, Wages, U&D); “You Are Being Hunted” record handling is campaign-level and easy to drop.
- **Memento labels**: 10 mementos exist only as Haskell constructors + record set entries; Chinese names must be authored (scan `gaps` calls this out: 10 Mementos have English enum names only).
- **Interlude text/flow**: 3 interludes with 9/7/part structure and options (`ThePriceOfProgress4/5/6`, `ProceedToInterlude3`, `TakeBlackBook`, `TakePuzzleBox`) are campaign-flow only; the locale JSONs carry the text keys but the branching is in `Campaign/Campaigns/TheCircleUndone.hs`.
- **Uncertain**: which of the 34 linked faces get their own target card entry vs. `linkedFaces` metadata (scan `gaps` leaves this to P1 `scope.json`); and whether `05042`/`05283` tarot-slot overrides are needed (scan watchlist).
