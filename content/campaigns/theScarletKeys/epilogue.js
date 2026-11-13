// 《绯红密钥》（The Scarlet Keys）· 尾声与多结局（P7）。
//
// 事实源（锁定）：参考实现 `Campaigns/TheScarletKeys.hs#CampaignStep EpilogueStep`：
//   1. 读 `epilogue.epilogue1`；
//   2. 若已记录 `theCellJoinedTheRedCoterie`（加入红色同志会）：
//      记录 `theRedCoterieAndTheCellAgreedToWorkTogether`，读 `epilogue2`（结盟结局）；
//   3. 否则统计「基金会信任」= 调查队协助 Sirry / 把真相告诉 Taylor / Quinn 站在你们这边
//      + 已完成 Foundation Intel 递送（参考 `getHasCrossedOutRecord TheCellIsDeliveringFoundationIntel`）；
//      「蒙骗」= 对 Taylor 隐瞒 / 擅离职守 / 援助骑士 / Ece 信任 / 与 Thorne 交易 / Aliki 站你这边 /
//      Desi 欠你人情 / Tuwile Masai 站你这边；
//      写入 `Foundation Trust` / `Cell Deception` 计数并读 `epilogue3`（带 trust/deception 变量）；
//   4. trust >= deception → 记录 `theCellWasGivenAPermanentPosition` 并读 `epilogue4`；
//      否则记录 `theCellWasDismantled` 并读 `epilogue5`；随后 `gameOver`。
//
// 本循环额外收口（P7 任务要求，参考实现分散在结局/景象里）：
//   · 存在抹除：把 `campaign.tsk.erased` 的卡号写进 `erasedCards`（战役构筑永久禁用）；
//     仍有空洞卡时记录 `theCellWasHollowed`；
//   · 绯红密钥归属：`keysHeld` 记录调查员持有的密钥（`<keyId>:<seat>`），被敌人夺走的留在 `keysStolen`；
//   · 红色同志会三池快照写入 `coterieStatus`（`ally=a;defeated=b;unresolved=c`）；
//   · 十章完成清单与最终结局标签 `campaignOutcome`，供大厅/纪事与 P8 账本读取。
// 正文只存 `textKey`（`epilogue.epilogue1`…`epilogue5`），由 parts.js#campaignStoryText 读取。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import { erasedFromExistence, hollowCards } from '../../../src/engine/tsk-hollow.js'
import { coterieSnapshot } from '../../../src/engine/tsk-coterie.js'
import { scarletKeys } from '../../../src/engine/tsk-scarlet-keys.js'
import { campaignStoryHeading, campaignStoryText } from './parts.js'

export const EPILOGUE_HANDLER_ID = 'scarletKeysEpilogue'

// 密钥归属读取（只读；不写状态）：调查员持有 → `<keyId>:<seat>`，敌人持有 → `<keyId>:<enemyId>`。
export function keysHeldByInvestigator (state) {
  return scarletKeys(state)
    .filter(key => key.bearer.type === 'investigator')
    .map(key => `${key.id}:${key.bearer.seat}`)
    .sort()
}

export function keysHeldByEnemy (state) {
  return scarletKeys(state)
    .filter(key => key.bearer.type === 'enemy')
    .map(key => `${key.id}:${key.bearer.enemyId}`)
    .sort()
}

// 「基金会信任 / 蒙骗」计数记录（参考 EpilogueStep 的 countHasRecords 列表）。
export const FOUNDATION_TRUST_RECORDS = Object.freeze([
  'theCellIsAssistingAgentSirry',
  'theCellToldTheTruthToTaylor',
  'agentQuinnHasYourBack',
])
export const CELL_DECEPTION_RECORDS = Object.freeze([
  'theCellHidTheTruthFromTaylor',
  'theCellIsOffMission',
  'theCellAidedTheKnight',
  'eceTrustsTheCell',
  'theCellMadeADealWithThorne',
  'alikiIsOnYourSide',
  'desiIsInYourDebt',
  'tuwileMasaiIsOnYourSide',
])

// 结局标签（写进 `campaignOutcome`；manifest.resolutionIds 仍用 victory/defeat 的通用口径）。
export const EPILOGUE_OUTCOMES = Object.freeze({
  coterieAlliance: 'theRedCoterieAndTheCellAgreedToWorkTogether',
  permanentPosition: 'theCellWasGivenAPermanentPosition',
  dismantled: 'theCellWasDismantled',
})

const logLine = (log, line) => { if (typeof log === 'function') log(line) }

function appendStory (state, line) {
  if (!line) return
  const visit = state?.campaign?.flow?.history?.at?.(-1)
  if (visit) visit.storyText = [visit.storyText, line].filter(Boolean).join('\n\n')
}

function countRecords (records, keys) {
  return keys.filter(key => records?.[key] === true).length
}

// ---------------------------------------------------------------------------
// 尾声子图：epilogue（按记录分支讲述）→ end
// ---------------------------------------------------------------------------
export const EPILOGUE_NODES = Object.freeze({
  epilogue: {
    type: 'story',
    title: campaignStoryHeading('epilogue') || 'Epilogue',
    textKey: 'epilogue.epilogue1',
    text: campaignStoryText('epilogue.epilogue1'),
    effects: [{ type: 'registered', handler: EPILOGUE_HANDLER_ID, event: 'epilogue' }],
    next: 'end',
  },
  end: {
    type: 'end',
    outcome: 'campaignComplete',
  },
})

export const EPILOGUE_TEXT_KEYS = Object.freeze([
  'epilogue.epilogue1', 'epilogue.epilogue2', 'epilogue.epilogue3', 'epilogue.epilogue4', 'epilogue.epilogue5',
])

// ---------------------------------------------------------------------------
// 尾声处理器
// ---------------------------------------------------------------------------
/** 终局状态的只读汇总（密钥归属 / 空洞抹除 / 同志会三池 / 十章）。 */
export function endgameSummary (state) {
  const campaign = state?.campaign
  const records = campaign?.records || {}
  const coterie = coterieSnapshot(state)
  return {
    erased: erasedFromExistence(state),
    hollows: hollowCards(state).map(card => card.code),
    heldKeys: keysHeldByInvestigator(state),
    stolenKeys: keysHeldByEnemy(state),
    coterie: coterie || { unresolved: [], ally: [], defeated: [] },
    chapters: Array.isArray(records.chaptersCompleted) ? [...records.chaptersCompleted] : [],
    keysHeld: Array.isArray(records.keysHeld) ? [...records.keysHeld] : [],
    keysStolen: Array.isArray(records.keysStolen) ? [...records.keysStolen] : [],
    time: Number(records.time) || 0,
    trust: Number(records.foundationTrust) || 0,
    deception: Number(records.cellDeception) || 0,
    outcome: records.campaignOutcome || '',
  }
}

/** 尾声：按记录分支讲述并写入最终记录（幂等：重复进入只补记录不重复发奖）。 */
export function runScarletKeysEpilogue (state, log) {
  const campaign = state?.campaign
  if (!campaign) throw new Error('尾声效果需要 state.campaign')
  const records = campaign.records || (campaign.records = {})

  // 1) 结局分支：加入同志会 / 信任与蒙骗较量。
  let outcome
  if (records.theCellJoinedTheRedCoterie === true) {
    records.theRedCoterieAndTheCellAgreedToWorkTogether = true
    appendStory(state, campaignStoryText('epilogue.epilogue2'))
    logLine(log, '🌅 尾声：调查队与红色同志会达成合作。')
    outcome = 'coterieAlliance'
  } else {
    const deliveredIntel = records.foundationIntelDelivered === true ? 1 : 0
    const trust = countRecords(records, FOUNDATION_TRUST_RECORDS) + deliveredIntel
    const deception = countRecords(records, CELL_DECEPTION_RECORDS)
    records.foundationTrust = trust
    records.cellDeception = deception
    appendStory(state, campaignStoryText('epilogue.epilogue3'))
    logLine(log, `🌅 尾声：基金会信任 ${trust}，蒙骗 ${deception}。`)
    if (trust >= deception) {
      records.theCellWasGivenAPermanentPosition = true
      appendStory(state, campaignStoryText('epilogue.epilogue4'))
      logLine(log, '🌅 尾声：调查队获得了基金会的常设职位。')
      outcome = 'permanentPosition'
    } else {
      records.theCellWasDismantled = true
      appendStory(state, campaignStoryText('epilogue.epilogue5'))
      logLine(log, '🌅 尾声：调查队被基金会解散。')
      outcome = 'dismantled'
    }
  }
  records.campaignOutcome = outcome

  // 2) 存在抹除 / 空洞：抹除名单永久禁用，仍有空洞卡时记录「调查队被空洞侵蚀」。
  const erased = erasedFromExistence(state)
  records.erasedCards = [...new Set([...erased, ...(Array.isArray(records.erasedCards) ? records.erasedCards : [])])]
  const hollows = hollowCards(state).map(card => card.code)
  if (hollows.length) records.theCellWasHollowed = true
  if (erased.length) logLine(log, `🕳️ 尾声：${erased.length} 张卡被存在抹除（本战役剩余时间禁止再构筑）。`)

  // 3) 绯红密钥归属 + 同胞会三池快照 + 十章完成清单。
  const held = keysHeldByInvestigator(state)
  const stolen = keysHeldByEnemy(state)
  records.keysHeld = held
  records.keysStolen = stolen
  const coterie = coterieSnapshot(state) || { unresolved: [], ally: [], defeated: [] }
  records.coterieStatus = `ally=${coterie.ally.length};defeated=${coterie.defeated.length};unresolved=${coterie.unresolved.length}`
  const chapters = [...new Set((campaign.scenarioResults || []).map(result => result?.scenarioId).filter(Boolean))]
  records.chaptersCompleted = chapters
  logLine(log, `🔑 尾声：调查队持有 ${held.length} 把绯红密钥，${stolen.length} 把仍在敌人手中；`
    + `已完成 ${chapters.length} 章；最终结局 ${outcome}。`)

  return endgameSummary(state)
}

export function runEpilogueEffect (state, effect, log) {
  if (effect.event === 'epilogue') return runScarletKeysEpilogue(state, log)
  throw new Error(`未知尾声效果：${String(effect.event)}`)
}

registerCampaignEffectHandler(EPILOGUE_HANDLER_ID, runEpilogueEffect)
