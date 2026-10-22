// 卡尔克萨剧情角色 → 卡号（第 123 轮，第 8 批）。
//
// 原先这些卡号写死在 `src/campaign/story.js` 的叙事拼装里：
// - `03006` 萝拉·海耶斯：序章追加「萝拉的序幕」；
// - 五位 VIP 的「提供的信息」段落只在对应记录存在时追加。
// 现在由战役内容声明，`story.js` 只按角色查表。

export const CARCOSA_STORY_ROLES = Object.freeze({
  lola: '03006',
  sebastiensInformation: '03079',
  constancesInformation: '03076a',
  jordansInformation: '03077',
  harukosInformation: '03078',
  ashleighsInformation: '03080',
})
