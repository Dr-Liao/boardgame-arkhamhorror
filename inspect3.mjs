import { pathToFileURL } from "node:url"
const mod = await import(pathToFileURL("G:/boardgame-hall-ai/games/arkhamhorror/content/campaigns/edgeOfTheEarth/story-text.js").href)
const ch = mod.EOTE_STORY_TEXT.chapters.iceAndDeathPart1
console.log("iceAndDeathPart1 chinese:", JSON.stringify(ch.chinese))
console.log("res1:", JSON.stringify(ch.resolutions.resolution1).slice(0, 700))
console.log("heading:", ch.heading)
