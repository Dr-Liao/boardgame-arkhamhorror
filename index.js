// 桌游 Mod：诡镇奇谈 · 卡牌版（Arkham Horror: The Card Game）
//
// 这是一个「合作类卡牌桌游」Mod：1~4 个真人或 AI 席位共同组成调查队，
// 对抗剧本（敌人 + 遭遇牌 + 密谋/毁灭）。规则引擎见 src/engine/engine.js。
//
// 模块分层见 ARCHITECTURE.md：src/ 放服务端领域代码，content/ 放内容包，web/ 放浏览器资源。
//
// 与经典双人 Mod（五子棋/井字棋）不同：
//   - cooperative = true：AI 是「队友」而非「对手」；
//   - 支持可变席位数，以及本地 AI / 联机真人混合队伍；
//   - AI 队友由模型选择调查员、构筑和升级；确定性策略只作失败兜底。

import {
  sessionPolicy, saveSummary, actionsRemaining as containerActionsRemaining, participantDescription,
  createSessionCheckpoint, checkpointView, migrateSessionCheckpoints, forkSessionCheckpoint,
} from './src/integration/hall-integration.js'
import { agentPlanning, planPrompt, plansForObserver } from './src/ai/agent-plans.js'
import { commitChoiceBatch } from './src/integration/choice-batch.js'
import { buildDebugCommand } from './src/integration/debug-console.js'

import { contentRegistry } from './content/registered.js'
import { META } from './src/cards/cards-data.js'
import { stateCompatibilityError } from './src/engine/rules-state.js'
import { migrateState } from './src/engine/save-migration.js'
import { setAutoReactionHosted } from './src/engine/resolution.js'
import { campaignListForUi } from './content/registry.js'
import { laneBalance } from './src/campaign/campaign-modes.js'
// 双线开闸是逐战役的：P5 只验证机制（演示/夹具可置 dualLineGate: 'open'），
// 真实 TDE 要等 P9.5 的 4 人 2+2 / 2 人 1+1 矩阵验收后再打开。
import { contentRegistry as campaignRegistry } from './content/registered.js'
import { deckBuilderData } from './src/deck/deckbuilding.js'
import {
  createGameState, applyMove, validateMove, describeParts, legalMoves, moveToText, decisionSeat, actingSeats, seatLocalMove,
  decisionSeed, moveCost, autoHubMove,
} from './src/engine/engine.js'

// P0 自动跳过：纯判定放在 web/ 里给浏览器与 Node 共用（Node 反向 import web/ 是允许的，
// 见 tests/architecture-guard.test.mjs 的「服务端模块如需复用，应由 Node 侧 import web/」）。
import { reactionSkipPlan } from './web/reaction-preferences.js'
import { handleApi, resourceVersion } from './src/integration/web-api.js'
import { handleDeckLibrary } from './src/integration/deck-library.js'
import { handleMusicLibrary } from './src/integration/music-library.js'
import { cacheWebAsset as cacheImageAsset } from './src/integration/image-cache.js'
import { cacheMusicAsset } from './src/integration/music-cache.js'
import { viewState, viewEvents, staticTables } from './src/integration/observation.js'
import { laneToRoomSeat, laneSeatForRoom } from './src/engine/lane-runtime.js'
import {
  isParallelState, laneStateOf, launchParallelLanes, parallelActingSeats, parallelApplyMove, parallelAutoChoice, parallelDecisionSeat,
  parallelDescribe, parallelLegalMoves, parallelPendingChoice, parallelPublicView, parallelSeatLocalMove,
  parallelValidateMove, parallelView, syncParallelStatus,
} from './src/integration/parallel-runtime.js'
import { aiDecisionContext } from './src/ai/ai-context.js'
import { storyChatContext } from './src/ai/ai-story.js'
import {
  DEFAULT_AI_DIALOGUE_SETTINGS, actionSpeechFrequency, reactionTriggers,
} from './src/ai/ai-dialogue.js'

// 动态元数据本地化缓存（docs/localization.md §7.2）：战役名来自内容注册表，
// 无法写死在静态 i18n.messages 里，由顶层 localize(locale) 按 locale 缓存。
const LOCALIZED_CAMPAIGN_OPTIONS = {}

const MOVE_FORMAT = [
  '局外：选择调查员 hubSelectInvestigator(code)；选人先看【决策资料】的 teamSummary，优先补齐尚未覆盖的职责，不要与队友重复同一职业定位；构筑 {"action":"hubSetDeck","codes":["卡号", "卡号", ...]}，按规定尺寸提交完整清单。',
  '升级：hubPurchase(added,removed) 可以连续暂存；hubConfirmUpgrades 确认、hubCancelUpgrades 撤销；hubDoneSeat 完成。其余局外操作照抄合法列表。',
  '{"action":"<行动>"}，行动类型如下（具体可用行动见【可执行行动】列表，照抄其中的 JSON 即可）：',
  '- 回答待决选择：{"action":"choose","choiceId":"<当前选择 id>","optionId":"<合法选项 id>"}',
  '- 有 pendingChoice 时，只能由 pendingChoice.seat 指定的座位回答 choose；不得执行普通行动，也不得回答其他座位的选择。',
  '- choiceId、optionId 与可选 revision 必须来自当前状态的合法行动；每次提交后重新读取列表，不复用旧选择。',
  '- 打出卡牌：{"action":"play","cardId":"<卡牌 code>"}',
  '- 抽牌：{"action":"draw"}',
  '- 获得资源：{"action":"resource"}',
  '- 移动：{"action":"move","locationId":"<地点 id>"}',
  '- 调查：{"action":"investigate"}',
  '- 攻击：{"action":"fight","enemyId":"<敌人 id>"}',
  '- 躲避：{"action":"evade","enemyId":"<敌人 id>"}',
  '- 主动交战（冷漠等不会自动交战的敌人）：{"action":"engage","enemyId":"<敌人 id>"}',
  '- 使用资产能力：{"action":"ability","assetId":"<资产 id>","abilityIndex":<整数索引>}',
  '- 使用资产能力（需选择目标敌人时）：{"action":"ability","assetId":"<资产 id>","abilityIndex":<整数>,"targetId":"<敌人 id>"}',
  '- 能力产生后续选择时：先提交合法 ability 行动，待 pendingChoice 出现后再用 choose 回答，不预先猜测分支。',
  '- 使用调查员异能（如奥图尔花 2 资源换行动）：{"action":"freeAction"}',
  '- 谈判敌人/丽塔：{"action":"parley","enemyId":"<敌人 id>"} 或 {"action":"parleyLita"}',
  '- 谈判盘问异教徒（午夜假面）：{"action":"parleyCultist","enemyId":"<敌人 id>"}',
  '- 抽取异教徒牌堆（午夜假面）：{"action":"drawCultist"}',
  '- 破坏仪式（地底噬魔）：{"action":"interruptRitual","skill":"willpower|agility"}',
  '- 献祭丽塔（地底噬魔）：{"action":"sacrificeLita"}',
  '- 破门：{"action":"breakDoor"}',
  '- 弃掉威胁区域弱点：{"action":"discardThreat","threatId":"<威胁 id>"}',
  '- 净化威胁（死灵之书，移走恐惧）：{"action":"purgeThreat","threatId":"<威胁 id>"}',
  '- 结束回合：{"action":"endTurn"}',
  '- 撤退：{"action":"resign"}',
  '',
  '行动要点（务必注意）：',
  '- 多数行动消耗 1 个行动点（每回合 3 点）；「弃掉威胁」等个别行动可能消耗 2 个行动点（见【可执行行动】label 里的「花 N 行动」）。',
  '- 「免费行动」不消耗行动点（label 带「⚡」）：奥图尔花 2 资源 +1 行动、部分资产能力（cost.action=false）。免费行动不会自动结束你的回合。',
  '- 已接入待决协议的换牌、技能投入、天赋牌付费与可选反应，使用窗口中的 choose 显式回答，不默认代选；其他旧效果仍可能简化处理。',
  '- 闪躲、守护结界等快速反应卡不能作为普通行动打出；只有在敌人攻击或抽到诡计的反应窗口出现时，才能用 choose 选择打出。',
  '- 多步选择需逐次提交合法回答，再使用列表中的确认或跳过选项；不要自行构造多选数组、索引或支付数量。',
  '- 带 targetId 的行动：当一项能力需要指定目标敌人时，【可执行行动】会为每个可选敌人各列一条，照抄其 JSON 即可（targetId 是敌人 id）。',
  '- 任何目标、支付、伤害恐惧分配、搜索或剧情回答都以当前合法列表为准；不要依据卡文自行添加选项或跳过必要选择。',
].join('\n')

const AGENT_HINT = [
  '这是一款【合作】桌游：你和所有其他调查员是队友，共同对抗剧本，而不是互相竞争。',
  '【离场与聊天】先核对座位身份和当前队伍参与状态。被击败、撤退、永久死亡、永久疯狂必须区分；被击败不等于永久死亡。已离场调查员不能继续本关行动或提供投入、支援，不得要求其调查、战斗、移动或等待其行动，也不得臆造治疗复活。真人仍能聊天和讨论策略；玩家继续发言不代表调查员恢复行动。回应其倒下或讨论分工时，应承认当前状态并由仍在场队友接手。当前状态优先于旧聊天、备忘和计划；准备、结算及更换调查员仍以当前合法选项为准。',
  '【实现边界】当前可启动《夜之狂热》《敦威治遗产》《卡尔克萨之路》《失落的时代》和《万象无终》；部分内容带 earlyAccess 或明确登记的近似实现，不是严格规则等价认证。全卡图鉴收录不等于可玩，以当前战役状态、合法行动和服务端结算为准，不根据原版卡文臆造效果。',
  '你们正在推进当前战役；关卡顺序、可用机制和结局以服务端状态与合法动作列表为准。',
  '【线索与移动】按当前场景推进条件核对所需线索、支付地点和时机，不从剧情文字猜测开门或触发条件。以收集线索为目标时选择仍有线索且可调查的地点；零线索地点仍可用于必经路线、支付推进、战斗、支援或撤退，但移动必须有具体目的。不要在条件未变化时反复往返两个空地点来试探剧情；每步核对线索缺口，旧计划声称“线索带齐”不能覆盖当前数值。要求回合结束支付时，凑齐后留在指定地点等支付窗口，不要因当前没有 advanceAct 就离开。',
  '【战役目标与合作】胜利点、创伤与冒险日志会跨关继承。请以团队整体利益为重：让高智识者调查、高战斗者处理敌人，配合队友推进场景目标；奖励、创伤及后续布置以当前实现的结算状态为准。',
  '收到待决选择时，不论当前是谁的回合，都只由指定回答座位提交 {"action":"choose","choiceId":"...","optionId":"..."}。可以跳过也必须使用合法列表提供的跳过选项；多步选择逐次回答、逐次读取新状态。',
  '没有待决选择时，从合法列表选一个普通行动作为 move；行动成本与可支付性以列表为准，免费行动不消耗行动点。',
  '技能检定会从混乱袋抽取标记；已接入协议的投入手牌、付费增益与可选反应通过待决窗口显式选择。未迁移的其他效果仍以简化模式和合法列表为准。',
  '注意槽位、资产使用次数与借机攻击；敌人的反击、猎手、猎物和庞大等关键词会影响行动结果。威胁区域中的弱点可能持续妨碍调查员；处理方法和成本以合法行动为准。威胁区域与对应能力文案会同时给出弱点上的充能/标记数量与目标值：达标后不要再重复投入（那只会白耗支援），未达标时才继续补。',
  '【交战与借机攻击】被敌人交战时，先看局面里的「借机攻击」提示和行动列表的 ⚠ 标记：抽牌、获得资源、移动、调查、打出卡牌、普通资产能力都会在效果结算前先被每个未横置的交战敌人攻击一次。除非这一手能立刻解除威胁（例如装上武器后马上攻击）或你已确认承受得起，否则先用攻击、躲避、谈判或撤退，或改用免费/「不引发借机攻击」的效果；不要被缠住时习惯性抽牌、攒资源或来回移动。',
  '请结合当前局势与队友状态做最优决策：缺线索就调查、被敌人纠缠就攻击或躲避、受伤/受惊就治疗或撤退、资源足够就打出强力卡牌；能推进「场景」目标时优先推进，同时盯住「密谋」的毁灭进度避免灭团。',
].join('\n')

// ---------------------------------------------------------------------------
// P5 批次 3：双线（pick / singleA / singleB）的大厅边界适配器
//
// 规则引擎在关卡内只认线内连续座位（laneSeat）；大厅命令、观察投影与 AI 用房间座位
// （roomSeat）。这里按 state.laneRuntime 做一次双向转换，非双线战役全部原样透传。
// viewEvents 不接收 state：私密座位在事件生成时已写成房间座位
// （roomSeatForEvent，并行则在 parallelApplyMove 里连演出快照一起换算）。
// ---------------------------------------------------------------------------
const laneSeatOfRoom = (state, roomSeat) => (state?.laneRuntime ? laneSeatForRoom(state, roomSeat) : roomSeat)
const roomSeatOfLane = (state, laneSeat) => (state?.laneRuntime ? laneToRoomSeat(state, laneSeat) : laneSeat)
const seatIsWaiting = (state, seat) => state?.laneRuntime != null && laneSeatOfRoom(state, seat) == null

const hostedLegalMoves = (state, seat = null) => {
  if (isParallelState(state)) return seat == null ? [] : parallelLegalMoves(state, seat)
  if (seat == null) return legalMoves(state)
  if (seatIsWaiting(state, seat)) return []
  return legalMoves(state, laneSeatOfRoom(state, seat))
}
const dualLineGateOpen = state => campaignRegistry.getCampaign(state?.campaign?.id)?.dualLineGate === 'open'
const parallelLaunchReason = state => {
  if (!dualLineGateOpen(state)) return '双线开闸属于 P9.5：该战役还没有在 manifest 打开 dualLineGate'
  const balance = laneBalance(state.campaign.seatParts)
  if (!balance.balanced) return `两线人数必须相等（A ${balance.A} / B ${balance.B}）`
  return null
}
const parallelLaunchMove = (state, move) => state?.campaign?.mode === 'parallel'
  && !isParallelState(state) && move?.action === 'hubBeginScenario'
const hostedValidateMove = (state, seat, move) => {
  if (parallelLaunchMove(state, move)) return parallelLaunchReason(state)
  if (isParallelState(state)) return parallelValidateMove(state, seat, move)
  if (seatIsWaiting(state, seat)) return '现在不是你的行动时机（另一条线）'
  return validateMove(state, laneSeatOfRoom(state, seat), move)
}
const hostedApplyMove = (state, seat, move) => {
  if (isParallelState(state)) return parallelApplyMove(state, seat, move)
  // 并行开闸：hub 的「开始第一关」直接启动两份运行时（容器进入局内态，
  // 各座位的视图/可用动作由 parallelView / parallelLegalMoves 按线投影）。
  if (parallelLaunchMove(state, move)) {
    const reason = parallelLaunchReason(state)
    if (reason) throw new Error(reason)
    const launched = launchParallelLanes(state)
    if (!launched.ok) throw new Error('并行双线已经在运行')
    state.currentSeat = parallelDecisionSeat(state) ?? 0
    state.legalMoves = []
    syncParallelStatus(state)
    return [{ type: 'info', text: '两条线同时进入梦境。', lane: null }]
  }
  if (seatIsWaiting(state, seat)) throw new Error('现在不是你的行动时机（另一条线）')
  return applyMove(state, laneSeatOfRoom(state, seat), move)
}
const hostedDecisionSeat = state => {
  if (isParallelState(state)) return parallelDecisionSeat(state)
  const seat = decisionSeat(state)
  return seat == null ? seat : roomSeatOfLane(state, seat)
}
const hostedActingSeats = state => (isParallelState(state)
  ? parallelActingSeats(state)
  : actingSeats(state).map(seat => roomSeatOfLane(state, seat)).filter(seat => seat != null))
const hostedSeatLocalMove = (state, seat, move) => {
  if (isParallelState(state)) return parallelSeatLocalMove(state, seat, move)
  if (seatIsWaiting(state, seat)) return false
  return seatLocalMove(state, laneSeatOfRoom(state, seat), move)
}
// 并行时该座位的权威局面在本线，不在容器。容器没有 scenario/round/actionsLeft。
const laneClock = (state, seat) => {
  if (seat == null || !isParallelState(state)) return state
  return laneStateOf(state, seat) || state
}
const hostedActionsRemaining = (state, seat) => {
  const lane = laneClock(state, seat)
  if (lane === state) return containerActionsRemaining(state, seat)
  const laneSeat = lane.laneRuntime?.roomSeats?.indexOf(seat) ?? -1
  if (laneSeat < 0) return undefined
  return lane.investigators?.find(item => item.seat === laneSeat)?.actionsLeft
}
const hostedAgentPlanning = {
  ...agentPlanning,
  commit(session, seat, raw, decisionState = session.state) {
    agentPlanning.commit(session, seat, raw, laneClock(decisionState, seat))
  },
  view(session, seat) {
    return plansForObserver(session, seat, laneClock(session.state, seat))
  },
  prompt(session, seat) {
    return planPrompt(session, seat, laneClock(session.state, seat))
  },
}
const hostedViewState = (state, seat = null, options = {}) => {
  if (isParallelState(state)) return seat == null ? parallelPublicView(state) : parallelView(state, seat)
  const observer = seat == null || !state?.laneRuntime ? seat
    : (seatIsWaiting(state, seat) ? null : laneSeatOfRoom(state, seat))
  return viewState(state, observer, options)
}
const describeStateFor = (state, observer) => {
  const parts = describeParts(state, observer)
  return parts.body + aiDecisionContext(state, observer) + (parts.tail ? '\n' + parts.tail : '')
}
const hostedDescribeState = (state, seat) => {
  if (isParallelState(state)) return seat == null ? '' : parallelDescribe(state, seat)
  if (seat == null) return describeStateFor(state, decisionSeat(state))
  if (!state?.laneRuntime) return describeStateFor(state, seat)
  if (seatIsWaiting(state, seat)) return describeStateFor(state, null)
  return describeStateFor(state, laneSeatOfRoom(state, seat))
}

export default {
  id: 'arkhamhorror',
  name: '诡镇奇谈：卡牌版',
  nameEn: 'Arkham Horror LCG',
  players: [1, 4],
  seats: 4,
  cooperative: true,
  sessionPolicy,
  saveSummary,
  actionsRemaining: hostedActionsRemaining,
  participantDescription,
  createSessionCheckpoint,
  checkpointView,
  // P0 联机：大厅按这个钩子取并行线的待决选择（房间座位）。
  pendingChoice(state) { return parallelPendingChoice(state) },
  migrateSessionCheckpoints,
  forkSessionCheckpoint,
  commitChoiceBatch,
  agentPlanning: hostedAgentPlanning,
  agentActionMessage({ before, seat, move, speech = '' }) {
    if (speech.trim()) return speech.trim()
    const name = before.investigators?.find(inv => inv.seat === seat)?.name || '调查员'
    // Pending answers may contain private hand/search candidates. Summarize
    // their category without publishing the selected card or hidden option.
    const choice = { commit: '技能投入', mulligan: '起手换牌', search: '搜索', discard: '弃牌', 'discard-hand': '弃牌' }
    const action = move.action === 'choose' ? (choice[before.pendingChoice?.kind] || '规则选择')
      : move.action.startsWith('hub') ? '调查准备' : moveToText({ ...move, label: undefined })
    return `${name}：已完成${action}。`
  },
  agentActionSpeechFrequency: actionSpeechFrequency,
  agentReactionTriggers: reactionTriggers,
  agentTurnKey: (state, seat) => {
    const source = laneClock(state, seat)
    const current = source === state ? source.currentSeat
      : (source.laneRuntime?.roomSeats?.[source.currentSeat] ?? source.currentSeat)
    return [source.uiState, source.scenario?.id, source.round, source.phase, current, seat].join(':')
  },
  validateAgentMove(state, seat, move) {
    return ['hubAutoDeck', 'hubAutoUpgrade'].includes(move.action) ? '模型需自主提交 hubSetDeck 的 codes 或选择 hubPurchase；自动策略只作失败兜底。' : null
  },
  agentFallback: (state, seat) => autoHubMove(state, seat, true),
  aiSlotLabel: 'AI 队友',
  aiSlotDescription: '由 AI 扮演的调查员队友（AI 会自动分配调查员并构筑卡组）',
  cover: 'linear-gradient(180deg, rgba(5, 13, 18, .02), rgba(4, 9, 13, .42)), url("/mods/arkhamhorror/img/cover/hall-cover.webp") center / cover no-repeat',
  coverEmoji: '\u00a0',
  description: '克苏鲁神话合作卡牌桌游：扮演调查员，构筑卡组，与 AI 队友一起调查诡异事件、对抗古老邪神。',
  tags: ['卡牌', '合作', '克苏鲁', '策略'],

  // 目录与开局设置元数据的本地化声明（docs/localization.md §7.1；接入步骤见 §8.7 第一步）。
  // i18n 是纯 JSON：大厅只按当前语言取展示文案，不改 type/default/选项集合。
  // zh-CN 是源语言，基础字段本身就是中文，messages 里可以省略。
  i18n: {
    defaultLocale: 'zh-CN',
    supportedLocales: ['zh-CN', 'en'],
    messages: {
      en: {
        name: 'Arkham Horror: The Card Game',
        description: 'A cooperative Lovecraftian card game: play investigators, build decks, and join AI teammates to investigate strange cases and confront ancient evils.',
        tags: ['Cards', 'Cooperative', 'Cthulhu', 'Strategy'],
        aiSlotLabel: 'AI teammate',
        aiSlotDescription: 'An AI-controlled investigator teammate (the AI assigns an investigator and builds the deck automatically)',
        settings: {
          playerCount: {
            label: 'Number of players',
            description: 'Total investigator seats; currently one human player plus AI teammates.',
            options: { 1: '1 player', 2: '2 players', 3: '3 players', 4: '4 players' },
          },
          campaignId: { label: 'Campaign' },
          cardPoolScope: {
            label: 'Card pool',
            description: 'Progressive: cards from cycles after the current campaign cycle are disallowed (investigators, deckbuilding and between-scenario upgrades are all restricted); All: no restriction on card sources.',
            options: { all: 'All', progressive: 'Progressive' },
          },
          allowRollback: {
            label: 'Allow rollback',
            description: 'Allow restarting from a scenario checkpoint (creates a branched save). When off, this game cannot roll back; normal save loading is unaffected.',
          },
          aiStoryAwareness: {
            label: 'AI story awareness',
            description: 'When on, AI teammates can read completed adventure log entries when deciding, get prior-scenario context for story choices, and reference story summaries in chat; they never see unreached story or ending branches.',
          },
          aiRoutineSpeechFrequency: { label: 'Routine action speech frequency' },
          aiSelfTestSpeechFrequency: { label: 'Self regular test response frequency' },
          aiOtherTestSpeechFrequency: { label: 'Other investigators regular test response frequency' },
          aiSelfCriticalSuccessSpeechFrequency: { label: 'Self critical success response frequency' },
          aiOtherCriticalSuccessSpeechFrequency: { label: 'Other investigators critical success response frequency' },
          aiSelfCriticalFailureSpeechFrequency: { label: 'Self critical failure response frequency' },
          aiOtherCriticalFailureSpeechFrequency: { label: 'Other investigators critical failure response frequency' },
          aiEnemyDefeatSpeechFrequency: { label: 'Enemy defeat response frequency' },
          aiInvestigatorExitDialogue: { label: 'Dialogue when an investigator leaves the scenario' },
          aiScenarioEndDialogue: { label: 'Dialogue at scenario end' },
          opponents: {
            label: 'AI teammates',
            description: 'Choose teammates from the hall AI list; teammates pick their investigator and deck during campaign preparation.',
          },
        },
      },
    },
  },

  // 动态元数据（docs/localization.md §7.2）：战役名等来自内容注册表的选项。
  // 同步纯函数、不得修改入参、不做重 I/O；返回形状与 messages[locale] 相同，最后合并。
  // 结果按 locale 缓存在模块内；没有英文名时保留中文。
  localize(locale) {
    if (locale !== 'en') return null
    let options = LOCALIZED_CAMPAIGN_OPTIONS.en
    if (!options) {
      options = Object.fromEntries(campaignListForUi(contentRegistry).map(campaign => [campaign.id, campaign.nameEn || campaign.name]))
      LOCALIZED_CAMPAIGN_OPTIONS.en = options
    }
    return { settings: { campaignId: { options: { ...options } } } }
  },

  render: { kind: 'cards' },
  agentHint: AGENT_HINT,

  // 本 Mod 自带的浏览器资源（脚本／样式／卡图）全部放在 games/arkhamhorror/web/，
  // 由大厅挂载到 /mods/arkhamhorror/；不要把这些文件散落到大厅的 public/ 里。
  // locales：游戏自带的前端语言包（docs/localization.md §8.2），大厅只校验路径并生成 URL。
  web: { dir: 'web', client: 'game-ui.js', styles: 'style.css', locales: { 'zh-CN': 'locales/zh-CN.js', en: 'locales/en.js' } },
  resourceVersion,
  handleApi,
  handleLocalApi(request) { return handleMusicLibrary(request) || handleDeckLibrary(request) },
  async cacheWebAsset(request) {
    return request.relative?.startsWith('audio/') ? cacheMusicAsset(request) : cacheImageAsset(request)
  },

  // Phase 6 · 前端「卡组构筑界面」与「战役选择」的静态元数据（纯 JSON，经 /api/catalog 下发）。
  get clientData() { return { deckBuilder: deckBuilderData(), campaigns: campaignListForUi(contentRegistry) } },
  hideOpponentSettings: true,
  requireReliableSaves: true,

  get settingsSpec() { return [
    {
      key: 'playerCount', type: 'select', label: '玩家人数', default: 2,
      description: '调查员席位总数；当前由 1 名人类与其余 AI 队友组成',
      options: [
        { value: 1, label: '1 人' }, { value: 2, label: '2 人' },
        { value: 3, label: '3 人' }, { value: 4, label: '4 人' },
      ],
    },
    {
      key: 'campaignId', type: 'select', label: '战役', default: 'nightOfTheZealot',
      options: campaignListForUi(contentRegistry).map(campaign => ({ value: campaign.id, label: campaign.name })),
    },
    {
      // 卡牌范围与回档开关在「游戏高级设置」弹窗里编辑（hub.js），不占用开局表单的通用下拉框。
      key: 'cardPoolScope', type: 'select', label: '卡牌范围', default: 'all',
      description: '渐进式：禁止超过当前循环的所有卡牌，只能使用当前战役循环及更早循环的卡牌（调查员、构筑与关间升级都受限）；全部：不限制卡牌来源。',
      options: [{ value: 'all', label: '全部' }, { value: 'progressive', label: '渐进式' }],
    },
    {
      key: 'allowRollback', type: 'toggle', label: '允许回档', default: 'on',
      description: '允许从关卡检查点「从此关重新开始」（创建分支存档）。关闭后本局不能回档；普通读档不受影响。',
    },
    {
      // AI 感知剧情归入「AI 高级设置」弹窗；默认开启，让 AI 队友知道已经发生的剧情。
      key: 'aiStoryAwareness', type: 'toggle', label: 'AI 感知剧情', default: 'on',
      description: '开启后，AI 队友决策时可读取已达成的冒险日志，剧情选择时附带当前关前情，聊天时参考剧情梗概；不会获得未到达的剧情或结局分支。',
    },
    {
      key: 'aiRoutineSpeechFrequency', type: 'range', label: '日常行动发言频率',
      default: DEFAULT_AI_DIALOGUE_SETTINGS.routineFrequency, min: 0, max: 100, step: 5,
    },
    {
      key: 'aiSelfTestSpeechFrequency', type: 'range', label: '自身普通检定回应频率',
      default: DEFAULT_AI_DIALOGUE_SETTINGS.selfTestFrequency, min: 0, max: 100, step: 5,
    },
    {
      key: 'aiOtherTestSpeechFrequency', type: 'range', label: '其他角色普通检定回应频率',
      default: DEFAULT_AI_DIALOGUE_SETTINGS.otherTestFrequency, min: 0, max: 100, step: 5,
    },
    {
      key: 'aiSelfCriticalSuccessSpeechFrequency', type: 'range', label: '自身大成功回应频率',
      default: DEFAULT_AI_DIALOGUE_SETTINGS.selfCriticalSuccessFrequency, min: 0, max: 100, step: 5,
    },
    {
      key: 'aiOtherCriticalSuccessSpeechFrequency', type: 'range', label: '其他角色大成功回应频率',
      default: DEFAULT_AI_DIALOGUE_SETTINGS.otherCriticalSuccessFrequency, min: 0, max: 100, step: 5,
    },
    {
      key: 'aiSelfCriticalFailureSpeechFrequency', type: 'range', label: '自身大失败回应频率',
      default: DEFAULT_AI_DIALOGUE_SETTINGS.selfCriticalFailureFrequency, min: 0, max: 100, step: 5,
    },
    {
      key: 'aiOtherCriticalFailureSpeechFrequency', type: 'range', label: '其他角色大失败回应频率',
      default: DEFAULT_AI_DIALOGUE_SETTINGS.otherCriticalFailureFrequency, min: 0, max: 100, step: 5,
    },
    {
      key: 'aiEnemyDefeatSpeechFrequency', type: 'range', label: '击败敌人回应频率',
      default: DEFAULT_AI_DIALOGUE_SETTINGS.enemyDefeatFrequency, min: 0, max: 100, step: 5,
    },
    {
      key: 'aiInvestigatorExitDialogue', type: 'toggle', label: '调查员退出本关时对话',
      default: DEFAULT_AI_DIALOGUE_SETTINGS.investigatorExitDialogue ? 'on' : 'off',
    },
    {
      key: 'aiScenarioEndDialogue', type: 'toggle', label: '关卡结束时对话',
      default: DEFAULT_AI_DIALOGUE_SETTINGS.scenarioEndDialogue ? 'on' : 'off',
    },
    {
      key: 'opponents', type: 'aiList', label: 'AI 队友',
      description: '从大厅 AI 列表中选择队友；调查员与卡组由队友在战役准备阶段选择。',
    },
  ] },
  defaults: {
    playerCount: 2, campaignId: 'nightOfTheZealot', aiStoryAwareness: 'on',
    cardPoolScope: 'all', allowRollback: 'on',
    aiRoutineSpeechFrequency: DEFAULT_AI_DIALOGUE_SETTINGS.routineFrequency,
    aiSelfTestSpeechFrequency: DEFAULT_AI_DIALOGUE_SETTINGS.selfTestFrequency,
    aiOtherTestSpeechFrequency: DEFAULT_AI_DIALOGUE_SETTINGS.otherTestFrequency,
    aiSelfCriticalSuccessSpeechFrequency: DEFAULT_AI_DIALOGUE_SETTINGS.selfCriticalSuccessFrequency,
    aiOtherCriticalSuccessSpeechFrequency: DEFAULT_AI_DIALOGUE_SETTINGS.otherCriticalSuccessFrequency,
    aiSelfCriticalFailureSpeechFrequency: DEFAULT_AI_DIALOGUE_SETTINGS.selfCriticalFailureFrequency,
    aiOtherCriticalFailureSpeechFrequency: DEFAULT_AI_DIALOGUE_SETTINGS.otherCriticalFailureFrequency,
    aiEnemyDefeatSpeechFrequency: DEFAULT_AI_DIALOGUE_SETTINGS.enemyDefeatFrequency,
    aiInvestigatorExitDialogue: DEFAULT_AI_DIALOGUE_SETTINGS.investigatorExitDialogue ? 'on' : 'off',
    aiScenarioEndDialogue: DEFAULT_AI_DIALOGUE_SETTINGS.scenarioEndDialogue ? 'on' : 'off',
    opponents: [null, null, null],
    rulesMode: 'simplified',
  },

  // —— 给 AI 的接口 ——
  moveFormat: MOVE_FORMAT,
  moveToText,
  // 观察顺序：局势 body → 【决策资料】JSON → 决策块 tail。
  // 决策块（当前场景推进条件 / 敌人意图 / 借机攻击 / 待决选择 / 可执行行动）必须留在最后：
  // 大厅会在观察后面接「回合进度 + 对局进程 + 输出要求」，把决策块放在 JSON 之前会让它离
  // 输出要求差上 1.4 万 token，满场局面下模型容易被中间的卡面资料稀释。
  describeState: hostedDescribeState,
  chatContext: state => storyChatContext(state),
  legalMoves: hostedLegalMoves,
  decisionSeat: hostedDecisionSeat,
  actingSeats: hostedActingSeats,
  seatLocalMove: hostedSeatLocalMove,
  decisionSeed,
  moveCost,
  saveCompatibilityError: state => stateCompatibilityError(state, META.resourceVersion),
  saveCompatibilityFromState: true,
  migrateState,
  viewState: hostedViewState,
  viewEvents,
  // P3.2 A1′：viewState 不修改入参 state（含嵌套对象），因此大厅可以每 revision 只把权威 state
  // structuredClone 一次，作为隔离副本交给各席位视图共用；不声明该能力时大厅保持逐席位拷贝。
  viewStateSharesState: true,
  // P1.4：会话级公共静态表（cards / investigatorDefs），大厅按 staticVersion 只下发一次。
  staticTables,

  // —— 规则 ——
  createState(settings, players) {
    return createGameState({ ...settings, campaignHub: settings.legacyAutoStart !== true }, players)
  },
  validateMove: hostedValidateMove,
  applyMove: hostedApplyMove,

  // —— 调试控制台（大厅可选钩子，见 lib/mods.js 与 artifacts/debug-console/CONTRACT.md §4）——
  // isDebugMove 让大厅拒绝经由普通 /move、自动代答或批量选择夹带调试动作；
  // debugCommand 只在 host-only 调试通道调用：解析由本 Mod 完成（只读），返回的 move 仍走
  // commitMove 事务（validateMove/applyMove/revision/actionLog/事件/快照与普通行动一致）。
  isDebugMove(move) { return move?.action === 'debug' },
  debugCommand(session, seat, command) { return buildDebugCommand(session, seat, command) },

  // 大厅加载 Mod 时调用一次：从此自动奖励窗口对真人可见，由大厅代答。
  // 纯引擎消费者（单测 / replay-fixtures / 审计工具）不调用，保持旧的直接领取。
  enableAutoReactionHosted() { setAutoReactionHosted(true) },

  // 三态自动结算（大厅可选钩子）：发布前把该座位的待决窗口代答成 trigger / skip。
  // states 只含该座位「动过的卡」；没有覆盖时按 autoByDefault 取内置默认：
  // 纯收益自动奖励 = auto，其余（如罗兰的线索反应）= ask。返回普通 move，仍过 validateMove。
  autoChoice({ state, seat, states }) {
    if (isParallelState(state)) return parallelAutoChoice({ state, seat, states })
    const choice = state?.pendingChoice
    const laneSeat = seatIsWaiting(state, seat) ? null : laneSeatOfRoom(state, seat)
    if (!choice || laneSeat == null || choice.seat !== laneSeat) return null
    const stateOf = code => states?.[code]
      ?? (state?.cards?.[code]?.autoByDefault ? 'auto' : 'ask')
    // 自动优先：默认自动奖励或玩家手动切到 auto 的旧式反应，都可以补 trigger。
    const triggerOptionId = choice.autoOptionId || choice.autoTriggerOptionId
    if (triggerOptionId && choice.canSkip !== false && stateOf(choice.cardCode) === 'auto') {
      return { action: 'choose', choiceId: choice.id, optionId: triggerOptionId, auto: true }
    }
    // 新式反应窗口（ability-exec）：一个窗口里每张候选卡是一个 option，没有单一 trigger id。
    // 只有恰好一个候选卡设为 auto 时才代答；多个候选让玩家自己选，避免替玩家排序。
    if (!triggerOptionId && choice.kind === 'reaction' && Array.isArray(choice.options)) {
      const autoOptions = choice.options.filter(option => option.cardCode
        && state?.cards?.[option.cardCode]?.hasAutoReaction
        && stateOf(option.cardCode) === 'auto')
      if (autoOptions.length === 1) {
        return { action: 'choose', choiceId: choice.id, optionId: autoOptions[0].id, auto: true }
      }
    }
    if (!choice.canSkip) return null
    const plan = reactionSkipPlan(state, code => stateOf(code) === 'skip')
    if (!plan) return null
    return { action: 'choose', choiceId: plan.choice.id, optionId: 'skip', auto: true }
  },

  // 旧协议兼容：只按 disabledCodes 做 skip（不再被大厅优先调用）。
  autoPassChoice({ state, seat, disabledCodes }) {
    if (!Array.isArray(disabledCodes) || !disabledCodes.length) return null
    const choice = state?.pendingChoice
    if (!choice || !choice.canSkip || choice.seat !== seat) return null
    const disabled = new Set(disabledCodes)
    const plan = reactionSkipPlan(state, code => disabled.has(code))
    if (!plan) return null
    return { action: 'choose', choiceId: plan.choice.id, optionId: 'skip' }
  },
}
