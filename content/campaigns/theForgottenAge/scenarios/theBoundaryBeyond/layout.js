import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario, PRESENT_LOCATIONS, ANCIENT_LOCATIONS } from './definition.js'

// 现场的 6 个格位沿用印刷地图的走向：圆形的神庙遗迹在上方，中排从左到右是
// 霍奇米尔科、大都会教堂、索卡洛广场、科约阿坎区，三角的查普尔特佩克公园在右上。
// 12 张古代地点不是独立格位——它们会覆盖在现代地点上「取而代之」，所以坐标与
// 对应现代地点相同（同一张桌面位置）。
const slots = {
  templeRuins: { x: 2, y: 0 },
  metropolitanCathedral: { x: 1, y: 1 },
  zocalo: { x: 2, y: 1 },
  xochimilco: { x: 0, y: 1 },
  coyoacan: { x: 3, y: 1 },
  chapultepecPark: { x: 4, y: 0 },
}

// 符号 → 现代格位，用来把 12 张古代地点落到它们在印刷地图上的位置。
const slotBySymbol = Object.fromEntries(Object.entries(PRESENT_LOCATIONS)
  .map(([id, spec]) => [spec.symbol, slots[id]]))

const coordinates = { ...slots }
for (const [id, spec] of Object.entries(ANCIENT_LOCATIONS)) {
  const point = slotBySymbol[spec.symbol]
  coordinates[id] = point ? { ...point } : { x: 0, y: 0 }
}

export const layout = layoutFor(scenario, coordinates)
