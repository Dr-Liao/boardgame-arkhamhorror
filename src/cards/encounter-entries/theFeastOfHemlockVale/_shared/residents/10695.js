// 10695 席米恩·阿特伍德 · 剧情资产（居民 · 烦人精）（theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   While you control Simeon Atwood, you get +1 [agility].
//   [action]: Parley. Test [agility](2). If you succeed, ([codex] 3).
//   Forced - After Simeon Atwood is defeated: Set him aside, out of play. In your Campaign Log,
//     decrease his Relationship Level.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组）。
//
// 读点（声明即接线）：
//   · 谈判 = abilities 的 action/parley（parley.js 枚举同地点剧情资产；api.test 走检定管线），
//     成功后把「读法典 3」回派给章节内容层（readCodex）。
//   · 关系等级 / 笔记 / 划除 = campaign.records 的 simeonAtwoodRelationshipLevel / simeonAtwoodNotes /
//     simeonAtwoodCrossedOut（src/engine/resident-record.js 的规格；写入只走 api.mechanics.residents.*）。
//   · +1[敏捷] = modifiers 的 skill:agility（modifierTotal 读点）；storyAssets + controllerSeat 的持有方式
//     由内容层读 flags.controlBonus。
//   · 被击败后「放一边 + 关系等级 -1」= flags.defeatRule（剧情资产不在 inv.assets，assetDefeated 不覆盖）。
const CODE = '10695'
const RESIDENT = 'simeonAtwood'
const NAME = '席米恩·阿特伍德'
const CODEX_NUMBER = 3
const RECORD = Object.freeze({
  level: 'simeonAtwoodRelationshipLevel', notes: 'simeonAtwoodNotes',
  crossedOut: 'simeonAtwoodCrossedOut', max: 5,
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
    parley: { skills: ['agility'], difficulty: 2, actions: 1 },
    controlBonus: { skillBonus: { agility: 1 } },
    defeatRule: { setAside: true, relationship: -1 },
  },
  modifiers: [{ target: 'skill:agility', amount: 1 }],
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：检定[敏捷](2)，成功则读法典 3',
    cost: { action: 1 },
    criteria: [({ state }) => !isCrossedOut(state)],
    resolve: ({ state, inv, source, api }) => api.test(inv.seat, 'agility', 2, {
      source: { type: 'scenario', action: 'parley', code: CODE, name: source?.name, ability: true },
      actionKind: 'parley',
      resolve: result => { if (result.success) readCodex(state, inv.seat, api) },
    }),
  }],
  note: '+1[敏捷] 声明为 skill:agility 修正（引擎 modifierTotal 读点）；state.storyAssets + controllerSeat 的持有方式'
    + '由内容层读 flags.controlBonus。「被击败后放一边 + 关系等级 -1」按 flags.defeatRule 由战役层结算。',
}
