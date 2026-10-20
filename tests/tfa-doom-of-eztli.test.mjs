import test from 'node:test'
import assert from 'node:assert/strict'
import * as eztli from '../content/campaigns/theForgottenAge/scenarios/theDoomOfEztli/index.js'
import {
  scenario as definition, EXPLORATION_LOCATIONS, EXPLORATION_TREACHERIES,
} from '../content/campaigns/theForgottenAge/scenarios/theDoomOfEztli/definition.js'

const clone = value => structuredClone(value)

function setupApi(seed = 1) {
  let value = seed >>> 0
  const randomValue = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0
    return value / 0x100000000
  }
  return {
    randomValue,
    shuffle(items, rng = randomValue) {
      const copy = [...items]
      for (let index = copy.length - 1; index > 0; index--) {
        const target = Math.floor(rng() * (index + 1))
        ;[copy[index], copy[target]] = [copy[target], copy[index]]
      }
      return copy
    },
  }
}

function stateFor(count = 2) {
  return {
    scenario: clone(definition),
    acts: clone(definition.acts),
    agendas: clone(definition.agendas),
    actIndex: 0,
    agendaIndex: 0,
    investigators: Array.from({ length: count }, (_, seat) => ({
      seat, code: '01001', name: `调查员${seat + 1}`, location: 'entryway',
      damage: 0, horror: 0, clues: 0, resources: 5, hand: [], assets: [], threat: [], engaged: [],
      deck: [], discard: [], actionsLeft: 3,
    })),
    locations: [],
    enemies: [],
    storyAssets: [],
    scenarioFlags: {},
    scenarioZones: {},
    victoryDisplay: [],
    encounterDeck: [],
    encounterDiscard: [],
    campaign: {
      leadSeat: 0,
      records: {},
      investigators: Array.from({ length: count }, (_, seat) => ({
        id: `inv${seat}`, deck: [], purchases: [], status: 'active',
        trauma: { physical: 0, mental: 0 },
      })),
      chaosBag: [],
    },
    chaosBag: [],
    difficulty: 'standard',
    numInvestigators: count,
    round: 1,
    phase: 'investigation',
    status: 'playing',
  }
}

function placed(state, ids) {
  for (const id of ids) {
    const base = state.scenario.locations[id]
    state.locations.push({
      ...clone(base), id, revealed: true, doom: 0,
      clues: (base.cluesPerInvestigator || 0) * state.numInvestigators,
    })
  }
  return state
}

const loc = (state, id) => state.locations.find(location => location.id === id)

function setup(state, seed = 1) {
  eztli.behavior.setupLocations(state, [], setupApi(seed))
  return state
}

test('埃兹特里的覆灭 M5：章节已是 playable，并保留原卡身份', () => {
  assert.equal(eztli.manifest.status, 'playable')
  assert.equal(eztli.manifest.catalogReferenceOnly, undefined)
  assert.equal(eztli.manifest.referenceCode, undefined)
  assert.equal(eztli.manifest.campaignId, 'theForgottenAge')
  assert.equal(eztli.manifest.contentVersion, '1.0.0')
  assert.equal(eztli.scenario.originalCode, '04054')
  assert.equal(eztli.behavior.id, 'theDoomOfEztli')
  assert.equal(eztli.manifest.locations.length, 7)
  assert.deepEqual(eztli.manifest.acts.map(act => act.id), ['act1', 'act2', 'act3'])
  assert.deepEqual(eztli.manifest.agendas.map(agenda => agenda.id), ['agenda1', 'agenda2'])
  assert.deepEqual(eztli.manifest.resolutionIds, ['noResolution', 'r1', 'r2', 'r3', 'r4', 'r5'])
  assert.deepEqual(eztli.manifest.requiredEncounterGroupIds, [
    'theDoomOfEztli', 'agentsOfYig', 'venom', 'flux', 'traps', 'ruins', 'poison', 'chillingCold',
  ])
  assert.deepEqual(eztli.manifest.requiredMechanicIds,
    ['tfaExploration', 'tfaSupplies', 'tfaVengeance', 'tfaPoisoned', 'tfaRelicOfAges'])
})

test('已实现的遭遇卡号都在本章牌堆内，且不含放在一边的古代遗物/时间石室', () => {
  const deck = new Set([
    ...eztli.manifest.zones.encounterDeck.map(entry => entry.cardCode),
    ...eztli.manifest.zones.setAside.map(entry => entry.cardCode),
  ])
  for (const code of eztli.behavior.implementedEncounterCodes) {
    assert.ok(deck.has(code), `${code} 应该在本章遭遇牌堆、放在一边或敌人里`)
  }
  assert.equal(eztli.behavior.implementedEncounterCodes.includes('04061'), false, '古代遗物是剧情资产')
  // 核心盒遭遇卡（01167 地窖寒风 / 01168 朦胧之雾）现在由共享解析器逐条实现。
  assert.equal(eztli.behavior.implementedEncounterCodes.includes('01167'), true)
  assert.equal(eztli.behavior.implementedEncounterCodes.includes('01168'), true)
  assert.equal(eztli.behavior.implementedEncounterCodes.includes('04085'), false)
  assert.equal(eztli.behavior.implementedEncounterCodes.includes('04098'), false)
  assert.equal(eztli.behavior.implementedEncounterCodes.includes('04099'), false)
})

test('符号地图按印刷符号连线，时间石室只连秘密通道', () => {
  const locations = Object.fromEntries(eztli.manifest.locations.map(location => [location.id, location]))
  assert.deepEqual([...locations.entryway.connections].sort(), ['ancientHall', 'grandChamber'])
  assert.deepEqual([...locations.chamberOfTime.connections].sort(), ['secretPassage'])
  assert.ok(locations.undergroundRuins.connections.includes('burialPit'))
  assert.ok(locations.burialPit.connections.includes('secretPassage'))
  assert.equal(locations.entryway.connections.includes('burialPit'), false,
    '入口（圆形）与坑葬墓室（三角形）没有互相印刷符号')
})

test('布置确定性：同种子给出同一探索牌库，10 张且不重复', () => {
  const build = seed => setup(stateFor(), seed).explorationDeck
  const first = build(17)
  assert.deepEqual(first, build(17))
  assert.notDeepEqual(first, build(18))
  assert.equal(first.length, 10)
  assert.deepEqual([...first].sort(),
    [...EXPLORATION_LOCATIONS, ...Object.values(EXPLORATION_TREACHERIES)].sort())
})

test('布置把时间石室、古代遗物、预示者与 4 张中毒放在一边，并从遗迹入口开始', () => {
  const state = setup(stateFor())
  assert.deepEqual(eztli.behavior.setupLocations(stateFor(), [], setupApi(3)), ['entryway'])
  const aside = state.scenarioZones.setAside
  assert.equal(aside.filter(code => code === '04102').length, 4)
  assert.ok(aside.includes('04061'), '古代遗物')
  assert.ok(aside.includes('04062'), '瓦卢西亚的预示者')
  assert.ok(aside.includes('04068'), '时间石室')
  assert.deepEqual(state.relicOfAges, { code: '04061', location: null, seat: null })
  assert.equal(eztli.behavior.totalVengeance(state), 0)
})

test('两张密谋都得到 +1×人数 的毁灭阀值', () => {
  for (const count of [1, 2, 3, 4]) {
    const state = setup(stateFor(count))
    eztli.behavior.afterChaosBagSetup(state)
    assert.deepEqual(state.agendas.map(agenda => agenda.doomThreshold), [6 + count, 12 + count])
  }
})

test('暗起波澜背面：把放在一边的预示者生成在毁灭标记最多的地点', () => {
  const state = setup(placed(stateFor(2), ['entryway', 'ancientHall', 'grandChamber']))
  loc(state, 'ancientHall').doom = 1
  loc(state, 'grandChamber').doom = 3
  const spawned = []
  const api = {
    info: () => {},
    spawn(code, locationId) {
      spawned.push({ code, locationId })
      const enemy = {
        id: 'e1', code, originalCode: code, name: '瓦卢西亚的预示者', location: locationId,
        damageTaken: 0, engagedSeat: null, resources: 0,
      }
      state.enemies.push(enemy)
      return enemy
    },
  }
  eztli.behavior.agendaReveal(state, state.agendas[0], api)
  assert.deepEqual(spawned, [{ code: '04062', locationId: 'grandChamber' }])
  assert.equal(state.scenarioZones.setAside.includes('04062'), false)
  assert.equal(state.scenarioFlags.harbingerSpawned, true)
  assert.equal(state.enemies[0].tfaRetaliateWhileExhausted, true)
})

test('神庙看守者背面：每位没有撤退的调查员被击败', () => {
  const state = setup(placed(stateFor(2), ['entryway']))
  state.investigators[1].resigned = true
  const defeated = []
  eztli.behavior.agendaReveal(state, state.agendas[1], {
    info: () => {},
    defeat: (inv, cause) => { inv.defeated = true; defeated.push({ seat: inv.seat, cause }) },
  })
  assert.deepEqual(defeated, [{ seat: 0, cause: 'both' }],
    'cause=both 让被击败者在结局结算时选择 1 点创伤，而不是 0 创伤白过')
})

test('进入遗迹背面：时间石室洗入探索牌库；没有粉笔则进胜利区并获复仇 1', () => {
  const build = hasChalk => {
    const state = setup(placed(stateFor(1), ['entryway']))
    state.explorationDeck = ['ancientHall']
    const api = {
      random: () => 0.25,
      info: () => {},
      hasSupply: (seat, name) => hasChalk && name === 'chalk',
    }
    eztli.behavior.actReveal(state, state.acts[0], api)
    return state
  }
  const noChalk = build(false)
  assert.deepEqual([...noChalk.explorationDeck].sort(), ['ancientHall', 'chamberOfTime'])
  assert.equal(noChalk.scenarioZones.setAside.includes('04068'), false, '时间石室离开放在一边')
  assert.deepEqual(noChalk.victoryDisplay.map(card => card.code), ['04057'])
  assert.equal(eztli.behavior.totalVengeance(noChalk), 1)

  const withChalk = build(true)
  assert.deepEqual(withChalk.victoryDisplay, [])
  assert.equal(eztli.behavior.totalVengeance(withChalk), 0, '有粉笔时本场景移出游戏，不进胜利区')
})

test('科学与魔法背面：时间石室的调查员控制古代遗物，地点排成一条线', () => {
  const state = setup(placed(stateFor(2),
    ['entryway', 'ancientHall', 'grandChamber', 'burialPit', 'undergroundRuins', 'secretPassage', 'chamberOfTime']))
  state.scenarioFlags.chamberPrepared = true
  state.investigators[0].location = 'chamberOfTime'
  state.investigators[1].location = 'entryway'
  loc(state, 'ancientHall').doom = 2
  loc(state, 'burialPit').doom = 0
  const granted = []
  const api = {
    random: () => 0.5,
    info: () => {},
    choose: () => '0',
    storyAsset: (code, locationId) => state.storyAssets.push({ id: 'relic', code, originalCode: code, location: locationId }),
    moveRelicOfAges: payload => {
      state.relicOfAges = {
        code: '04061',
        location: payload.seat != null ? state.investigators[payload.seat].location : payload.location,
        seat: payload.seat ?? null,
      }
    },
    giveAsset: (seat, code) => {
      granted.push({ seat, code })
      state.investigators[seat].assets.push({ id: `asset${seat}`, code, originalCode: code })
    },
  }
  eztli.behavior.actReveal(state, state.acts[1], api)
  assert.equal(state.relicOfAges.seat, 0)
  assert.equal(state.relicOfAges.location, 'chamberOfTime')
  assert.deepEqual(granted, [{ seat: 0, code: '04061' }])
  const line = state.scenarioFlags.locationLine
  assert.equal(line[0], 'chamberOfTime')
  assert.equal(line[line.length - 1], 'entryway')
  assert.equal(state.scenarioFlags.locationsInLine, true)
  assert.ok(loc(state, 'ancientHall').linePosition > loc(state, 'burialPit').linePosition,
    '毁灭标记多的地点排在更右侧')
  assert.deepEqual(loc(state, 'chamberOfTime').connections, [line[1]])
  assert.deepEqual(loc(state, 'entryway').connections, [line[line.length - 2]])
})

test('逃出遗迹：持有遗物者撤退 → 结局 1，否则 → 结局 3', () => {
  const build = resigned => {
    const state = setup(placed(stateFor(2), ['entryway', 'chamberOfTime']))
    state.relicOfAges = { code: '04061', location: 'chamberOfTime', seat: 1 }
    state.investigators[1].resigned = resigned
    const finished = []
    eztli.behavior.actReveal(state, state.acts[2], { info: () => {}, finish: key => finished.push(key) })
    return finished
  }
  assert.deepEqual(build(true), ['r1'])
  assert.deepEqual(build(false), ['r3'])
})

test('逃出遗迹正面：胜利区 ≥3 复仇时蛇族敌人 +1 躲避', () => {
  const state = setup(placed(stateFor(1), ['entryway']))
  state.actIndex = 2
  const serpent = { code: '04098', originalCode: '04098', traits: ['Serpent'] }
  const humanoid = { code: '04085', originalCode: '04085', traits: ['Curse'] }
  assert.equal(eztli.behavior.enemyStatModifier(state, serpent, 'evade'), 0)
  state.victoryDisplay = [{ id: 'v1', code: '04057', vengeance: 3 }]
  assert.equal(eztli.behavior.enemyStatModifier(state, serpent, 'evade'), 1)
  assert.equal(eztli.behavior.enemyStatModifier(state, humanoid, 'evade'), 0)
  state.actIndex = 1
  assert.equal(eztli.behavior.enemyStatModifier(state, serpent, 'evade'), 0, '只有逃出遗迹正面生效')

  // 04066 地下遗迹：有敌人时视同胜利区（P2 跨章共享口径）。
  const ruins = setup(placed(stateFor(1), ['entryway', 'undergroundRuins']))
  ruins.actIndex = 2
  ruins.victoryDisplay = [{ id: 'v1', code: '04057', vengeance: 2 }]
  assert.equal(eztli.behavior.enemyStatModifier(ruins, serpent, 'evade'), 0, '2 点复仇还不够')
  const enemy = { id: 'e1', code: '04098', originalCode: '04098', location: 'undergroundRuins', traits: ['Serpent'] }
  ruins.enemies.push(enemy)
  assert.equal(eztli.behavior.enemyStatModifier(ruins, serpent, 'evade'), 1,
    '地下遗迹有敌人时 +1 点复仇达到 3')
  ruins.enemies = []
  assert.equal(eztli.behavior.enemyStatModifier(ruins, serpent, 'evade'), 0, '没有敌人就不再计入')
})

test('古代石厅：轮末把 1 个线索翻成毁灭，可用 3 资源取消', () => {
  const build = answer => {
    const state = setup(placed(stateFor(1), ['entryway', 'ancientHall']))
    state.investigators[0].location = 'ancientHall'
    state.investigators[0].resources = 3
    loc(state, 'ancientHall').clues = 2
    eztli.behavior.roundEnded(state, { choose: () => answer, info: () => {} })
    return state
  }
  const flipped = build('skip')
  assert.equal(loc(flipped, 'ancientHall').clues, 1)
  assert.equal(loc(flipped, 'ancientHall').doom, 1)
  assert.equal(flipped.investigators[0].resources, 3)

  const paid = build('0')
  assert.equal(loc(paid, 'ancientHall').clues, 2)
  assert.equal(loc(paid, 'ancientHall').doom, 0)
  assert.equal(paid.investigators[0].resources, 0)
})

test('华美石室：调查未超过难度 2 点即把 1 个线索翻成毁灭', () => {
  const build = result => {
    const state = setup(placed(stateFor(1), ['entryway', 'grandChamber']))
    state.investigators[0].location = 'grandChamber'
    loc(state, 'grandChamber').clues = 2
    eztli.behavior.afterTest(state, state.investigators[0], {
      ...result, source: { label: '调查', code: '04064' }, drawn: [],
    }, { info: () => {} })
    return state
  }
  const failed = build({ success: false, value: 1, difficulty: 2 })
  assert.equal(loc(failed, 'grandChamber').clues, 1)
  assert.equal(loc(failed, 'grandChamber').doom, 1)

  const marginal = build({ success: true, value: 3, difficulty: 2 })
  assert.equal(loc(marginal, 'grandChamber').clues, 1, '刚好超过 1 点仍要翻面')

  const good = build({ success: true, value: 4, difficulty: 2 })
  assert.equal(loc(good, 'grandChamber').clues, 2)
  assert.equal(loc(good, 'grandChamber').doom, 0)
})

test('坑葬墓室：探索成功后两次「抽遭遇牌或放毁灭」', () => {
  const build = answer => {
    const state = setup(placed(stateFor(1), ['entryway', 'burialPit']))
    state.investigators[0].location = 'burialPit'
    const drawn = []
    const api = {
      choose: () => answer, info: () => {},
      drawEncounter: seat => drawn.push(seat),
    }
    eztli.behavior.afterExplore(state, state.investigators[0], { code: '04065', kind: 'location', runtime: api })
    return { state, drawn }
  }
  const doom = build('doom')
  assert.equal(loc(doom.state, 'burialPit').doom, 2)
  assert.deepEqual(doom.drawn, [])
  assert.equal(doom.state.investigators[0].tfaExploredThisTurn, true)

  const draws = build('draw')
  assert.deepEqual(draws.drawn, [0, 0])
  assert.equal(loc(draws.state, 'burialPit').doom, 0)
})

test('秘密通道：进入时受到 1 伤害 + 1 恐惧，或放 1 毁灭；有绳索则忽略', () => {
  const run = (answer, rope) => {
    const state = setup(placed(stateFor(1), ['entryway', 'secretPassage']))
    state.investigators[0].location = 'secretPassage'
    const api = {
      checkSupplies: () => rope, choose: () => answer, info: () => {},
      damage: (seat, amount) => { state.investigators[seat].damage += amount },
      horror: (seat, amount) => { state.investigators[seat].horror += amount },
    }
    eztli.behavior.locationEntered(state, state.investigators[0], loc(state, 'secretPassage'), api)
    return state
  }
  const harm = run('harm', false)
  assert.equal(harm.investigators[0].damage, 1)
  assert.equal(harm.investigators[0].horror, 1)
  assert.equal(loc(harm, 'secretPassage').doom, 0)

  const doom = run('doom', false)
  assert.equal(loc(doom, 'secretPassage').doom, 1)
  assert.equal(doom.investigators[0].damage, 0)

  const roped = run('harm', true)
  assert.equal(roped.investigators[0].damage, 0)
  assert.equal(loc(roped, 'secretPassage').doom, 0)
})

test('时间石室入场：附属放在一边的古代遗物并在其上放 1 毁灭（只结算一次）', () => {
  const state = setup(placed(stateFor(1), ['entryway', 'chamberOfTime']))
  const api = {
    info: () => {},
    storyAsset: (code, locationId) => state.storyAssets.push({ id: 'relic', code, originalCode: code, location: locationId }),
    moveRelicOfAges: payload => {
      state.relicOfAges = {
        code: '04061',
        location: payload.seat != null ? state.investigators[payload.seat].location : payload.location,
        seat: payload.seat ?? null,
      }
    },
  }
  eztli.behavior.locationRevealed(state, loc(state, 'chamberOfTime'), api)
  assert.deepEqual(state.relicOfAges, { code: '04061', location: 'chamberOfTime', seat: null })
  assert.equal(loc(state, 'chamberOfTime').doom, 1)
  assert.equal(state.scenarioZones.setAside.includes('04061'), false)
  assert.equal(state.scenarioZones.setAside.includes('04068'), false)
  assert.equal(state.storyAssets.length, 1)

  eztli.behavior.locationRevealed(state, loc(state, 'chamberOfTime'), api)
  assert.equal(loc(state, 'chamberOfTime').doom, 1, '同一张地点只结算一次')
  assert.equal(state.storyAssets.length, 1)
})

test('地下遗迹：有敌人时计入复仇，敌人离场后放 1 毁灭', () => {
  const state = setup(placed(stateFor(1), ['entryway', 'undergroundRuins']))
  loc(state, 'undergroundRuins').clues = 1
  const enemy = {
    id: 'e1', code: '04098', originalCode: '04098', name: '伊格的獠牙',
    location: 'undergroundRuins', damageTaken: 1, engagedSeat: null,
  }
  state.enemies.push(enemy)
  assert.equal(eztli.behavior.totalVengeance(state), 1, '有敌人时即使还有线索也算复仇')
  state.enemies.splice(0, 1)
  assert.equal(eztli.behavior.totalVengeance(state), 0, '没敌人且有线索时不计入')

  eztli.behavior.enemyDefeated(state, enemy, { info: () => {} })
  assert.equal(loc(state, 'undergroundRuins').doom, 1)
})

test('时间石室在结算复仇时按「已揭示且无线索」计入 2 点', () => {
  const state = setup(placed(stateFor(1), ['entryway', 'chamberOfTime']))
  assert.equal(eztli.behavior.totalVengeance(state), 0, '还有线索时不计入「已揭示且无线索」')
  loc(state, 'chamberOfTime').clues = 0
  assert.equal(eztli.behavior.totalVengeance(state), 2)
})

test('瓦卢西亚的预示者：每次成功攻击/躲避放 1 资源，满 2×人数后遁去身影', () => {
  const state = setup(placed(stateFor(2), ['entryway']))
  const enemy = {
    id: 'h1', code: '04062', originalCode: '04062', name: '瓦卢西亚的预示者',
    location: 'entryway', damageTaken: 3, engagedSeat: 0, exhausted: false, resources: 0,
  }
  state.enemies.push(enemy)
  state.investigators[0].engaged = ['h1']
  const inv = state.investigators[0]
  const api = { info: () => {} }
  eztli.behavior.enemyAttackedSuccessfully(state, inv, enemy, api)
  assert.equal(enemy.resources, 1)
  eztli.behavior.afterEvade(state, inv, enemy, { success: true }, api)
  assert.equal(enemy.resources, 2)
  eztli.behavior.enemyAttackedSuccessfully(state, inv, enemy, api)
  assert.equal(enemy.resources, 3)
  assert.equal(state.enemies.includes(enemy), true, '还没到 2×人数')
  eztli.behavior.afterEvade(state, inv, enemy, { success: true }, api)
  assert.equal(state.enemies.includes(enemy), false, '达到阈值后遁去身影')
  assert.equal(state.scenarioFlags.harbingerSetAside, true)
  assert.equal(state.scenarioFlags.harbingerDamage, 3, '保留伤害标记')
  assert.equal(state.scenarioZones.setAside.includes('04062'), true)
  assert.deepEqual(state.investigators[0].engaged, [])
})

test('逃出遗迹目标：所有未被击败的调查员都撤退后推进场景', () => {
  const state = setup(placed(stateFor(2), ['entryway']))
  state.actIndex = 2
  const advanced = []
  const api = { advanceAct: () => advanced.push(state.actIndex) }
  state.investigators[0].resigned = true
  eztli.behavior.checkObjectives(state, api)
  assert.deepEqual(advanced, [], '还有人没撤退')
  state.investigators[1].resigned = true
  eztli.behavior.checkObjectives(state, api)
  assert.deepEqual(advanced, [2])
})

test('最后一位调查员撤退：只有逃出遗迹正面会借此推进场景', () => {
  const state = setup(placed(stateFor(1), ['entryway']))
  const advanced = []
  const api = { advanceAct: () => advanced.push(state.actIndex) }
  eztli.behavior.allResigned(state, api)
  assert.deepEqual(advanced, [], '进入遗迹没有「全体撤退」目标')
  state.actIndex = 2
  eztli.behavior.allResigned(state, api)
  assert.deepEqual(advanced, [2], '引擎在最后一人撤退时会直接判无结局，这里改为推进场景')
})

test('结局 1：带着遗物撤退的调查员也会把古代遗物加入牌组', () => {
  const state = setup(placed(stateFor(1), ['entryway']))
  state.relicOfAges = { code: '04061', location: 'entryway', seat: 0 }
  state.investigators[0].resigned = true
  const result = eztli.behavior.resolution(state, 'r1', [], {})
  assert.equal(result.award, true)
  assert.equal(state.campaign.investigators[0].deck.includes('04061'), true)
  assert.equal(state.campaign.records.theInvestigatorsRecoveredTheRelicOfAges, true)
})

test('结局 1：记录夺回遗物、把遗物加入牌组、记录复仇与预示者伤害', () => {
  const state = setup(placed(stateFor(2), ['entryway', 'chamberOfTime']))
  state.victoryDisplay = [{ id: 'act', code: '04057', vengeance: 1 }]
  state.enemies.push({
    id: 'h1', code: '04062', originalCode: '04062', name: '瓦卢西亚的预示者',
    location: 'entryway', damageTaken: 4, engagedSeat: null, resources: 0,
  })
  const result = eztli.behavior.resolution(state, 'r1', [], {})
  assert.deepEqual(result, { award: true, bonus: 0 })
  const records = state.campaign.records
  assert.equal(records.theInvestigatorsRecoveredTheRelicOfAges, true)
  assert.equal(records.theHarbingerIsStillAlive, 4)
  assert.equal(records.yigsFury, 1)
  assert.ok(state.campaign.investigators[0].deck.includes('04061'))
  const restored = JSON.parse(JSON.stringify(state))
  assert.deepEqual(restored.campaign.records, records)
})

test('结局 2：亚历山卓夺回遗物，不给调查员加卡', () => {
  const state = setup(placed(stateFor(1), ['entryway']))
  const result = eztli.behavior.resolution(state, 'r2', [], {})
  assert.equal(result.award, true)
  assert.equal(state.campaign.records.alejandroRecoveredTheRelicOfAges, true)
  assert.equal(state.campaign.records.theHarbingerIsStillAlive, 0)
  assert.equal(state.campaign.investigators[0].deck.includes('04061'), false)
})

test('结局 3：默认摧毁遗迹走结局 5；也可选择回到遗迹深处走结局 4', () => {
  const engine = setup(placed(stateFor(1), ['entryway']))
  engine.victoryDisplay = [{ id: 'act', code: '04057', vengeance: 1 }]
  const destroyed = eztli.behavior.resolution(engine, 'r3', [], {})
  assert.equal(destroyed.award, true)
  assert.equal(engine.campaign.records.theInvestigatorsRecoveredTheRelicOfAges, true)
  assert.equal(engine.scenarioFlags.finalChoice, 'destroy')
  assert.equal(engine.campaign.records.yigsFury, 1 + 10, '复仇 1 + 遗迹被摧毁 10')

  const back = setup(placed(stateFor(1), ['entryway']))
  const restarted = eztli.behavior.resolution(back, 'r3', [], { choose: () => 'goBackInside' })
  assert.equal(restarted.award, false)
  assert.equal(back.scenarioFlags.finalChoice, 'goBackInside')
  assert.equal(back.scenarioFlags.resolution4Count, 1)
  assert.equal(back.campaign.records.theInvestigatorsRecoveredTheRelicOfAges, undefined)

  const direct = setup(placed(stateFor(1), ['entryway']))
  assert.equal(eztli.behavior.resolution(direct, 'r4', [], {}).award, false)
  assert.equal(direct.scenarioFlags.resolution4Count, 1)
  assert.throws(() => eztli.behavior.resolution(direct, 'r9', [], {}), /未知埃兹特里覆灭结局/)
})

test('无结局按卡面分流：无人被击败 → 结局 3；有人被击败 → 结局 2', () => {
  // 无人被击败：进入结局 3 的二选一（这里选摧毁 → 结局 5）。
  const clean = setup(placed(stateFor(1), ['entryway']))
  const asked = []
  const result = eztli.behavior.resolution(clean, 'noResolution', [], {
    choose: request => { asked.push(request); return 'destroy' },
  })
  assert.equal(asked.length, 1, '结局 3 必须询问一次')
  assert.equal(result.award, true)
  assert.equal(clean.scenarioFlags.finalChoice, 'destroy')
  assert.equal(clean.campaign.records.theInvestigatorsRecoveredTheRelicOfAges, true, '只有走结局 5 才发遗物')

  // 有人被击败且伊格之怒 <4：+3 复仇后走结局 2（亚历山卓夺回遗物，不给调查员加卡）。
  const defeated = setup(placed(stateFor(2), ['entryway']))
  defeated.investigators[0].defeated = true
  defeated.investigators[1].resigned = true
  const second = eztli.behavior.resolution(defeated, 'noResolution', [], {})
  assert.equal(defeated.campaign.records.yigsFury, 3)
  assert.equal(defeated.campaign.records.alejandroRecoveredTheRelicOfAges, true)
  assert.equal(defeated.campaign.records.theInvestigatorsRecoveredTheRelicOfAges, undefined, '结局 2 不发遗物')
  assert.equal(second.award, true)

  // 伊格之怒 ≥4 且全员被击败：战役失败，不再有下一关。
  const wiped = setup(placed(stateFor(1), ['entryway']))
  wiped.investigators[0].defeated = true
  wiped.campaign.records.yigsFury = 4
  eztli.behavior.resolution(wiped, 'noResolution', [], {})
  assert.equal(wiped.campaign.investigators[0].status, 'killed')
  assert.equal(wiped.campaign.failed, true)
})

test('结局 4：重演次数写入战役记录，并通过引擎原语重开本章', () => {
  const state = setup(placed(stateFor(1), ['entryway']))
  const api = { restartScenario: () => { api.restarted = true; return true } }
  const result = eztli.behavior.resolution(state, 'r4', [], api)
  assert.equal(api.restarted, true, '必须调用剧本重开原语')
  assert.equal(state.campaign.records.resolution4Count, 1, '重演次数写进战役记录（跨关保留）')
  assert.equal(result.award, false)
  assert.equal(result.restarted, true)

  // 下一次布置：遗迹入口按重演次数放毁灭（记录在 setupLocations 之前就存在）。
  const replayState = stateFor(1)
  replayState.campaign.records.resolution4Count = 2
  const replay = setup(placed(replayState, ['entryway']))
  eztli.behavior.afterChaosBagSetup(replay)
  assert.equal(loc(replay, 'entryway').doom, 2, '入口放置 2 点毁灭')
})

test('伊格之怒 ≥4 时被击败的调查员在结算中死亡，否则复仇 +3', () => {
  const killed = setup(placed(stateFor(1), ['entryway']))
  killed.investigators[0].defeated = true
  killed.campaign.records.yigsFury = 4
  eztli.behavior.resolution(killed, 'r2', [], {})
  assert.equal(killed.campaign.investigators[0].status, 'killed')

  const spared = setup(placed(stateFor(1), ['entryway']))
  spared.investigators[0].defeated = true
  eztli.behavior.resolution(spared, 'r2', [], {})
  assert.equal(spared.campaign.records.yigsFury, 3)
  assert.equal(spared.campaign.investigators[0].status, 'active')
})

test('遗迹入口提供撤退与火把检查行动', () => {
  const state = setup(placed(stateFor(1), ['entryway']))
  const inv = state.investigators[0]
  state.campaign.supplies = { 0: ['torches'] }
  const moves = eztli.behavior.actions(state, inv)
  assert.deepEqual(moves.map(move => move.rule).sort(), ['resignEntryway', 'searchWithTorches'])

  const resigned = []
  eztli.behavior.performAction(state, inv, moves.find(move => move.rule === 'resignEntryway'),
    { resign: seat => resigned.push(seat) })
  assert.deepEqual(resigned, [0])

  inv.location = 'ancientHall'
  assert.deepEqual(eztli.behavior.actions(state, inv), [], '只有遗迹入口可以撤退/查看探索牌库')
})

test('火把行动：查看探索牌库顶 2 张，弃掉其中的诡计', () => {
  const state = setup(placed(stateFor(1), ['entryway']))
  state.explorationDeck = ['04092', 'ancientHall']
  const inv = state.investigators[0]
  eztli.behavior.performAction(state, inv, { rule: 'searchWithTorches' }, {
    checkSupplies: () => true, random: () => 0.5, info: () => {},
  })
  assert.equal(state.encounterDiscard.includes('04092'), true)
  assert.deepEqual(state.explorationDeck, ['ancientHall'])

  const noTorch = setup(placed(stateFor(1), ['entryway']))
  noTorch.explorationDeck = ['04092', 'ancientHall']
  eztli.behavior.performAction(noTorch, noTorch.investigators[0], { rule: 'searchWithTorches' }, {
    checkSupplies: () => false, random: () => 0.5, info: () => {},
  })
  assert.deepEqual(noTorch.explorationDeck, ['04092', 'ancientHall'])
})

test('混乱标记表与四档难度一致，elder thing 失败时在所在地点放毁灭', () => {
  const state = setup(placed(stateFor(1), ['entryway']))
  state.difficulty = 'standard'
  const inv = state.investigators[0]
  assert.equal(eztli.behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -1)
  loc(state, 'entryway').doom = 1
  assert.equal(eztli.behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -3)
  state.difficulty = 'hard'
  assert.equal(eztli.behavior.resolveChaosToken(state, inv, 'skull', {}).delta, -4)
  state.difficulty = 'standard'
  assert.equal(eztli.behavior.resolveChaosToken(state, inv, 'cultist', {}).delta, -1,
    '普通难度只按有毁灭的地点数量')
  assert.equal(eztli.behavior.resolveChaosToken(state, inv, 'tablet', {}).delta, -1)
  state.difficulty = 'hard'
  assert.equal(eztli.behavior.resolveChaosToken(state, inv, 'cultist', {}).delta, -1,
    '困难难度按毁灭标记总数')
  const elderThing = eztli.behavior.resolveChaosToken(state, inv, 'elderthing', {})
  assert.equal(elderThing.drawAnother, true)
  assert.equal(elderThing.placeDoomOnFail, true)

  state.difficulty = 'standard'
  const before = loc(state, 'entryway').doom
  eztli.behavior.afterTest(state, inv, {
    success: false, value: 0, difficulty: 3, drawn: ['elderthing'], source: { label: '调查', code: '04060' },
  }, { info: () => {} })
  assert.equal(loc(state, 'entryway').doom, before + 1)
})

test('同一路线的开始状态在 JSON 往返后完全一致', () => {
  const build = () => {
    const state = setup(placed(stateFor(2), ['entryway', 'ancientHall', 'grandChamber']), 41)
    eztli.behavior.actReveal(state, state.acts[0], { random: () => 0.25, info: () => {}, hasSupply: () => false })
    eztli.behavior.roundEnded(state, { choose: () => 'skip', info: () => {} })
    return state
  }
  const first = build()
  const second = build()
  assert.equal(JSON.stringify(first), JSON.stringify(second))
  const restored = JSON.parse(JSON.stringify(first))
  assert.deepEqual(restored.explorationDeck, first.explorationDeck)
  assert.deepEqual(restored.scenarioZones, first.scenarioZones)
  assert.deepEqual(restored.relicOfAges, first.relicOfAges)
  assert.deepEqual(restored.locations.map(location => location.doom),
    first.locations.map(location => location.doom))
  assert.deepEqual(restored.victoryDisplay, first.victoryDisplay)
})

test('04064 华美石室：调查未超过难度 2 点时先把线索翻成毁灭', () => {
  const state = setup(placed(stateFor(1), ['entryway', 'grandChamber']))
  const location = state.locations.find(entry => entry.id === 'grandChamber')
  location.clues = 1
  location.doom = 0
  const inv = state.investigators[0]
  const api = { info: () => {} }
  eztli.behavior.investigateResult(state, inv, location,
    { success: true, value: 3, difficulty: 4 }, api)
  assert.equal(location.clues, 0)
  assert.equal(location.doom, 1, '线索翻成毁灭')
  // 超过难度 2 点时不触发。
  location.clues = 1
  eztli.behavior.investigateResult(state, inv, location,
    { success: true, value: 6, difficulty: 4 }, api)
  assert.equal(location.clues, 1)
  assert.equal(location.doom, 1)
})

test('04067 秘密通道：任何一位在此的调查员带绳索都忽略强制', () => {
  const state = setup(placed(stateFor(2), ['entryway', 'secretPassage']))
  const location = state.locations.find(entry => entry.id === 'secretPassage')
  const inv = state.investigators[0]
  const mate = state.investigators[1]
  mate.location = location.id
  state.campaign.supplies = { 1: ['rope'] }
  let asked = 0
  const api = {
    info: () => {},
    checkSupplies: (seat, name) => ((state.campaign.supplies || {})[seat] || []).includes(name),
    choose: () => { asked++; return 'doom' },
  }
  eztli.behavior.locationEntered(state, inv, location, api)
  assert.equal(asked, 0, '有绳索时不询问')
  assert.equal(location.doom || 0, 0)
  // 没有绳索时才需要选择。
  state.campaign.supplies = {}
  eztli.behavior.locationEntered(state, inv, location, api)
  assert.equal(asked, 1)
  assert.equal(location.doom, 1)
})

test('全员被击败时战役结束（无论伊格之怒）', () => {
  const state = setup(placed(stateFor(2), ['entryway']))
  for (const inv of state.investigators) inv.defeated = true
  state.campaign.records.yigsFury = 0
  const api = { info: () => {}, addTrauma: () => {} }
  eztli.behavior.resolution(state, 'r2', [], api)
  assert.equal(state.campaign.failed, true)
})

test('探索只在幕 1/2 可用，幕 3 不能再探索', () => {
  const state = setup(placed(stateFor(1), ['entryway']))
  const inv = state.investigators[0]
  state.actIndex = 0
  assert.equal(eztli.behavior.canExplore(state, inv), true)
  state.actIndex = 1
  assert.equal(eztli.behavior.canExplore(state, inv), true)
  state.actIndex = 2
  assert.equal(eztli.behavior.canExplore(state, inv), false, '幕 3 没有探索行动')
})

test('04056 神庙看守者：被击败的调查员会按卡面留下创伤（cause=both）', () => {
  const state = setup(placed(stateFor(2), ['entryway']))
  state.investigators[0].resigned = true
  const defeated = []
  const api = {
    info: () => {},
    defeat: (inv, cause) => { inv.defeated = true; defeated.push([inv.seat, cause]) },
  }
  const agenda = state.agendas.find(entry => (entry.originalCode || entry.code) === '04056')
  eztli.behavior.agendaReveal(state, agenda, api)
  assert.deepEqual(defeated, [[1, 'both']], '撤退者不受影响，未撤退者被击败并留创伤')
})

test('04058 科学与魔法：地点排成一条线并给出线性 layout', () => {
  const state = setup(placed(stateFor(2), ['entryway', 'grandChamber', 'burialPit']))
  const api = {
    info: () => {},
    choose: request => request.options[0].id,
    giveAsset: () => {},
    moveRelicOfAges: () => {},
  }
  eztli.behavior.actReveal(state, state.acts[1], api)
  assert.equal(state.scenarioFlags.locationsInLine, true)
  const ids = state.scenarioFlags.locationLine
  assert.ok(ids.length >= 2)
  const layout = state.scenario.layout.locations
  assert.equal(Object.keys(layout).length, ids.length)
  const xs = ids.map(id => layout[id].x)
  assert.deepEqual(xs, [...xs].sort((left, right) => left - right), 'x 单调递增')
  assert.ok(ids.every(id => layout[id].y === 0), '同一行')
})

test('结局 1/5：多人时由队长选择谁把古代遗物带回牌库', () => {
  const state = setup(placed(stateFor(2), ['entryway']))
  state.campaign.records = {}
  state.campaign.investigators = {
    0: { id: 'a', deck: [], status: 'active' },
    1: { id: 'b', deck: [], status: 'active' },
  }
  const answers = []
  const api = {
    info: () => {},
    choose: request => { answers.push(request.kind); return '1' },
  }
  eztli.behavior.resolution(state, 'r1', [], api)
  assert.deepEqual(answers, ['investigator'])
  assert.deepEqual(state.campaign.investigators[1].deck, ['04061'])
  assert.deepEqual(state.campaign.investigators[0].deck, [])
})

test('04060 遗迹入口：没有火把不显示行动；查看顶 2 张时两张都可见', () => {
  const state = setup(placed(stateFor(1), ['entryway']))
  const inv = state.investigators[0]
  state.campaign.supplies = { 0: [] }
  assert.deepEqual(eztli.behavior.actions(state, inv).map(move => move.rule), ['resignEntryway'])
  state.campaign.supplies = { 0: ['torches'] }
  assert.deepEqual(eztli.behavior.actions(state, inv).map(move => move.rule).sort(), ['resignEntryway', 'searchWithTorches'])
  state.explorationDeck = ['04081', 'grandChamber']
  const logs = []
  eztli.behavior.performAction(state, inv, { rule: 'searchWithTorches' }, {
    checkSupplies: () => true,
    info: text => logs.push(text),
    random: () => 0.5,
  })
  assert.ok(logs.some(text => text.includes('火把照亮了')))
  assert.ok(logs.some(text => text.includes('并弃掉它')))
})
