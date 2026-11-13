// 09067 “我收下了！”（"I'll take that!"）· 游荡者（Rogue）事件 · 0 经验 · 技巧 · 升级 · 违法。
//
// 卡面：快速。在你成功躲避一个[[类人]]敌人或成功调查时打出。
//       从你手牌打出一个[[道具]]支援，其费用降低 X 点，其中 X 为你检定成功且超过难度的点数。
//       将“我收下了！”附属到该支援。所附属的支援获得[[违法]]。
//
// 一卡一文件：这张卡的行为只在这里维护。
//
// 读点：
//   · 触发时机 → evadeSuccess / investigateSuccess 两个窗口（combat.js / actions.js 各一处调用点，
//     context 带 successBy）。
//   · 「以 -X 费用打出」→ api.playCard(seat, code, { discount, noAction: true })（走正常打出管线）。
//   · 「附属到该支援」→ api.attachPlayerCardToAsset（attachCardTo 的唯一写点）；事件本身不弃置
//     （条目 keepOnPlay），物理牌只以附属形态存在。
//   · 「所附属支援获得[[违法]]」→ 条目级 assetRule.hostTrait（stats.js#effectiveTraits 读附属的 hostTrait，
//     因此特性读点统一且随附属离场消失）。
import { ALL_CARDS } from '../../cards/cards-data.js'
//
// P1-8（2026-11-13）：躲避支 criteria 曾在窗口过滤期调用 api.cardTraits —— criteria 的 ctx 里没有 api
//   （ability-rules.js#descriptorUsable:205），异常被 matcher 吞成 false → 躲避支永不出现。改为只读
//   窗口 context 里的敌人实例 traits（spawnEnemy 已把印刷特性复制到实例；与 api.cardTraits 同源）。
//   调查支仍依赖引擎在 investigateSuccess 上开 reactionWindow（目前 actions.js:645 只 triggerReaction，
//   快速事件枚举不到）——已作为引擎读点报给主进程。
const CODE = '09067'

// 只读判定：窗口 context 里的敌人实例 traits（spawnEnemy 已复制印刷特性）优先；
// 合成/测试枚举的实例没有 traits 时回落到印刷数据（与 api.cardTraits 同一份数据）。
const isHumanoid = enemy => {
  if (!enemy) return false
  const traits = enemy.traits || ALL_CARDS[enemy.code]?.traits || []
  return traits.some(trait => String(trait).toLowerCase() === 'humanoid')
}

export default {
  code: CODE,
  keepOnPlay: true,
  assetRule: { hostTrait: 'illicit' },
  abilities: [
    {
      kind: 'played',
      fast: true,
      trigger: ['evadeSuccess', 'investigateSuccess'],
      label: '快速：以 -X 费用打出一张[[道具]]支援并附属；该支援获得[[违法]]',
      criteria: [({ inv, context }) => {
        if (!context || context.seat !== inv.seat) return false
        if (context.when === 'investigateSuccess') return true
        return context.when === 'evadeSuccess' && isHumanoid(context.enemy)
      }],
      resolve: ({ inv, api, context }) => {
        const successBy = Math.max(0, Number(context?.successBy) || 0)
        const items = [...new Set((inv.hand || []).filter(code => api.cardType(code) === 'asset'
          && api.cardTraits(code).some(trait => String(trait).toLowerCase() === 'item')))]
        if (!items.length) {
          api.info('「我收下了！」：你手中没有[[道具]]支援。')
          return
        }
        const picked = items.length === 1 ? items[0] : api.choice({
          kind: 'card', source: CODE, seat: inv.seat,
          prompt: `「我收下了！」：打出一张[[道具]]支援（费用 -${successBy}）。`,
          options: items.map(code => ({ id: code, cardCode: code, label: api.cardName(code) })),
        })
        if (!api.playCard(inv.seat, picked, { discount: successBy, noAction: true })) {
          api.info(`「我收下了！」：「${api.cardName(picked)}」当前不能打出。`)
          return
        }
        const played = (inv.assets || []).filter(asset => asset.code === picked).pop()
        if (!played) {
          api.info(`「我收下了！」：「${api.cardName(picked)}」没有留在场上。`)
          return
        }
        api.attachPlayerCardToAsset(CODE, played, { ownerSeat: inv.seat })
        api.info(`🕵️ 「我收下了！」：以 -${successBy} 费用打出「${api.cardName(picked)}」并附属，该支援获得[[违法]]。`)
      },
    },
  ],
  modifiers: [],
}
