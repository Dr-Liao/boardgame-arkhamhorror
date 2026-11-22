// 重返真相幻影 · 桌面布局。
//
// 参考 ReturnToAPhantomOfTruth.hs（8 列 × 4 行）：
//   grandGuignol   .                canalSaintMartin .
//   grandGuignol   montmartre       canalSaintMartin pereLachaiseCemetery
//   operaGarnier   montmartre       leMarais         pereLachaiseCemetery
//   operaGarnier   .                leMarais         .
//   gareDOrsay     gardensOfLuxembourg notreDame     .
//   .              montparnasse     .                .
// 基础布局已覆盖这些地点 id；这里沿用基础坐标（新增变体卡共用同一 id/坐标）。
import { layoutFor } from '../../../../scenario-manifest.js'
import { scenario } from './definition.js'

export const layout = layoutFor(scenario, {
  grandGuignol: { x: 0, y: 0 },
  montmartre: { x: 1, y: 0 },
  canalSaintMartin: { x: 2, y: 0 },
  pereLachaiseCemetery: { x: 3, y: 0 },
  operaGarnier: { x: 0, y: 1 },
  leMarais: { x: 2, y: 1 },
  gareDOrsay: { x: 0, y: 2 },
  montparnasse: { x: 1, y: 2 },
  gardensOfLuxembourg: { x: 2, y: 2 },
  notreDame: { x: 3, y: 2 },
})
