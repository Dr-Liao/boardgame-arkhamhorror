// 02221 灵魂之歌
// 归属：关卡专用 · bloodOnTheAltar（血色祭坛）
// 遭遇组：blood_on_the_altar
// 卡面：涌动。险境。
// 卡面：显现 - 将灵魂之歌加入到任意调查员的威胁区域。
// 卡面：强制 - 在你将要受到伤害时：受到额外2点伤害并弃掉灵魂之歌。
//
// 一卡一文件：这张卡的规则只在这里维护，不要写回 encounter-abilities.js。

import { threatHarmEncounter } from '../../_shared.js'

export default threatHarmEncounter('02221', 'damage', { surge: true, campaigns: ['dunwich'] })
