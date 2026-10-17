// 桌游 Mod：诡镇奇谈 · 卡牌版（Arkham Horror: The Card Game）
//
// 这是一个「合作类卡牌桌游」Mod：1 名人类玩家 + 1~3 名 AI 队友，共同组成调查队，
// 对抗剧本（敌人 + 遭遇牌 + 密谋/毁灭）。规则引擎见 src/engine/engine.js。
//
// 模块分层见 ARCHITECTURE.md：src/ 放服务端领域代码，content/ 放内容包，web/ 放浏览器资源。
//
// 与经典双人 Mod（五子棋/井字棋）不同：
//   - cooperative = true：AI 是「队友」而非「对手」；
//   - 支持可变数量的 AI 队友（settings.teammates）；
//   - AI 队友由模型选择调查员、构筑和升级；确定性策略只作失败兜底。

import {
  sessionPolicy, saveSummary, actionsRemaining, participantDescription,
  createSessionCheckpoint, checkpointView, migrateSessionCheckpoints, forkSessionCheckpoint,
} from './src/integration/hall-integration.js'
import { agentPlanning } from './src/ai/agent-plans.js'
import { commitChoiceBatch } from './src/integration/choice-batch.js'

import { contentRegistry } from './content/registered.js'
import { META } from './src/cards/cards-data.js'
import { stateCompatibilityError } from './src/engine/rules-state.js'
import { migrateState } from './src/engine/save-migration.js'
import { campaignListForUi } from './content/registry.js'
import { deckBuilderData } from './src/deck/deckbuilding.js'
import {
  createGameState, applyMove, validateMove, describeState, legalMoves, moveToText, decisionSeat, actingSeats, seatLocalMove,
  decisionSeed, moveCost, autoHubMove,
} from './src/engine/engine.js'

import { handleApi, resourceVersion } from './src/integration/web-api.js'
import { handleDeckLibrary } from './src/integration/deck-library.js'
import { cacheWebAsset } from './src/integration/image-cache.js'
import { viewState, viewEvents } from './src/integration/observation.js'
import { aiDecisionContext } from './src/ai/ai-context.js'
import { storyChatContext } from './src/ai/ai-story.js'
import {
  DEFAULT_AI_DIALOGUE_SETTINGS, actionSpeechFrequency, reactionTriggers,
} from './src/ai/ai-dialogue.js'

const MOVE_FORMAT = [
  '局外：选择调查员 hubSelectInvestigator(code)；构筑 {"action":"hubSetDeck","codes":["卡号", "卡号", ...]}，按规定尺寸提交完整清单。',
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
  '【简化模式】当前开放部分 Core 卡牌及《夜之狂热》三关流程，不是严格规则等价实现；全卡图鉴收录不等于可玩。以当前状态和合法行动为准，不根据原版卡文臆造效果。',
  '你们正在推进当前战役；关卡顺序、可用机制和结局以服务端状态与合法动作列表为准。',
  '【线索与移动】按当前场景推进条件核对所需线索、支付地点和时机，不从剧情文字猜测开门或触发条件。以收集线索为目标时选择仍有线索且可调查的地点；零线索地点仍可用于必经路线、支付推进、战斗、支援或撤退，但移动必须有具体目的。不要在条件未变化时反复往返两个空地点来试探剧情；每步核对线索缺口，旧计划声称“线索带齐”不能覆盖当前数值。要求回合结束支付时，凑齐后留在指定地点等支付窗口，不要因当前没有 advanceAct 就离开。',
  '【战役目标与合作】胜利点、创伤与冒险日志会跨关继承。请以团队整体利益为重：让高智识者调查、高战斗者处理敌人，配合队友推进场景目标；奖励、创伤及后续布置以当前实现的结算状态为准。',
  '收到待决选择时，不论当前是谁的回合，都只由指定回答座位提交 {"action":"choose","choiceId":"...","optionId":"..."}。可以跳过也必须使用合法列表提供的跳过选项；多步选择逐次回答、逐次读取新状态。',
  '没有待决选择时，从合法列表选一个普通行动作为 move；行动成本与可支付性以列表为准，免费行动不消耗行动点。',
  '技能检定会从混乱袋抽取标记；已接入协议的投入手牌、付费增益与可选反应通过待决窗口显式选择。未迁移的其他效果仍以简化模式和合法列表为准。',
  '注意槽位、资产使用次数与借机攻击；敌人的反击、猎手、猎物和庞大等关键词会影响行动结果。威胁区域中的弱点可能持续妨碍调查员；处理方法和成本以合法行动为准。',
  '请结合当前局势与队友状态做最优决策：缺线索就调查、被敌人纠缠就攻击或躲避、受伤/受惊就治疗或撤退、资源足够就打出强力卡牌；能推进「场景」目标时优先推进，同时盯住「密谋」的毁灭进度避免灭团。',
].join('\n')

export default {
  id: 'arkhamhorror',
  name: '诡镇奇谈：卡牌版',
  nameEn: 'Arkham Horror LCG',
  players: [1, 4],
  seats: 4,
  cooperative: true,
  sessionPolicy,
  saveSummary,
  actionsRemaining,
  participantDescription,
  createSessionCheckpoint,
  checkpointView,
  migrateSessionCheckpoints,
  forkSessionCheckpoint,
  commitChoiceBatch,
  agentPlanning,
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
  agentTurnKey: (state, seat) => [state.uiState, state.scenario?.id, state.round, state.phase, state.currentSeat, seat].join(':'),
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
  render: { kind: 'cards' },
  agentHint: AGENT_HINT,

  // 本 Mod 自带的浏览器资源（脚本／样式／卡图）全部放在 games/arkhamhorror/web/，
  // 由大厅挂载到 /mods/arkhamhorror/；不要把这些文件散落到大厅的 public/ 里。
  web: { dir: 'web', client: 'game-ui.js', styles: 'style.css' },
  resourceVersion,
  handleApi,
  handleLocalApi: handleDeckLibrary,
  cacheWebAsset,

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
      key: 'aiStoryAwareness', type: 'select', label: 'AI 感知剧情', default: 'off',
      description: '开启后，AI 队友决策时可读取已达成的冒险日志，剧情选择时附带当前关前情，聊天时参考剧情梗概；不会获得未到达的剧情或结局分支。',
      options: [{ value: 'off', label: '关闭' }, { value: 'on', label: '开启' }],
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
    playerCount: 2, campaignId: 'nightOfTheZealot', aiStoryAwareness: 'off',
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
  describeState: (state, seat) => describeState(state, seat) + aiDecisionContext(state, seat ?? decisionSeat(state)),
  chatContext: state => storyChatContext(state),
  legalMoves,
  decisionSeat,
  actingSeats,
  seatLocalMove,
  decisionSeed,
  moveCost,
  saveCompatibilityError: state => stateCompatibilityError(state, META.resourceVersion),
  saveCompatibilityFromState: true,
  migrateState,
  viewState,
  viewEvents,

  // —— 规则 ——
  createState(settings, players) {
    return createGameState({ ...settings, campaignHub: settings.legacyAutoStart !== true }, players)
  },
  validateMove,
  applyMove,
}
