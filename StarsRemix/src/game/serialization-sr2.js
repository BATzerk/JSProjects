(function (global) {
  const PREFIX = "SR2";
  const { CELL_STATES, DIFFICULTIES } = global.StarsRemixSnapshots;

  function encode(snapshot) {
    global.StarsRemixSnapshots.validate(snapshot);
    const { puzzle, progress, solution, difficulty } = snapshot;
    const houseBits = bitsRequired(puzzle.size - 1);
    const cellBits = bitsRequired(CELL_STATES.length - 1);
    const payload = [
      puzzle.size.toString(36),
      puzzle.starsPerUnit.toString(36),
      DIFFICULTIES.indexOf(difficulty.label).toString(36),
      encodeText(puzzle.id),
      encodeText(puzzle.title),
      encodeValues(puzzle.houses.flat(), houseBits),
      encodeValues(progress.board.flat().map((cell) => CELL_STATES.indexOf(cell)), cellBits),
      encodeValues(solution.map(({ row, col }) => row * puzzle.size + col), bitsRequired(puzzle.size ** 2 - 1)),
    ].join(".");
    return `${PREFIX}.${payload}.${checksum(payload)}`;
  }

  function decode(text) {
    const parts = text.trim().split(".");
    if (parts.length !== 10 || parts[0] !== PREFIX) {
      throw new Error("That is not a supported Stars Remix board file.");
    }
    const payload = parts.slice(1, -1).join(".");
    if (checksum(payload) !== parts.at(-1)) throw new Error("That board string is damaged or incomplete.");

    const size = parseInteger(parts[1], 36);
    const starsPerUnit = parseInteger(parts[2], 36);
    const difficultyIndex = parseInteger(parts[3], 36);
    const difficultyLabel = DIFFICULTIES[difficultyIndex];
    if (!difficultyLabel) throw new Error("The saved difficulty is invalid.");
    if (size <= 0 || size > 32 || starsPerUnit <= 0 || starsPerUnit > size) {
      throw new Error("The saved puzzle data is invalid.");
    }

    const houses = chunk(decodeValues(parts[6], size ** 2, bitsRequired(size - 1)), size);
    const cellIndexes = decodeValues(parts[7], size ** 2, bitsRequired(CELL_STATES.length - 1));
    if (cellIndexes.some((value) => value >= CELL_STATES.length)) {
      throw new Error("The saved board state is invalid.");
    }
    const board = chunk(cellIndexes.map((value) => CELL_STATES[value]), size);
    const solution = decodeValues(parts[8], size * starsPerUnit, bitsRequired(size ** 2 - 1))
      .map((position) => ({ row: Math.floor(position / size), col: position % size }));

    return global.StarsRemixSnapshots.create({
      puzzle: { id: decodeText(parts[4]), title: decodeText(parts[5]), size, starsPerUnit, houses },
      board,
      solution,
      difficultyLabel,
    });
  }

  function encodeValues(values, width) {
    const bytes = new Uint8Array(Math.ceil(values.length * width / 8));
    values.forEach((value, index) => {
      if (!Number.isInteger(value) || value < 0 || value >= 2 ** width) throw new Error("A saved value is out of range.");
      for (let bit = 0; bit < width; bit += 1) {
        if (value & (1 << bit)) bytes[Math.floor((index * width + bit) / 8)] |= 1 << ((index * width + bit) % 8);
      }
    });
    return bytesToBase64(bytes);
  }

  function decodeValues(encoded, count, width) {
    const bytes = base64ToBytes(encoded);
    if (bytes.length !== Math.ceil(count * width / 8)) throw new Error("The saved board payload has the wrong length.");
    return Array.from({ length: count }, (_, index) => {
      let value = 0;
      for (let bit = 0; bit < width; bit += 1) {
        value |= ((bytes[Math.floor((index * width + bit) / 8)] >> ((index * width + bit) % 8)) & 1) << bit;
      }
      return value;
    });
  }

  function encodeText(value) { return bytesToBase64(new TextEncoder().encode(value)); }
  function decodeText(value) {
    try { return new TextDecoder("utf-8", { fatal: true }).decode(base64ToBytes(value)); }
    catch { throw new Error("The saved board contains invalid text."); }
  }
  function bytesToBase64(bytes) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  }
  function base64ToBytes(value) {
    if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error("The saved board payload is invalid.");
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    let binary;
    try { binary = atob(padded); } catch { throw new Error("The saved board payload is invalid."); }
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  function checksum(value) {
    let hash = 0x811c9dc5;
    for (const byte of new TextEncoder().encode(value)) {
      hash ^= byte;
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36).padStart(7, "0");
  }
  function bitsRequired(maximum) { return Math.max(1, Math.ceil(Math.log2(maximum + 1))); }
  function chunk(values, size) {
    return Array.from({ length: size }, (_, index) => values.slice(index * size, (index + 1) * size));
  }
  function parseInteger(value, radix) {
    if (!/^[0-9a-z]+$/i.test(value)) throw new Error("The saved board header is invalid.");
    const result = Number.parseInt(value, radix);
    if (!Number.isSafeInteger(result)) throw new Error("The saved board header is invalid.");
    return result;
  }

  global.StarsRemixSerializationFormats = {
    ...global.StarsRemixSerializationFormats,
    SR2: { encode, decode },
  };
})(globalThis);
