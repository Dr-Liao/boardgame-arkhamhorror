// 10118 百折不挠（Persistence）· 潜袭者技能 · 1 经验 · 天性
// 卡面：你可以将百折不挠从你的弃牌堆投入技能检定。如果你这么做，本次检定后，将其混洗入你的牌库。
//
// 一卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 缺读点（blocked）：
//   · 投入候选只有一个枚举点：tests.js#commitCandidates 扫 owner.hand + playChannels.commitEntries。
//     playChannels 的 commit 通道目前只有 beneath / playCommit / attachedCommit / deckTopCommit，
//     没有「弃牌堆可投入」通道（play-channels.js#entriesOf.discard 只枚举可 *打出* 的事件/支援，
//     且技能牌被排除），也没有定义「投入后洗回牌库」的档案字段。
//   · commitOrigins.commit(seat, { code, from:'discard' }) 已经能借手牌完成一次投入并还原来源，
//     但没有任何玩家窗口/候选枚举会调用它——卡牌在弃牌堆时不是能力来源（descriptorSources 只枚举
//     手牌、受控支援、威胁区、下方/宿主等通道）。
//   · 条目因此不声明无人读取的字段：手牌投入（[wild] 图标）由卡面数据本来的投入路径正常工作，
//     弃牌堆投入 + 洗回牌库两半在 primitive-requests/10118.json 登记为缺原语。
const CODE = '10118'

export default {
  code: CODE,
  name: 'Persistence',
  simplified: true,
  note: 'blocked read point: 引擎没有「弃牌堆技能牌可投入」的候选通道（play-channels 的 commit 通道只有 beneath/playCommit/attachedCommit/deckTopCommit；tests.js#commitCandidates 只扫手牌 + 这些通道），也没有投入后「洗回牌库」的档案字段，因此「从弃牌堆投入 + 检定后洗回牌库」两半都未实现；手牌投入仍按卡面的 [wild] 图标正常结算。见 primitive-requests/10118.json。',
  abilities: [],
}
