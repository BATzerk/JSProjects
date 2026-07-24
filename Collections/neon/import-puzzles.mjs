import { readFile } from 'node:fs/promises';

const dataApiUrl = String(process.argv[2] || '').replace(/\/+$/, '');
const authUrl = String(process.argv[3] || '').replace(/\/+$/, '');
const exportPath = new URL('../supabase/puzzles-export.json', import.meta.url);

if (!/^https:\/\//.test(dataApiUrl) || !/^https:\/\//.test(authUrl)) {
  console.error('Usage: node neon/import-puzzles.mjs <NEON_DATA_API_URL> <NEON_AUTH_URL>');
  process.exitCode = 1;
} else {
  const puzzles = JSON.parse(await readFile(exportPath, 'utf8'));
  const tokenResponse = await fetch(`${authUrl}/token/anonymous`);
  if (!tokenResponse.ok) {
    throw new Error(`Anonymous token request failed (HTTP ${tokenResponse.status}).`);
  }
  const { token } = await tokenResponse.json();
  if (!token) throw new Error('Neon did not return an anonymous access token.');

  const response = await fetch(`${dataApiUrl}/puzzles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(puzzles),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Puzzle import failed (HTTP ${response.status}): ${details}`);
  }

  console.log(`Imported ${puzzles.length} puzzles (existing IDs were left unchanged).`);
}
