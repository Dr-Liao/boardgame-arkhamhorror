// 11729 深渊之眼（Eye of the Deep）· 诡计 · 共享遭遇组 cosmic_legacy（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/cosmic_legacy。
// 卡面（cards-data 11729）：
//   显现 - 将深渊之眼放置入场，位于你的威胁区。每位调查员限1张。
//   你在一次技能检定中揭示的每个[cultist]和[tablet]标记，改为视为[elder_thing]标记。
//   [action]：检定[willpower](3)。如果你成功，弃掉深渊之眼。
//
// 读点（声明即接线）：
//   · 威胁区入场 = api.threat；重复副本在显现时判重后由引擎弃置；
//   · 「揭示的 cultist/tablet 视为 elder_thing」= tokenReveal 中断窗口 + api.replaceChaosToken
//     （tests.js#标记揭示段：替换后原标记归还混乱袋，并按新标记继续结算；持有者 = 威胁区卡的所属座位）；
//   · 摆脱行动 [action] 走威胁区 action 描述子 + api.test + api.removeThreat。
const CODE = '11729'
const DIFFICULTY = 3
const CONVERTIBLE = ['cultist', 'tablet']

const holderOf = (state, source) => (state?.investigators || [])
  .find(inv => (inv.threat || []).includes(source)) || null

export default {
  code: CODE,
  name: '深渊之眼',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  flags: {
    threatArea: true,
    traits: ['Power'],
    quantity: 2,
    limitPerInvestigator: 1,
    test: { skill: 'willpower', difficulty: DIFFICULTY },
    tokenConversion: { from: ['cultist', 'tablet'], to: 'elderthing' },
  },
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(item => (item.originalCode || item.code) === CODE)) {
      api.info?.(`🌑 「深渊之眼」：${inv.name} 已经有一张，本次不放入场（每位调查员仅限 1 张）。`)
      return false
    }
    api.threat(inv.seat, CODE)
    api.info?.(`🌑 「深渊之眼」进入 ${inv.name} 的威胁区域：ta 揭示的邪教徒/石板标记视为旧神标记。`)
    return true
  },
  abilities: [{
    kind: 'forced',
    trigger: 'tokenReveal',
    silent: true,
    label: '你揭示的 cultist/tablet 标记改为 elder_thing',
    criteria: ({ state, source, context }) => {
      const holder = holderOf(state, source)
      return Boolean(holder) && context?.when === 'tokenReveal'
        && context?.seat === holder.seat && CONVERTIBLE.includes(context?.token)
        && !context?.replacementToken
    },
    resolve: ({ context, api }) => {
      if (!api.replaceChaosToken?.(context, 'elderthing')) return
      api.info?.('🌑 「深渊之眼」：把本次揭示的邪教徒/石板标记视为旧神标记结算。')
    },
  }, {
    kind: 'action',
    actionKind: 'activate',
    cost: { action: 1 },
    label: '[action] 意志(3)：成功弃掉深渊之眼',
    criteria: ({ state, source }) => Boolean(holderOf(state, source)),
    resolve: ({ inv, source, api }) => {
      api.test(inv.seat, 'willpower', DIFFICULTY, {
        source: { type: 'encounter', code: CODE, name: '深渊之眼', label: '摆脱检定' },
        resolve: result => {
          if (!result?.success) return
          api.removeThreat?.(source)
          api.info?.(`🌑 「深渊之眼」：${inv.name} 检定成功，弃掉「深渊之眼」。`)
        },
      })
    },
  }],
  note: '标记转换走 tokenReveal 中断 + api.replaceChaosToken（原标记归还混乱袋、按旧神标记继续结算），'
    + '与参考实现的 ForcedChaosTokenChange 同口径：替换只影响本次检定的结算、不改变混乱袋构成；'
    + '摆脱行动走威胁区 action 描述子。',
}
