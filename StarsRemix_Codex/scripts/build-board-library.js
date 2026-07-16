import { rebuildLibrary } from "./board-library-files.js";

const library = await rebuildLibrary();
console.log(`Built board library with ${library.boards.length} boards.`);
