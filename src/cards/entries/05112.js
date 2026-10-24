// 05112 魔法手势
// 卡面：快速。
// 卡面：你拥有额外1个法术槽位，只能用来携带一张[[法术]]或[[仪式]]支援。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// P7 复核：额外法术槽位走修正管线 `add:slot` + value:'arcane'（P2.9 的槽位读点；
// 旧写法 slot:arcane 也能生效，但文档口径是 add:slot）。`fast` 是资产关键字，写在条目上。
// 显式简化保留：槽位读点只按「槽位容量」计数，没有「这个额外槽位只能放[[法术]]/[[仪式]]」的
// 特性过滤（与 05009「最多 2 张[[工具]]不占双手」同一缺口）。

export default {
  code: '05112',
  fast: true,
  simplified: true,
  note: '未实现：额外法术槽位未限制只能携带[[法术]]/[[仪式]]支援；槽位读点只按容量计算（现有槽位原语不支持按特性分组，05009 同口径）。',
  modifiers: [
    { target: 'add:slot', value: 'arcane', amount: 1 },
  ],
  abilities: [],
}
