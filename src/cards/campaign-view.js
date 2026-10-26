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
import { extraEncounterDeckInfo } from '../engine/alt-decks.js'
import { tarotInfo } from '../engine/tarot.js'
import { bondedSetProjection } from '../engine/bonded.js'
import { watcherAndMementoProjection } from '../campaign/mementos.js'
import { locationStateProjection } from '../engine/location-state.js'
import { storyInvestigatorProjection } from '../engine/story-investigators.js'
import { projectHunch } from '../engine/hunch-deck.js'
import { resourceBankProjection } from '../engine/resource-bank.js'

export function campaignProjection(state) {
  const out = {}
  // 直觉牌库（第 5 步 P6）：牌库张数与已揭示的那张是桌面公开信息，顺序不投影。
  const hunch = projectHunch(state)
  if (hunch.length) out.hunch = hunch
  // 资源寄存（第 5 步 P6）：「家族遗产」上的资源数印在卡面上，属于公开信息。
  const banks = (state.investigators || []).map(inv => resourceBankProjection(inv)).filter(Boolean)
  if (banks.length) out.resourceBanks = banks
  // 探索牌库是背面朝下的随机牌堆：只公开张数；弃牌堆公开内容。
  out.exploration = {
    deck: Array.isArray(state.explorationDeck) ? state.explorationDeck.length : 0,
    discard: [...(state.explorationDiscard || [])],
  }
  // 第二遭遇牌堆（第四循环 P2.2）：只有建过堆的关卡才投影；顺序永不外泄，只给张数与弃牌堆。
  if (state.extraEncounterDecks?.spectral) out.spectral = extraEncounterDeckInfo(state, 'spectral')
  // 塔罗牌组（第四循环 P2.4）：只给牌库存量与已抽出的牌（正逆位），顺序不投影。
  if (state.scenarioDecks?.tarot) out.tarot = tarotInfo(state)
  // 序章故事调查员（第四循环 P2.6）：谁选了谁、哪些被划掉都是桌面公开信息。
  const storyInvestigators = storyInvestigatorProjection(state)
  if (storyInvestigators) out.storyInvestigators = storyInvestigators
  // 绑定（第四循环 P2.8）：场外集合是桌面公开信息，只投影有集合的关卡。
  const bonded = bondedSetProjection(state)
  if (Object.keys(bonded).length) out.bonded = bonded
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
  // 卡尔克萨之路：黑星升起的双密谋牌堆、苍白面具的地下墓穴牌库、邪秽誓约的钥匙
  // 都是桌面公开信息。以前只有 a 牌堆通过 state.doom 间接可见，c 牌堆完全看不到，
  // 玩家无法判断该把毁灭放到哪套密谋上、另一套推进到了第几张。
  // 只投影公开字段：牌堆张数、当前（已翻开的）卡号、毁灭、是否已移出游戏；
  // 未翻开的牌序不投影（否则客户端能提前看到下一张密谋）。
  if (state.scenario?.id === 'blackStarsRise') {
    const flags = state.scenarioFlags || {}
    const deckInfo = deck => deck ? {
      size: Array.isArray(deck.cards) ? deck.cards.length : 0,
      index: Number(deck.index || 0),
      doom: Number(deck.doom || 0),
      removed: deck.removed === true,
      current: deck.cards?.[deck.index] ?? null,
    } : null
    out.blackStarsRise = {
      route: flags.route || null,
      openPath: flags.openPath === true,
      openedDeck: flags.pathOpenedBy || null,
      decks: { a: deckInfo(flags.agendaDecks?.a), c: deckInfo(flags.agendaDecks?.c) },
    }
  }
  if (state.scenario?.id === 'thePallidMask') {
    const flags = state.scenarioFlags || {}
    const tomb = (state.locations || []).find(location => location.id === flags.tombLocationId)
    out.thePallidMask = {
      catacombs: Array.isArray(state.scenarioZones?.catacombsDeck)
        ? state.scenarioZones.catacombsDeck.length : 0,
      // 暗影坟墓只在已揭示后才公开具体是哪一张，避免泄露未揭示地点的身份。
      tombRevealed: tomb?.revealed === true,
      tombName: tomb?.revealed ? tomb.name : null,
    }
  }
  if (state.scenario?.id === 'theUnspeakableOath') {
    out.theUnspeakableOath = { keysFound: Number(state.scenarioFlags?.keysFound || 0) }
  }
  // 遗留记忆 / 看守人（第四循环 P2.10）：记录里的公开信息，非空时才出现。
  Object.assign(out, watcherAndMementoProjection(state))
  // 裂口/火盆（第四循环 P2.11）：只投影有标记的地点，公开值。
  // 注意键名**不能**叫 `locations`：观察投影里的 `view.locations` 是地点数组，同名会把牌桌整张地图覆盖掉。
  const locationStates = locationStateProjection(state)
  if (Object.keys(locationStates).length) out.locationStates = locationStates
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
