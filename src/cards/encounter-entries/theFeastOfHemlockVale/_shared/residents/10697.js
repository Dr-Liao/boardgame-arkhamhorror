// 10697 瑞玟·霍桑 · 剧情资产（居民 · 纽约红人）（theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   While you control River Hawthorne, you get +1 [willpower].
//   [action]: Parley. Test either [willpower] or [intellect] (3). If you succeed, ([codex] 5).
//   Forced - After River Hawthorne is defeated: Set them aside, out of play. In your Campaign Log,
//     decrease their Relationship Level.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组）。
//
// 读点（声明即接线）：
//   · 谈判 = abilities 的 action/parley；「意志或智力(3)」先 api.choice 选技能，再走一次 api.test
//     （难度固定 3，不追加行动）；成功后把「读法典 5」回派给章节内容层（readCodex）。
//   · 关系等级 / 笔记 / 划除 = campaign.records 的 riverHawthorneRelationshipLevel / riverHawthorneNotes /
//     riverHawthorneCrossedOut（src/engine/resident-record.js 的规格；写入只走 api.mechanics.residents.*）。
//   · +1[意志] = modifiers 的 skill:willpower（modifierTotal 读点）；storyAssets + controllerSeat 的持有方式
//     由内容层读 flags.controlBonus。
//   · 被击败后「放一边 + 关系等级 -1」= flags.defeatRule（剧情资产不在 inv.assets，assetDefeated 不覆盖）。
const CODE = '10697'
const RESIDENT = 'riverHawthorne'
const NAME = '瑞玟·霍桑'
const CODEX_NUMBER = 5
const RECORD = Object.freeze({
  level: 'riverHawthorneRelationshipLevel', notes: 'riverHawthorneNotes',
  crossedOut: 'riverHawthorneCrossedOut', max: 5,
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
    parley: { skills: ['willpower', 'intellect'], difficulty: 3, actions: 1 },
    controlBonus: { skillBonus: { willpower: 1 } },
    defeatRule: { setAside: true, relationship: -1 },
  },
  modifiers: [{ target: 'skill:willpower', amount: 1 }],
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：检定[意志]或[智力](3)，成功则读法典 5',
    cost: { action: 1 },
    criteria: [({ state }) => !isCrossedOut(state)],
    resolve: ({ state, inv, source, api }) => {
      const skill = api.choice({
        kind: 'skill', source: CODE, seat: inv.seat,
        prompt: '「瑞玟·霍桑」谈判：选择本次检定的技能。',
        options: [{ id: 'willpower', label: '意志' }, { id: 'intellect', label: '智力' }],
      })
      return api.test(inv.seat, skill === 'intellect' ? 'intellect' : 'willpower', 3, {
        source: { type: 'scenario', action: 'parley', code: CODE, name: source?.name, ability: true },
        actionKind: 'parley',
        resolve: result => { if (result.success) readCodex(state, inv.seat, api) },
      })
    },
  }],
  note: '「意志或智力(3)」用 api.choice 选技能后只做一次 api.test（难度都是 3），不追加行动或费用；'
    + '+1[意志] 为 skill:willpower 修正，state.storyAssets + controllerSeat 的持有方式由内容层读 flags.controlBonus。',
}
