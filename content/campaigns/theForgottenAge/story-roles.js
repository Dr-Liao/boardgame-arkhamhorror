// 失落时代剧情角色 → 卡号（第 123 轮，第 8 批）。
//
// 原先 `src/campaign/story.js` 在《久远腹地（上）》的导入段里写死
// `04147`（伊塔卡）/ `04051`（亚历山卓）/ `04148`（探险日志）三个卡号，
// 用来判断「随行同伴」是否在队伍牌组里。现在由战役内容声明，`story.js` 只按角色查表。

export const TFA_STORY_ROLES = Object.freeze({
  ichtaca: '04147',
  alejandro: '04051',
  journal: '04148',
})
