import { ALL_CARDS } from '../../../../../src/cards/cards-data.js'
import { registeredEntry } from '../../../../../src/engine/ability.js'
import { campaignCardChange } from '../../../../../src/campaign/campaign.js'
import { requestChoice } from '../../../../../src/engine/resolution.js'
import { encounterRules } from '../../encounter-rules.js'
import { assetRuleFor, enemyScriptFor, locationRuleFor } from '../../../../../src/cards/card-rules.js'
import { carcosaChaosToken, carcosaChaosAfterTest } from '../../carcosa-chaos.js'

const active = state => state.investigators.filter(inv => !inv.defeated && !inv.resigned)
const original = card => card?.originalCode || card?.code
const hardSide = state => ['hard', 'expert'].includes(state.difficulty)
const symbolFamily = new Set(['cultist', 'tablet', 'elderthing'])
const rememberedFacts = [
  'setAFireInTheKitchen',
  'incitedAFightAmongstThePatients',
  'distractedTheGuards',
  'releasedADangerousPatient',
  'knowTheGuardsPatrols',
  'recalledTheWayOut',
]
const isLunatic = enemy => enemy.traits?.some(trait => ['Lunatic', 'Possessed'].includes(trait))

function randomIndex(length, api) {
  return Math.floor(api.random() * length)
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

function stashRandomMonster(state, api) {
  const monsters = state.scenarioZones.monsters || []
  if (!monsters.length) return null
  const code = monsters.splice(randomIndex(monsters.length, api), 1)[0]
  if (state.agendaIndex === 2) {
    state.encounterDeck.push(code)
    api.shuffleEncounterDeck()
  } else {
    state.scenarioZones.underAct ||= []
    state.scenarioZones.underAct.push(code)
  }
  return code
}

function chooseKeys(state, api, skills = ['combat', 'agility', 'intellect']) {
  const options = [
    ...skills.map(skill => ({ id: skill, label: `由一位调查员进行 [${skill}]（4）检定` })),
    { id: 'force', label: '强行夺走钥匙' },
  ]
  const answer = api.choose({
    kind: 'story', source: '03163', seat: state.campaign.leadSeat,
    prompt: '选择取得地下室钥匙的方式。', options,
  })
  if (answer === 'force') {
    state.scenarioFlags.tookKeysByForce = true
    state.scenarioFlags.keysFound = 1
    return
  }
  const candidates = active(state)
  const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choose({
    kind: 'target', source: `03163-${answer}`, seat: state.campaign.leadSeat,
    prompt: '选择进行检定的调查员。',
    options: candidates.map(inv => ({ id: String(inv.seat), label: inv.name })),
  }))
  api.test(seat, answer, 4, result => {
    if (result.success) {
      state.scenarioFlags.keysFound = 1
      return
    }
    chooseKeys(state, api, skills.filter(skill => skill !== answer))
  })
}

function unspeakableChaosToken(state, inv, token, api) {
  if (!symbolFamily.has(token) && token !== 'skull') {
    return carcosaChaosToken('theUnspeakableOath', state, inv, token, api)
  }
  const hard = hardSide(state)
  if (token === 'skull') return hard ? { delta: 0, drawAnother: true } : { delta: -1 }
  if (token === 'cultist') return { delta: -(inv.horror || 0) }
  if (token === 'tablet') {
    const location = state.locations.find(candidate => candidate.id === inv.location)
    return { delta: -(location?.shroud || 0) }
  }
  const monsters = state.scenarioZones.monsters || []
  if (!monsters.length) return { delta: 0, autoFail: true }
  const answer = api.choose({
    kind: 'chaos', source: '03159-elderthing', seat: inv.seat,
    prompt: '古神标记：将随机怪物放到场景牌库底下，或令本次检定自动失败。',
    options: [{ id: 'monster', label: '放置随机怪物' }, { id: 'fail', label: '本次检定自动失败' }],
  })
  if (answer === 'monster') {
    stashRandomMonster(state, api)
    return { delta: 0 }
  }
  return { delta: 0, autoFail: true }
}

function discardHidden(state, inv, code) {
  const handIndex = inv.hand.indexOf(code)
  if (handIndex >= 0) inv.hand.splice(handIndex, 1)
  const hiddenIndex = (inv.hiddenCards || []).indexOf(code)
  if (hiddenIndex >= 0) inv.hiddenCards.splice(hiddenIndex, 1)
  state.encounterDiscard.push(code)
}

export function setupPlan(state) {
  const halls = state.scenarioFlags?.oathHalls || {
    west: state.scenario.hallPools.west[0],
    east: state.scenario.hallPools.east[0],
  }
  return {
    locations: [
      halls.west, halls.east, 'messHall', 'kitchen', 'yard', 'garden',
      'infirmary', 'basementHall',
    ],
    setAside: ['03178', '03179', '03180', '03181', '03182a'],
    removed: state.scenarioZones?.removed || [],
  }
}

export const behavior = {
  // 03175 后院：调查时每有 1 点恐惧，隐藏值 +1。
  locationShroudModifier(state, location, inv) {
    return original(location) === '03175' && inv ? (inv.horror || 0) : 0
  },
  // 注：03052 后台的「隐私诡计算 3 张手牌」属于谢幕，已移到 curtainCall/behavior.js；
  // 本关没有带 flags.backstage 的地点，原实现是永不执行的死代码。
  ...encounterRules,
  id: 'theUnspeakableOath',
  spawnOverrides: { '03183': 'basementHall' },
  setupPlan,
  resolveChaosToken(state, inv, token, api) {
    return unspeakableChaosToken(state, inv, token, api)
  },
  setupLocations(state, _events, api) {
    state.scenarioFlags = { remembered: [], tookKeysByForce: false, keysFound: 0 }
    state.scenarioZones.removed = []
    state.scenarioZones.underAct = []
    state.scenarioFlags.oathHalls = {}
    for (const [side, ids] of Object.entries(state.scenario.hallPools)) {
      const shuffled = api.shuffle([...ids], () => api.randomValue(state))
      state.scenarioFlags.oathHalls[side] = shuffled[0]
      state.scenarioZones.removed.push(state.scenario.locations[shuffled[1]].originalCode)
    }
    const rng = () => api.randomValue(state)
    state.scenarioZones.monsters = api.shuffle([...state.scenario.monsterDeck], rng)
    state.scenarioZones.lunatics = api.shuffle([...state.scenario.lunaticsDeck], rng)
    const halls = Object.values(state.scenarioFlags.oathHalls)
    for (const inv of active(state)) inv.location = halls[Math.floor(api.randomValue(state) * halls.length)]
    const tookClasp = !!state.campaign.records.youTookTheOnyxClasp
    state.acts.splice(tookClasp ? 2 : 1, 1)
    return setupPlan(state).locations
  },
  afterChaosBagSetup(state) {
    const extra = { easy: '-2', standard: '-3', hard: '-4', expert: '-5' }[state.difficulty] || '-3'
    state.chaosBag.push(extra)
    state.scenarioFlags.temporaryChaosToken = extra
  },
  afterMulligan(state) {
    if (!(state.campaign.records.vipsInterviewed || []).includes('03076a')) return
    for (const inv of active(state)) {
      if (!inv.deck.length) continue
      const underlyingCode = inv.deck.pop()
      inv.assets.push({
        id: `courage-${inv.seat}-${state.round}`,
        code: 'xcourage',
        underlyingCode,
        name: '胆量',
        cost: 0,
        sanity: 2,
        exhausted: false,
        courage: true,
      })
    }
  },
  assetLeftPlay(_state, _inv, asset) {
    if (asset.code !== 'xcourage') return
    asset.code = asset.underlyingCode || asset.originalCode
    delete asset.underlyingCode
    delete asset.originalCode
  },
  investigatorEntryError(_state, location, inv) {
    if (location.enterClueCost && !location.revealed && inv.clues < location.enterClueCost) return '进入未揭示的病人拘禁室需要花费 1 个线索'
    return null
  },
  beforeMove(_state, inv, location) {
    if (location.enterClueCost && !location.revealed) inv.clues--
  },
  actReveal(state, act, api) {
    registeredEntry(act.originalCode)?.actRule?.onReveal?.(state, act, api)
  },
  agendaReveal(state, agenda, api) {
    registeredEntry(agenda.originalCode)?.agendaRule?.onReveal?.(state, agenda, api)
  },
  checkObjectives(state, api) {
    if (original(state.acts[state.actIndex]) === '03166'
      && (state.scenarioFlags.remembered || []).filter(fact => rememberedFacts.includes(fact)).length >= 4) {
      api.advanceAct()
    }
  },
  canFightEnemy(state, inv, enemy) {
    return !(inv.hiddenCards || []).includes('03186') || !isLunatic(enemy)
  },
  // 第 114 轮：疯人院暴食怪的「移动后同一阶段不能攻击」由条目 enemyScript 声明，
  // 这里只做通用分派（不再按卡号分支）。
  enemyMoved(state, enemy) {
    enemyScriptFor(original(enemy))?.onMoved?.(state, enemy)
  },
  enemyAttackModifier(state, enemy) {
    const scripted = enemyScriptFor(original(enemy))?.attackModifier?.(state, enemy) || {}
    const base = scripted
    if (enemy.location === 'westernHall169' && enemy.traits?.some(trait => String(trait).toLowerCase() === 'possessed')) {
      return { ...base, horror: (base.horror || 0) + 1 }
    }
    return base
  },
  enemyDefeated(state, enemy, api) {
    const shared = encounterRules.enemyDefeated?.(state, enemy, api) || false
    if (enemy.location === 'westernHall168'
      && enemy.traits?.some(trait => String(trait).toLowerCase() === 'possessed')
      && enemy.defeatedBy != null) {
      api.drawCards(enemy.defeatedBy, 1)
    }
    return shared
  },
  enemyDamaged(state, enemy, api) {
    enemyScriptFor(original(enemy))?.onDamaged?.(state, enemy, api)
  },
  turnEnded(state, inv, api) {
    encounterRules.turnEnded?.(state, inv, api)
    const location = state.locations.find(candidate => candidate.id === inv.location)
    if (original(location) === '03171') {
      api.horror(inv.seat, 1)
      inv.resources += 2
    }
  },
  afterTest(state, inv, result, api) {
    encounterRules.afterTest?.(state, inv, result, api)
    carcosaChaosAfterTest('theUnspeakableOath', state, inv, {
      ...result, drawn: result.drawn.filter(token => !symbolFamily.has(token) && token !== 'skull'),
    }, api)
    const tokens = result.drawn.filter(token => !result.cancelledTokens?.includes(token))
    if (!result.success) {
      if (tokens.includes('skull')) stashRandomMonster(state, api)
      if (hardSide(state) && tokens.includes('cultist')) api.horror(inv.seat, 1)
      if (hardSide(state) && tokens.includes('tablet')) api.horror(inv.seat, 1)
    }
    if (result.success && result.source?.label === '调查'
      && original(state.locations.find(location => location.id === inv.location)) === '03173'
      && inv.hand.length) {
      const choice = api.choose({
        kind: 'card', source: '03173', seat: inv.seat,
        prompt: '食堂：选择弃掉一张手牌。',
        options: inv.hand.map((code, index) => ({ id: String(index), label: ALL_CARDS[code]?.nameZh || code })),
      })
      inv.discard.push(inv.hand.splice(Number(choice), 1)[0])
    }
  },
  actions(state, inv) {
    const moves = []
    const location = state.locations.find(candidate => candidate.id === inv.location)
    const code = original(location)
    const noClues = (location?.clues || 0) === 0
    const facts = state.scenarioFlags.remembered || []
    // 第 83 轮：六个「记忆事实」地点与医务室的行动在地点条目声明。
    // 第 114 轮：东区病房（03170）的躲避行动也在地点条目声明。
    locationRuleFor(code)?.actions?.({ state, inv, location, moves, facts })
    if (inv.hiddenCards?.some(hidden => ['03186', '03187'].includes(hidden))) {
      for (const hidden of inv.hiddenCards.filter(card => ['03186', '03187'].includes(card))) {
        moves.push({ action: 'scenarioAction', rule: 'discardGift', hidden, label: '弃掉隐藏的疯狂馈赠' })
      }
    }
    for (const enemy of state.enemies.filter(candidate => enemyScriptFor(original(candidate))?.danielPossessed
      && candidate.location === inv.location)) {
      moves.push({ action: 'scenarioAction', actionKind: 'parley', rule: 'onyxParley',
        enemyId: enemy.id, label: '展示黑玛瑙扣环，与丹尼尔谈判',
        reason: inv.assets.some(asset => assetRuleFor(original(asset))?.onxyRing) ? null : '需要控制“黑玛瑙扣环”' })
    }
    const daniel = inv.assets.find(asset => assetRuleFor(original(asset))?.daniel)
    if (daniel) {
      moves.push({ action: 'scenarioAction', rule: 'transferDaniel', actions: 0, label: '横置丹尼尔，将其交给同地点调查员',
        reason: daniel.exhausted ? '需要先重整“丹尼尔”先生'
          : active(state).some(other => other.seat !== inv.seat && other.location === inv.location) ? null
            : '需要同地点有另一名调查员' })
    }
    return moves.filter(move => !(inv.hiddenCards || []).includes('03187')
      || !['kitchenFire', 'yardFight', 'gardenGuards', 'occupiedCell', 'drearyCell', 'familiarCell', 'infirmary', 'eastHallEvade'].includes(move.rule))
  },
  performAction(state, inv, move, api) {
    // 第 83 轮：地点条目先接管自己的场景行动。
    const here = state.locations.find(candidate => candidate.id === inv.location)
    if (locationRuleFor(original(here))?.performAction?.(state, inv, move, api)) return
    if (move.rule === 'discardGift') {
      if (!(inv.hiddenCards || []).includes(move.hidden)) throw new Error('隐藏牌不在手中')
      stashRandomMonster(state, api)
      discardHidden(state, inv, move.hidden)
    } else if (move.rule === 'onyxParley') {
      const enemy = state.enemies.find(candidate => candidate.id === move.enemyId && enemyScriptFor(original(candidate))?.danielPossessed
        && candidate.location === inv.location)
      if (!enemy || !inv.assets.some(asset => assetRuleFor(original(asset))?.onxyRing)) throw new Error('无法与丹尼尔谈判')
      api.damageEnemy(enemy.id, 99, inv.seat, '03142')
    } else if (move.rule === 'transferDaniel') {
      const daniel = inv.assets.find(asset => assetRuleFor(original(asset))?.daniel && !asset.exhausted)
      const candidates = active(state).filter(other => other.seat !== inv.seat && other.location === inv.location)
      if (!daniel || !candidates.length) throw new Error('无法转交丹尼尔')
      const seat = candidates.length === 1 ? candidates[0].seat : Number(api.choose({
        kind: 'target', source: daniel.id, seat: inv.seat, prompt: '选择接管丹尼尔的调查员。',
        options: candidates.map(candidate => ({ id: String(candidate.seat), label: candidate.name })),
      }))
      inv.assets.splice(inv.assets.indexOf(daniel), 1)
      daniel.exhausted = true
      state.investigators[seat].assets.push(daniel)
    } else throw new Error(`未知邪秽誓约行动：${move.rule}`)
  },
  // 第 114 轮：约束衣（03185）与危墙迫近（03188）的显现结算已迁到遭遇条目，
  // 本章的 resolveEncounter 直接沿用共享遭遇规则（...encounterRules 已提供）。
  allResigned(state, api) {
    api.advanceAct()
  },
  resolution(state, key, events, api) {
    if (!['noResolution', 'r1', 'r2', 'r3'].includes(key)) throw new Error('未知邪秽誓约结局')
    const addTrauma = (seat, kind, amount) => {
      if (!(amount > 0)) return
      if (api.addTrauma) api.addTrauma(state, seat, kind, amount, events)
      else if (api.trauma) api.trauma(seat, kind, amount)
      else state.campaign.trauma[seat][kind] += amount
    }
    if (state.victoryDisplay.some(card => original(card) === '03065b')) addVipSlain(state, '03065')
    const records = state.campaign.records
    const danielAllyEscaped = state.investigators.some(inv =>
      inv.resigned && inv.assets.some(asset => assetRuleFor(original(asset))?.daniel))
    const danielWasPossessed = state.enemies.some(enemy => enemyScriptFor(original(enemy))?.danielPossessed)
      || state.victoryDisplay.some(card => original(card) === '03182b')
    records.danielStatus = danielAllyEscaped ? 'survived'
      : danielWasPossessed ? 'possessed' : 'didNotSurvive'
    for (const inv of state.investigators.filter(candidate => candidate.defeated)) {
      const trauma = state.campaign.trauma[inv.seat]
      const amount = Math.max(0, (inv.maxSanity || inv.sanity || 0) - trauma.mental)
      addTrauma(inv.seat, 'mental', amount)
    }
    if (key === 'r1' || key === 'noResolution') {
      records.theKingClaimedItsVictims = true
      const owner = Object.values(state.campaign.investigators).find(record => record.deck.includes('03142'))
      const candidates = Object.values(state.campaign.investigators)
        .filter(record => record.status === 'active' && record.seat !== owner?.seat)
      if (owner && owner.status !== 'active' && candidates.length) {
        const request = {
          kind: 'storyCard', source: '03142', seat: state.campaign.leadSeat,
          prompt: '选择一位新的调查员持有黑玛瑙扣环。',
          options: candidates.map(record => ({ id: String(record.seat), label: record.name })),
        }
        const answer = candidates.length === 1 ? String(candidates[0].seat)
          : api.choose ? api.choose(request) : requestChoice(state, request)
        campaignCardChange(state.campaign, owner.seat, '03142', 'remove', 'theUnspeakableOath')
        campaignCardChange(state.campaign, Number(answer), '03142', 'add', 'theUnspeakableOath')
      }
      replaceSymbols(state, 'cultist')
    } else if (key === 'r2') {
      records.theInvestigatorsWereAttackedAsTheyEscapedTheAsylum = true
      for (const inv of state.investigators) addTrauma(inv.seat, 'physical', 1)
      replaceSymbols(state, 'tablet')
    } else {
      records.theInvestigatorsEscapedTheAsylum = true
      replaceSymbols(state, 'elderthing')
    }
    return { bonus: 0, award: true }
  },
}
