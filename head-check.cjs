const fs = require("fs")
const path = require("path")
const dir = "content/campaigns"
for (const name of fs.readdirSync(dir)) {
  const file = path.join(dir, name, "story-text.js")
  if (!fs.existsSync(file)) continue
  const text = fs.readFileSync(file, "utf8")
  const hits = [...text.matchAll(/"heading": "([^"]{0,30})"/g)].map(m => m[1])
  if (hits.length) console.log(name + " => " + [...new Set(hits)].slice(0, 8).join(" | "))
}
