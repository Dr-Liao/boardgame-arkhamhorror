// 02227 追根究底
// 卡面：你的地点有线索才能投入到技能检定。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。

export default {
  code: '02227',
  abilities: [
    { kind: 'commit', label: '追根究底', skill: { requireClueAtLocation: true } },
  ],
  modifiers: [

  ],
}
