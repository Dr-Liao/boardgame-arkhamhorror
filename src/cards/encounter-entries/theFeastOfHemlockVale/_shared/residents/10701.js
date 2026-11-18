// 10701 伯蒂·马斯格雷夫 · 剧情资产（居民 · 独具慧眼）（theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   While you control Bertie Musgrave, you get +1 health and +1 sanity.
//   [fast] Take either 1 damage or 1 horror and exhaust Bertie Musgrave: Parley. Draw 1 card ([codex] Ω).
//   Forced - After Bertie Musgrave is defeated: Set him aside, out of play.
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组；伯蒂不在战役日志的八位居民表里，
//   没有关系等级记录，只有法典 Ω，因此 flags 不声明 record）。
//
// 读点（声明即接线）：
//   · 「快速」= 条目 fast + cost.action:false（action 描述子免行动，牌桌按既有快速口径展示）；
//   · 「受到 1 点伤害或 1 点恐惧」= resolve 里的 api.choice（引擎的费用不能声明二选一，见 note）；
//   · 「横置」= cost.exhaust；「抽 1 张」= api.drawCards；
//   · 法典 Ω = readCodex（章节内容层的法典事件，与其余居民同一套回派约定）；
//   · 被击败后「放一边」= flags.defeatRule（剧情资产不在 inv.assets，assetDefeated 不覆盖，由战役层结算）。
const CODE = '10701'
const RESIDENT = 'bertieMusgrave'
const NAME = '伯蒂·马斯格雷夫'
const CODEX_NUMBER = 'omega'

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
  fast: true,
  flags: {
    resident: RESIDENT,
    codexNumber: CODEX_NUMBER,
    controlBonus: { maxHealth: 1, maxSanity: 1 },
    parley: { skills: [], difficulty: 0, actions: 0, fast: true, harmChoice: ['damage', 'horror'], draw: 1 },
    defeatRule: { setAside: true },
  },
  modifiers: [{ target: 'maxHealth', amount: 1 }, { target: 'maxSanity', amount: 1 }],
  abilities: [{
    kind: 'action',
    actionKind: 'parley',
    label: '快速谈判：受到 1 点伤害或 1 点恐惧并横置伯蒂，抽 1 张牌并读法典 Ω',
    cost: { action: false, exhaust: true },
    resolve: ({ state, inv, api }) => {
      const choice = api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '「伯蒂·马斯格雷夫」：选择承受哪一种。',
        options: [{ id: 'damage', label: '受到 1 点伤害' }, { id: 'horror', label: '受到 1 点恐惧' }],
      })
      if (choice === 'horror') api.horror(inv.seat, 1)
      else api.damage(inv.seat, 1)
      api.drawCards(inv.seat, 1)
      return readCodex(state, inv.seat, api)
    },
  }],
  note: '近似：「受到 1 点伤害或 1 点恐惧」在印刷上是费用里的二选一，引擎的 cost 不能声明选择，因此放进 resolve'
    + '（横置费之后、抽牌之前结算），合法性不受影响。[fast] 用 fast + cost.action:false；被击败后放一边按 flags.defeatRule 结算。',
}
