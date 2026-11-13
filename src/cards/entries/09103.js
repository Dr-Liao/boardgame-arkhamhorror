// 09103 临时盾牌（Improvised Shield）· 幸存者资产 · 0 经验 · 手槽 · 3 生命
// 卡面：临时盾牌只能从你的弃牌堆打出。
//       强制 - 在临时盾牌被击败时，不将其弃掉，改为洗入你的牌库。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 读点：
//   · 只能从弃牌堆打出：条目级 playableFromDiscard + playableOnlyFromDiscard
//     （play-condition / doPlay 的弃牌堆通道声明；与 06245 同一组字段）。
//   · 被击败时洗回牌库：P6 原语 assetDefeated 窗口（src/engine/asset-defeat.js）——
//     上下文 `shuffledIntoDeck` 是引擎承认的「改为洗回牌库」出口。
// approximation: legalMoves 的弃牌堆通道目前只枚举事件（play-channels.js#discard），
//   支援（本卡）没有真实的「从弃牌堆打出」入口；已写 primitive-request 09103.json。
//   条目字段与 doPlay 的 fromDiscard 路径均为真读点，缺的是行动枚举。
const code = '09103'

export default {
  code,
  playableFromDiscard: true,
  playableOnlyFromDiscard: true,
  note: '引擎读点：playableFromDiscard/playableOnlyFromDiscard 已接入 play-channels 的弃牌堆通道——「只能从弃牌堆打出」的支援会在 legalMoves 里作为普通行动出现（弃牌堆通道现同时枚举事件与这类支援；快速窗口仍只给事件）；被击败洗回牌库已实现。',
  abilities: [
    {
      kind: 'forced',
      trigger: 'assetDefeated',
      label: '被击败时：不弃掉，改为洗回牌库',
      criteria: [({ context, source }) => context?.assetCode === code && context?.asset?.id === source?.id],
      resolve: ({ inv, context, api }) => {
        context.shuffledIntoDeck = true
        api.info(`♻️ 「临时盾牌」被击败：不弃掉，改为洗回 ${inv.name} 的牌库。`)
      },
    },
  ],
  modifiers: [],
}
