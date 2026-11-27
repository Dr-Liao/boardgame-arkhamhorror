// 05270 死期临近
// 归属：关卡专用 05238《聚合幻灭》（uad）。卡面：显现 - 放入任意调查员的威胁区。
// 强制 - 在你将要受到恐惧时：受到额外 2 点恐惧并弃掉死期临近。
// 一卡一文件：规则只在这里维护；恐惧拦截走条目 harmInterceptor（读点 enemies.js 的 applyHarm）。
import { threatHarmEncounter } from '../../_shared.js'

export default threatHarmEncounter('05270', 'horror')
