// 《铁杉谷盛宴》（The Feast of Hemlock Vale）· 尾声与多结局（P7）。
//
// 事实源（锁定，只读）：参考实现 `Campaigns/TheFeastOfHemlockVale.hs#CampaignStep EpilogueStep` 与
// `CampaignSpecificStep "epilogueCodex"`：
//   1. 读 `epilogue.body`（检查 Campaign Log：还有活着的调查员时，可以读满足条件的尾声法典）；
//   2. 先按两条「牺牲」记录选正文：
//        `drMarquezSacrificedHerselfForTheVale` → `epilogue.epilogue1`
//        `theInvestigatorsSacrificedThemselvesForTheVale` → `epilogue.epilogue2`
//        否则 → `epilogue.epilogue3`
//   3. `anyAliveInvestigators && not investigatorsSacrificedThemselves` → 进入尾声法典
//      （atwoods / hemlocks / judith / theo 四条，各自条件见 `FHV_EPILOGUE_CODEX`）；
//   4. `gameOver`。
// 结局判定（本循环把散落在各章的「山谷命运」记录收敛到一处）：
//   · `theValeWasSaved` / `theValeBurned` / `theInvestigatorsBarelySurvivedTheFeastOfHemlockVale` /
//     `theInvestigatorsBecameTheTrueFeastOfHemlockVale` / `theInvestigatorsWereDevoured`（fateOfTheVale）；
//   · `victory` = 山谷得救或调查员献身；`defeat` = 山谷焚毁 / 全员被吞噬（manifest.resolutionIds 口径）。
//
// 本文件不写 state 字段、不改引擎：结局标签写进已声明的战役记录 `campaignOutcome`，
// 结算摘要供大厅/纪事读取。正文一律存 textKey，由 flow.js 从 story-text 读取。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import {
  FHV_RESIDENTS, recordsSnapshot, residentCrossedOut, residentLevel,
} from './records.js'
import { FHV_EPILOGUE_STEP, campaignStoryHeading, campaignStoryText } from './parts.js'

export const EPILOGUE_HANDLER_ID = 'fhvEpilogue'

// 结局标签（写进 `records.campaignOutcome`；manifest.resolutionIds 仍用 victory/defeat 的通用口径）。
export const FHV_OUTCOMES = Object.freeze({
  valeSaved: 'theValeWasSaved',
  valeBurned: 'theValeBurned',
  barelySurvived: 'theInvestigatorsBarelySurvivedTheFeastOfHemlockVale',
  trueFeast: 'theInvestigatorsBecameTheTrueFeastOfHemlockVale',
  devoured: 'theInvestigatorsWereDevoured',
  marquezSacrificed: 'drMarquezSacrificedHerselfForTheVale',
  investigatorsSacrificed: 'theInvestigatorsSacrificedThemselvesForTheVale',
})

// 参考 `CampaignStep EpilogueStep` 的两条牺牲记录 + 山谷命运记录（顺序即判定优先级）。
export const FHV_EPILOGUE_BRANCHES = Object.freeze([
  Object.freeze({ id: 'marquezSacrificed', record: FHV_OUTCOMES.marquezSacrificed, textKey: 'epilogue.epilogue1', outcome: 'victory' }),
  Object.freeze({ id: 'investigatorsSacrificed', record: FHV_OUTCOMES.investigatorsSacrificed, textKey: 'epilogue.epilogue2', outcome: 'victory' }),
  Object.freeze({ id: 'otherwise', record: null, textKey: 'epilogue.epilogue3', outcome: 'victory' }),
])

// 尾声法典（`CampaignSpecificStep "epilogueCodex"`）：四条，条件是居民记录/关系等级。
//   atwoods：Leah 与 Simeon 都没被划掉；
//   hemlocks：`theHemlocksMadeATruce` 且 William / River 都没被划掉；
//   judith：关系等级 ≥ 5 且未被划掉；theo：关系等级 ≥ 5 且未被划掉。
export const FHV_EPILOGUE_CODEX = Object.freeze([
  Object.freeze({
    id: 'atwoods',
    labelKey: 'epilogue.label.atwoods',
    textKey: 'epilogue.codex.atwoods.body',
    titleKey: 'epilogue.codex.atwoods.title',
    residents: Object.freeze(['leahAtwood', 'simeonAtwood']),
    when: records => !residentCrossedOut(records, 'leahAtwood') && !residentCrossedOut(records, 'simeonAtwood'),
  }),
  Object.freeze({
    id: 'hemlocks',
    labelKey: 'epilogue.label.hemlocks',
    textKey: 'epilogue.codex.hemlocks.body',
    titleKey: 'epilogue.codex.hemlocks.title',
    residents: Object.freeze(['williamHemlock', 'riverHawthorne']),
    when: records => records?.theHemlocksMadeATruce === true
      && !residentCrossedOut(records, 'williamHemlock') && !residentCrossedOut(records, 'riverHawthorne'),
  }),
  Object.freeze({
    id: 'judith',
    labelKey: 'epilogue.label.judith',
    textKey: 'epilogue.codex.judith.body',
    titleKey: 'epilogue.codex.judith.title',
    residents: Object.freeze(['judithPark']),
    when: records => residentLevel(records, 'judithPark') >= 5 && !residentCrossedOut(records, 'judithPark'),
  }),
  Object.freeze({
    id: 'theo',
    labelKey: 'epilogue.label.theo',
    textKey: 'epilogue.codex.theo.body',
    titleKey: 'epilogue.codex.theo.title',
    residents: Object.freeze(['theoPeters']),
    when: records => residentLevel(records, 'theoPeters') >= 5 && !residentCrossedOut(records, 'theoPeters'),
  }),
])

const logLine = (log, line) => { if (typeof log === 'function') log(line) }

function appendStory (state, line) {
  if (!line) return
  const visit = state?.campaign?.flow?.history?.at?.(-1)
  if (visit) visit.storyText = [visit.storyText, line].filter(Boolean).join('\n\n')
}

// ---------------------------------------------------------------------------
// 尾声子图：epilogue → end
// ---------------------------------------------------------------------------
export const EPILOGUE_NODES = Object.freeze({
  [FHV_EPILOGUE_STEP]: {
    type: 'story',
    title: campaignStoryHeading('epilogue.title') || 'Epilogue',
    textKey: 'epilogue.body',
    textKeys: ['epilogue.epilogue1', 'epilogue.epilogue2', 'epilogue.epilogue3'],
    effects: [{ type: 'registered', handler: EPILOGUE_HANDLER_ID, event: 'epilogue' }],
    next: 'end',
  },
  end: {
    type: 'end',
    outcome: 'campaignComplete',
  },
})

export const EPILOGUE_TEXT_KEYS = Object.freeze([
  'epilogue.body', 'epilogue.epilogue1', 'epilogue.epilogue2', 'epilogue.epilogue3',
  'epilogue.marquezSacrificedHerself', 'epilogue.investigatorsSacrificedThemselves', 'epilogue.otherwise',
  ...FHV_EPILOGUE_CODEX.map(entry => entry.textKey),
])

// ---------------------------------------------------------------------------
// 结局判定
// ---------------------------------------------------------------------------
/** 参考 EpilogueStep 的正文分支（牺牲 > 被吞噬 > 山谷焚毁 > 山谷得救 > 勉强生还）。 */
export function fhvEpilogueBranch (records = {}) {
  if (records.theInvestigatorsWereDevoured === true) return { id: 'devoured', textKey: 'epilogue.epilogue3', outcome: 'defeat' }
  if (records[FHV_OUTCOMES.marquezSacrificed] === true) return { id: 'marquezSacrificed', textKey: 'epilogue.epilogue1', outcome: 'victory' }
  if (records[FHV_OUTCOMES.investigatorsSacrificed] === true) return { id: 'investigatorsSacrificed', textKey: 'epilogue.epilogue2', outcome: 'victory' }
  if (records[FHV_OUTCOMES.valeBurned] === true) return { id: 'valeBurned', textKey: 'epilogue.epilogue3', outcome: 'defeat' }
  if (records[FHV_OUTCOMES.trueFeast] === true) return { id: 'trueFeast', textKey: 'epilogue.epilogue3', outcome: 'defeat' }
  if (records[FHV_OUTCOMES.barelySurvived] === true) return { id: 'barelySurvived', textKey: 'epilogue.epilogue3', outcome: 'victory' }
  if (records[FHV_OUTCOMES.valeSaved] === true) return { id: 'valeSaved', textKey: 'epilogue.epilogue3', outcome: 'victory' }
  return { id: 'otherwise', textKey: 'epilogue.epilogue3', outcome: 'defeat' }
}

/** 当前记录下可以阅读的尾声法典条目（大厅/尾声展示用；只读）。 */
export function fhvEpilogueCodex (records = {}) {
  return FHV_EPILOGUE_CODEX.filter(entry => entry.when(records)).map(entry => entry.id)
}

/** 终局摘要（只读）：结局分支 / 山谷命运 / 居民关系 / 法典 / 已勘察区域 / 未花费经验。 */
export function endgameSummary (state) {
  const records = state?.campaign?.records || {}
  const branch = fhvEpilogueBranch(records)
  return Object.freeze({
    ...recordsSnapshot(records),
    branch: branch.id,
    outcome: branch.outcome,
    codex: fhvEpilogueCodex(records),
    vale: Object.freeze({
      saved: records[FHV_OUTCOMES.valeSaved] === true,
      burned: records[FHV_OUTCOMES.valeBurned] === true,
      devoured: records[FHV_OUTCOMES.devoured] === true,
    }),
  })
}

/**
 * 尾声：按记录分支讲述并写入最终结局记录（幂等：重复进入只补记录，不重复发放）。
 * 与参考实现的差别（P7 approximation）：参考实现把四条尾声法典留给玩家**按需阅读**；
 * 本层在结尾一次性把合格条目写进历史（大厅可以再逐条展示），并把结局标签写进
 * `records.campaignOutcome`（`victory` / `defeat`）。
 */
export function runFhvEpilogue (state, log) {
  const campaign = state?.campaign
  if (!campaign) throw new Error('尾声效果需要 state.campaign')
  const records = campaign.records || (campaign.records = {})

  const branch = fhvEpilogueBranch(records)
  appendStory(state, campaignStoryText('epilogue.epilogue1'))
  logLine(log, `🌅 尾声：${branch.id} → ${branch.outcome}。`)

  // 四条尾声法典：条件满足即写入历史（合格条目也写进记录，供大厅/纪事读取）。
  const codex = fhvEpilogueCodex(records)
  for (const entry of FHV_EPILOGUE_CODEX.filter(row => codex.includes(row.id))) {
    appendStory(state, campaignStoryText(entry.textKey))
  }
  records.epilogueCodex = codex
  records.campaignOutcome = branch.outcome
  records.campaignOutcomeBranch = branch.id
  records.fhvResolution = branch.outcome

  // 山谷命运 / 献身者的展示地名（记录面板读点；不改变结局判定）。
  records.valeFate = [
    records[FHV_OUTCOMES.valeSaved] ? FHV_OUTCOMES.valeSaved : null,
    records[FHV_OUTCOMES.valeBurned] ? FHV_OUTCOMES.valeBurned : null,
    records[FHV_OUTCOMES.trueFeast] ? FHV_OUTCOMES.trueFeast : null,
    records[FHV_OUTCOMES.devoured] ? FHV_OUTCOMES.devoured : null,
  ].filter(Boolean).join(',')

  // 居民结局：未被划掉的居民（尾声展示与账本读点）。
  records.survivingResidents = FHV_RESIDENTS
    .filter(row => !residentCrossedOut(records, row.id) && records[row.record.crossedOut] !== true)
    .map(row => row.id)

  const summary = endgameSummary(state)
  logLine(log, `🌅 尾声：山谷命运 ${records.valeFate || '未记录'}；可读尾声法典 ${codex.length} 条；`
    + `最终结局 ${branch.outcome}（${branch.id}）。`)
  return summary
}

export function runEpilogueEffect (state, effect, log) {
  if (effect.event === 'epilogue') return runFhvEpilogue(state, log)
  throw new Error(`未知尾声效果：${String(effect.event)}`)
}

registerCampaignEffectHandler(EPILOGUE_HANDLER_ID, runEpilogueEffect)
