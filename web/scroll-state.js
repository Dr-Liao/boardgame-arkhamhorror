// Arkham views are rebuilt after most interactions. Preserve every scroll
// region that the player has moved instead of maintaining a fragile selector
// allow-list as new panels are added.
const transientClass = name => /^(active|current|selected|open|closed|is-|has-|ah-drop)/.test(name)

function fingerprint(element, root) {
  if (element === root) return '$root'
  if (element.dataset.scrollKey) return `$key:${element.dataset.scrollKey}`
  if (element.id) return `$id:${element.id}`
  const classes = [...element.classList].filter(name => !transientClass(name)).sort()
  const identity = classes.length
    ? `.${classes.join('.')}`
    : `[${element.getAttribute('role') || ''}:${element.getAttribute('aria-label') || ''}]`
  return `${element.tagName.toLowerCase()}${identity}`
}

function context(element, root) {
  const values = []
  for (let node = element; node; node = node.parentElement) {
    if (node.dataset?.scrollContext != null) values.push(node.dataset.scrollContext)
    if (node === root) break
  }
  return values.reverse().join('\u001f')
}

function indexedElements(root) {
  const counts = new Map()
  return [root, ...root.querySelectorAll('*')].map(element => {
    const key = fingerprint(element, root)
    const index = counts.get(key) || 0
    counts.set(key, index + 1)
    return { element, key, index }
  })
}

export function captureScrollState(root) {
  if (!root) return []
  return indexedElements(root)
    .filter(({ element }) => element.scrollTop !== 0 || element.scrollLeft !== 0)
    .map(({ element, key, index }) => ({
      key,
      index,
      top: element.scrollTop,
      left: element.scrollLeft,
      context: context(element, root),
    }))
}

export function restoreScrollState(root, saved) {
  if (!root || !saved?.length) return
  const elements = new Map()
  for (const item of indexedElements(root)) {
    if (!elements.has(item.key)) elements.set(item.key, [])
    elements.get(item.key).push(item.element)
  }
  for (const item of saved) {
    const element = elements.get(item.key)?.[item.index]
    if (element && context(element, root) === item.context) {
      element.scrollTop = item.top
      element.scrollLeft = item.left
    }
  }
}

export function restoreScrollWhenMounted(root, saved) {
  queueMicrotask(() => {
    if (root?.isConnected) restoreScrollState(root, saved)
  })
}
