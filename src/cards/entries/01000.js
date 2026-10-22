// 01000 随机基础弱点
// 卡面：这是「随机基础弱点」的占位卡：牌组构建时它代表「从基础弱点池随机抽一张」，
//       本身不进牌库、也不进遭遇牌堆。
//
// 一张卡一个文件：这张卡的行为只在这里维护。
// 不要往 card-abilities.js 或任何批次文件里追加条目；新增卡用 tools/scaffold-card.mjs <code> --entry。
//
// 第 124 轮：`src/cards/card-rules.js` 原先写死 `RANDOM_BASIC_WEAKNESS_CODE = '01000'`，
// 现在由条目的 `randomBasicWeakness` 声明，读点 `RANDOM_BASIC_WEAKNESS_CODE` 从条目派生。

export default {
  code: '01000',
  randomBasicWeakness: true,
  abilities: [

  ],
  modifiers: [

  ],
}
