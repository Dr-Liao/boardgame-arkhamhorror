// 雾中之光 · P8 生产章节装配（真实 layout + playable manifest）。
// 场景数据/身份/行为仍由 chapter-entry.js#productionChapter 从 chapter-data.json 构建。
import { productionChapter } from '../../chapter-entry.js'
const entry = productionChapter('aLightInTheFog')
export const { manifest, scenario, identities, layout, behavior } = entry
