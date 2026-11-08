import { readFileSync } from "node:fs"
const text = readFileSync("content/campaigns/edgeOfTheEarth/story-text.js", "utf8")
const start = text.indexOf("export const EOTE_STORY_TEXT")
// 从生成物里取 city chapter 与 heart part1/2 的关键 sections
const data = text.slice(start)
for (const key of ['"id": "cityOfTheElderThings"', '"id": "theHeartOfMadnessPart1"', '"id": "theHeartOfMadnessPart2"']) {
  const i = data.indexOf(key)
  console.log("=== " + key + " @ " + i)
  const seg = data.slice(i, i + 400)
  console.log(seg)
}
