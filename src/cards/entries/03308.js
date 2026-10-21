// 03308 卡戎的银币
// 卡面：永久。卓越。
// 卡面：在冒险结局期间取得经验值时，如果该次冒险期间你没有被击败，你取得额外2点经验。如果该次冒险期间你被击败，你阵亡。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 03308 卡戎的银币：永久；结局结算时 +2 经验，但被击败即死亡（读点在结局发经验段）。

export default {
  code: '03308',
  passive: { permanent: true },
  obolContract: true,
  abilities: [

  ],
  modifiers: [

  ],
}
