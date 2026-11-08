// P0 验收用例清单（run.mjs 顺序执行）
import { campaigns } from './idp.mjs'
import { fatalMirage } from './fatal-mirage.mjs'
import { city } from './city.mjs'
import { peaksHeart } from './peaks-heart.mjs'
import { playerInvestigator } from './player-investigator.mjs'
import { ledger } from './ledger.mjs'

export const CASES = Object.freeze([
  ...campaigns, // P0-1..P0-4
  ...fatalMirage, // P0-5, P0-13
  ...city, // P0-6, P0-12
  ...peaksHeart, // P0-7, P0-8
  ...playerInvestigator, // P0-9, P0-10
  ...ledger, // P0-11
])
