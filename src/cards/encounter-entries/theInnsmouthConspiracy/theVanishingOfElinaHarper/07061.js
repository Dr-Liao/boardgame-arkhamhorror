// 07061 营救（The Rescue）· 场景 2 · 艾莲娜·哈珀失踪案（TIC 第二章）
//
// 印刷（中文）：
//   绑架犯失去冷漠，得到+1[per_investigator]生命值，并且不能与之谈判。
//   目标 - 如果绑架犯在胜利区，或艾莲娜·哈珀的地点没有线索，推进
//   (如果游戏中有至少2位调查员，则改为两项条件都必须满足)。
// 印刷（英文）：
//   The kidnapper loses aloof, gets +1 [per_investigator] health, and cannot be parleyed with.
//   Objective - If either the kidnapper is in the victory display, or there are no clues on Elina
//   Harper's location, advance (if there are 2 or more investigators, both conditions must be
//   fulfilled instead).
// （背面）：- If Brian Burnham was the kidnapper, proceed to (→R2). … - If Robert Friendly was the
//   kidnapper, proceed to (→R7).
//
// 读点 / 内容接线（详细契约见 artifacts/migration/tic/p7/workers/w6/harper-report.md）：
//   · 绑架犯身份：campaign.records.harperSuspect（可能是角色名或卡号）→ _shared.js#suspectCode
//     的 printedRole 双向读回印刷卡号（07076–07081）。指控流程由内容层事件写入该记录。
//   · 「失去冷漠 / 不能谈判」= 既有实体规则目标 loses:aloof / cannot:parley，写在幕条目的
//     顶层 modifiers 行（modifiers.js#entityModifierRows 的 scene 行 → enemy-aloof.js#enemyIsAloof
//     与 parley.js#parleyForbidden 的 entityRuleActive 读点；07124–07127 同款写法）。
//   · 「+1[每调查员]生命」= modifiers 行 enemyHealth，amount=(state)=>state.numInvestigators；
//     读点 enemies.js#enemyHealthValue + modifiers.js#entityModifierTotal（scene 行允许 enemyHealth）。
//   · 目标：条目 actRule.objective ← act-agenda.js#checkAct 的条目函数分支（TIC behavior 没有
//     checkObjectives），条件成立后引擎自动 advanceAct。艾莲娜·哈珀的地点判据：本章指控流程把
//     07083「艾莲娜·哈珀(知道得太多)」压在藏身处地点下方（location.beneath）或作为地点附属
//     （location.attachments），本卡两种形态都读，避免与内容层实现方式耦合。
//   · 背面六种绑架犯→结局键：actRule.resolutionByKidnapper 数据表（07078→R2、07081→R3、
//     07080→R4、07079→R5、07077→R6、07076→R7，取自 TheRescue.hs:49-61 与
//     content/.../resolutions.js 已支持键）。内容层事件处理器 `ticHarperRescue` 读当前幕条目的
//     该表后调 api.scenario.finish(key)；内容未接线时 onReveal 只登记警告，不误结算 R1。
//   · onReveal 事件契约：api.scenario.resolveScenarioEvent('ticHarperRescue', {
//     actCode:'07061', actId, scenarioId })（幕 onReveal 面 api 即场景运行时，直接调用亦可）。
//
// implemented: true（修正行/目标/背面事件契约全部可用；具体 finish 与六种结局映射由 Lead 在
//   content/.../entry-rules.js 的 `events.ticHarperRescue` 接线后生效，卡内已按契约调用）。
import { suspectCode } from '../../_shared.js'

const CARD = '07061'
const ELINA = '07083'          // 艾莲娜·哈珀（知道得太多）· 故事资产
const PLAYER_COUNT_AND = 2     // ≥2 人时两项条件都要满足

// 事件发送：能力面（api.scenario.resolveScenarioEvent）与幕 onReveal 面（api 本身是场景运行时）都兼容。
function emitScenarioEvent(api, id, payload) {
  const target = api?.scenario && typeof api.scenario.resolveScenarioEvent === 'function' ? api.scenario : api
  const resolve = target?.resolveScenarioEvent
  if (typeof resolve !== 'function') return false
  try {
    resolve.call(target, id, payload)
    return true
  } catch (error) {
    if (/Unknown scenario event/.test(String(error?.message))) {
      target.info?.(`⚠️ 内容层尚未接线场景事件 ${id}：本次只记录，营救结局待 Lead 接线（见 harper-report.md）。`)
      return false
    }
    throw error
  }
}

const codeOf = card => (typeof card === 'string' ? card : card?.originalCode || card?.code)

function kidnapperCode(state) {
  return suspectCode(state.campaign?.records?.harperSuspect)
}

function isKidnapper(state, entity) {
  const code = kidnapperCode(state)
  return Boolean(code) && codeOf(entity) === code
}

// 「艾莲娜·哈珀的地点」：07083 压在下方（location.beneath）或作为地点附属（location.attachments）。
function elinaLocation(state) {
  return (state.locations || []).find(location =>
    (Array.isArray(location.beneath) && location.beneath.includes(ELINA))
    || (location.attachments || []).some(card => codeOf(card) === ELINA)) || null
}

function kidnapperInVictoryDisplay(state) {
  const code = kidnapperCode(state)
  if (!code) return false
  return (state.victoryDisplay || []).some(card => codeOf(card) === code)
}

function elinaLocationHasNoClues(state) {
  const location = elinaLocation(state)
  return Boolean(location) && (Number(location.clues) || 0) === 0
}

const kidnapperCondition = { when: ({ state, entity }) => isKidnapper(state, entity) }

export default {
  code: CARD, scope: 'act', implemented: true,
  // 幕上的全局修正：只作用于「绑架犯」这一张敌人（嫌疑敌人的判定见文件头）。
  modifiers: [
    { target: 'loses:aloof', condition: kidnapperCondition },
    { target: 'cannot:parley', condition: kidnapperCondition },
    { target: 'enemyHealth', amount: ({ state }) => state.numInvestigators, condition: kidnapperCondition },
  ],
  actRule: {
    // 六种绑架犯 → 印刷结局键（content/.../resolutions.js 已支持 resolution2..7）。
    resolutionByKidnapper: {
      '07078': 'resolution2', // Brian Burnham
      '07081': 'resolution3', // Othera Gilman
      '07080': 'resolution4', // Joyce Little
      '07079': 'resolution5', // Barnabas Marsh
      '07077': 'resolution6', // Zadok Allen
      '07076': 'resolution7', // Robert Friendly
    },

    // 目标：1 人局「绑架犯在胜利区 或 艾莲娜的地点没有线索」；≥2 人局两者都必须满足。
    objective(state) {
      const inVictory = kidnapperInVictoryDisplay(state)
      const noClues = elinaLocationHasNoClues(state)
      return state.numInvestigators >= PLAYER_COUNT_AND ? (inVictory && noClues) : (inVictory || noClues)
    },

    // 背面：按绑架犯进入 R2–R7，由内容层事件处理器统一 finish（避免卡条目认识章节结局表）。
    onReveal(state, act, api) {
      emitScenarioEvent(api, 'ticHarperRescue', {
        actCode: CARD, actId: act?.id ?? null, scenarioId: state.scenario?.id ?? null,
        kidnapper: kidnapperCode(state) || null,
      })
    },
  },
}
