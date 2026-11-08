import fs from 'node:fs'
const ROOT = "G:/boardgame-hall-ai/games/arkhamhorror"
const raw = JSON.parse(fs.readFileSync("G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/c/_line-evidence.json", "utf8"))
const lines = []
for (const [path, data] of Object.entries(raw)) {
  if (data.error) { lines.push(path + " ERROR"); continue }
  const parts = Object.entries(data.hits).filter(([, v]) => v.length).map(([k, v]) => k + "=" + v.join(","))
  lines.push(path + " [" + data.lineCount + "] " + parts.join(" "))
}
fs.writeFileSync("G:/boardgame-hall-ai/games/arkhamhorror/docs/edgeOfTheEarth/eote-scan/campaign/c/_line-evidence.txt", lines.join("\n"), "utf8")
console.log(lines.join("\n"))
