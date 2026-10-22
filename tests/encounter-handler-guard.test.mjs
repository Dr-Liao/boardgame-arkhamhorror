// P1 守卫：进入卡尔克萨/失落时代遭遇牌库的 campaignRule 诡计必须有实现落点。
//
// 背景（卡牌保真度审计 §3.3）：诡计统一写成 `effect: { kind: 'campaignRule' }`，由各章
// `resolveEncounter` 按卡号分发；未命中时静默 `return false`，整张卡变成"无事发生"。
// 这条守卫要求每个 campaignRule 诡计至少满足其一：
//   · 条目声明了 `encounterResolve`（`implemented: true` 是证据账本标记）；
//   · 章节 behavior 在 `implementedEncounterCodes` 里显式登记（表示该章自己结算）。
import test from 'node:test'
import assert from 'node:assert/strict'

import { encounterResolveFor, implementedFor } from '../src/cards/card-rules.js'
import { ALL_CARDS } from '../src/cards/cards-data.js'

// 卡尔克萨之路
import * as curtainCall from '../content/campaigns/thePathToCarcosa/scenarios/curtainCall/index.js'
import * as theLastKing from '../content/campaigns/thePathToCarcosa/scenarios/theLastKing/index.js'
import * as echoesOfThePast from '../content/campaigns/thePathToCarcosa/scenarios/echoesOfThePast/index.js'
import * as theUnspeakableOath from '../content/campaigns/thePathToCarcosa/scenarios/theUnspeakableOath/index.js'
import * as aPhantomOfTruth from '../content/campaigns/thePathToCarcosa/scenarios/aPhantomOfTruth/index.js'
import * as thePallidMask from '../content/campaigns/thePathToCarcosa/scenarios/thePallidMask/index.js'
import * as blackStarsRise from '../content/campaigns/thePathToCarcosa/scenarios/blackStarsRise/index.js'
import * as dimCarcosa from '../content/campaigns/thePathToCarcosa/scenarios/dimCarcosa/index.js'

// 失落的时代
import * as theUntamedWilds from '../content/campaigns/theForgottenAge/scenarios/theUntamedWilds/index.js'
import * as theDoomOfEztli from '../content/campaigns/theForgottenAge/scenarios/theDoomOfEztli/index.js'
import * as threadsOfFate from '../content/campaigns/theForgottenAge/scenarios/threadsOfFate/index.js'
import * as theBoundaryBeyond from '../content/campaigns/theForgottenAge/scenarios/theBoundaryBeyond/index.js'
import * as heartOfTheEldersPart1 from '../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/index.js'
import * as heartOfTheEldersPart2 from '../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/index.js'
import * as theCityOfArchives from '../content/campaigns/theForgottenAge/scenarios/theCityOfArchives/index.js'
import * as theDepthsOfYoth from '../content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/index.js'
import * as shatteredAeons from '../content/campaigns/theForgottenAge/scenarios/shatteredAeons/index.js'
import * as turnBackTime from '../content/campaigns/theForgottenAge/scenarios/turnBackTime/index.js'

import { implementedEncounterCodes as untamedImplemented } from '../content/campaigns/theForgottenAge/scenarios/theUntamedWilds/behavior.js'
import { implementedEncounterCodes as doomImplemented } from '../content/campaigns/theForgottenAge/scenarios/theDoomOfEztli/behavior.js'
import { implementedEncounterCodes as threadsImplemented } from '../content/campaigns/theForgottenAge/scenarios/threadsOfFate/behavior.js'
import { implementedEncounterCodes as boundaryImplemented } from '../content/campaigns/theForgottenAge/scenarios/theBoundaryBeyond/behavior.js'
import { implementedEncounterCodes as heart1Implemented } from '../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart1/behavior.js'
import { implementedEncounterCodes as heart2Implemented } from '../content/campaigns/theForgottenAge/scenarios/heartOfTheEldersPart2/behavior.js'
import { implementedEncounterCodes as cityImplemented } from '../content/campaigns/theForgottenAge/scenarios/theCityOfArchives/behavior.js'
import { implementedEncounterCodes as shatteredImplemented } from '../content/campaigns/theForgottenAge/scenarios/shatteredAeons/behavior.js'
import { implementedEncounterCodes as turnBackImplemented } from '../content/campaigns/theForgottenAge/scenarios/turnBackTime/behavior.js'
import { behavior as depthsBehavior } from '../content/campaigns/theForgottenAge/scenarios/theDepthsOfYoth/behavior.js'

const TFA_IMPLEMENTED = new Set([
  ...untamedImplemented, ...doomImplemented, ...threadsImplemented, ...boundaryImplemented,
  ...heart1Implemented, ...heart2Implemented, ...cityImplemented,
  ...(depthsBehavior.implementedEncounterCodes || []),
  ...shatteredImplemented, ...turnBackImplemented,
])

const CARCOSA_SCENARIOS = [curtainCall, theLastKing, echoesOfThePast, theUnspeakableOath,
  aPhantomOfTruth, thePallidMask, blackStarsRise, dimCarcosa]
const TFA_SCENARIOS = [theUntamedWilds, theDoomOfEztli, threadsOfFate, theBoundaryBeyond,
  heartOfTheEldersPart1, heartOfTheEldersPart2, theCityOfArchives, theDepthsOfYoth,
  shatteredAeons, turnBackTime]

function campaignRuleTreacheries(module) {
  return Object.entries(module.scenario.treacheries || {})
    .filter(([code, def]) => def.effect?.kind === 'campaignRule'
      && !def.hidden && ALL_CARDS[code]?.type === 'treachery')
    .map(([code, def]) => ({ code, def }))
}

test('卡尔克萨之路：每个 campaignRule 诡计都有条目结算', () => {
  const missing = []
  for (const module of CARCOSA_SCENARIOS) {
    for (const { code, def } of campaignRuleTreacheries(module)) {
      if (encounterResolveFor(code) || implementedFor(code)) continue
      missing.push(`${module.scenario.id}: ${code} ${def.name || ''}`.trim())
    }
  }
  assert.deepEqual(missing, [], `campaignRule 未命中会静默无事发生：\n  ${missing.join('\n  ')}`)
})

test('失落的时代：每个 campaignRule 诡计都有条目结算或章节显式登记', () => {
  const missing = []
  for (const module of TFA_SCENARIOS) {
    for (const { code, def } of campaignRuleTreacheries(module)) {
      if (encounterResolveFor(code) || implementedFor(code) || TFA_IMPLEMENTED.has(code)) continue
      missing.push(`${module.scenario.id}: ${code} ${def.name || ''}`.trim())
    }
  }
  assert.deepEqual(missing, [], `campaignRule 未命中会静默无事发生：\n  ${missing.join('\n  ')}`)
})

test('章节 implementedEncounterCodes 只登记本战役真实存在的卡号', () => {
  const bad = [...TFA_IMPLEMENTED].filter(code => !ALL_CARDS[code])
  assert.deepEqual(bad, [], `章节实现清册含未知卡号：${bad.join(',')}`)
})
