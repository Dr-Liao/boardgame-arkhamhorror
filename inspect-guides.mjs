import { readFileSync } from "node:fs"
for (const id of ["cityOfTheElderThings", "theHeartOfMadnessPart1", "theHeartOfMadnessPart2"]) {
  const g = JSON.parse(readFileSync("web/scenario-guides/" + id + ".json", "utf8"))
  console.log("=== " + id, JSON.stringify(g.chinese), "status:", g.chineseStatus)
  const titles = []
  const walk = node => {
    if (node && typeof node === "object") {
      if (node.title) titles.push(node.title)
      for (const child of node.children || []) walk(child)
      for (const child of node.columns || []) walk(child)
    }
  }
  walk(g.locales.zh)
  console.log("zh titles:", JSON.stringify(titles).slice(0, 600))
  console.log("specialRules zh:", JSON.stringify(g.locales.zh.specialRules).slice(0, 700))
}
