// 10698 基甸·米兹拉克 · 剧情资产（居民 · 历经风浪）（theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   While you control Gideon Mizrah, you have 1 additional accessory slot.
//   [action] [action]: Parley. ([codex] 6).
//   Forced - After Gideon Mizrah is defeated: Set him aside, out of play. In your Campaign Log,
//     decrease his Relationship Level.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组）。
//
// 读点（声明即接线）：
//   · 谈判 = abilities 的 action/parley：印刷「[action][action] 谈判」无检定，因此只有 cost.action 2，
//     成功后把「读法典 6」回派给章节内容层（readCodex）。
//   · 关系等级 / 笔记 / 划除 = campaign.records 的 gideonMizrahRelationshipLevel / gideonMizrahNotes /
//     gideonMizrahCrossedOut（src/engine/resident-record.js 的规格；写入只走 api.mechanics.residents.*）。
//   · 额外饰品槽 = modifiers 的 add:slot（accessory；引擎 slotBonus 读点）；storyAssets + controllerSeat
//     的持有方式由内容层读 flags.controlBonus。
//   · 被击败后「放一边 + 关系等级 -1」= flags.defeatRule（剧情资产不在 inv.assets，assetDefeated 不覆盖）。
const CODE = '10698'
const RESIDENT = 'gideonMizrah'
const NAME = '基甸·米兹拉克'
const CODEX_NUMBER = 6
const RECORD = Object.freeze({
  level: 'gideonMizrahRelationshipLevel', notes: 'gideonMizrahNotes',
  crossedOut: 'gideonMizrahCrossedOut', max: 5,
})

const isCrossedOut = state => state?.campaign?.records?.[RECORD.crossedOut] === true

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
    parley: { skills: [], difficulty: 0, actions: 2 },
    controlBonus: { accessorySlots: 1 },
    defeatRule: { setAside: true, relationship: -1 },
  },
  modifiers: [{ target: 'add:slot', value: 'accessory' }],
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判（2 个行动）：读法典 6',
    cost: { action: 2 },
    criteria: [({ state }) => !isCrossedOut(state)],
    resolve: ({ state, inv, api }) => readCodex(state, inv.seat, api),
  }],
  note: '额外饰品槽用 add:slot（accessory；引擎 slotBonus 读点）；「[action][action] 谈判无检定」= cost.action 2、无 api.test。'
    + 'state.storyAssets + controllerSeat 的持有方式由内容层读 flags.controlBonus；被击败后的关系等级 -1 按 flags.defeatRule 结算。',
}
