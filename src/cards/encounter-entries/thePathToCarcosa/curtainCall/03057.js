// 03057 排练厅
// 归属：关卡专用 · curtainCall（卡尔克萨之路 · 谢幕）
// 遭遇组：curtain_call
// 卡面：强制 - 你调查排练厅时检定成功且超过难度至少2点后：受到1点恐惧。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 第 104 轮：谢幕的排练室。

export default { code: '03057', scope: 'location', flags: { overSuccessHorror: true } }
