// 10702 罗莎·马奎兹博士 · 剧情资产（居民 · 领域翘楚）（theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   While you control Dr. Rosa Marquez, you get +1 [intellect] and +1 [agility].
//   [reaction] After you discover the last clue at your location: ([codex] Θ).
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组）。本卡是「战役发放的牌组资产」：
//   章节奖励会把它加入某位调查员的牌组（「put Dr. Marquez into play under an investigator's control」/
//   牌组奖励），因此声明 scenarioPlayable（引擎读点 src/engine/stats.js#runtimeCardAvailable，
//   授予事实源是战役牌组记录；费用 4 / 盟友槽 / 技能图标取自 cards-data）。
//
// 读点（声明即接线）：
//   · +1[智力]、+1[敏捷] = modifiers 的 skill:intellect / skill:agility（modifierTotal 读点；本卡进 inv.assets
//     后即时生效），同一份印刷事实另存 flags.controlBonus；
//   · 「发现所在地点的最后一个线索后」= clueDiscovered 窗口的 context.lastClue（locations.js 在发现线索时置位，
//     唯一读点）；成功后把「读法典 Θ」回派给章节内容层（readCodex）。
const CODE = '10702'
const RESIDENT = 'drRosaMarquez'
const NAME = '罗莎·马奎兹博士'
const CODEX_NUMBER = 'theta'

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
  if (!known) api.info?.(`「${NAME}」：本章内容层没有实现法典回派事件。`)
  return false
}

export default {
  code: CODE,
  scope: 'storyAsset',
  implemented: true,
  scenarioPlayable: true,
  flags: {
    resident: RESIDENT,
    codexNumber: CODEX_NUMBER,
    deckPlayable: true,
    cost: 4,
    slot: 'ally',
    traits: ['Ally', 'Miskatonic', 'Wayfarer'],
    controlBonus: { skillBonus: { intellect: 1, agility: 1 } },
    codexTrigger: 'lastClueAtYourLocation',
  },
  modifiers: [{ target: 'skill:intellect', amount: 1 }, { target: 'skill:agility', amount: 1 }],
  abilities: [{
    kind: 'reaction',
    trigger: 'clueDiscovered',
    label: '你发现所在地点的最后一个线索后：读法典 Θ',
    criteria: [({ inv, context }) => context?.seat === inv.seat && context?.lastClue === true],
    resolve: ({ state, inv, api }) => readCodex(state, inv.seat, api),
  }],
  note: '法典 Θ 挂在 clueDiscovered 窗口（context.lastClue = 该地点线索刚归零），因此「最后一个线索」是引擎真实读点；'
    + '本卡是战役发放的牌组资产（scenarioPlayable + 战役牌组记录），修正管线在 inv.assets 里即时生效。',
}
