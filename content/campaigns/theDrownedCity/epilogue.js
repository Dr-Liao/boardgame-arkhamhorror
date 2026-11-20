// 《沉没之城》（The Drowned City）· 尾声与多结局（P7）。
//
// 事实源（锁定，只读）：参考实现 `Campaigns/TheDrownedCity.hs#CampaignStep EpilogueStep`：
//   1. 读 `epilogue.body`（检查 Campaign Log）；
//   2. Campaign Log 条目按印刷顺序逐条检查，第一条命中即读对应尾声：
//        阿卡姆城被克苏鲁毁灭（`cthulhuAnnihilatedTheCityOfArkham`）→ 尾声 1；
//        克苏鲁被驱离（`cthulhuWasDrivenAway`）或（被放逐且阿卡姆被摧毁）→ 尾声 2；
//        克苏鲁被放逐（`cthulhuWasBanished`）→ 尾声 3；
//        调查员阻止了克苏鲁苏醒（`theInvestigatorsHaltedCthulhusAwakening`）→ 尾声 4；
//        都不命中 → 不读尾声正文，直接 gameOver；
//   3. `gameOver`。
// 结局正文键来自 interludes.json#epilogue（`epilogue.epilogueN.title/body`）。
//
// 本文件不写 state 字段、不改引擎：尾声只读记录、写日志/纪事，正文由 flow.js 从 story-text 取。
import { registerCampaignEffectHandler } from '../../../src/campaign/content-effects.js'
import { tdcEpilogueBranch, TDC_EPILOGUE_BRANCHES } from './parts.js'
import { recordsSnapshot } from './records.js'

export const EPILOGUE_HANDLER_ID = 'tdcEpilogue'

// 尾声正文键（测试/账本用）。
export const EPILOGUE_TEXT_KEYS = Object.freeze([
  'epilogue.title', 'epilogue.checkCampaignLog',
  ...TDC_EPILOGUE_BRANCHES.flatMap(branch => [branch.titleKey, branch.textKey]),
])

const logLine = (log, line) => { if (typeof log === 'function') log(line) }

function appendStory (state, line) {
  if (!line) return
  const visit = state?.campaign?.flow?.history?.at?.(-1)
  if (visit) visit.storyText = [visit.storyText, line].filter(Boolean).join('\n\n')
}

/** 结局摘要（只读；大厅/测试共用）。 */
export function endgameSummary (state) {
  const records = state?.campaign?.records || {}
  const branch = tdcEpilogueBranch(records)
  return Object.freeze({
    ...recordsSnapshot(records),
    branch,
    outcome: branch ? (TDC_EPILOGUE_BRANCHES.find(row => row.id === branch)?.outcome || null) : 'defeat',
  })
}

/**
 * 尾声：按记录讲结局（只读 + 日志；不新增战役记录——CONTRACT §4 没有 outcome 键）。
 * 参考实现只在命中时读一段尾声正文；流程图的 `epilogueRouter` 负责把玩家带到对应节点。
 */
export function runTdcEpilogue (state, log) {
  const campaign = state?.campaign
  if (!campaign) throw new Error('尾声效果需要 state.campaign')
  const records = campaign.records || (campaign.records = {})
  const branch = tdcEpilogueBranch(records)
  const summary = endgameSummary(state)
  if (branch) {
    const row = TDC_EPILOGUE_BRANCHES.find(item => item.id === branch)
    appendStory(state, row ? '' : '')
    logLine(log, `🌅 尾声：命中 ${branch}（${row?.outcome || '?'}）——按 Campaign Log 顺序读取该段尾声。`)
  } else {
    logLine(log, '🌅 尾声：Campaign Log 没有命中任何尾声条目（参考实现直接结束战役）。')
  }
  return summary
}

export function runEpilogueEffect (state, effect, log) {
  if (effect.event === 'epilogue') return runTdcEpilogue(state, log)
  throw new Error(`未知尾声效果：${String(effect.event)}`)
}

// ---------------------------------------------------------------------------
// 尾声子图：epilogue（检查 Campaign Log）→ epilogueRouter → epilogue1..4 → end
// ---------------------------------------------------------------------------
export function epilogueNodes () {
  const nodes = {
    epilogue: {
      type: 'interlude',
      upgrades: false,
      titleKey: 'epilogue.title',
      textKeys: ['epilogue.checkCampaignLog'],
      effects: [{ type: 'registered', handler: EPILOGUE_HANDLER_ID, event: 'epilogue' }],
      next: 'epilogueRouter',
    },
    epilogueRouter: {
      type: 'stepReturn',
      titleKey: 'epilogue.title',
      rules: TDC_EPILOGUE_BRANCHES.map(branch => ({
        id: branch.id,
        when: branch.when,
        next: branch.id,
      })),
      // 没有任何尾声命中 → 直接结束战役（参考 `gameOver`）。
      next: 'end',
    },
  }
  for (const branch of TDC_EPILOGUE_BRANCHES) {
    nodes[branch.id] = {
      type: 'interlude',
      upgrades: false,
      titleKey: branch.titleKey,
      textKey: branch.textKey,
      next: 'end',
    }
  }
  return nodes
}

registerCampaignEffectHandler(EPILOGUE_HANDLER_ID, runEpilogueEffect)
