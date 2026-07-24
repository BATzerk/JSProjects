(() => {
// Neon Data API configuration.
//
// 1. Create a Neon project and provision an unauthenticated Data API.
// 2. Run neon/schema.sql in the Neon SQL Editor.
// 3. Paste the branch's Data API and Auth URLs below.
//
// These service URLs are safe to ship in client code. Auth issues short-lived
// anonymous tokens; neon/schema.sql limits those visitors to reading and
// creating puzzles.

const NEON_DATA_API_URL =
  'https://ep-lucky-cloud-ayarsnpt.apirest.c-5.us-east-2.aws.neon.tech/neondb/rest/v1';
const NEON_AUTH_URL =
  'https://ep-lucky-cloud-ayarsnpt.neonauth.c-5.us-east-2.aws.neon.tech/neondb/auth';

window.CollectionsConfig = {
  NEON_DATA_API_URL,
  NEON_AUTH_URL,
};
})();
