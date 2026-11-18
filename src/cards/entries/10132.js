// 10132 密教珍藏（Occult Reliquary）· 中立支援 · 3 级 · 永久 · [[恩赐]]/[[契约]]
// 卡面：
//   永久。每套牌库仅限 1 张。
//   你拥有额外 1 个手部、饰品或法术槽位，只可以用来携带[[祝福]]或[[诅咒萦绕]]支援。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
//
// 读点（卡面 → 引擎）：
//   · 永久：cards-data 的 `permanent: true` —— setup.js 在开局把牌库里的永久卡直接放入场，
//     条目不需要 setup 描述子，也不需要从手牌打出。
//   · 受限额外槽 = 条目级 `restrictedSlots`（2026-10-26 原语收敛，与 01008 书位 / 02147 武器位 /
//     05112 法术位 / 10041 手部工具位同一读点）：assets.js#restrictedSlotInfo 只把容量给
//     特性命中的候选，受限占用不计入普通槽；判定唯一入口仍是 canEquip。
//   · 「[[祝福]]」/「[[诅咒萦绕]]」= 特性 Blessed / Cursed（cards-data 的 traits，大小写不敏感，
//     与 restrictedSlotInfo 的匹配口径一致）。10134 暮光冠冕本身就是 [[祝福]] 支援。
//
// approximation（缺读点见 artifacts/migration/fhv/primitive-requests/10132.json）：
//   引擎没有「一个额外槽位在三种槽位类型里二/三选一」的灵活槽原语（restrictedSlotInfo 按
//   entry.slot 严格相等匹配）。这里为 hand / accessory / arcane 各声明 1 格，都能放
//   [[祝福]]/[[诅咒萦绕]] 支援；因此比印刷最多多出 2 格可用容量（印刷只有 1 格）。
const CODE = '10132'
const BLESSED_OR_CURSED = ['Blessed', 'Cursed']

export default {
  code: CODE,
  name: 'Occult Reliquary',
  simplified: true,
  note: 'approximation: 「额外 1 个手部、饰品或法术槽位」用 restrictedSlots 三条声明近似（三个槽位各 1 格，只能放[[祝福]]/[[诅咒萦绕]]支援）；引擎没有「三选一」灵活槽原语，因此比印刷最多多出 2 格容量，见 primitive-requests/10132.json。',
  restrictedSlots: [
    { slot: 'hand', traitsAny: BLESSED_OR_CURSED, count: 1 },
    { slot: 'accessory', traitsAny: BLESSED_OR_CURSED, count: 1 },
    { slot: 'arcane', traitsAny: BLESSED_OR_CURSED, count: 1 },
  ],
  abilities: [],
  modifiers: [],
}
