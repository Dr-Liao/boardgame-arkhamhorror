import { SUSPECTS, HIDEOUTS, suspectCode, hideoutCode, suspectRole, hideoutRole } from './role-data.js'
import { checkParallelActObjectives } from '../../../src/engine/parallel-acts.js'
import { recordSetRemove } from '../../../src/campaign/record-sets.js'
import { scenarioIntroduction, suppressIntroPresentation } from './introduction.js'
import { resolveChapter } from './resolutions.js'
import { resolveFlashback } from './flashbacks.js'
import { registeredEntry } from '../../../src/engine/ability.js'
import { chapterActBackSetup } from './late-setup.js'

// Stage readers dispatch to the physical card entry; no card text lives here.
export const entryRules = {
  introduction: scenarioIntroduction, suppressIntroPresentation,
  resolveChaosToken(state,inv,token,api) {return registeredEntry(state.scenario.referenceCode)?.scenarioRule?.resolveChaosToken?.(state,inv,token,api)},
  applyTokenEffect(state,inv,effect,api) {return registeredEntry(state.scenario.referenceCode)?.scenarioRule?.applyTokenEffect?.(state,inv,effect,api)},
  afterTest(state,inv,result,api,context) {return registeredEntry(state.scenario.referenceCode)?.scenarioRule?.afterTest?.(state,inv,result,api,context)},
  testAutoFail(state,inv,context) {return registeredEntry(state.scenario.referenceCode)?.scenarioRule?.testAutoFail?.(state,inv,context)===true},
  resolveFlashback,
  scenarioCardsSeen(state,deck,seat,cards) {
    if(deck!=='leads')return
    state.scenarioFlags.crossedOff ||= []
    for(const code of cards) {
      if(SUSPECTS[code])recordSetRemove(state.campaign,'possibleSuspects',SUSPECTS[code])
      if(HIDEOUTS[code])recordSetRemove(state.campaign,'possibleHideouts',HIDEOUTS[code])
      if(!state.scenarioFlags.crossedOff.includes(code))state.scenarioFlags.crossedOff.push(code)
    }
  },
  resolution: resolveChapter,
  // 全员撤退：引擎先给当前幕一次「目标已达成」的结算机会，再走默认 noResolution。
  // 条目在 `actRule.allResigned` 声明（数据驱动分派，内容层不写卡号分支）。
  allResigned(state, api) {
    const act = state.acts?.[state.actIndex]
    const rule = registeredEntry(act?.originalCode || act?.code)?.actRule
    return rule?.allResigned?.(state, act, api)
  },
  cardAddedToHand(state,inv,code) {
    if(state.scenario.id!=='aLightInTheFog'||!['07179','07180','07181'].includes(code))return
    state.scenarioFlags.relicsAddedToHand ||= []
    if(!state.scenarioFlags.relicsAddedToHand.includes(code))state.scenarioFlags.relicsAddedToHand.push(code)
  },
  actReveal(state, act, api) {
    const rule = registeredEntry(act.originalCode || act.code)?.actRule
    // P7：幕背面需要「章节级布置」时，条目只声明 `actRule.chapterSetup`（数据键），
    // 内容层从 chapter-data 的 setup[键] 读取布置数据；不在内容层写卡号分支。
    if (typeof rule?.chapterSetup === 'string') return chapterActBackSetup(state, act, api, rule.chapterSetup, rule)
    if (typeof rule?.onReveal !== 'function') throw new Error(`Innsmouth act is not implemented: ${act.originalCode || act.code}`)
    return rule.onReveal(state, act, api)
  },
  agendaReveal(state, agenda, api) {
    const rule = registeredEntry(agenda.originalCode || agenda.code)?.agendaRule
    if (typeof rule?.onReveal !== 'function') throw new Error(`Innsmouth agenda is not implemented: ${agenda.originalCode || agenda.code}`)
    return rule.onReveal(state, agenda, api)
  },
  // 议程正面「进行期间的持续/静默强制」：条目在 `agendaRule.phaseBegan` 声明，内容层只做
  // 数据驱动分派（读点：turn.js#phaseBeginningWindow），不在内容层写卡号分支。
  phaseBegan(state, phase, api) {
    const agenda = state.agendas?.[state.agendaIndex]
    const rule = registeredEntry(agenda?.originalCode || agenda?.code)?.agendaRule
    rule?.phaseBegan?.(state, agenda, phase, api)
  },
  // P7：《深陷其中》议程「每个[[嫌犯]]敌人失去冷漠 / 不能与之谈判」。引擎在 aloof 判定与
  // parley 合法性处先问这两个读点；条目在当前幕/议程的 `enemyLosesAloof`/`parleyBlocked` 声明。
  enemyLosesAloof(state, enemy) {
    return stageRules(state).some(rule => rule.enemyLosesAloof?.(state, enemy) === true)
  },
  parleyBlocked(state, inv, entity, entityType) {
    return stageRules(state).some(rule => rule.parleyBlocked?.(state, inv, entity, entityType) === true)
  },
  // P7《艾莲娜·哈珀失踪案》：07060 背面 → 指控流程；07061 背面 → 营救结局映射。
  // 卡条目只发事件（api.scenario.resolveScenarioEvent），章节流程全部留在内容层（本文件）。
  events: { ticHarperAccusation, ticHarperRescue },
  // 「任意轮结束时，你可以推进」（07060 正面目标）：引擎 phases.js 的轮末钩子 →
  // 条目 `actRule.roundEndCheck`（数据驱动分派，内容层不写卡号分支）。
  roundEnded(state, api) {
    const act = state.acts?.[state.actIndex]
    if (!act) return
    const rule = registeredEntry(act.originalCode || act.code)?.actRule
    return rule?.roundEndCheck?.(state, act, api)
  },
  // 《暗潮之下》并行幕（07316/07317/07318「深海之城」）完成判定：引擎 act-agenda.js#checkAct
  // 末尾调用；本钩子一旦声明即由内容层接管（引擎不再跑兜底）。薄委托给
  // parallel-acts.js#checkParallelActObjectives：只遍历 api.parallelActs()；07316 是线性幕，
  // 由 checkLinearAct → onReveal 完成，不能在这里遍历 actsInPlay（会重复处理）。
  checkParallelActs(state, api) {
    return checkParallelActObjectives(state, api, registeredEntry)
  },
}

// 当前在场的幕/议程条目规则（数据驱动分派；内容层不写卡号分支）。
function stageRules(state) {
  const agenda = state.agendas?.[state.agendaIndex]
  const act = state.acts?.[state.actIndex]
  return [
    agenda ? registeredEntry(agenda.originalCode || agenda.code)?.agendaRule : null,
    act ? registeredEntry(act.originalCode || act.code)?.actRule : null,
  ].filter(Boolean)
}

// ===========================================================================
// 《艾莲娜·哈珀失踪案》指控 / 营救（07060 / 07061 的内容层接线）
// ---------------------------------------------------------------------------
// 指控（07060 背面「The Accusation」）：
//   1) 私有牌堆 harperAnswers = [真嫌犯卡号, 真窝点卡号]（chapter-setup.js 初始化，顺序固定）；
//   2) 候选 = campaign records 的 possibleSuspects/possibleHideouts（查看迹象时由
//      scenarioCardsSeen 剔除；记录值可能写角色名或卡号，统一经 suspectCode/hideoutCode 归一）。
//      记录为空时（直接开局/测试夹具）回退全表并剔除 scenarioFlags.crossedOff，保证可结算；
//   3) 领队分别公开指认 → 正确数 0/1/2；
//   4) 无论对错都把真实答案圈进剧本日志：records.harperSuspect/harperHideout 写角色名
//      （后续「深陷其中」「达贡巢穴」用 suspectCode(该记录) 反查印刷卡号）；
//   5) 0 正确：全员撤退 → noResolution → resolutions.js 映射 resolution1（MissionFailed）；
//      1 正确：移出剧情参考卡 07062a，把「愤怒暴民」07062b 生成到印斯茅斯广场 07065；
//      2 正确：直接进入营救准备；
//   6) 转场：07061「营救」装进下一格幕牌库（advanceAct 在 onReveal 之后才 actIndex++，
//      所以推进结束后的当前幕正好是 07061）；07059「狂热追击」装进下一格议程牌库并直接
//      推进到它的正面（跳过当前议程背面），随后清空场上毁灭（对齐参考实现在
//      AdvanceToAgenda 内部执行的 RemoveAllDoomFromPlay）；
//   7) 藏身处：真实窝点地点入场、每位调查员 1 个线索、07083「艾莲娜·哈珀」压在
//      location.beneath 下方、绑架犯敌人生成在该地点。
//
// 营救（07061 背面）：按绑架犯卡号查条目 actRule.resolutionByKidnapper → resolution2..7，
// 调 api.finish(key)（content/.../resolutions.js 已支持这些键并写 TheMissionWasSuccessful）。
// ===========================================================================

const printedCode = value => (typeof value === 'string'
  ? value
  : value?.originalCode || value?.code || null)

// 领队从印刷卡号列表里选 1 张（只有 1 个候选时不弹选择）。
function choosePrintedCard(api, { seat, source, prompt, codes }) {
  const list = [...new Set((codes || []).filter(Boolean))]
  if (!list.length) return null
  if (list.length === 1) return list[0]
  const cardName = code => api?.cardName?.(code) || code
  return api.choose({
    kind: 'card', seat, source, prompt,
    options: list.map(code => ({ id: String(code), cardCode: String(code), label: cardName(code) })),
  })
}

// 候选（印刷卡号）：优先剧本日志集合；集合为空时回退全表并剔除已查看的迹象（crossedOff）。
function possibleCodes(state, api, recordKey, table, normalize) {
  const values = api?.mechanics?.recordSets?.values?.(recordKey) || []
  const mapped = values.map(value => normalize?.(value)).filter(Boolean)
  if (mapped.length) return [...new Set(mapped)]
  const crossed = new Set(state.scenarioFlags?.crossedOff || [])
  return Object.keys(table || {}).filter(code => !crossed.has(code))
}

// 把一张舞台卡装进幕/议程牌库的 index 槽（引擎原语语义：index === 当前长度时追加扩展，
// 否则从 index 起替换旧牌；不改变 actIndex/agendaIndex）。
function installStageCard(state, api, kind, index, code) {
  const setter = kind === 'act' ? 'setActDeckCards' : 'setAgendaDeckCards'
  if (typeof api?.[setter] !== 'function') {
    api?.info?.(`⚠️ 场景运行时缺少 ${setter}：无法把 ${code} 装进${kind === 'act' ? '幕' : '议程'}牌库。`)
    return false
  }
  return api[setter](index, [String(code)]) === true
}

// 全员撤退（0 正确指控）：resignMany 会先把状态改完、最后统一抛 ScenarioEnded。
function resignAll(state, api) {
  const seats = (state.investigators || [])
    .filter(inv => !inv.defeated && !inv.resigned).map(inv => inv.seat)
  if (!seats.length) return
  if (typeof api?.resignMany === 'function') {
    api.resignMany(seats)
    return
  }
  for (const seat of seats) api?.resign?.(seat)
}

// 转场 + 藏身处布置（指控 1/2 正确共用）。
function prepareRescue(state, api, { trueSuspect, trueHideout }) {
  const actSlot = (state.actIndex ?? 0) + 1
  const actInstalled = installStageCard(state, api, 'act', actSlot, '07061')
  const agendaSlot = (state.agendaIndex ?? 0) + 1
  const agendaInstalled = installStageCard(state, api, 'agenda', agendaSlot, '07059')
  if (agendaInstalled) {
    const advanced = typeof api?.advanceAgendaTo === 'function' ? api.advanceAgendaTo(agendaSlot) : false
    if (!advanced) state.agendaIndex = agendaSlot
    api?.clearDoom?.()
  } else {
    api?.info?.('⚠️ 「狂热追击」07059 未能装进议程牌库：指控后仍停留在当前议程。')
  }
  // 真实窝点地点入场（已在场则直接复用）。
  const existing = (state.locations || []).find(location => printedCode(location) === trueHideout)
  let hideoutId = existing?.id ?? null
  if (!hideoutId && typeof api?.placePrintedLocation === 'function') {
    try { hideoutId = api.placePrintedLocation(trueHideout) } catch { hideoutId = null }
  }
  if (!hideoutId) {
    api?.info?.('⚠️ 藏身处未能入场：营救目标将缺少哈珀的地点。')
  } else {
    const hideout = (state.locations || []).find(location => location.id === hideoutId) || null
    if (hideout) {
      hideout.clues = (Number(hideout.clues) || 0) + state.numInvestigators
      if (api?.takeFromSetAside?.('07083')) {
        if (typeof api.attachUnderLocation === 'function') api.attachUnderLocation(hideoutId, '07083')
        else { hideout.beneath ||= []; if (!hideout.beneath.includes('07083')) hideout.beneath.push('07083') }
      } else if (!(hideout.beneath || []).includes('07083')) {
        api?.info?.('⚠️ 07083 不在旁置区：艾莲娜·哈珀未压在藏身处下方。')
      }
    }
    const already = (state.enemies || []).some(enemy => printedCode(enemy) === trueSuspect)
    if (!already) {
      const spawned = typeof api?.spawn === 'function' ? api.spawn(trueSuspect, hideoutId) : null
      if (!spawned) api?.info?.('⚠️ 绑架犯生成失败。')
    }
  }
  if (!actInstalled) api?.info?.('⚠️ 「营救」07061 未能装进幕牌库：指控后可能没有营救幕。')
}

function ticHarperAccusation(state, payload, api) {
  if (!state || state.status !== 'playing') return false
  // 只在 07060 的背面结算（onReveal 时当前幕仍是 07060；advanceAct 之后才 actIndex++）。
  if (printedCode(state.acts?.[state.actIndex]) !== '07060') return false
  if (state.scenarioFlags?.harperAccusationDone) return false
  const answers = api?.mechanics?.scenarioDecks?.cards?.('harperAnswers') || []
  if (answers.length < 2) {
    api?.info?.('⚠️ 找不到隐藏答案（harperAnswers），跳过指控流程。')
    return false
  }
  const trueSuspect = printedCode(answers[0])
  const trueHideout = printedCode(answers[1])
  const suspects = possibleCodes(state, api, 'possibleSuspects', SUSPECTS, suspectCode)
  const hideouts = possibleCodes(state, api, 'possibleHideouts', HIDEOUTS, hideoutCode)
  if (!suspects.length || !hideouts.length) {
    api?.info?.('⚠️ 没有可指认的嫌疑/窝点，跳过指控流程。')
    return false
  }
  state.scenarioFlags.harperAccusationDone = true
  const lead = state.campaign?.leadSeat ?? 0
  const nameOf = code => api?.cardName?.(code) || code
  const suspectPick = choosePrintedCard(api, {
    seat: lead, source: '07060', prompt: '指控谁是绑架犯？', codes: suspects,
  })
  const hideoutPick = choosePrintedCard(api, {
    seat: lead, source: '07060', prompt: '指控哈珀被关在哪里？', codes: hideouts,
  })
  if (!suspectPick || !hideoutPick) return false
  const correct = (suspectPick === trueSuspect ? 1 : 0) + (hideoutPick === trueHideout ? 1 : 0)
  api?.info?.(`🕵️ 指控：绑架犯「${nameOf(suspectPick)}」、窝点「${nameOf(hideoutPick)}」。`)
  // 圈出真实答案（无论对错；后续章节按这些记录继续）。
  const suspectName = suspectRole?.(trueSuspect)
  const hideoutName = hideoutRole?.(trueHideout)
  if (suspectName) api?.setCampaignRecord?.('harperSuspect', suspectName)
  if (hideoutName) api?.setCampaignRecord?.('harperHideout', hideoutName)
  if (correct === 0) {
    api?.info?.('❌ 指控失误：印斯茅斯的追捕者找上门来，你们只能撤退（→结局1）。')
    resignAll(state, api)
    return true
  }
  if (correct === 1) {
    api?.removeStoryAsset?.('07062a')
    const square = (state.locations || []).find(location => printedCode(location) === '07065')
    if (square) api?.spawn?.('07062b', square.id)
    else api?.info?.('⚠️ 印斯茅斯广场 07065 不在场：愤怒暴民未生成。')
    api?.info?.('🃏 「找到哈珀特工」翻面：愤怒暴民在印斯茅斯广场出现！')
  }
  prepareRescue(state, api, { trueSuspect, trueHideout })
  return true
}

function ticHarperRescue(state, payload, api) {
  if (!state || state.status !== 'playing') return false
  const act = state.acts?.[state.actIndex]
  if (printedCode(act) !== '07061') return false
  const rule = registeredEntry(act.originalCode || act.code)?.actRule
  const kidnapper = printedCode(payload?.kidnapper)
    || suspectCode(state.campaign?.records?.harperSuspect)
    || null
  const key = rule?.resolutionByKidnapper?.[String(kidnapper || '')] || 'resolution1'
  if (typeof api?.finish !== 'function') {
    api?.info?.('⚠️ 无法结算营救结局：场景运行时缺少 api.finish。')
    return false
  }
  api.info(`🔚 营救结局：${key}（绑架犯 ${kidnapper || '未知'}）`)
  api.finish(key)
  return true
}
