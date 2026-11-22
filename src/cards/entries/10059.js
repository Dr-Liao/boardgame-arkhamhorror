// 10059 饥饿霉菌（Ravenous Myconid · 智能菌株 Sentient Strain）· 探寻者资产 · 4 经验 · 2 资源
// 卡面：
//   研究完成。每套牌库仅限 1 张。
//   [fast]：查找你的绑定卡牌，找出诡异疯长，并将其加入你的手牌。（每轮仅限一次。）
//   [reaction] 在调查员抽取非弱点诡计卡牌时，如果该调查员所在地点的隐藏值不大于饥饿霉菌上的
//   生长数：取消该诡计的效果并将其弃掉。移除饥饿霉菌上所有的生长。
//
// 读点（卡面 → 引擎）：
//   · 生长标记 = 资产实例的 uses（usesType 'growth'）。诡异疯长（10045）结算时把 1 资源作为
//     生长放置到这张卡上；本卡只经 api.addUses 读写（支援标记的唯一写点）。
//   · 「查找绑定卡牌」= api.bonded.retrieve（bonded.js 的场外集合检索；绑定关系来自
//     cards-data 的 bondedCards / bondedTo，条目不需要再声明）。每轮一次用 limit 'oncePerRound'。
//   · 「调查员抽取非弱点诡计卡牌」= encounterDrawn 窗口（encounter.js#drawEncounter 在结算显现
//     之前开窗，context = { when, seat, location, cardCode, weakness, peril }）。
//     「非弱点诡计」= cards-data type 'treachery' 且 context.weakness !== true。
//   · 取消并弃掉 = 写窗口 context.cancelled（encounter.js 在窗口后按该字段跳过显现并弃牌）。
//   · 研究完成 = 条目级 researchRequirement（campaign.js#researchRequirementFor 的唯一读点）；
//     记录键 'classifiedNewSpecies' 与基础卡 10044 的 api.recordResearch 写点同源（FHV P7 战役日志）。
//     卡面数据本身是 catalog-only，条目不提供任何 buildable 标记。
//
// approximation（逐条披露，见 artifacts/migration/fhv/primitive-requests/10059.json）：
//   ① 窗口条件里的「隐藏值」读地点实例的 shroud + shroudMod；地点附属/章节钩子产生的**有效**
//      隐藏值只有 api.locationShroud（结算期）能读，条件阶段没有对应 helper。
const CODE = '10059'
const GROWTH = 'growth'
const UNCANNY_GROWTH = '10045'

const growthOf = source => Math.max(0, Number(source?.uses) || 0)
const shroudOf = location => Math.max(0, Number(location?.shroud || 0) + Number(location?.shroudMod || 0))

function searchUncannyGrowth({ inv, api }) {
  const taken = api.bonded.retrieve(inv.seat, CODE, { handCount: 1 })
  if (taken.length) api.info(`🍄 饥饿霉菌：查找绑定卡牌，把「${api.cardName(UNCANNY_GROWTH)}」加入手牌。`)
  else api.info('🍄 饥饿霉菌：绑定卡牌「诡异疯长」不在场外集合里。')
}

export default {
  code: CODE,
  name: 'Ravenous Myconid (Sentient Strain)',
  simplified: true,
  note: 'approximation: encounterDrawn 条件里的「隐藏值」用地点 shroud + shroudMod 计算；地点附属/章节钩子给的有效隐藏值需在条件阶段读 api.locationShroud（当前没有 helper），见 primitive-requests/10059.json。',
  researchRequirement: 'classifiedNewSpecies',
  researchUpgradeFrom: '10044',
  uses: 0,
  usesType: GROWTH,
  abilities: [
    {
      kind: 'free',
      fast: true,
      label: '查找绑定卡牌，找出诡异疯长加入手牌（每轮一次）',
      limit: 'oncePerRound',
      cost: { action: false },
      criteria: [({ inv, helpers }) => helpers.bondedAvailable(inv.seat, CODE, UNCANNY_GROWTH) > 0],
      resolve: searchUncannyGrowth,
    },
    {
      kind: 'reaction',
      trigger: 'encounterDrawn',
      label: '调查员抽取非弱点诡计时，若其地点隐藏值不大于生长数：取消该诡计并移除全部生长',
      criteria: [({ state, source, context, helpers }) => {
        if (!source || !context || !context.cardCode || context.weakness === true) return false
        if (helpers.cardType(context.cardCode) !== 'treachery') return false
        const growth = growthOf(source)
        if (growth <= 0) return false
        const location = (state.locations || []).find(entry => entry.id === context.location)
        return Boolean(location) && shroudOf(location) <= growth
      }],
      resolve: ({ source, context, api }) => {
        const growth = growthOf(source)
        context.cancelled = true
        api.addUses(source, -growth)
        api.info(`🛡️ 饥饿霉菌：取消「${api.cardName(context.cardCode)}」的全部效果并弃掉它；移除 ${growth} 个生长标记。`)
      },
    },
  ],
  modifiers: [],
}
