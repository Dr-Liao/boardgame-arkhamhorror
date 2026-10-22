// 04210 张开巨口
// 归属：关卡专用 · heartOfTheEldersPart1（久远腹地（上）· 昆扬之口）
// 遭遇组：pillars_of_judgment
// 卡面：[action]位于昆扬之口的调查员共同花费1[per_investigator]个线索：你解开了其中一个谜题。在昆扬之口上放置1资源，作为一个石柱标记。
// 卡面：目标 - 为了进入昆扬，必须解开六根石柱的谜题。如果昆扬之口上有6个石柱标记，推进到场景2b。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

export default { code: '04210', scope: 'act', actRule: { onReveal(state, act, api) { api.finish('r1') } } }
