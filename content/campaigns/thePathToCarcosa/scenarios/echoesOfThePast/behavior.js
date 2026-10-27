import { assetRuleFor, enemyScriptFor, locationRuleFor } from '../../../../../src/cards/card-rules.js'
import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { awardStoryCard } from '../../../../../src/campaign/campaign-effects.js'
import { campaignCardChange } from '../../../../../src/campaign/campaign.js'
import { requestChoice } from '../../../../../src/engine/resolution.js'
import { encounterRules } from '../../encounter-rules.js'
import { carcosaChaosToken, carcosaChaosAfterTest } from '../../carcosa-chaos.js'

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const original = card => card?.originalCode || card?.code
const hardSide = state => ['hard', 'expert'].includes(state.difficulty)
const historicalRooms = new Set(['03128', '03129', '03130', '03132', '03133', '03134', '03136', '03137', '03138'])
const symbolFamily = new Set(['cultist', 'tablet', 'elderthing'])

function shuffleWithSetup(state, values, api) {
  return api.shuffle([...values], () => api.randomValue(state))
}

function distance(state, start, target) {
  if (start === target) return 0
  const queue = [start]
  const seen = new Map([[start, 0]])
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]
    for (const next of state.locations.find(location => location.id === current)?.connections || []) {
      if (next === target) return seen.get(current) + 1
      if (!seen.has(next)) {
        seen.set(next, seen.get(current) + 1)
        queue.push(next)
      }
    }
  }
  return Infinity
}

function replaceSymbols(state, token) {
  const replace = bag => [...(bag || []).filter(face => !symbolFamily.has(face)), token, token]
  state.chaosBag = replace(state.chaosBag)
  state.campaign.chaosBag = replace(state.campaign.chaosBag)
}

function addVipSlain(state, code) {
  const slain = state.campaign.records.vipsSlain ||= []
  if (!slain.includes(code)) slain.push(code)
}

function awardRequiredStoryCard(state, code, reason, api = {}) {
  const candidates = Object.values(state.campaign.investigators)
    .filter(record => record.status === 'active' && !record.deck.includes(code))
  if (!candidates.length || Object.values(state.campaign.investigators).some(record => record.deck.includes(code))) return
  const request = {
    kind: 'storyCard', source: code, seat: state.campaign.leadSeat ?? candidates[0].seat,
    prompt: `选择一位调查员持有${ALL_CARDS[code].nameZh || ALL_CARDS[code].name}。`,
    options: candidates.map(record => ({ id: String(record.seat), label: record.name })),
  }
  const answer = candidates.length === 1 ? String(candidates[0].seat)
    : api.choose ? api.choose(request) : requestChoice(state, request)
  campaignCardChange(state.campaign, Number(answer), code, 'add', reason)
}

function awardOptionalStoryCard(state, code, reason, api = {}) {
  if (state._resolution) return awardStoryCard(state, code, reason)
  const candidates = Object.values(state.campaign.investigators)
    .filter(record => record.status === 'active' && !record.deck.includes(code))
  if (!candidates.length || !api.choose) return
  const answer = api.choose({
    kind: 'storyCard', source: code, seat: state.campaign.leadSeat ?? candidates[0].seat,
    prompt: `是否将${ALL_CARDS[code].nameZh || ALL_CARDS[code].name}加入牌组？`,
    options: [{ id: 'skip', label: '不加入' }, ...candidates.map(record => ({
      id: String(record.seat), label: record.name,
    }))],
  })
  if (answer !== 'skip') campaignCardChange(state.campaign, Number(answer), code, 'add', reason)
}

function placeDoomOnNearestEnemy(state, inv, api) {
  if (!state.enemies.length) return
  const nearestDistance = Math.min(...state.enemies.map(enemy => distance(state, inv.location, enemy.location)))
  const nearest = state.enemies.filter(enemy => distance(state, inv.location, enemy.location) === nearestDistance)
  const id = nearest.length === 1 ? nearest[0].id : api.choose({
    kind: 'target', source: '03120-cultist', seat: inv.seat,
    prompt: '选择一名最近的敌人，在其上放置 1 个毁灭标记。',
    options: nearest.map(enemy => ({ id: enemy.id, label: enemy.name })),
  })
  const enemy = nearest.find(candidate => candidate.id === id)
  if (enemy) enemy.doom = (enemy.doom || 0) + 1
}

function echoesChaosToken(state, inv, token, api) {
  if (!symbolFamily.has(token) && token !== 'skull') return carcosaChaosToken('echoesOfThePast', state, inv, token, api)
  const hard = hardSide(state)
  if (token === 'skull') {
    const doom = state.enemies.map(enemy => enemy.doom || 0)
    return { delta: -(hard ? doom.reduce((sum, value) => sum + value, 0) : Math.max(0, ...doom)) }
  }
  if (hard) {
    if (token === 'cultist') placeDoomOnNearestEnemy(state, inv, api)
    if (token === 'tablet') api.discardRandom(inv.seat, 1)
    if (token === 'elderthing' && state.enemies.some(enemy => enemy.location === inv.location)) api.horror(inv.seat, 1)
  }
  return { delta: hard ? -4 : -2 }
}

export function setupPlan(state) {
  const kept = state.scenarioFlags?.echoesFloors || state.scenario.floorPools
  return {
    locations: ['entryHall', 'quietHallsSecond', 'quietHallsThird', ...Object.values(kept).flat()],
    // 03144 探求者的 3 张实体卡开局按人数生成，其余放在一边（不洗进遭遇牌库）。
    setAside: ['03139', '03140', '03141', '03142', '03143', '03144', '03144', '03144'],
    removed: state.scenarioZones?.removed || [],
  }
}

export const behavior = {
  ...encounterRules,
  id: 'echoesOfThePast',
  setupPlan,
  resolveChaosToken(state, inv, token, api) {
    return echoesChaosToken(state, inv, token, api)
  },
  setupLocations(state, _events, api) {
    state.scenarioFlags = { firstRoundBonus: !!state.campaign.records.youFledTheDinnerParty }
    state.scenarioZones.removed = []
    // 03139/03140/03141-03143 与 03144 的未使用副本都放在一边；
    // 以前 `setupPlan().setAside` 只是导出数据，引擎的 setAside 区一直是空的。
    state.scenarioZones.setAside = [...setupPlan(state).setAside]
    state.scenarioFlags.echoesFloors = {}
    for (const [floor, ids] of Object.entries(state.scenario.floorPools)) {
      const shuffled = shuffleWithSetup(state, ids, api)
      state.scenarioFlags.echoesFloors[floor] = shuffled.slice(0, 2)
      state.scenarioZones.removed.push(state.scenario.locations[shuffled[2]].originalCode)
    }
    const third = state.scenarioFlags.echoesFloors.third
    const candidates = state.numInvestigators < 4
      ? third : [...state.scenarioFlags.echoesFloors.second, ...third]
    state.scenarioFlags.seekerLocations = shuffleWithSetup(state, candidates, api)
    if ((state.campaign.records.vipsInterviewed || []).includes('03079')) {
      state.scenario.locations.entryHall.cluesFixed = state.numInvestigators
    }
    if (state.scenarioFlags.firstRoundBonus) {
      for (const inv of active(state)) inv.actionsLeft++
    }
    return setupPlan(state).locations
  },
  setupEnemies(state, _events, api) {
    const count = state.numInvestigators === 1 ? 0 : state.numInvestigators === 2 ? 1 : state.numInvestigators === 3 ? 2 : 3
    // 卡面：生成在「任意无人历史协会地点」，由玩家选择。
    const empty = state.locations.filter(location => historicalRooms.has(original(location))
      && !active(state).some(inv => inv.location === location.id)).map(location => location.id)
    for (let i = 0; i < count; i++) {
      const id = empty.length
        ? (empty.length === 1 ? empty[0] : api.choose({
          kind: 'location', source: 'seekerSpawn', seat: state.campaign.leadSeat,
          prompt: '选择卡尔克萨探求者生成的无人历史协会地点。',
          options: empty.map(candidate => ({ id: candidate, label: state.locations.find(item => item.id === candidate)?.name || candidate })),
        }))
        : state.scenarioFlags.seekerLocations[i]
      const index = empty.indexOf(id)
      if (index >= 0) empty.splice(index, 1)
      api.spawnEnemy(state, '03144', id, null)
    }
  },
  enemySpawned(state, enemy, api) {
    encounterRules.enemySpawned?.(state, enemy, api)
    const location = state.locations.find(candidate => candidate.id === enemy.location)
    if (location && historicalRooms.has(original(location)) && !location.revealed) api.reveal(location.id)
  },
  mythosEnded(state, api) {
    // 03144 卡尔克萨探求者：神话阶段结束时移走 1 个线索，不能则放 1 毁灭。
    for (const enemy of state.enemies) enemyScriptFor(original(enemy))?.onMythosEnd?.(state, enemy, api)
  },
  enemyDamaged(state, enemy, api) {
    // 第 119 轮：03140 附身宣誓者的「密谋 2 之前免疫伤害」在敌人条目的 enemyScript.onDamaged。
    enemyScriptFor(original(enemy))?.onDamaged?.(state, enemy, api)
  },
  enemyDefeated(state, enemy, api) {
    // 第 119 轮：03140 被击败的胜利区与结局在条目的 enemyScript.onDefeated。
    const script = enemyScriptFor(original(enemy))
    if (script?.onDefeated) return script.onDefeated(state, enemy, api) === true
    return encounterRules.enemyDefeated?.(state, enemy, api) || false
  },
  enemyPhaseStart(state, api) {
    // 第 119 轮：敌军阶段开始的敌人脚本统一按条目派发（03140 的毁灭/重整选择）。
    for (const enemy of state.enemies) enemyScriptFor(original(enemy))?.onPhaseStart?.(state, enemy, api)
    // 03139 隐藏的图书馆：「敌人移动时，隐藏的图书馆获得[[通道]]特性」。
    // 在猎手移动循环前临时授予，移动结束后（enemyPhaseAfterHunters）撤销。
    // 特性授予按来源记账（source: '03139'），皮博迪先生授予的同一特性不会被覆盖。
    const library = state.locations.find(location => location.id === 'hiddenLibrary')
    if (library) api.addLocationTrait(library, 'Passageway', { source: '03139' })
  },
  enemyPhaseAfterHunters(state, api) {
    // 猎手移动窗口结束：撤掉 03139 的临时[[通道]]（只撤销本来源，皮博迪先生的授予保留）。
    const library = state.locations.find(location => location.id === 'hiddenLibrary')
    if (library) api.removeLocationTrait(library, 'Passageway', { source: '03139' })
  },
  roundEnded(state, api) {
    encounterRules.roundEnded?.(state, api)
    // 第 119 轮：03144 追寻者的轮末线索/毁灭在条目的 enemyScript.onRoundEnd。
    for (const enemy of state.enemies) enemyScriptFor(original(enemy))?.onRoundEnd?.(state, enemy, api)
    // 03141 皮博迪先生：重整阶段已把他重置，因此「直到他重整」的效果到此结束。
    // 只撤销本次授予（来源 '03141'）：印刷[[通道]]特性与其它来源的授予都不受影响。
    const temporary = state.scenarioFlags?.peabodyPassage
    if (temporary?.locationId) {
      const location = state.locations.find(candidate => candidate.id === temporary.locationId)
      if (location) {
        api.setShroudMod(location, 1)
        api.removeLocationTrait(location, 'Passageway', { source: '03141' })
        api.info?.('🎩 「皮博迪先生」重整，通道效果结束。')
      }
      delete state.scenarioFlags.peabodyPassage
    }
  },
  locationShroudModifier() {
    // 第 119 轮：03137 的「皮博迪先生在此地则帷幕 -2」已改成地点条目的 locationShroud 修饰符。
    return 0
  },
  actReveal(state, act, api) {
    registeredEntry(act.originalCode)?.actRule?.onReveal?.(state, act, api)
  },
  agendaReveal(state, agenda, api) {
    registeredEntry(agenda.originalCode)?.agendaRule?.onReveal?.(state, agenda, api)
  },
  actions(state, inv) {
    const moves = []
    const location = state.locations.find(candidate => candidate.id === inv.location)
    const code = original(location)
    // 第 119 轮：03128 会议室 / 03134 阅览室的场景行动在地点条目。
    locationRuleFor(code)?.actions?.({ state, inv, location, moves })
    if (['03131', '03135'].includes(code)) {
      const unrevealed = state.locations.filter(candidate => !candidate.revealed).length
      const withClues = state.locations.filter(candidate => (candidate.clues || 0) > 0).length
      moves.push({ action: 'scenarioAction', rule: 'restoreClues', label: '在宁静的走廊放置线索',
        reason: unrevealed ? '还有地点尚未揭示' : withClues ? '还有地点留着线索' : null })
    }
    // 皮博迪先生在场时，只差他是否已重整（身份读条目的 assetRule.peabody）。
    const peabody = inv.assets.find(asset => assetRuleFor(original(asset))?.peabody)
    if (peabody) moves.push({ action: 'scenarioAction', rule: 'peabodyPassage', label: '横置皮博迪先生，选择一个地点作为通道',
      reason: peabody.exhausted ? '需要先重整“皮博迪先生”' : null })
    return moves
  },
  performAction(state, inv, move, api) {
    if (move.rule === 'meetingRoomAlly') {
      const location = state.locations.find(candidate => candidate.id === inv.location)
      const allies = inv.assets.filter(asset => !asset.exhausted
        && ALL_CARDS[asset.code]?.traits?.some(trait => trait.toLowerCase() === 'ally'))
      if (original(location) !== '03128' || !location.clues || !allies.length
        || state.scenarioFlags[`meetingRoom:${inv.seat}`] === state.round) {
        throw new Error('会议室能力当前不可用')
      }
      const id = allies.length === 1 ? allies[0].id : api.choose({
        kind: 'target', source: '03128', seat: inv.seat,
        prompt: '选择横置一名盟友支援。',
        options: allies.map(asset => ({
          id: asset.id, label: ALL_CARDS[asset.code]?.nameZh || ALL_CARDS[asset.code]?.name || asset.code,
        })),
      })
      const ally = allies.find(asset => asset.id === id)
      if (!ally) throw new Error('必须选择一名可横置的盟友')
      ally.exhausted = true
      state.scenarioFlags[`meetingRoom:${inv.seat}`] = state.round
      location.clues--
      api.gainClues(inv.seat, 1)
    } else if (move.rule === 'restoreClues') {
      state.locations.find(location => location.id === inv.location).clues += state.numInvestigators
    } else if (move.rule === 'readingRoom') {
      state.scenarioFlags.readingRoomRound = state.round
      const location = state.locations.find(candidate => candidate.id === inv.location)
      api.test(inv.seat, 'intellect', location.shroud + (location.shroudMod || 0), result => {
        if (!result.success) return
        const enemies = state.enemies.filter(enemy => (enemy.doom || 0) > 0)
        const id = enemies.length === 1 ? enemies[0].id : api.choose({
          kind: 'target', source: '03134', seat: inv.seat, prompt: '选择一名有毁灭的敌人。',
          options: enemies.map(enemy => ({ id: enemy.id, label: enemy.name })),
        })
        const enemy = enemies.find(candidate => candidate.id === id)
        if (enemy) {
          enemy.doom--
          inv.clues++
        }
      })
    } else if (move.rule === 'peabodyPassage') {
      // 第 119 轮：皮博迪先生的身份读条目的 assetRule.peabody。
      // 卡面：[action]横置皮博迪先生：选择一个地点。直到皮博迪先生重整，该地点隐藏值 -1
      // 并获得[[通道]]特性。目标可以是场上任意地点（含隐藏的图书馆与调查员所在地点）。
      const peabody = inv.assets.find(asset => assetRuleFor(original(asset))?.peabody && !asset.exhausted)
      if (!peabody) throw new Error('皮博迪先生必须处于重整状态')
      const locations = state.locations.slice()
      if (!locations.length) throw new Error('场上没有可选择的地点')
      const id = api.choose({
        kind: 'target', source: '03141', seat: inv.seat,
        prompt: '选择一处获得[[通道]]特性并减少 1 点隐藏值的地点。',
        options: locations.map(location => ({ id: location.id, label: location.name || location.id })),
      })
      const location = state.locations.find(candidate => candidate.id === id)
      if (!location) throw new Error('必须选择一处场上地点')
      peabody.exhausted = true
      state.scenarioFlags ||= {}
      // 皮博迪先生每次重整后的新效果会顶掉旧效果（现实中他必须先重整才能再次行动，
      // 而「直到他重整」的旧效果在那一刻就已结束；这里对非常规的中途重整也保持一致）。
      // 撤销旧效果时用原语的反向操作：隐藏值 +1、只撤销本来源的[[通道]]授予。
      const previous = state.scenarioFlags.peabodyPassage
      if (previous?.locationId) {
        const previousLocation = state.locations.find(candidate => candidate.id === previous.locationId)
        if (previousLocation) {
          api.setShroudMod(previousLocation, 1)
          api.removeLocationTrait(previousLocation, 'Passageway', { source: '03141' })
        }
      }
      state.scenarioFlags.peabodyPassage = { locationId: location.id }
      api.setShroudMod(location, -1)
      api.addLocationTrait(location, 'Passageway', { source: '03141' })
      api.info?.(`🎩 「皮博迪先生」让「${location.name}」获得[[通道]]特性（隐藏值 -1），直到他重整。`)
    } else throw new Error(`未知往事回声行动：${move.rule}`)
  },
  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    // The scenario owns its original symbol clauses; the shared dispatcher
    // still receives any future non-symbol result extensions.
    carcosaChaosAfterTest('echoesOfThePast', state, inv, {
      ...result, drawn: result.drawn.filter(token => !symbolFamily.has(token) && token !== 'skull'),
    }, api)
    if (!result.success && !hardSide(state)) {
      const tokens = result.drawn.filter(token => !result.cancelledTokens?.includes(token))
      if (tokens.includes('cultist')) placeDoomOnNearestEnemy(state, inv, api)
      if (tokens.includes('tablet')) api.discardRandom(inv.seat, 1)
      if (tokens.includes('elderthing') && state.enemies.some(enemy => enemy.location === inv.location)) api.horror(inv.seat, 1)
    }
    if (result.success && result.source?.label === '调查') {
      const location = state.locations.find(candidate => candidate.id === inv.location)
      if (['03133', '03136'].includes(original(location))) {
        const key = `library:${location.id}:${inv.seat}`
        if (state.scenarioFlags[key] !== state.round && api.choose({
          kind: 'reaction', source: original(location), seat: inv.seat,
          prompt: '是否承受 2 点恐惧，在此处额外发现 1 个线索？',
          options: [{ id: 'skip', label: '不触发' }, { id: 'trigger', label: '承受恐惧并发现线索' }],
        }) === 'trigger') {
          state.scenarioFlags[key] = state.round
          api.horror(inv.seat, 2)
          if (location.clues > 0) {
            location.clues--
            inv.clues++
          }
        }
      }
    }
  },
  enemyStatModifier(state, enemy, stat) {
    const shared = encounterRules.enemyStatModifier?.(state, enemy, stat) || 0
    const location = state.locations.find(candidate => candidate.id === enemy.location)
    return shared + (['03129', '03138'].includes(original(location)) && ['fight', 'evade'].includes(stat) ? 1 : 0)
  },
  resolveEncounter(state, inv, card, api) {
    // 第 119 轮：03145 误入歧途 / 03146 追随者找到前路的显现结算在遭遇条目
    // （encounterResolveCampaigns: ['carcosa']）。
    return encounterRules.resolveEncounter.call(this, state, inv, card, api)
  },
  allResigned(_state, api) {
    api.finish('noResolution')
  },
  storyResolutionKey(_state, key) {
    return key === 'noResolution' ? 'r4' : key
  },
  resolution(state, key, _events, api = {}) {
    if (!['noResolution', 'r1', 'r2', 'r3', 'r4'].includes(key)) throw new Error('未知往事回声结局')
    const records = state.campaign.records
    if (state.victoryDisplay.some(card => original(card) === '03068b')) addVipSlain(state, '03068')
    if (key === 'r1') {
      records.youTookTheOnyxClasp = true
      records.conviction = (records.conviction || 0) + 1
      awardRequiredStoryCard(state, '03142', 'echoesOfThePast', api)
      replaceSymbols(state, 'cultist')
    } else if (key === 'r2') {
      records.youLeftTheOnyxClaspBehind = true
      records.doubt = (records.doubt || 0) + 1
      replaceSymbols(state, 'tablet')
    } else if (key === 'r3') {
      records.youDestroyedTheOathspeaker = true
      awardOptionalStoryCard(state, '03143', 'echoesOfThePast', api)
      replaceSymbols(state, 'tablet')
    } else {
      records.theFollowersOfTheSignHaveFoundTheWayForward = true
      replaceSymbols(state, 'elderthing')
    }
    return { bonus: key === 'r4' || key === 'noResolution' ? 1 : 0, award: true }
  },
}
