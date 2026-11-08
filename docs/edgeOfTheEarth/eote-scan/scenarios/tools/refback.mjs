import { ALL_CARDS } from "./src/cards/cards-data.js"
for (const code of ["08501","08549","08596","08621","08648"]) {
  const c = ALL_CARDS[code]
  console.log("=== " + code + " " + (c?.name||"") + " / " + (c?.nameZh||"") + " ===")
  console.log("text:", (c?.text||"").slice(0,400).replace(/\n/g," | "))
  console.log("backText:", (c?.backText||"").slice(0,2500).replace(/\n/g," | "))
  console.log()
}
