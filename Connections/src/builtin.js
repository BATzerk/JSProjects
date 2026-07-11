(() => {
// The built-in sample puzzle, shown when no custom puzzle is in the URL.
// Groups are ordered easiest (yellow) to trickiest (purple).
// `board` is 16 [groupIndex, wordIndex] pairs defining the starting layout.
const BUILTIN_PUZZLE = {
  title: 'The Starter Board',
  author: '',
  groups: [
    { name: 'Fast', words: ['SWIFT', 'RAPID', 'BRISK', 'SPEEDY'] },
    { name: '___ Bank', words: ['PIGGY', 'BLOOD', 'RIVER', 'WORLD'] },
    { name: 'Keyboard Keys', words: ['SHIFT', 'RETURN', 'ESCAPE', 'TAB'] },
    { name: '___ Mail', words: ['SNAIL', 'JUNK', 'VOICE', 'BLACK'] },
  ],
  board: [
    [2, 0], [3, 0], [1, 0], [0, 0],
    [3, 1], [1, 1], [2, 1], [0, 1],
    [1, 2], [0, 2], [3, 2], [2, 2],
    [0, 3], [3, 3], [2, 3], [1, 3],
  ],
};

window.ConnectionsBuiltin = {
  BUILTIN_PUZZLE,
};
})();
