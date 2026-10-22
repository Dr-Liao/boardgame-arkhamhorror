import { ALL_CARDS } from '../cards/cards-data.js'
import { poisonWeaknessCode } from '../cards/card-rules.js'
import { awardExperience, campaignCardChange, updateCampaignStatus } from './campaign.js'
import { changeChaosBag } from '../engine/chaos-bag.js'
import { requestChoice } from '../engine/resolution.js'
import { randomValue } from '../engine/rules-state.js'
import { resolveSurvivors } from '../../content/campaigns/theDunwichLegacy/later-behaviors.js'

// Called inside the existing replayable resolution transaction. A saved choice
// replays from its base state, so neither rewards nor bag changes are duplicated.
export function awardStoryCard(state, code, reason) {
  const card = ALL_CARDS[code]
  if (!card || card.type !== 'asset' || !(card.unique || (card.encounterCode && card.quantity === 1))) throw new Error('无效的剧情资产')
  const campaign = state.campaign
  if (Object.values(campaign.investigators).some(record => record.deck.includes(code))) return
  const candidates = Object.values(campaign.investigators).filter(record => record.status === 'active')
  if (!candidates.length) return
  const answer = requestChoice(state, {
    kind: 'storyCard', source: code, seat: campaign.leadSeat ?? candidates[0].seat,
    prompt: `是否将${card.nameZh || card.name}加入一位调查员的牌组？不计入牌组张数。`, canSkip: true,
    options: [{ id: 'skip', label: '不加入牌组' }, ...candidates.map(record => ({
      id: String(record.seat), label: `加入${record.name}的牌组`,
    }))],
  })
  if (answer !== 'skip') campaignCardChange(campaign, Number(answer), code, 'add', reason)
}

// 补给品：按调查员记录在 state.campaign.supplies[seat]，同名补给可以重复购买
// （原卡：配给、药品、汽油可多次拿取）。这里不经过引擎的去重版 grantSupplies。
function supplyList(state, seat) {
  state.campaign.supplies ||= {}
  state.campaign.supplies[seat] ||= []
  return state.campaign.supplies[seat]
}

function activeRecords(state) {
  return Object.values(state.campaign.investigators)
    .filter(record => record.status === 'active')
    .sort((left, right) => left.seat - right.seat)
}

function recordLabelOf(campaign, seat) {
  const record = campaign.investigators[seat]
  return record?.name || `座位 ${seat + 1}`
}

// 幕间正文：写进日志，同时按剧情节点记录，供调查纪事只展示实际到达的段落。
function story(state, text, log) {
  if (!text) return
  log(text)
  const nodeId = state.campaign.flow?.nodeId
  if (!nodeId) return
  state.campaign.storySections ||= {}
  state.campaign.storySections[nodeId] ||= []
  state.campaign.storySections[nodeId].push(text)
}

// 战役记录写入：按 recordSchema 校验类型，避免把布尔记录写成字符串。
function writeRecord(state, key, value, log) {
  const campaign = state.campaign
  const declared = campaign.recordSchema?.[key]
  const actual = Array.isArray(value) ? 'string[]' : typeof value
  if (declared && declared !== actual) throw new Error(`战役记录 ${key} 类型应为 ${declared}`)
  campaign.records[key] = structuredClone(value)
  if (log) log(`📝 战役记录：${key} = ${Array.isArray(value) ? value.join('、') : String(value)}`)
}

function applyTrauma(state, seat, kind, amount, log) {
  if (!(amount > 0)) return
  const campaign = state.campaign
  campaign.trauma[seat] ||= { physical: 0, mental: 0 }
  campaign.trauma[seat][kind] += amount
  updateCampaignStatus(campaign, seat)
  if (log) log(`💔 ${recordLabelOf(campaign, seat)} 受到 ${amount} 点${kind === 'physical' ? '肉体' : '精神'}创伤。`)
}

// 下一场冒险的起始修正（原卡：起始资源 -3 / 起始线索 +1）。
function adjustNextScenario(state, seat, { resources = 0, clues = 0 }) {
  const campaign = state.campaign
  campaign.startingAdjustments ||= {}
  const current = campaign.startingAdjustments[seat] || { resources: 0, clues: 0 }
  campaign.startingAdjustments[seat] = {
    resources: current.resources + resources,
    clues: current.clues + clues,
  }
}

function blockNextMulligan(state, reason, log) {
  const campaign = state.campaign
  campaign.ruleFlags ||= {}
  campaign.ruleFlags.cannotMulliganOnce = true
  if (log) log(`🚫 下一场冒险开始时不能更换起始手牌（${reason}）。`)
}

function chaosTokenCount(state, token) {
  const bag = state.campaign.chaosBag || state.chaosBag || []
  return bag.filter(face => face === token).length
}

function hasSupplyAnywhere(state, name) {
  return activeRecords(state).some(record => supplyList(state, record.seat).includes(name))
}

function supplyHolders(state, name) {
  return activeRecords(state).filter(record => supplyList(state, record.seat).includes(name))
}

function leadSeatOf(state) {
  const active = activeRecords(state)
  const lead = state.campaign.leadSeat
  return active.some(record => record.seat === lead) ? lead : active[0]?.seat
}

// 幕间：毛毯。有毛毯安稳入睡，没有则辗转反侧并选择 1 点创伤。
function applySleepCheck(state, effect, log) {
  const active = activeRecords(state)
  if (!active.length) return
  const blanket = effect.supply || 'blanket'
  for (const record of active) {
    if (supplyList(state, record.seat).includes(blanket)) {
      story(state, effect.withText || '', log)
      continue
    }
    story(state, effect.withoutText || '', log)
    const answer = requestChoice(state, {
      kind: 'sleepTrauma', source: { seat: record.seat }, seat: record.seat,
      prompt: `${record.name}：没有${effect.supplyLabel || '毛毯'}，选择 1 点创伤。`,
      options: [{ id: 'physical', label: '受到 1 点肉体创伤' }, { id: 'mental', label: '受到 1 点精神创伤' }],
    })
    applyTrauma(state, record.seat, answer === 'mental' ? 'mental' : 'physical', 1, log)
  }
}

// 幕间一：队长选择一位调查员放哨。有双筒望远镜者看到树林中的身影并得到 2 XP，否则得到黑暗中的眼睛与 1 点精神创伤。
function applyLookoutCheck(state, effect, log) {
  const active = activeRecords(state)
  if (!active.length) return
  const answer = requestChoice(state, {
    kind: 'lookout', source: { seats: active.map(record => record.seat) }, seat: leadSeatOf(state),
    prompt: effect.prompt || '调查员队长必须选择一位调查员来为队伍放哨。',
    options: active.map(record => ({ id: String(record.seat), label: record.name })),
  })
  const seat = Number(answer)
  const hasBinoculars = supplyList(state, seat).includes(effect.supply || 'binoculars')
  if (hasBinoculars) {
    story(state, effect.withText || '', log)
    const xp = Number(effect.withXp || 0)
    if (xp > 0) {
      awardExperience(state.campaign, seat, xp)
      log(`⭐ ${recordLabelOf(state.campaign, seat)} 因留意树林中的身影额外获得 ${xp} XP。`)
    }
  } else {
    story(state, effect.withoutText || '', log)
    applyTrauma(state, seat, effect.withoutTrauma || 'mental', 1, log)
  }
}

// 幕间：按「是否有某种补给」分流，可写记录、给下一场起始线索或禁止换手牌。
function applySupplyCheck(state, effect, log) {
  const supply = effect.supply
  if (!supply) return
  if (effect.whenRecord && !state.campaign.records[effect.whenRecord]) {
    if (effect.skippedText) story(state, effect.skippedText, log)
    return
  }
  const holders = supplyHolders(state, supply)
  const label = effect.labels?.[supply] || effect.label || supply
  if (holders.length) {
    if (effect.promptText) story(state, effect.promptText, log)
    story(state, effect.presentText || '', log)
    for (const key of effect.recordsWhenPresent ? Object.keys(effect.recordsWhenPresent) : []) {
      writeRecord(state, key, effect.recordsWhenPresent[key], null)
    }
    if (effect.startingClues) {
      for (const record of holders) adjustNextScenario(state, record.seat, { clues: effect.startingClues })
      log(`🧩 带有${label}的调查员在下一场冒险时起始线索 +${effect.startingClues}。`)
    }
    if (effect.presentXp) {
      for (const record of holders) awardExperience(state.campaign, record.seat, effect.presentXp)
      log(`⭐ 带有${label}的调查员各获得 ${effect.presentXp} XP。`)
    }
  } else {
    if (effect.promptText) story(state, effect.promptText, log)
    story(state, effect.absentText || '', log)
    for (const key of effect.recordsWhenAbsent ? Object.keys(effect.recordsWhenAbsent) : []) {
      writeRecord(state, key, effect.recordsWhenAbsent[key], null)
    }
    if (effect.absentMulliganBlock) blockNextMulligan(state, `没有${label}`, log)
  }
}

// 幕间二：古代遗物的保管人二选一（只有在取回遗物时才会发生）。
function applyRelicCustody(state, effect, log) {
  const campaign = state.campaign
  if (effect.guardRecord && !campaign.records[effect.guardRecord]) {
    story(state, effect.otherwiseText || '', log)
    return
  }
  story(state, effect.introText || '', log)
  const options = (effect.options || []).filter(option => option?.id)
  if (!options.length) return
  const answer = requestChoice(state, {
    kind: 'relicCustody', source: { options: options.map(option => option.id) }, seat: leadSeatOf(state),
    prompt: effect.prompt || '调查员队长必须决定遗物交给谁保管。',
    options: options.map(option => ({ id: option.id, label: option.label || option.id })),
  })
  const chosen = options.find(option => option.id === answer) || options[0]
  story(state, chosen.text || '', log)
  for (const [key, value] of Object.entries(chosen.records || {})) writeRecord(state, key, value, null)
  if (chosen.token) {
    changeChaosBag(state, chosen.token, 1, { permanent: true })
    log(`🎲 混乱袋永久加入 1 个 ${chosen.token} 标记。`)
  }
  if (chosen.storyCard) {
    const target = leadSeatOf(state)
    const owned = Object.values(campaign.investigators).some(record => record.deck.includes(chosen.storyCard))
    if (!owned) {
      campaignCardChange(campaign, target, chosen.storyCard, 'add', 'interludeTwo')
      log(`🃏 ${recordLabelOf(campaign, target)} 的牌组加入「${ALL_CARDS[chosen.storyCard]?.nameZh || chosen.storyCard}」。`)
    }
  }
  if (effect.afterText) story(state, effect.afterText, log)
}

// 幕间三：伊塔卡的信念。混乱袋至少 2 个异教徒标记 + 建立纽带 + 对你有信心。
function applyIchtacaFaith(state, effect, log) {
  const campaign = state.campaign
  const cultistCount = chaosTokenCount(state, effect.token || 'cultist')
  const needTokens = effect.tokenCount || 2
  const recordKeys = effect.records || []
  const tokensOk = cultistCount >= needTokens
  const recordsOk = recordKeys.every(key => campaign.records[key])
  story(state, `${tokensOk ? '✓' : '✗'} ${effect.checklist?.cultistCount || '混乱袋中至少有 2 个异教徒标记'}（当前 ${cultistCount} 个）`, log)
  for (const [index, key] of recordKeys.entries()) {
    const label = (effect.recordLabels || [])[index] || key
    story(state, `${campaign.records[key] ? '✓' : '✗'} ${label}`, log)
  }
  if (tokensOk && recordsOk) {
    story(state, effect.passText || '', log)
    if (effect.record) writeRecord(state, effect.record, true, null)
    if (effect.addToken) {
      changeChaosBag(state, effect.addToken, 1, { permanent: true })
      log(`🎲 混乱袋永久加入 1 个 ${effect.addToken} 标记。`)
    }
    return
  }
  if (effect.failText) story(state, effect.failText, log)
}

// 幕间四：恢复意识与否。混乱袋 2 个石板标记 + 解救亚历山卓 + 上一场控制住看管人。
function applyAlejandroMind(state, effect, log) {
  const campaign = state.campaign
  const tabletCount = chaosTokenCount(state, effect.token || 'tablet')
  story(state, `${tabletCount === (effect.tokenCount || 2) ? '✓' : '✗'} ${effect.checklist?.tabletCount || '混乱袋中有至少 2 个石板标记'}（当前 ${tabletCount} 个）`, log)
  const rescued = effect.records.every(key => campaign.records[key])
  story(state, `${rescued ? '✓' : '✗'} ${effect.checklist?.rescuedAlejandro || '调查员解救了亚历山卓。'}`, log)
  const custodian = effect.flag ? campaign.ruleFlags?.[effect.flag] === true : true
  story(state, `${custodian ? '✓' : '✗'} ${effect.checklist?.theCustodianWasUnderControl || '在上一场冒险结束时，看管人受调查员控制。'}`, log)
  if (tabletCount === (effect.tokenCount || 2) && rescued && custodian) {
    story(state, effect.passText || '', log)
    if (effect.passRecord) writeRecord(state, effect.passRecord, true, null)
    if (effect.passToken) {
      changeChaosBag(state, effect.passToken, 1, { permanent: true })
      log(`🎲 混乱袋永久加入 1 个 ${effect.passToken} 标记。`)
    }
    return
  }
  story(state, effect.failText || '', log)
  if (effect.failRecord) writeRecord(state, effect.failRecord, true, null)
  if (effect.removeCard) removeCardFromDecks(campaign, effect.removeCard, 'interludeFour', log)
}

// 幕间四：归位程式反效果。按混乱袋揭示标记决定离体体验弱点与伊斯人身体。
function applyOutOfBodyProcess(state, effect, log) {
  const campaign = state.campaign
  const backfired = campaign.records[effect.backfiredRecord]
  const spectacular = campaign.records[effect.spectacularRecord]
  if (!backfired && !spectacular) {
    if (effect.skippedText) story(state, effect.skippedText, log)
    return
  }
  story(state, effect.introText || '', log)
  const bag = campaign.chaosBag || state.chaosBag || []
  if (!bag.length) return
  const draws = spectacular ? 2 : 1
  const yithian = []
  for (const record of activeRecords(state)) {
    const revealed = []
    for (let n = 0; n < draws; n++) revealed.push(bag[Math.floor(randomValue(state) * bag.length)])
    const stuckAsYithian = revealed.some(face => ['cultist', 'tablet', 'elderthing', 'autofail'].includes(face))
    const outOfBody = stuckAsYithian || revealed.some(face => face === 'skull'
      || (/^-?\d+$/.test(face) && face !== '+1'))
    log(`🎲 ${record.name} 揭示：${revealed.join('、')}。`)
    if (outOfBody) {
      if (effect.weakness && ALL_CARDS[effect.weakness] && !record.deck.includes(effect.weakness)) {
        campaignCardChange(campaign, record.seat, effect.weakness, 'add', 'outOfBody')
      }
      story(state, `${record.name}：${effect.lines?.outOfBody || '获得离体体验弱点。'}`, log)
    } else {
      story(state, `${record.name}：${effect.lines?.none || '不承受负面效果。'}`, log)
    }
    if (stuckAsYithian) {
      yithian.push(record.seat)
      story(state, `${record.name}：${effect.lines?.yithian || '必须使用伊斯人身体调查员卡牌。'}`, log)
    }
  }
  if (yithian.length) {
    campaign.ruleFlags ||= {}
    campaign.ruleFlags.yithianBodySeats = yithian
    if (effect.yithianBody) log(`🧬 这些调查员在本战役余下时间使用「${ALL_CARDS[effect.yithianBody]?.nameZh || effect.yithianBody}」：${yithian.map(seat => recordLabelOf(campaign, seat)).join('、')}。`)
  }
}

// 幕间五：古代遗物的读数。找回遗物读神秘的嗡嗡声，否则读日益忧虑并加入负值标记。
function applyRelicReadings(state, effect, log) {
  const campaign = state.campaign
  story(state, effect.introText || '', log)
  const found = campaign.records[effect.foundRecord]
  if (found) {
    story(state, effect.foundText || '', log)
  } else {
    story(state, effect.missingText || '', log)
    const token = effect.tokens?.[state.difficulty] || effect.tokens?.standard
    if (token) {
      changeChaosBag(state, token, 1, { permanent: true })
      log(`🎲 混乱袋永久加入 1 个 ${token} 标记。`)
    }
  }
  const recovered = effect.recoveredRecord ? campaign.records[effect.recoveredRecord] : true
  const forging = effect.forgingRecord ? campaign.records[effect.forgingRecord] : true
  if (found && recovered && forging) {
    story(state, effect.finalDawningText || '', log)
    for (const code of effect.previousRelicCodes || []) removeCardFromDecks(campaign, code, 'interludeFive')
    const owner = Object.values(campaign.investigators)
      .find(record => record.status === 'active' && (effect.finalDawningCard && record.deck.includes(effect.finalDawningCard)))
    const target = owner || campaign.investigators[leadSeatOf(state)]
    if (effect.finalDawningCard && target) {
      campaignCardChange(campaign, target.seat, effect.finalDawningCard, 'add', 'interludeFive')
      log(`🃏 ${target.name} 的牌组加入「${ALL_CARDS[effect.finalDawningCard]?.nameZh || effect.finalDawningCard}」。`)
    }
  }
}

// 幕间五结尾：深渊中无法再使用药品与配给，全部划掉。
function applyDiscardSupplies(state, effect, log) {
  if (effect.text) story(state, effect.text, log)
  for (const record of activeRecords(state)) {
    const list = supplyList(state, record.seat)
    const removed = []
    for (const name of effect.supplies || []) {
      while (list.includes(name)) {
        list.splice(list.indexOf(name), 1)
        removed.push(name)
      }
    }
    if (removed.length) {
      log(`✂️ ${record.name} 划掉了 ${removed.map(name => effect.labels?.[name] || name).join('、')}。`)
    }
  }
}

// 补给点：花 3 XP 移除中毒弱点，花 5 XP 移除 1 点肉体或精神创伤。
function applyResupplyServices(state, effect, log) {
  const campaign = state.campaign
  const poison = effect.poisonCode || poisonWeaknessCode()
  for (const record of activeRecords(state)) {
    const poisoned = record.deck.includes(poison)
    if (poisoned && record.xp >= (effect.poisonCost || 3)) {
      const answer = requestChoice(state, {
        kind: 'resupplyPoison', source: { seat: record.seat }, seat: record.seat, canSkip: true,
        prompt: `${record.name}：可以花 3 XP 把「中毒」弱点从牌库移除（当前 ${record.xp} XP）。`,
        options: [{ id: 'skip', label: '不处理中毒' },
          { id: 'cure', label: `花费 ${effect.poisonCost || 3} XP 移除中毒弱点` }],
      })
      if (answer === 'cure') {
        record.xp -= effect.poisonCost || 3
        record.spentXp = (record.spentXp || 0) + (effect.poisonCost || 3)
        campaignCardChange(campaign, record.seat, poison, 'remove', 'stMarys')
        campaign.xp = Object.values(campaign.investigators).reduce((sum, item) => sum + item.xp, 0)
        log(`🏥 ${record.name} 花 ${effect.poisonCost || 3} XP 移除了中毒弱点。`)
      }
    }
    const trauma = campaign.trauma[record.seat] || { physical: 0, mental: 0 }
    const options = []
    if (trauma.physical > 0 && record.xp >= (effect.traumaCost || 5)) options.push({ id: 'physical', label: `花费 ${effect.traumaCost || 5} XP 移除 1 点肉体创伤` })
    if (trauma.mental > 0 && record.xp >= (effect.traumaCost || 5)) options.push({ id: 'mental', label: `花费 ${effect.traumaCost || 5} XP 移除 1 点精神创伤` })
    if (!options.length) continue
    const answer = requestChoice(state, {
      kind: 'resupplyTrauma', source: { seat: record.seat }, seat: record.seat, canSkip: true,
      prompt: `${record.name}：可以在圣玛丽医院治疗创伤（当前 ${record.xp} XP）。`,
      options: [{ id: 'skip', label: '不治疗创伤' }, ...options],
    })
    if (answer === 'skip') continue
    record.xp -= effect.traumaCost || 5
    record.spentXp = (record.spentXp || 0) + (effect.traumaCost || 5)
    campaign.trauma[record.seat][answer] = Math.max(0, campaign.trauma[record.seat][answer] - 1)
    updateCampaignStatus(campaign, record.seat)
    campaign.xp = Object.values(campaign.investigators).reduce((sum, item) => sum + item.xp, 0)
    log(`🏥 ${record.name} 花 ${effect.traumaCost || 5} XP 移除了 1 点${answer === 'physical' ? '肉体' : '精神'}创伤。`)
  }
}

// 按记录分流的幕间正文（落下深渊 / 接近联结点等）。
function applyStoryBranch(state, effect, log) {
  const branches = effect.when || []
  const hit = branches.find(branch => state.campaign.records[branch.record] === (branch.equals ?? true))
  if (hit?.text) story(state, hit.text, log)
  else if (effect.fallbackText) story(state, effect.fallbackText, log)
  if (effect.afterText) story(state, effect.afterText, log)
}

function removeCardFromDecks(campaign, code, reason, log = null) {
  let removed = 0
  for (const record of Object.values(campaign.investigators)) {
    if (record.status !== 'active') continue
    while (record.deck.includes(code)) {
      campaignCardChange(campaign, record.seat, code, 'remove', reason)
      removed++
    }
  }
  if (removed && log) log(`🃏 移除了牌组中的「${ALL_CARDS[code]?.nameZh || code}」。`)
  return removed
}

// 序幕与补给点：每位调查员用补给品点数逐项购买补给品。
function applyPickSupplies(state, effect, log) {
  const campaign = state.campaign
  const active = activeRecords(state)
  if (!active.length) return
  const costs = effect.costs || {}
  const labels = effect.labels || {}
  const points = Number((effect.points || {})[active.length] ?? 0)
  const template = effect.prompt || '选择补给品(剩余{pointsRemaining}点补给品点数)'
  campaign.supplyPoints ||= {}
  for (const record of active) {
    let remaining = points
    campaign.supplyPoints[record.seat] = remaining
    for (let guard = 0; guard < 64; guard++) {
      const affordable = (effect.options || []).filter(name => (costs[name] ?? 0) <= remaining)
      if (!affordable.length) break
      const answer = requestChoice(state, {
        kind: 'pickSupplies',
        source: { context: effect.context || 'prologue', seat: record.seat, remaining, bought: supplyList(state, record.seat).length },
        seat: record.seat,
        prompt: `${recordLabelOf(campaign, record.seat)}：${template.replace('{pointsRemaining}', String(remaining))}`,
        options: [
          { id: 'done', label: '完成购买（剩余点数不退还）' },
          ...affordable.map(name => ({ id: name, label: `${labels[name] || name}（${costs[name] ?? 0} 点）` })),
        ],
      })
      if (answer === 'done') break
      supplyList(state, record.seat).push(answer)
      remaining -= costs[answer] ?? 0
      campaign.supplyPoints[record.seat] = remaining
      log(`🎒 ${recordLabelOf(campaign, record.seat)} 购买了补给「${labels[answer] || answer}」，剩余 ${remaining} 点补给品点数。`)
    }
    if (remaining > 0) log(`${recordLabelOf(campaign, record.seat)} 未使用的补给品点数（${remaining}）作废。`)
  }
}

// 「共同划掉等于调查员人数的配给」：由调查队共同决定每份配给从谁的清单里划掉。
function applyCrossOffSupply(state, effect, log) {
  const campaign = state.campaign
  const active = activeRecords(state)
  if (!active.length || !effect.supply) return
  const labels = effect.labels || {}
  const label = labels[effect.supply] || effect.label || effect.supply
  const total = effect.perInvestigator ? active.length : Math.max(0, Number(effect.count ?? 1))
  const lead = active.some(record => record.seat === campaign.leadSeat) ? campaign.leadSeat : active[0].seat
  let crossed = 0
  for (let index = 0; index < total; index++) {
    const holders = active.filter(record => supplyList(state, record.seat).includes(effect.supply))
    if (!holders.length) break
    const answer = requestChoice(state, {
      kind: 'crossOffSupply',
      source: { supply: effect.supply, index, total },
      seat: holders.some(record => record.seat === lead) ? lead : holders[0].seat,
      prompt: `检查你们的补给品：共同划掉 ${total} 个${label}（已划 ${crossed}）。选择这一份由谁划掉。`,
      options: holders.map(record => ({
        id: String(record.seat),
        label: `${record.name}（持有 ${supplyList(state, record.seat).filter(name => name === effect.supply).length} 个）`,
      })),
    })
    const seat = Number(answer)
    const list = supplyList(state, seat)
    list.splice(list.indexOf(effect.supply), 1)
    crossed++
    log(`✂️ ${recordLabelOf(campaign, seat)} 划掉了 1 个${label}（${crossed}/${total}）。`)
  }
  if (total > crossed) {
    if (effect.shortageMulliganBlock) blockNextMulligan(state, `没有${label}`, log)
    const missing = total - crossed
    for (let index = 0; index < missing; index++) {
      if (!effect.shortageChoice) {
        log(`⚠️ 还差 ${missing} 个${label}：${effect.shortageText || '你们的补给不足。'}`)
        break
      }
      // 每少一份补给：由队长选择一位调查员阅读「配给不足」，该调查员下一场冒险起始资源减少。
      const answer = requestChoice(state, {
        kind: 'shortage',
        source: { supply: effect.supply, index, missing },
        seat: lead,
        prompt: `还差 ${missing - index} 个${label}：选择一位调查员阅读「配给不足」。`,
        options: active.map(record => ({ id: String(record.seat), label: record.name })),
      })
      const seat = Number(answer)
      if (effect.shortageText) story(state, effect.shortageText, log)
      const penalty = Number(effect.shortageChoice.resources ?? -3)
      adjustNextScenario(state, seat, { resources: penalty })
      log(`📉 ${recordLabelOf(campaign, seat)} 下一场冒险的起始资源 ${penalty}。`)
    }
  }
}

// 「每位带有药品的调查员可以划掉药品，移除任意一位调查员牌库中的中毒弱点」。
function applyCurePoisonedWithMedicine(state, effect, log) {
  const campaign = state.campaign
  const active = activeRecords(state)
  const medicine = effect.medicine || 'medicine'
  const poison = effect.poisonCode || poisonWeaknessCode()
  const labels = effect.labels || {}
  const label = labels[medicine] || '药品'
  const poisoned = seat => (campaign.investigators[seat]?.deck || []).includes(poison)
  for (const donor of active) {
    if (!supplyList(state, donor.seat).includes(medicine)) continue
    const targets = active.filter(record => poisoned(record.seat))
    if (!targets.length) break
    const answer = requestChoice(state, {
      kind: 'curePoison',
      source: { seat: donor.seat, targets: targets.map(record => record.seat) },
      seat: donor.seat,
      canSkip: true,
      prompt: `${donor.name}：可以划掉 1 个${label}，移除任意一位调查员牌库中的「${effect.poisonLabel || '中毒'}」弱点。`,
      options: [{ id: 'skip', label: `不划掉${label}` },
        ...targets.map(record => ({ id: String(record.seat), label: `移除${record.name}牌库中的${effect.poisonLabel || '中毒'}弱点` }))],
    })
    if (answer === 'skip') continue
    const seat = Number(answer)
    const list = supplyList(state, donor.seat)
    list.splice(list.indexOf(medicine), 1)
    campaignCardChange(campaign, seat, poison, 'remove', 'medicine')
    log(`💊 ${donor.name} 划掉了 1 个${label}，移除了${recordLabelOf(campaign, seat)}牌库中的「${effect.poisonLabel || '中毒'}」。`)
  }
  for (const record of active.filter(record => poisoned(record.seat))) {
    story(state, effect.toxicityText || `☠️ ${record.name}：毒性仍在扩散。`, log)
    applyTrauma(state, record.seat, effect.toxicityTrauma || 'physical', 1, log)
  }
}

// 序幕：在厄休拉／里奥／蒙特雷之间指定远征求领队。
function applyExpeditionLeaderChoice(state, effect, log) {
  const campaign = state.campaign
  const candidates = activeRecords(state).filter(record => (effect.candidates || []).includes(record.code))
  if (!candidates.length) return
  const answer = requestChoice(state, {
    kind: 'expeditionLeader',
    source: { candidates: [...(effect.candidates || [])] },
    seat: candidates.some(record => record.seat === campaign.leadSeat) ? campaign.leadSeat : candidates[0].seat,
    prompt: effect.prompt || '选择他们之中的一位调查员担任本次探险的队长。',
    options: candidates.map(record => ({ id: String(record.seat), label: record.name })),
  })
  const seat = Number(answer)
  state.expeditionLeaderSeat = seat
  campaign.expeditionLeader = seat
  log(`🧭 ${recordLabelOf(campaign, seat)} 成为远征求领队。`)
}

export function applyCampaignEffect(state, effect, log) {
  if (effect.type === 'chaos') changeChaosBag(state, effect.token, effect.amount, { permanent: true })
  else if (effect.type === 'log') log(effect.text)
  else if (effect.type === 'storyCard') awardStoryCard(state, effect.code, state.campaign.flow.nodeId)
  else if (effect.type === 'recordUnion') {
    if (!Array.isArray(effect.values) || effect.values.some(value => typeof value !== 'string')) {
      throw new Error('集合记录必须是字符串数组')
    }
    const current = state.campaign.records[effect.key] || []
    if (!Array.isArray(current)) throw new Error(`战役记录 ${effect.key} 不是集合`)
    state.campaign.records[effect.key] = [...new Set([...current, ...effect.values])]
  } else if (effect.type === 'recordRemove') {
    if (!Array.isArray(effect.values)) throw new Error('划掉记录必须是数组')
    const removed = new Set(effect.values)
    state.campaign.records[effect.key] = (state.campaign.records[effect.key] || [])
      .filter(value => !removed.has(value))
  } else if (effect.type === 'replaceChaosFamily') {
    const family = new Set(['cultist', 'tablet', 'elderthing'])
    if (!Array.isArray(effect.tokens) || effect.tokens.some(token => !family.has(token))) {
      throw new Error('卡尔克萨符号族替换无效')
    }
    const replace = bag => [...(bag || []).filter(token => !family.has(token)), ...effect.tokens]
    state.campaign.chaosBag = replace(state.campaign.chaosBag)
    if (state.chaosBag) state.chaosBag = replace(state.chaosBag)
  } else if (effect.type === 'campaignRuleFlag') {
    state.campaign.ruleFlags ||= {}
    state.campaign.ruleFlags[effect.key] = effect.value ?? true
  } else if (effect.type === 'privateStory') {
    const audience = effect.audienceRecord
      ? state.campaign.records[effect.audienceRecord] || []
      : effect.audienceInvestigatorIds || []
    state.campaign.privateStories ||= []
    state.campaign.privateStories.push({
      id: effect.id,
      title: effect.title,
      text: effect.text,
      audienceInvestigatorIds: [...new Set(audience)],
    })
  } else if (effect.type === 'campaignWeakness') {
    const code = effect.code
    const active = Object.entries(state.campaign.investigators)
      .filter(([, record]) => record.status === 'active')
    if (!active.length || active.some(([, record]) => record.deck.includes(code))) return
    let target = active.find(([, record]) => record.seat === state.campaign.leadSeat)
    if (!target) target = active[0]
    campaignCardChange(state.campaign, target[1].seat, code, 'add', effect.reason || 'campaign')
    state.campaign.records[effect.bearerRecord || 'pallidMaskBearer'] = target[1].id
  } else if (effect.type === 'transferCampaignWeakness') {
    const key = effect.bearerRecord || 'pallidMaskBearer'
    const currentId = state.campaign.records[key]
    const current = Object.values(state.campaign.investigators)
      .find(record => record.id === currentId)
    if (current?.status === 'active') return
    const next = Object.entries(state.campaign.investigators)
      .find(([, record]) => record.status === 'active')
    if (!next) return
    if (current?.deck.includes(effect.code)) {
      campaignCardChange(state.campaign, current.seat, effect.code, 'remove', 'bearer-transfer')
    }
    if (!next[1].deck.includes(effect.code)) {
      campaignCardChange(state.campaign, next[1].seat, effect.code, 'add', 'bearer-transfer')
    }
    state.campaign.records[key] = next[1].id
  }
  else if (effect.type === 'dunwichSurvivors') resolveSurvivors(state)
  else if (effect.type === 'pickSupplies') applyPickSupplies(state, effect, log)
  else if (effect.type === 'crossOffSupply') applyCrossOffSupply(state, effect, log)
  else if (effect.type === 'curePoisonedWithMedicine') applyCurePoisonedWithMedicine(state, effect, log)
  else if (effect.type === 'expeditionLeader') applyExpeditionLeaderChoice(state, effect, log)
  else if (effect.type === 'sleepCheck') applySleepCheck(state, effect, log)
  else if (effect.type === 'lookoutCheck') applyLookoutCheck(state, effect, log)
  else if (effect.type === 'supplyCheck') applySupplyCheck(state, effect, log)
  else if (effect.type === 'relicCustody') applyRelicCustody(state, effect, log)
  else if (effect.type === 'ichtacaFaith') applyIchtacaFaith(state, effect, log)
  else if (effect.type === 'alejandroMind') applyAlejandroMind(state, effect, log)
  else if (effect.type === 'outOfBodyProcess') applyOutOfBodyProcess(state, effect, log)
  else if (effect.type === 'relicReadings') applyRelicReadings(state, effect, log)
  else if (effect.type === 'discardSupplies') applyDiscardSupplies(state, effect, log)
  else if (effect.type === 'resupplyServices') applyResupplyServices(state, effect, log)
  else if (effect.type === 'storyBranch') applyStoryBranch(state, effect, log)
  else if (effect.type === 'experience') {
    if (!Number.isSafeInteger(effect.amount) || effect.amount < 0) throw new Error('经验奖励必须为非负整数')
    for (const record of Object.values(state.campaign.investigators)) {
      if (record.status !== 'active') continue
      awardExperience(state.campaign, record.seat, effect.amount)
      log(`${record.name} 获得 ${effect.amount} XP。`)
    }
  } else throw new Error('未注册的战役效果：' + effect.type)
}

// ---------------------------------------------------------------------------
// Phase 3（D4）：战役结果声明化
//
// 此前 `resolution` 钩子把「结局写哪些记录、给谁创伤、多少经验」直接写在 behavior.js
// 的函数体里（23 个关卡、122 处记录赋值）。这些结果现在可以声明成数据：
//
//   resolution(state, key, events, api) {
//     return {
//       bonus: 2, award: key !== 'r3',
//       effects: [
//         { record: { houseBurned: false }, when: { not: { resolution: 'r1' } } },
//         { record: { houseBurned: true }, when: { resolution: 'r1' } },
//         { record: { litaForcedOthers: true }, when: { resolution: 'r3' },
//           investigatorStatus: 'killed', targets: 'notResigned' },
//         { when: { resolution: 'r1' }, trauma: { lead: { mental: 1 } } },
//       ],
//     }
//   }
//
// 条目字段（只允许这些，未知字段在结算时抛错，不静默忽略）：
//   when               条件（见 matchesResultCondition）：resolution / resolutionIn /
//                      record / recordTruthy / failed / all / any / not
//   text               写进日志/纪事的正文
//   record             写战役记录（按 campaign.recordSchema 校验类型与键是否存在）
//   recordUnion        集合并入（string[]）
//   recordRemove       集合划掉（string[]）
//   trauma             创伤：{ <target>: { physical, mental } }
//   xp                 经验：{ amount, targets }
//   targets            把「作用于谁」作为条目级默认值（trauma/xp/investigatorStatus 共用）
//   investigatorStatus 战役状态：'killed' / 'insane' / 'active'
//   failed             把战役标记为失败
//   storyCard          把一张剧情资产加入牌组（会询问由谁携带）
//   chaos              混乱袋永久加入标记：{ token, amount }
//   flag               战役规则标记：{ key, value }
//
// targets 取 'lead' / 'all' / 'active' / 'notResigned' / 'notDefeated' / 座位号。
// 记录写入必须能在 recordSchema 里找到键，缺失即抛错——这项校验旧行为的直接赋值没有。
// ---------------------------------------------------------------------------

export const RESULT_EFFECT_KEYS = Object.freeze([
  'when', 'text', 'record', 'recordUnion', 'recordRemove', 'trauma', 'xp', 'targets',
  'investigatorStatus', 'failed', 'storyCard', 'chaos', 'flag',
])

const RESULT_EFFECT_KEY_SET = new Set(RESULT_EFFECT_KEYS)

function resultTargetSeats(state, target) {
  const investigators = state.campaign.investigators || {}
  const all = Object.values(investigators).sort((left, right) => left.seat - right.seat)
  const runtimeOf = seat => state.investigators?.[seat]
  switch (target) {
    case undefined:
    case null:
    case 'all': return all.map(record => record.seat)
    case 'active': return all.filter(record => record.status === 'active').map(record => record.seat)
    // 撤退/败退是「本场冒险」的事实，读执行中的调查员状态而不是战役记录状态。
    case 'notResigned': return all.filter(record => !runtimeOf(record.seat)?.resigned).map(record => record.seat)
    case 'notDefeated': return all.filter(record => !runtimeOf(record.seat)?.defeated).map(record => record.seat)
    case 'lead': return [state.campaign.leadSeat].filter(seat => Number.isInteger(seat))
    default:
      if (Number.isInteger(target)) return [target]
      throw new Error(`未知战役结果目标：${String(target)}`)
  }
}

function resultRecord(state, key) {
  return state.campaign.records?.[key]
}

export function matchesResultCondition(state, condition) {
  if (condition == null) return true
  if (typeof condition !== 'object' || Array.isArray(condition)) throw new Error('战役结果条件必须是对象')
  if (condition.all) return condition.all.every(item => matchesResultCondition(state, item))
  if (condition.any) return condition.any.some(item => matchesResultCondition(state, item))
  if (condition.not) return !matchesResultCondition(state, condition.not)
  if (condition.resolution != null && state.resolution !== condition.resolution) return false
  if (condition.resolutionIn && !condition.resolutionIn.includes(state.resolution)) return false
  if (condition.record != null) {
    const expected = condition.equals === undefined ? true : condition.equals
    if (resultRecord(state, condition.record) !== expected) return false
  }
  if (condition.recordTruthy != null && !resultRecord(state, condition.recordTruthy)) return false
  if (condition.failed != null && Boolean(state.campaign.failed) !== condition.failed) return false
  return true
}

function writeResultRecord(state, key, value, log) {
  const campaign = state.campaign
  if (!Object.hasOwn(campaign.recordSchema || {}, key)) throw new Error(`未声明战役记录 ${key}`)
  const declared = campaign.recordSchema[key]
  const actual = Array.isArray(value) ? 'string[]' : typeof value
  if (declared !== actual) throw new Error(`战役记录 ${key} 类型应为 ${declared}`)
  campaign.records[key] = structuredClone(value)
  if (log) log(`📝 战役记录：${key} = ${Array.isArray(value) ? value.join('、') : String(value)}`)
}

function applyTraumaResult(state, seats, trauma, log) {
  for (const seat of seats) {
    for (const kind of ['physical', 'mental']) {
      const amount = trauma[kind] || 0
      if (!(amount > 0)) continue
      applyTrauma(state, seat, kind, amount, log)
    }
  }
}

// 结算 `resolution` 返回的声明式结果（在 finishScenario 的记录快照之前调用）。
export function applyResolutionResults(state, effects, { log = () => {}, runtime = null } = {}) {
  if (effects == null) return 0
  if (!Array.isArray(effects)) throw new Error('resolution.effects 必须是数组')
  const campaign = state.campaign
  let applied = 0
  for (const effect of effects) {
    if (!effect || typeof effect !== 'object' || Array.isArray(effect)) throw new Error('战役结果条目必须是对象')
    for (const key of Object.keys(effect)) {
      if (!RESULT_EFFECT_KEY_SET.has(key)) throw new Error(`战役结果条目未知字段 ${key}`)
    }
    if (!matchesResultCondition(state, effect.when)) continue
    applied++
    if (effect.text) log(effect.text)
    for (const [key, value] of Object.entries(effect.record || {})) writeResultRecord(state, key, value, log)
    for (const [key, values] of Object.entries(effect.recordUnion || {})) {
      if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) {
        throw new Error(`战役结果集合记录 ${key} 必须是字符串数组`)
      }
      writeResultRecord(state, key, [...new Set([...(campaign.records[key] || []), ...values])], log)
    }
    for (const [key, values] of Object.entries(effect.recordRemove || {})) {
      if (!Array.isArray(values)) throw new Error(`战役结果划掉记录 ${key} 必须是数组`)
      const removed = new Set(values)
      writeResultRecord(state, key, (campaign.records[key] || []).filter(value => !removed.has(value)), log)
    }
    const seats = resultTargetSeats(state, effect.targets)
    if (effect.trauma) applyTraumaResult(state, seats, effect.trauma.all || effect.trauma, log)
    if (effect.trauma?.lead) applyTraumaResult(state, resultTargetSeats(state, 'lead'), effect.trauma.lead, log)
    if (effect.xp) {
      const amount = typeof effect.xp === 'number' ? effect.xp : effect.xp.amount
      if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('经验奖励必须为非负整数')
      for (const seat of resultTargetSeats(state, effect.xp?.targets ?? effect.targets ?? 'active')) {
        awardExperience(campaign, seat, amount)
        log(`⭐ ${recordLabelOf(campaign, seat)} 获得 ${amount} XP。`)
      }
    }
    if (effect.investigatorStatus) {
      for (const seat of seats) {
        const record = campaign.investigators[seat]
        if (!record) continue
        record.status = effect.investigatorStatus
        updateCampaignStatus(campaign, seat)
      }
    }
    if (effect.failed) campaign.failed = true
    if (effect.storyCard) awardStoryCard(state, effect.storyCard, campaign.flow?.nodeId)
    if (effect.chaos) changeChaosBag(state, effect.chaos.token, effect.chaos.amount ?? 1, { permanent: true })
    if (effect.flag) {
      campaign.ruleFlags ||= {}
      campaign.ruleFlags[effect.flag.key] = effect.flag.value ?? true
    }
  }
  return applied
}
