// One removal observer for all card images, including placeholders that never
// enter the viewport. Check connectivity after DOM moves so retained art survives.
const resources = new Map()
let observer
let scheduled = false

function sweep() {
  scheduled = false
  for (const [node, dispose] of resources) {
    if (!node.isConnected) dispose()
    else dispose.refresh?.()
  }
  if (!resources.size) { observer?.disconnect(); observer = null }
}

function schedule() {
  if (scheduled) return
  scheduled = true
  queueMicrotask(sweep)
}

export function trackImageResource(node, cleanup, refresh) {
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    resources.delete(node)
    cleanup()
  }
  dispose.refresh = refresh
  resources.set(node, dispose)
  if (!observer && typeof MutationObserver !== 'undefined' && typeof document !== 'undefined') {
    observer = new MutationObserver(records => {
      if (records.some(record => record.removedNodes.length)) schedule()
    })
    observer.observe(document.documentElement, { childList: true, subtree: true })
  }
  // Rendered nodes are mounted synchronously by the host.
  schedule()
  return dispose
}

export function disposeImageResources() {
  for (const dispose of [...resources.values()]) dispose()
  observer?.disconnect()
  observer = null
}

// Keep card frames/text mounted so scrolling, focus and click targets are stable.
// Only decoded art is unloaded; re-entry cancels eviction and restores the URL.
export function observeImageViewport(node, { enter, exit, delay = 3000, margin = '600px' }) {
  let timer
  let disposed = false
  let observer
  const cancel = () => { clearTimeout(timer); timer = null }
  const stop = () => {
    disposed = true
    cancel()
    observer?.disconnect()
  }
  if (typeof IntersectionObserver === 'undefined') {
    queueMicrotask(() => { if (!disposed && node.isConnected) enter() })
    return stop
  }
  let ancestors = null
  let observedRoot
  let generation = 0
  const refresh = () => {
    if (disposed || !node.isConnected) return
    const path = []
    for (let parent = node.parentElement; parent; parent = parent.parentElement) path.push(parent)
    if (ancestors?.length === path.length && path.every((parent, index) => parent === ancestors[index])) return
    ancestors = path
    let root = null
    if (typeof getComputedStyle === 'function') for (const parent of path) {
      const style = getComputedStyle(parent)
      if (/(auto|scroll)/.test(style.overflowY + style.overflowX)) { root = parent; break }
    }
    if (observer && root === observedRoot) return
    observedRoot = root
    cancel()
    observer?.disconnect()
    const ticket = ++generation
    observer = new IntersectionObserver(entries => {
      if (disposed || ticket !== generation || !node.isConnected) return
      const entry = entries.at(-1)
      if (entry?.isIntersecting) { cancel(); enter() }
      else if (!timer) timer = setTimeout(() => {
        timer = null
        if (!disposed && node.isConnected) exit()
      }, delay)
    }, { root, rootMargin: margin })
    observer.observe(node)
  }
  // stablePanel/retainTableArt move retained art into new scroll containers.
  // The shared removal sweep refreshes connected images as well as disposing old ones.
  stop.refresh = refresh
  queueMicrotask(refresh)
  return stop
}
