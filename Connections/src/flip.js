(() => {
// FLIP animation helper: measure elements, mutate the DOM, then animate
// each element from its old position to its new one.
//
// `elements`: iterable of elements to track.
// `mutate`: function that reorders / inserts / removes DOM nodes.
// Returns a promise that resolves when the movement finishes.
//
// Never stalls game logic: if the document is hidden (animations pause),
// the mutation is applied instantly, and a timeout backstops the finished
// promises so a paused animation can't wedge an await chain.
function flip(elements, mutate, { duration = 450, easing = 'cubic-bezier(0.25, 0.1, 0.25, 1)' } = {}) {
  const tracked = [...elements];

  if (document.hidden) {
    mutate();
    return Promise.resolve();
  }

  const first = new Map(tracked.map((el) => [el, el.getBoundingClientRect()]));

  mutate();

  const animations = [];
  for (const el of tracked) {
    if (!el.isConnected) continue;
    const before = first.get(el);
    const after = el.getBoundingClientRect();
    const dx = before.left - after.left;
    const dy = before.top - after.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
    animations.push(
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
        { duration, easing }
      ).finished
    );
  }

  const done = Promise.all(animations).catch(() => {});
  const backstop = new Promise((resolve) => setTimeout(resolve, duration + 300));
  return Promise.race([done, backstop]);
}

window.ConnectionsFlip = {
  flip,
};
})();
