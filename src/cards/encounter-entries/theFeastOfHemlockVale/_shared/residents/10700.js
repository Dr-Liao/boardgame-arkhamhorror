// 10700 希奥·彼得斯 · 剧情资产（居民 · 多面手）（theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   While you control Theo Peters, you may take an additional action during your turn, which can only be
//     used to move.
//   [action] Choose and discard X cards from your hand, where X is the current day number: Parley. ([codex] 8).
//   Forced - After Theo Peters is defeated: Set him aside, out of play. In your Campaign Log,
//     decrease his Relationship Level.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组）。
//
// 读点（声明即接线）：
//   · 谈判 = abilities 的 action/parley：「选择并弃掉 X 张手牌，X = 当前天数」用动态 cost.discardHand
//     （引擎的弃手牌费用 = discardChosenCards，玩家自选；合法性/扣除同一口径）；无检定，成功后回派法典 8。
//   · 关系等级 / 笔记 / 划除 = campaign.records 的 theoPetersRelationshipLevel / theoPetersNotes /
//     theoPetersCrossedOut（src/engine/resident-record.js 的规格；写入只走 api.mechanics.residents.*）。
//   · 「额外一次行动（只能移动）」= modifiers 的 actions +1（引擎 actions 修正读点）+ flags.controlBonus.extraAction
//     保留印刷限制（引擎没有「只能用于移动」的行动类型读点）。
//   · 被击败后「放一边 + 关系等级 -1」= flags.defeatRule（剧情资产不在 inv.assets，assetDefeated 不覆盖）。
const CODE = '10700'
const RESIDENT = 'theoPeters'
const NAME = '希奥·彼得斯'
const CODEX_NUMBER = 8
const RECORD = Object.freeze({
  level: 'theoPetersRelationshipLevel', notes: 'theoPetersNotes',
  crossedOut: 'theoPetersCrossedOut', max: 5,
})

const isCrossedOut = state => state?.campaign?.records?.[RECORD.crossedOut] === true

// 当前天数：引擎 scenario-calendar.js 写 scenarioFlags.mechanics.scenarioDate（day/period），战役记录同步
// campaign.records.hemlockDate（`day< N >:<period>`，见 welcomeToHemlockVale/chaos.js）。条目只读，不写。
function currentDay(state) {
  const day = Number(state?.scenarioFlags?.mechanics?.scenarioDate?.day)
  if (Number.isInteger(day) && day > 0) return day
  const raw = String(state?.campaign?.records?.hemlockDate || '')
  const parsed = Number(raw.replace(/^day/, '').split(':')[0])
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

// 法典回派（四种已完成章节的事件约定，按顺序探测，只吞「未知事件」；见 10693.js 的同一段）。
const camelOf = value => value.charAt(0).toUpperCase() + value.slice(1)
const codexCandidates = state => {
  const chapter = String(state?.scenario?.id || '')
  const short = chapter.replace(/^the/, '').replace(/^[A-Z]/, letter => letter.toLowerCase())
  return [
    [`${chapter}ResidentParley`, { code: CODE, resident: RESIDENT, id: CODE }],
    [`${chapter}Codex`, { entry: RESIDENT, entryId: RESIDENT, key: RESIDENT, number: CODEX_NUMBER, id: CODE }],
    [`${short}Codex${camelOf(RESIDENT)}`, {}],
    [`${chapter}Codex${camelOf(RESIDENT)}`, {}],
  ]
}
function readCodex(state, seat, api) {
  const bridge = typeof api?.scenario?.resolveScenarioEvent === 'function' ? api.scenario : api
  if (typeof bridge?.resolveScenarioEvent !== 'function') return false
  let known = false
  for (const [id, payload] of codexCandidates(state)) {
    try {
      known = true
      return bridge.resolveScenarioEvent(id, { ...payload, seat })
    } catch (error) {
      if (!/Unknown scenario event/.test(String(error?.message || ''))) throw error
    }
  }
  if (!known) api.info?.(`「${NAME}」：本章内容层没有实现法典回派事件（条目只负责谈判费用与检定）。`)
  return false
}

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  flags: {
    resident: RESIDENT,
    codexNumber: CODEX_NUMBER,
    record: { ...RECORD },
    availability: { notCrossedOut: RECORD.crossedOut, relationshipLevel: RECORD.level, maxLevel: RECORD.max },
    parley: { skills: [], difficulty: 0, actions: 1, discardCards: 'dayNumber' },
    controlBonus: { extraAction: 'move' },
    defeatRule: { setAside: true, relationship: -1 },
  },
  modifiers: [{ target: 'actions', amount: 1 }],
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：选择并弃掉 X 张手牌（X = 当前天数）读法典 8',
    cost: { action: 1, discardHand: ({ state }) => currentDay(state) },
    criteria: [({ state }) => !isCrossedOut(state)],
    resolve: ({ state, inv, api }) => readCodex(state, inv.seat, api),
  }],
  note: '近似：额外一次「只能用于移动」的行动用 actions +1 修正承载（引擎没有行动类型读点）；'
    + '「选择并弃掉 X 张手牌」走引擎的 discardHand 费用（玩家自选、X 为动态费用），与印刷「选择」一致。',
}
