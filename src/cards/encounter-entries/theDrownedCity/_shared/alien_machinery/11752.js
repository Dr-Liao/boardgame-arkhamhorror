// 11752 地狱机械（Infernal Machinery）· 诡计 · 共享遭遇组 alien_machinery（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/alien_machinery。
// 卡面（cards-data 11752）：
//   显现 - 将地狱机械放置入场，位于你的威胁区。
//   你不能触发[[符文]]或[[神器]]卡牌的能力。
//   [action]：检定[intellect]或[agility](4)。如果你成功，弃掉地狱机械。
//
// 读点（声明即接线）：
//   · 威胁区入场 = api.threat；
//   · 摆脱行动 [action] = 威胁区 action 描述子：先用 api.choice 选技能（智识/敏捷），
//     再 api.test(4)，成功 api.removeThreat；
//   · 「不能触发符文/神器卡牌的能力」= 引擎目前只有整类能力封锁读点
//     （threatEffect.cannotTriggerActionAbilities = 禁止触发 [action] 能力；隐私牌的
//     cannotTriggerFree 规则），**没有按特性过滤的「不能触发某特性的卡牌能力」读点**。
//     因此本条款只落 flags 数据，并登记 primitive request shared-3（pending）：需要
//     「威胁区卡按卡牌特性禁止触发能力」的读点。
const CODE = '11752'
const DIFFICULTY = 4

export default {
  code: CODE,
  name: '地狱机械',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  flags: {
    threatArea: true,
    traits: ['Hazard'],
    quantity: 2,
    test: { skills: ['intellect', 'agility'], difficulty: DIFFICULTY },
    cannotTriggerCardAbilitiesWithTraits: ['Glyph', 'Artifact'],
  },
  encounterResolve(state, inv, card, api) {
    api.threat(inv.seat, CODE)
    api.info?.(`⚙️ 「地狱机械」进入 ${inv.name} 的威胁区域：不能触发[[符文]]或[[神器]]卡牌的能力。`)
    return true
  },
  abilities: [{
    kind: 'action',
    actionKind: 'activate',
    cost: { action: 1 },
    label: '[action] 智识/敏捷(4)：成功弃掉地狱机械',
    criteria: ({ state, source }) => Boolean((state?.investigators || []).some(inv => (inv.threat || []).includes(source))),
    resolve: ({ state, inv, source, api }) => {
      const answer = String(api.choice({
        kind: 'effect', source: CODE, seat: inv.seat,
        prompt: '「地狱机械」：选择检定的技能。',
        options: [
          { id: 'intellect', label: '智识(4)' },
          { id: 'agility', label: '敏捷(4)' },
        ],
      }))
      const skill = answer === 'agility' ? 'agility' : 'intellect'
      api.test(inv.seat, skill, DIFFICULTY, {
        source: { type: 'encounter', code: CODE, name: '地狱机械', label: '摆脱检定' },
        resolve: result => {
          if (!result?.success) return
          api.removeThreat?.(source)
          api.info?.(`⚙️ 「地狱机械」：${inv.name} 检定成功，弃掉本卡。`)
        },
      })
    },
  }],
  note: '威胁区入场与摆脱行动已接线（二选一技能 + 检定成功弃卡）。'
    + '近似：「不能触发[[符文]]/[[神器]]卡牌的能力」没有按特性封锁能力的引擎读点，目前只有 flags 数据；'
    + '已登记 primitive request shared-3（pending）。',
}
