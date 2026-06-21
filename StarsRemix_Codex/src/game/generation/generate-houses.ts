import { orthogonalNeighbors } from "../puzzle.ts";
import type { Position } from "../types.ts";
import { pick, shuffle } from "./random.ts";
import type { RandomSource } from "./types.ts";

export function generateHouses(
  size: number,
  solution: Position[],
  random: RandomSource,
  maxAttempts = 100,
  starsPerHouse = 2,
): number[][] | null {
  if (starsPerHouse < 1 || starsPerHouse > 2 || solution.length % starsPerHouse !== 0) return null;
  const starKeys = new Set(solution.map(positionKey));

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const houses = Array.from({ length: size }, () => Array<number>(size).fill(-1));
    const shuffledStars = shuffle(solution, random);
    let failed = false;

    for (let house = 0; house < shuffledStars.length / starsPerHouse; house += 1) {
      const start = shuffledStars[house * starsPerHouse];
      if (starsPerHouse === 1) {
        houses[start.row][start.col] = house;
        continue;
      }
      const target = shuffledStars[house * starsPerHouse + 1];
      const path = findRandomPath(start, target, size, houses, starKeys, random);
      if (!path) {
        failed = true;
        break;
      }
      path.forEach(({ row, col }) => houses[row][col] = house);
    }
    if (failed) continue;

    fillUnassignedCells(houses, random);
    return houses;
  }
  return null;
}

function findRandomPath(
  start: Position,
  target: Position,
  size: number,
  houses: number[][],
  starKeys: Set<string>,
  random: RandomSource,
): Position[] | null {
  const targetKey = positionKey(target);
  const queue = [start];
  const previous = new Map<string, Position | null>([[positionKey(start), null]]);

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (positionKey(current) === targetKey) break;
    for (const next of shuffle(orthogonalNeighbors(current, size), random)) {
      const key = positionKey(next);
      if (previous.has(key)) continue;
      if (houses[next.row][next.col] !== -1) continue;
      if (starKeys.has(key) && key !== targetKey) continue;
      previous.set(key, current);
      queue.push(next);
    }
  }
  if (!previous.has(targetKey)) return null;

  const path: Position[] = [];
  let current: Position | null = target;
  while (current) {
    path.push(current);
    current = previous.get(positionKey(current)) ?? null;
  }
  return path;
}

function fillUnassignedCells(houses: number[][], random: RandomSource): void {
  const size = houses.length;
  let remaining = houses.flat().filter((house) => house === -1).length;
  while (remaining > 0) {
    const frontier: Position[] = [];
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        if (houses[row][col] !== -1) continue;
        if (orthogonalNeighbors({ row, col }, size).some((cell) => houses[cell.row][cell.col] !== -1)) {
          frontier.push({ row, col });
        }
      }
    }
    if (frontier.length === 0) throw new Error("House growth reached an impossible state.");
    const cell = pick(frontier, random);
    const neighboringHouses = orthogonalNeighbors(cell, size)
      .map(({ row, col }) => houses[row][col])
      .filter((house) => house !== -1);
    houses[cell.row][cell.col] = pick(neighboringHouses, random);
    remaining -= 1;
  }
}

function positionKey(position: Position): string {
  return `${position.row}:${position.col}`;
}
