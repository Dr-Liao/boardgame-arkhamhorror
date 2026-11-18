// 10091 通灵术（Speak to the Dead）· 潜修者支援 · 1 资源 · 法术槽 · 天赋/仪式
// 卡面：
//   使用(6 贡品)。
//   [action] 花费任意数量的贡品：谈判。选择你弃牌堆中的一张[[法术]]或[[仪式]]事件并从混乱袋中
//   揭示标记，数量等于花费的贡品。如果揭示了[skull]或[curse]标记，将所选事件返回你的手牌。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 使用(6 贡品) → 条目级 uses/usesType（实例初始化在 newPlayerAssetInstance；补满/耗尽读点同源）。
//   · 「花费任意数量的贡品」：费用表达式（cost.uses）只能写数字/表达式，没有「任意 N 个 uses」，
//     因此 resolve 里先问 N（1..剩余贡品）再走 api.spendUses（use-transfer/uses.js 的唯一扣 uses 写点）。
//   · 「谈判。」→ countsAs: 'parley'（dispatch.js 的 isParleyDescriptor 读点：本行动不引发借机攻击；
//     卡面「谈判」指示门禁也在同一个字段上）。
//   · 弃牌堆里的[[法术]]/[[仪式]]事件：api.cardType + api.cardTraits 只读筛选（不写 state）；
//     回手走 api.moveCard({ code, from:'discard', to:'hand' })（B6 区域搬运原语）。
//   · 「揭示等于花费数量的混乱标记」：api.revealChaosTokens(N)（非检定的揭示原语，02013/09049 同款；
//     curse/bless 按规则在揭示后消耗，其余归还）。
import { ALL_CARDS } from '../../cards/cards-data.js'

const CODE = '10091'

const isEventCode = code => ALL_CARDS[code]?.type === 'event'
const hasSpellOrRitualTrait = code => (ALL_CARDS[code]?.traits || [])
  .some(trait => ['spell', 'ritual'].includes(String(trait).toLowerCase()))

// 弃牌堆里可返回的候选：[[法术]]或[[仪式]]事件（只读筛选，写入口是 api.moveCard）。
const recoverableEvents = inv => [...new Set(inv.discard || [])]
  .filter(code => isEventCode(code) && hasSpellOrRitualTrait(code))

export default {
  code: CODE,
  name: '通灵术',
  uses: 6,
  usesType: 'offerings',
  abilities: [
    {
      kind: 'action',
      countsAs: 'parley',
      label: '谈判：花费任意数量贡品，揭示等量标记；有骷髅/诅咒则把弃牌堆的一张[[法术]]/[[仪式]]事件返回手牌',
      cost: { action: true },
      criteria: [({ state, inv, source }) => (source?.uses || 0) > 0 && recoverableEvents(inv).length > 0],
      resolve: ({ state, inv, source, api }) => {
        const candidates = recoverableEvents(inv)
        const room = Math.max(0, Math.min(6, source?.uses || 0))
        if (!room || !candidates.length) {
          api.info('「通灵术」：没有可花费的贡品，或弃牌堆里没有[[法术]]/[[仪式]]事件。')
          return
        }
        const spend = room === 1 ? 1 : Number(api.choice({
          kind: 'effect', source: CODE, seat: inv.seat,
          prompt: `「通灵术」：花费任意数量的贡品（剩余 ${room}），揭示等量的混乱标记。`,
          options: Array.from({ length: room }, (_, index) => {
            const amount = index + 1
            return { id: String(amount), label: `花费 ${amount} 个贡品（揭示 ${amount} 个混乱标记）` }
          }),
        })) || 1
        if (!api.spendUses(source, spend)) return
        const chosen = candidates.length === 1 ? candidates[0] : candidates.find(code => code === api.choice({
          kind: 'search', source: CODE, seat: inv.seat,
          prompt: '「通灵术」：选择弃牌堆里要返回的一张[[法术]]/[[仪式]]事件。',
          options: candidates.map(code => ({ id: code, label: api.cardName(code), cardCode: code })),
        })) || candidates[0]
        if (!chosen) return
        const tokens = api.revealChaosTokens(spend)
        const hit = tokens.some(token => token === 'skull' || token === 'curse')
        api.info(`🕯 「通灵术」：花费 ${spend} 个贡品，揭示 ${tokens.map(api.tokenLabel).join('、') || '（空袋）'}。`)
        if (!hit) {
          api.info(`🕯 「通灵术」：没有揭示[skull]或[curse]标记，「${api.cardName(chosen)}」留在弃牌堆。`)
          return
        }
        api.moveCard({ code: chosen, from: 'discard', to: 'hand' })
        api.info(`🕯 「通灵术」：把弃牌堆的「${api.cardName(chosen)}」返回 ${inv.name} 的手牌。`)
      },
    },
  ],
  modifiers: [],
}
