import { layoutFor } from '../../../../scenario-manifest.js'
import { coordinates } from '../../../theDunwichLegacy/scenarios/theEssexCountyExpress/layout.js'
import { scenario } from './definition.js'

// 列车是 7 节线性车厢：复用基础章的槽位坐标，车头在右侧。
export const layout = layoutFor(scenario, coordinates)
