// 11748 深潜者伏击（Deep One Ambush）· 诡计 · 共享遭遇组 deep_ones（印刷 2 张）
// 归属：战役内跨关卡共用 · theDrownedCity/_shared/deep_ones。
// 卡面（cards-data 11748）：
//   显现 - 将深潜者伏击放置入场，位于你的威胁区。每位调查员限1张。
//   强制 - 一名[[深潜者]]敌人与您交战后：该敌人攻击你。然后，弃掉深潜者伏击。
//
// 读点（声明即接线）：
//   · 威胁区入场 = api.threat；重复副本在显现时判重后由引擎弃置；
//   · 「深潜者敌人与你交战后」= enemyEngaged 窗口（context 带 enemy/seat）+ 特性过滤 +
//     威胁区卡持有者判定；
//   · 「该敌人攻击你」= api.scenario.attack（enemies.js#enemyAttack 的剧本攻击入口）；
//   · 「弃掉深潜者伏击」= api.removeThreat（威胁区卡的唯一弃置写入口）。
const CODE = '11748'
const TRAIT = 'deep one'

const holderOf = (state, source) => (state?.investigators || [])
  .find(inv => (inv.threat || []).includes(source)) || null

const isDeepOne = enemy => (enemy?.traits || []).some(trait => String(trait).toLowerCase() === TRAIT)

export default {
  code: CODE,
  name: '深潜者伏击',
  scope: 'treachery',
  implemented: true,
  treacheryRule: { threatArea: true },
  flags: {
    threatArea: true,
    traits: ['Scheme'],
    quantity: 2,
    limitPerInvestigator: 1,
    engageAttackTrait: 'Deep One',
  },
  encounterResolve(state, inv, card, api) {
    if ((inv.threat || []).some(item => (item.originalCode || item.code) === CODE)) {
      api.info?.(`🦑 「深潜者伏击」：${inv.name} 已经有一张，本次不放入场（每位调查员仅限 1 张）。`)
      return false
    }
    api.threat(inv.seat, CODE)
    api.info?.(`🦑 「深潜者伏击」进入 ${inv.name} 的威胁区域。`)
    return true
  },
  abilities: [{
    kind: 'forced',
    trigger: 'enemyEngaged',
    silent: true,
    label: '一名深潜者敌人与你交战后：该敌人攻击你，然后弃掉本卡',
    criteria: ({ state, source, context }) => {
      const holder = holderOf(state, source)
      return Boolean(holder) && context?.seat === holder.seat
        && Boolean(context?.enemy) && isDeepOne(context.enemy)
    },
    resolve: ({ state, source, context, api }) => {
      const holder = holderOf(state, source)
      const inv = state.investigators?.[context?.seat]
      const enemy = context?.enemy
      if (!holder || !inv || !enemy) return
      api.scenario?.attack?.(enemy, inv)
      api.removeThreat?.(source)
      api.info?.(`🦑 「深潜者伏击」：${inv.name} 被「${enemy.name}」交战，该敌人立刻攻击，然后弃掉本卡。`)
    },
  }],
  note: '威胁区入场/判重与「深潜者交战后攻击并弃卡」全部接线：enemyEngaged 窗口 + api.scenario.attack +'
    + ' api.removeThreat。攻击按剧本攻击入口结算（含伤害分配与攻击窗口）。',
}
