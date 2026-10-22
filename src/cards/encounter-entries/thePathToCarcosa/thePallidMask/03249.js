// 03249 墓灯地穴
// 归属：关卡专用 · thePallidMask（卡尔克萨之路 · 苍白面具）
// 遭遇组：the_pallid_mask
// 卡面：在墓灯地穴调查改为使用[willpower]，而非尝试调查原本指示的技能。
// 卡面：强制 - 在墓灯地穴揭示时：将地下墓穴牌库顶的2张地下墓穴放置入场，分别放在墓灯地穴的上方和右方。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。
//
// 注：04055 / 04056 的密谋条目已在「埃兹特里的覆灭」部分声明，并被该章 behavior 使用；
// 时间倒流沿用同一张卡但文案/结局不同，因此它的 agendaReveal 仍保留章节内分支（见交接文档）。
// 墓灯地穴（03249）：在此调查改为使用意志；埋骨洞窟（03250）：调查时少 1 个手部槽位。

export default { code: '03249', scope: 'location', locationRule: { investigateSkill: 'willpower' } }
