// 03165 真正可怕的人(版本二)
// 归属：关卡专用 · theUnspeakableOath（卡尔克萨之路 · 邪秽誓约）
// 遭遇组：the_unspeakable_oath
// 卡面：忽略阿卡姆疯人院地点未揭示面上的文字。
// 卡面：目标 - 找到关着丹尼尔·契斯特菲尔德的病人拘禁室地点。(要推进场景时，你会收到指示)。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 7 批：卡尔克萨「不可言说的誓言」的部分幕/密谋脚本。

export default { code: '03165', scope: 'act', actRule: { onReveal(state, act, api) { api.spawn('03182b', 'danielsCell') } } }
