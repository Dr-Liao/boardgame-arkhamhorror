// 10701b 伯蒂·马斯格雷夫 · 敌人（伯蒂·马斯格雷夫的敌人面，theFeastOfHemlockVale/_shared/residents）
// 卡面（中文正文见 src/cards/cards-data.js 的 textZh，本文件不抄第二份）：
//   Aloof. Patrol (Mother Rachel's location).
//   Forced - When damage would be assigned to a [[Resident]] enemy at Bertie Musgrave's location and he is
//     ready: It is assigned to Bertie Musgrave, instead.
//   Forced - After Bertie Musgrave is defeated: ([codex] Ω).
// 归属：战役共用 · theFeastOfHemlockVale/_shared/residents（Residents 遭遇组双面卡 10701 的背面）。
//
// 印刷数值（战斗 3 / 躲避 3 / 生命 3 / 伤害 1 / 恐惧 0 / 胜利 0 / 特性 [[类人]][[米斯卡塔尼克]]）由 cards-data 提供；
// Aloof 由章节 encounterDefinitions 从英文正文解析。
// 读点：
//   · 巡逻（蕾切尔嬷嬷的地点）= enemyRule.patrolTarget { kind: 'resident', assetCode: '10693' }
//     （normalizePatrolTarget 的 resident 类型 + resolvePatrol，引擎真实读点）；
//   · 「被击败后读法典 Ω」= enemyDefeated 窗口 + readCodex（章节内容层的法典回派约定）。
const CODE = '10701b'
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
  if (!known) api.info?.(`「${NAME}」：本章内容层没有实现法典回派事件。`)
  return false
}

export default {
  code: CODE,
  scope: 'enemy',
  implemented: true,
  enemyRule: {
    patrolTarget: { kind: 'resident', assetCode: '10693' },
    redirectDamageToSelf(_state, source, target) {
      return source.id !== target.id && source.location === target.location
        && !source.defeated && !source.exhausted && target.traits?.includes('Resident')
    },
  },
  flags: {
    resident: RESIDENT,
    assetCode: '10701',
    keywords: ['aloof', 'patrol'],
    patrol: 'motherRachelLocation',
    damageRedirectToSelf: { traits: ['Resident'], whileReady: true },
    defeatCodex: CODEX_NUMBER,
    victory: 0,
  },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyDefeated',
    label: '伯蒂·马斯格雷夫被击败后：读法典 Ω',
    criteria: [({ context }) => String(context?.enemy?.originalCode || context?.enemy?.code || '') === CODE],
    resolve: ({ state, context, api }) => readCodex(state, context?.seat ?? state?.campaign?.leadSeat ?? 0, api),
  }],
  note: '伯蒂巡逻到蕾切尔嬷嬷的地点。重整时替本地点其他居民敌人承受伤害。',
}
