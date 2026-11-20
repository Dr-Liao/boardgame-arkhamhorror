import assert from 'node:assert/strict'
import test from 'node:test'
import '../content/registered.js'
import { createGameState, applyMove, legalMoves, validateMove } from '../src/engine/engine.js'

function submit(state, seat, move) {
  assert.equal(validateMove(state, seat, move), null, JSON.stringify(move))
  applyMove(state, seat, move)
}

function settle(state, pick = () => null) {
  for (let index = 0; state.pendingChoice && index < 80; index++) {
    const choice = state.pendingChoice
    const seat = (choice.seats || [choice.seat]).find(Number.isInteger)
    assert.ok(Number.isInteger(seat), choice.prompt)
    const ids = choice.options.map(option => option.id)
    const optionId = pick(choice, seat) ?? ['skip', 'done', 'continue', 'confirm'].find(id => ids.includes(id)) ?? ids[0]
    submit(state, seat, { action: 'choose', choiceId: choice.id, optionId })
  }
  assert.ok(!state.pendingChoice)
}

function debug(state, kind, fields = {}, pick) {
  submit(state, state.currentSeat ?? 0, { action: 'debug', kind, ...fields })
  settle(state, pick)
}

function enter(scenarioId, seed = scenarioId, campaignRecords = {}) {
  const state = createGameState({
    campaignId: 'theFeastOfHemlockVale', campaignHub: true, playerInvestigator: '10001',
    difficulty: 'standard', seed,
  }, [{ seat: 0, role: 'human' }])
  settle(state)
  Object.assign(state.campaign.records, campaignRecords)
  debug(state, 'scenario', { scenarioId })
  return state
}

const currentAct = state => state.acts[state.actIndex]?.code
const offered = (state, predicate) => legalMoves(state, 0).find(move => !move.reason && !move.disabled && predicate(move))

function perform(state, predicate, pick) {
  const move = offered(state, predicate)
  assert.ok(move, '预期动作未进入 legalMoves')
  const { label, explanation, disabled, reason, ...command } = move
  submit(state, 0, command)
  settle(state, pick)
}

test('FHV 终章：真实调查触发深渊抽牌，调查员归位后推进幕 1，探索洞穴后进入幕 3', () => {
  const state = enter('fateOfTheVale')
  const abyss = state.scenarioFlags.mechanics.scenarioDecks.abyss
  const trueCode = state.scenarioFlags.fateTrueSelves[0]
  abyss.deck = [trueCode]
  state.investigators[0].hand = ['01016', '01018', '01020', '01021', '01022']

  function investigate() {
    const here = state.locations.find(location => location.id === state.investigators[0].location)
    here.shroud = 0
    debug(state, 'actions', { targetSeat: 0, amount: 8 })
    debug(state, 'forceToken', { token: '+1' })
    perform(state, move => move.action === 'investigate')
  }

  investigate()
  assert.equal(state.investigators[0].code, trueCode)
  if (currentAct(state) === '10655') perform(state, move => move.rule === 'fateAdvanceAct')
  assert.equal(currentAct(state), '10656')

  const caves = ['10716', '10717', '10718']
  for (const code of caves) {
    const pile = state.scenarioFlags.mechanics.scenarioDecks.abyss
    const index = pile.deck.indexOf(code)
    assert.ok(index >= 0)
    pile.deck.unshift(...pile.deck.splice(index, 1))
    investigate()
  }
  for (const code of caves) {
    const cave = state.locations.find(location => location.originalCode === code || location.code === code)
    assert.ok(cave, code)
    assert.ok(cave.connections.some(id => id.startsWith('mirrorNest')))
    debug(state, 'reveal', { locationId: cave.id })
    assert.equal(state.uiState, 'inScenario', JSON.stringify(state.log.slice(-16)))
    const remaining = state.locations.find(location => location.id === cave.id).clues
    if (remaining) debug(state, 'locationClues', { locationId: cave.id, amount: -remaining })
  }
  state.campaign.records.theHemlocksMadeATruce = true
  perform(state, move => move.action === 'endTurn', choice =>
    choice.source === 'fateInterlude' ? 'saveTheVale' : null)
  assert.equal(state.actIndex, 2)
  assert.equal(currentAct(state), '10658')
  assert.equal(state.campaign.records.fateInterlude, 'saveTheVale')
  assert.ok(offered(state, move => move.rule === 'fateResidentParley'))
})

test('FHV 最长一夜：从牛奶房抽出 Fire!，另一张洗入遭遇牌库，区域间无重复', () => {
  const state = enter('theLongestNight', 'nightfate-tln-fire')
  state.scenarioFlags.mechanics.barriers = []
  debug(state, 'moveTo', { targetSeat: 0, locationId: 'milkhouse' })
  const fireCount = codes => codes.filter(code => code === '10743').length
  const asideBefore = fireCount(state.scenarioZones.setAside)
  perform(state, move => move.rule === 'theLongestNightFireDraw')
  assert.equal(fireCount(state.scenarioZones.setAside), asideBefore - 2)
  assert.equal(fireCount(state.encounterDeck), 1)
  assert.equal(fireCount(state.encounterDiscard), 0)
  assert.equal(state.locations.flatMap(location => location.attachments || [])
    .filter(attachment => attachment.code === '10743').length, 1)
})

test('FHV 最长一夜：全灭显示败北叙事，记录调查员阵亡并结束战役', () => {
  const state = enter('theLongestNight')
  debug(state, 'harm', { targetSeat: 0, damage: 99, horror: 99 })
  assert.equal(state.campaign.scenarioResults.at(-1).storyResolution, 'investigatorDefeat')
  assert.equal(state.campaign.investigators[0].status, 'killed')
  assert.equal(state.campaign.records.theLongestNightResolution, 'investigatorDefeat')
  assert.equal(state.campaign.failed, true)
})

test('FHV 扭曲空洞：法典 Σ 后探索目标地点，轮末共同付线索进入特殊幕和议程', () => {
  const state = enter('theTwistedHollow', 'probe-hollow-woods')
  debug(state, 'advanceAct')
  assert.equal(currentAct(state), '10608')
  assert.ok(!state.scenarioZones.setAsideLocations.includes('theTwistedHollow'))
  let hollow = null
  for (let index = 0; !hollow && index < 12; index++) {
    const unrevealed = state.locations.find(location => !location.revealed)
    assert.ok(unrevealed)
    debug(state, 'reveal', { locationId: unrevealed.id })
    hollow = state.locations.find(location => location.id === 'theTwistedHollow')
  }
  assert.ok(hollow)
  debug(state, 'moveTo', { targetSeat: 0, locationId: hollow.id })
  debug(state, 'clues', { targetSeat: 0, amount: 2 })
  perform(state, move => move.action === 'endTurn', choice => {
    if (choice.kind !== 'act') return null
    return choice.options.find(option => option.id !== 'skip')?.id
  })
  assert.equal(currentAct(state), '10609')
  assert.equal(state.agendas[state.agendaIndex]?.code, '10609')
})

test('FHV 岩间密语：矿车朝向由可操作的座位提交', () => {
  const state = enter('writtenInRock')
  let answered = false
  debug(state, 'advanceAct', {}, (choice, seat) => {
    if (choice.kind !== 'mineCartFacing') return null
    assert.equal(seat, 0)
    answered = true
    return 'east'
  })
  assert.ok(answered)
  assert.equal(state.scenarioFlags.mechanics.rail.facing, 'east')
})

test('FHV 失踪的姐妹：失败后由抽到重属自然的调查员选择伤害', () => {
  const state = enter('theLostSister')
  const inv = state.investigators[0]
  debug(state, 'spawn', { targetSeat: 0, code: '10583a', locationId: inv.location })
  debug(state, 'forceToken', { token: 'autofail' })
  let answered = false
  debug(state, 'encounter', { targetSeat: 0, code: '10586' }, (choice, seat) => {
    if (!choice.prompt.includes('重属自然')) return null
    assert.equal(seat, 0)
    answered = true
    return 'damage'
  })
  assert.ok(answered)
  assert.equal(state.investigators[0].damage, 2)
})

test('FHV 汉洛克庄园：议程翻面生成庞大敌人，洗入的诡计可正常抽取', () => {
  const state = enter('hemlockHouse', 'mida-repro', { day: 2 })
  const fires = '10743'
  for (const code of ['10545', '10546', fires]) {
    assert.ok(!state.encounterDeck.includes(code))
    assert.ok(state.scenario.treacheries[code])
  }
  debug(state, 'advanceAgenda')
  assert.equal(state.agendaIndex, 1)
  assert.equal(state.agendas[1].code, '10527')
  assert.ok(state.enemies.some(enemy => enemy.enemyLocation && enemy.massive))
  for (const code of ['10545', '10546']) {
    assert.ok(state.encounterDeck.includes(code))
    state.encounterDeck.splice(state.encounterDeck.indexOf(code), 1)
    state.encounterDeck.push(code)
    debug(state, 'forceToken', { token: 'autofail' })
    debug(state, 'encounter', { targetSeat: 0 })
  }
  debug(state, 'advanceAgenda')
  assert.equal(state.encounterDeck.filter(code => code === fires).length, 4)
  assert.ok(!state.scenarioZones.setAside.includes(fires))
  state.encounterDeck.splice(state.encounterDeck.indexOf(fires), 1)
  state.encounterDeck.push(fires)
  debug(state, 'encounter', { targetSeat: 0 })
  assert.ok(state.locations.some(location => location.attachments?.some(card => card.code === fires)))
})

test('FHV 岩间密语：矿车道岔和深掘混种入场的选择都有可操作座位', () => {
  const state = enter('writtenInRock')
  debug(state, 'advanceAct')
  let hybridChoice = false
  debug(state, 'spawn', { code: '10518', targetSeat: 0 }, (choice, seat) => {
    if (choice.source !== '10518') return null
    assert.equal(seat, 0)
    assert.ok(['slide', 'swap'].includes(choice.kind))
    hybridChoice = true
    return choice.options[0].id
  })
  assert.ok(hybridChoice)
  let switched = false
  perform(state, move => move.action === 'endTurn', (choice, seat) => {
    if (choice.kind !== 'mineCart') return null
    assert.equal(seat, 0)
    switched = true
    return 'cancel'
  })
  assert.ok(switched)
})

test('FHV 失踪的姐妹：由发动幕能力的座位选择要拉近的敌人', () => {
  const state = enter('theLostSister')
  debug(state, 'advanceAct')
  const here = state.investigators[0].location
  const neighbor = state.locations.find(location => state.locations.find(item => item.id === here).connections.includes(location.id))
  assert.ok(neighbor)
  neighbor.traits = [...new Set([...(neighbor.traits || []), 'Dark'])]
  debug(state, 'spawn', { code: '10583a', targetSeat: 0, locationId: neighbor.id })
  const enemy = state.enemies.find(item => item.code === '10583a')
  assert.ok(enemy)
  enemy.location = neighbor.id
  enemy.engagedSeat = null
  state.investigators[0].engaged = []
  debug(state, 'clues', { targetSeat: 0, amount: 1 })
  let selected = false
  perform(state, move => move.rule === 'lostSisterLureFromDark', (choice, seat) => {
    if (!choice.prompt.includes('选择要拉到这里')) return null
    assert.equal(seat, 0)
    selected = true
    return enemy.id
  })
  assert.ok(selected)
  assert.equal(state.enemies.find(item => item.id === enemy.id).location, here)
})

test('FHV 寂静荒野：攻击后只击败无彩幼虫，士兵和虫后留场', () => {
  const state = enter('theSilentHeath', 'silent-heath-attack')
  debug(state, 'reveal', { all: true })
  for (const code of ['10563', '10564', '10565']) debug(state, 'spawn', { code, targetSeat: 0 })
  perform(state, move => move.action === 'endTurn')
  assert.ok(state.victoryDisplay.some(card => card.code === '10563'))
  for (const code of ['10564', '10565']) {
    assert.ok(state.enemies.some(enemy => enemy.code === code))
    assert.ok(!state.victoryDisplay.some(card => card.code === code))
  }
})

test('FHV 面具：场上已有面具时，第二张无槽位面具既不枚举也不能通过校验', () => {
  const state = enter('writtenInRock', 'mask-crash')
  debug(state, 'resources', { targetSeat: 0, amount: 20 })
  debug(state, 'card', { code: '10111', zone: 'hand', targetSeat: 0 })
  perform(state, move => move.action === 'play' && move.cardId === '10111')
  for (const code of ['10133', '10134']) {
    debug(state, 'card', { code, zone: 'hand', targetSeat: 0 })
    assert.equal(offered(state, move => move.action === 'play' && move.cardId === code), undefined)
    assert.match(validateMove(state, 0, { action: 'play', cardId: code }), /没有合法的支援放置方案/)
  }
})

test('FHV 最长一夜：幕上可以撤退并进入第三结局', () => {
  const state = enter('theLongestNight')
  perform(state, move => move.action === 'resign')
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'resolution3')
})

for (const resolution of ['resolution1', 'resolution2']) {
  test(`FHV 山谷的命运：在深渊推进幕 3 并进入 ${resolution}`, () => {
    const state = enter('fateOfTheVale', resolution, { gideonFinishedTheTaleOfAnnabelleLee: true })
    debug(state, 'advanceAct')
    debug(state, 'advanceAct', {}, choice => choice.source === 'fateInterlude' ? 'letsEndThis' : null)
    assert.equal(currentAct(state), '10657')
    assert.equal(offered(state, move => move.rule === 'fateAdvanceAct'), undefined)
    state.scenarioFlags.mechanics.scenarioDecks.abyss.deck = []
    debug(state, 'moveTo', { targetSeat: 0, locationId: 'theAbyss' })
    debug(state, 'clues', { targetSeat: 0, amount: 2 })
    if (resolution === 'resolution2') state.storyAssets.push({ code: '10522' })
    perform(state, move => move.rule === 'fateAdvanceAct', choice => {
      if (choice.source !== 'fateAct3V1') return null
      assert.equal(choice.options.some(option => option.id === 'resolution2'), resolution === 'resolution2')
      return resolution
    })
    assert.equal(state.campaign.scenarioResults.at(-1).resolution, resolution)
  })
}

test('FHV 山谷的命运：谈判带走最后一名居民后进入第三结局', () => {
  const state = enter('fateOfTheVale', 'resolution3', { theHemlocksMadeATruce: true })
  debug(state, 'advanceAct')
  debug(state, 'advanceAct', {}, choice => choice.source === 'fateInterlude' ? 'saveTheVale' : null)
  assert.equal(currentAct(state), '10658')
  const residents = state.locations.flatMap(location => (location.beneath || []).map(() => location.id))
  assert.ok(residents.length > 0)
  const inv = state.investigators[0]
  inv.willpower = 8
  inv.hand = Array(residents.length + 5).fill('01016')
  debug(state, 'actions', { targetSeat: 0, amount: residents.length + 2 })
  debug(state, 'clues', { targetSeat: 0, amount: 3 })
  assert.equal(offered(state, move => move.rule === 'fateAdvanceAct'), undefined)
  for (const id of residents) {
    debug(state, 'moveTo', { targetSeat: 0, locationId: id })
    const remaining = () => state.locations.find(item => item.id === id).beneath.length
    const count = remaining()
    debug(state, 'forceToken', { token: '+1' })
    perform(state, move => move.rule === 'fateResidentParley')
    assert.equal(remaining(), count - 1, JSON.stringify(state.log.slice(-8)))
  }
  perform(state, move => move.rule === 'fateAdvanceAct')
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'resolution3')
})

test('FHV 山谷的命运：五张在场火焰在轮末触发第四结局', () => {
  const state = enter('fateOfTheVale')
  state.campaign.records.theValeIsFullOfFireworks = true
  debug(state, 'advanceAct')
  debug(state, 'advanceAct', {}, choice => choice.source === 'fateInterlude' ? 'burnItAll' : null)
  assert.equal(currentAct(state), '10659')
  const fire = '10743'
  assert.equal(state.scenarioZones.setAside.filter(code => code === fire).length, 5)
  state.enemies = []
  debug(state, 'actions', { targetSeat: 0, amount: 10 })
  for (const id of ['theCrossroads', 'theCommons', 'boardingHouse', 'hemlockChapel', 'theOldMill']) {
    debug(state, 'moveTo', { targetSeat: 0, locationId: id })
    state.locations.find(location => location.id === id).shroud = 0
    perform(state, move => move.rule === 'fateDrawFire')
  }
  assert.equal(currentAct(state), '10659')
  assert.equal(state.locations.flatMap(location => location.attachments || []).filter(card => card.code === fire).length, 5)
  perform(state, move => move.action === 'endTurn')
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'resolution4')
})

test('FHV 山谷的命运：旅舍、集会厅和两处洞察检定写入逃生记录，最后撤退进入第五结局', () => {
  const state = enter('fateOfTheVale')
  debug(state, 'advanceAct')
  debug(state, 'advanceAct', {}, choice => choice.source === 'fateInterlude' ? 'escape' : null)
  assert.equal(currentAct(state), '10660')
  assert.equal(offered(state, move => move.rule === 'fateResign'), undefined)
  state.enemies = []
  state.chaosBag = Array(9).fill('+1')
  const inv = state.investigators[0]
  inv.hand = ['01016', '01018', '01020', '01021', '01022']
  inv.willpower = inv.intellect = inv.combat = inv.agility = 8
  debug(state, 'actions', { targetSeat: 0, amount: 10 })
  debug(state, 'clues', { targetSeat: 0, amount: 6 })
  for (const [id, key] of [
    ['boardingHouse', 'theInvestigatorsFoundGas'],
    ['theCommons', 'theInvestigatorsFoundTheosTruck'],
    ['theOldMill', 'theSamplesWereFound'],
    ['theAtwoodHouse', 'theSurveyNotesWereRecovered'],
  ]) {
    debug(state, 'moveTo', { targetSeat: 0, locationId: id })
    perform(state, move => move.rule === 'fateEscapeLocation', choice =>
      choice.source === id && choice.options.some(option => option.id === 'pay') ? 'pay' : null)
    assert.equal(state.campaign.records[key], true, key)
  }
  debug(state, 'moveTo', { targetSeat: 0, locationId: 'theCrossroads' })
  debug(state, 'spawn', { code: '10663b', targetSeat: 0 })
  const enemy = state.enemies.find(item => item.code === '10663b')
  enemy.evade = 0
  if (enemy.engagedSeat !== 0) perform(state, move => move.action === 'engage' && move.enemyId === enemy.id)
  perform(state, move => move.action === 'evade' && move.enemyId === enemy.id, choice =>
    choice.source === 'theCrossroads' && choice.options.some(option => option.id === 'record') ? 'record' : null)
  assert.equal(state.campaign.records.theRoadIsClear, true)
  perform(state, move => move.rule === 'fateResign')
  assert.equal(state.campaign.scenarioResults.at(-1).resolution, 'resolution5')
})
