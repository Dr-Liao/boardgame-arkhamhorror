// 印刷特性（trait）的中文名。
//
// 为什么要有这个读点：规则判定必须按印刷英文特性（`Insight`、`Cultist`），但**给玩家看的
// 文字**必须和卡面一致（`[[洞察]]`、`[[异教徒]]`）。运行时提示/牌组校验消息里直接拼
// `${trait}` 会把英文漏到中文句子中（例如「牌组需要至少 10 张[[Insight]]事件」）。
//
// 数据源就是卡池本身，不另维护一份手写词典：cards-data.js 里每张卡的 `traits` 与
// `traitsZh` 逐位对应（5 930 张卡、8 000+ 对），新卡导入后自动带上译名。
// 少数卡的中文写法不一致（同一特性既写成中文又写成英文，或两种译法），取票数最多的**非英文**
// 写法；查不到时回退英文——宁可显示英文，也不编造一个不存在的译名。
import { ALL_CARDS } from './cards-data.js'

const labels = new Map()

function buildLabels() {
  // 英文特性（小写）→ Map<中文写法, 票数>
  const votes = new Map()
  for (const card of Object.values(ALL_CARDS)) {
    const printed = Array.isArray(card?.traits) ? card.traits : []
    const localized = Array.isArray(card?.traitsZh) ? card.traitsZh : []
    // 只认逐位对应的卡面：长度不一致说明数据缺译名，不参与投票（避免错位配对）。
    if (!printed.length || printed.length !== localized.length) continue
    for (let index = 0; index < printed.length; index++) {
      const name = String(printed[index] ?? '').trim()
      const text = String(localized[index] ?? '').trim()
      if (!name || !text) continue
      const key = name.toLowerCase()
      const bucket = votes.get(key) ?? new Map()
      bucket.set(text, (bucket.get(text) ?? 0) + 1)
      votes.set(key, bucket)
    }
  }
  for (const [key, bucket] of votes) {
    const [best] = [...bucket.entries()].sort((a, b) => {
      // 先比「是不是真的翻译了」：卡面英文写法（Ally/Tome 等）不能压过中文写法。
      const translated = text => (text.toLowerCase() === key ? 0 : 1)
      return translated(b[0]) - translated(a[0]) || b[1] - a[1]
    })
    labels.set(key, best[0])
  }
}

/** 印刷特性 → 中文写法；没有译名时原样返回（不抛错，消息层永远拿得到字符串）。 */
export function traitLabel(trait) {
  if (trait == null) return ''
  const text = String(trait).trim()
  if (!text) return ''
  if (!labels.size) buildLabels()
  return labels.get(text.toLowerCase()) ?? text
}

/** 特性数组版：用于「特性 A/B」这类一次列多个的提示。 */
export function traitLabels(traits) {
  return (Array.isArray(traits) ? traits : []).map(traitLabel).filter(Boolean)
}
