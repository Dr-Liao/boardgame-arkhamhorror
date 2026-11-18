// 10693 蕾切尔嬷嬷 · 剧情资产（居民 · 慈悲为怀）（theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   While you control Mother Rachel, you have 1 additional arcane slot.
//   [action]: Parley. Test [willpower](2). If you succeed, ([codex] 1).
//   Forced - After Mother Rachel is defeated: Set her aside, out of play. In your Campaign Log,
//     decrease her Relationship Level.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组 20 张双面居民之一）。
//
// 读点（声明即接线）：
//   · 谈判 = abilities 的 action/parley：src/engine/parley.js 枚举同地点的剧情资产（state.storyAssets），
//     检定与费用走 ability 管线（api.test / cost）；成功后把「读法典 1」回派给章节内容层（readCodex）。
//   · 关系等级 / 笔记 / 划除 = campaign.records 的 motherRachelRelationshipLevel / motherRachelNotes /
//     motherRachelCrossedOut（src/engine/resident-record.js 的规格；写入只走 api.mechanics.residents.*）。
//   · 额外法术槽 = modifiers 的 add:slot（引擎 slotBonus 读点）；居民实例以 state.storyAssets +
//     controllerSeat 持有、不进 inv.assets 时，同一份印刷事实由内容层读 flags.controlBonus。
//   · 被击败后「放一边 + 关系等级 -1」= flags.defeatRule：剧情资产实例不在 inv.assets，引擎的
//     assetDefeated 窗口不覆盖它，因此由战役层按该字段结算（与本组其它入口同口径）。
const CODE = '10693'
const RESIDENT = 'motherRachel'
const NAME = '蕾切尔嬷嬷'
const CODEX_NUMBER = 1
const RECORD = Object.freeze({
  level: 'motherRachelRelationshipLevel', notes: 'motherRachelNotes',
  crossedOut: 'motherRachelCrossedOut', max: 5,
})

// 「名字被划掉的居民不能进入游戏」：条目只读战役记录（不写），写入走 api.mechanics.residents.*。
const isCrossedOut = state => state?.campaign?.records?.[RECORD.crossedOut] === true

// 法典回派：四种已完成章节 worker 的事件约定，按顺序探测，只吞「未知事件」。
//   · `<章节 id>ResidentParley` { code, resident, id, seat }      —— welcomeToHemlockVale
//   · `<章节 id>Codex`           { entry, key, number, id, seat } —— preludeTheFinalEvening / theTwistedHollow
//   · `<短章名>Codex<居民>`       { seat }                         —— theSilentHeath（去掉开头 the 的短名）
//   · `<章节 id>Codex<居民>`      { seat }                         —— 通用兜底
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
    parley: { skills: ['willpower'], difficulty: 2, actions: 1 },
    controlBonus: { arcaneSlots: 1 },
    defeatRule: { setAside: true, relationship: -1 },
  },
  modifiers: [{ target: 'add:slot', value: 'arcane' }],
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '谈判：检定[意志](2)，成功则读法典 1',
    cost: { action: 1 },
    criteria: [({ state }) => !isCrossedOut(state)],
    resolve: ({ state, inv, source, api }) => api.test(inv.seat, 'willpower', 2, {
      source: { type: 'scenario', action: 'parley', code: CODE, name: source?.name, ability: true },
      actionKind: 'parley',
      resolve: result => { if (result.success) readCodex(state, inv.seat, api) },
    }),
  }],
  note: '额外法术槽用 add:slot 修正（引擎 slotBonus 读点）；居民以 state.storyAssets + controllerSeat 持有时不进 inv.assets，'
    + '这类持有下的加成由内容层读 flags.controlBonus。「被击败后放一边 + 关系等级 -1」按 flags.defeatRule 由战役层结算'
    + '（引擎 assetDefeated 窗口只覆盖 inv.assets）。',
}
