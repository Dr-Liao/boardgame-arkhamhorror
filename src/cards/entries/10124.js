// 10124 坚守信念（Keep Faith）· 生存者事件 · 2 经验 · 命运/祝福
// 卡面：快速。可在任何 [fast] 时间段期间打出。
//       在混乱袋中加入 4 个 [bless] 标记。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点（卡面 → 引擎）：
//   · 「快速。可在任何 [fast] 时间段期间打出」= played 描述子 `fast: true` 且不带 trigger
//     （quickEventView 只把 fast+trigger 视为反应窗口专用；无 trigger 的快速事件在 legalMoves 里是
//     0 行动的普通打出候选，行动点用尽后的空档期也能直接打出——与 07034 同款重印行为）。
//   · 「加入 4 个 [bless]」= `api.chaosTokens.add('bless', 4)`（token-pool 的唯一写点；受实体标记池
//     上限 10 限制，超出部分自然不加，返回实际加入数）。
const CODE = '10124'
const BLESS = 'bless'
const AMOUNT = 4

export default {
  code: CODE,
  name: 'Keep Faith',
  abilities: [
    {
      kind: 'played',
      fast: true,
      label: '快速：在混乱袋中加入 4 个祝福标记',
      resolve: ({ api }) => {
        const added = api.chaosTokens.add(BLESS, AMOUNT)
        api.info(`🕯️ 坚守信念：在混乱袋中加入 ${added} 个祝福标记（印刷 ${AMOUNT} 个，受标记池上限限制）。`)
      },
    },
  ],
  modifiers: [],
}
