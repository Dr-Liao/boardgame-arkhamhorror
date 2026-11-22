import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

// 参考布局（3 行网格）：三角形(图书馆/天文台) + 圆形图标一行，第二行教办/宿舍。
export const layout = layoutFor(scenario, {
  orneLibrary: { x: 0, y: 0 }, warrenObservatory: { x: 0, y: 0 },
  miskatonicQuad: { x: 1, y: 0 }, scienceBuilding: { x: 2, y: 0 }, alchemyLabs: { x: 3, y: 0 },
  humanitiesBuilding: { x: 0, y: 1 }, studentUnion: { x: 1, y: 1 },
  administrationBuilding: { x: 2, y: 1 }, dormitories: { x: 1, y: 2 }, facultyOffices: { x: 2, y: 2 },
})
