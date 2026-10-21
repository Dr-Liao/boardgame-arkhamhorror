// 战役层观察投影（Phase 6 · 战役插件化第二批：project）
//
// 症状：`src/integration/observation.js` 直接读战役专属状态（`state.relicOfAges` /
// `state.campaign.records.yigsFury` / `state.expeditionLeaderSeat` / 探索牌库 / 两个剧本的
// 公开标记），于是「新增战役只加 content/campaigns/<id>/」在观察面上不成立。
//
// 本模块把「战役状态 → 公开投影」的映射收进内容层：
//   · 只投影公开信息（探索牌库只给张数、遗物给位置/持有人、复仇合计、伊格之怒）；
//   · 字段名与旧投影**逐字一致**，前端与测试不需要改；
//   · 观察者无关（这些都是桌面公开信息），所以不需要 observer 参数。
//
// 读点：`src/integration/observation.js` 里的 `Object.assign(view, campaignProjection(state))`；
// 以及 `src/ai/ai-context.js` 的 campaignHints（战役作者给出的决策提示，只写公开信息）。
import { contentRegistry } from '../../content/registered.js'

export function campaignProjection(state) {
  const out = {}
  // 探索牌库是背面朝下的随机牌堆：只公开张数；弃牌堆公开内容。
  out.exploration = {
    deck: Array.isArray(state.explorationDeck) ? state.explorationDeck.length : 0,
    discard: [...(state.explorationDiscard || [])],
  }
  // 古代遗物：位置与持有人都是桌上的公开信息。
  out.relicOfAges = state.relicOfAges
    ? {
        code: state.relicOfAges.code,
        location: state.relicOfAges.location ?? null,
        seat: state.relicOfAges.seat ?? null,
      }
    : null
  // 命运之线：亚历山卓的位置、伊塔卡的猎物与目的地都是公开信息（卡在桌上/记录里）。
  if (state.scenario?.id === 'threadsOfFate') {
    const flags = state.scenarioFlags || {}
    const alejandro = flags.alejandro || null
    out.threadsOfFate = {
      alejandro: alejandro
        ? { code: alejandro.code || '04051', location: alejandro.location ?? null, enemyId: alejandro.enemyId ?? null }
        : null,
      prey: [...(flags.ichtacasPrey || [])],
      destinations: [...(flags.ichtacasDestinations || [])],
    }
  }
  // 幽嘶深渊：深度、追击区、瓦卢西亚之子与密谋旁附属都是桌上公开信息。
  if (state.scenario?.id === 'theDepthsOfYoth') {
    const flags = state.scenarioFlags || {}
    const zones = state.scenarioZones || {}
    const agenda = state.agendas?.[state.agendaIndex]
    out.depths = {
      depthLevel: Number(flags.depthLevel || 1),
      pursuit: [...(zones.pursuit || [])],
      childrenOfValusia: [...(zones.childrenOfValusia || [])],
      agendaAttachments: (agenda?.attachments || []).map(entry => entry.code || entry.originalCode),
    }
  }
  // 领队：状态字段优先，其次战役记录（旧存档只有后者）。
  out.expeditionLeaderSeat = Number.isInteger(state.expeditionLeaderSeat)
    ? state.expeditionLeaderSeat
    : (Number.isInteger(state.campaign?.expeditionLeader) ? state.campaign.expeditionLeader : null)
  // 复仇合计：胜利区里带复仇点数的虚拟卡（`recordVengeance` 写入）。
  out.vengeance = (state.victoryDisplay || []).reduce((sum, card) => sum + (card.vengeance || 0), 0)
  // 伊格之怒：战役记录里的累计值。
  out.yigsFury = Number(state.campaign?.records?.yigsFury || 0)
  return out
}

/**
 * 战役作者写给 AI 的决策提示（Phase 6 · 战役插件化：agentHints）。
 * 只写「桌面公开信息 + 规则提醒」，不得包含隐藏信息（遭遇牌库顺序、未揭示地点等）。
 * 战役清单里没有 `agentHints` 时返回空数组 —— 旧战役的提示词因此完全不变。
 */
export function campaignAgentHints(state) {
  const id = state?.campaign?.id
  if (!id) return []
  const manifest = contentRegistry.getCampaign(id)
  const hints = manifest?.agentHints
  return Array.isArray(hints) ? hints.filter(item => typeof item === 'string' && item) : []
}
