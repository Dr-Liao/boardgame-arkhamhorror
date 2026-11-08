import { pathToFileURL } from "node:url"
const mod = await import(pathToFileURL("G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/story-text.js").href)
const text = mod.EOTE_STORY_TEXT
const city = text.chapters.cityOfTheElderThings
console.log("city heading:", city.heading)
console.log("city chinese:", JSON.stringify(city.chinese))
console.log("city setup:", city.setup.slice(0, 500))
console.log("---specialRules keys:", Object.keys(city.sections.specialRules || {}))
console.log("specialRules body:", (city.sections.specialRules?.[0]?.body || "").slice(0, 400))
const p1 = text.chapters.theHeartOfMadnessPart1
console.log("=== part1 heading:", p1.heading, "chinese:", JSON.stringify(p1.chinese))
console.log("res1:", JSON.stringify(p1.resolutions.resolution1, null, 1).slice(0, 1200))
const p2 = text.chapters.theHeartOfMadnessPart2
console.log("=== part2 chinese:", JSON.stringify(p2.chinese))
console.log("noResolution:", JSON.stringify(p2.resolutions.noResolution).slice(0, 500))
