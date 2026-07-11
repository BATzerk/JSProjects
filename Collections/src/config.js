(() => {
// Supabase project credentials.
//
// 1. Create a project at https://supabase.com
// 2. Run supabase/schema.sql in the SQL Editor
// 3. Paste your values below (Project Settings -> API)
//
// The publishable/anon key is safe to ship in client code; row-level security in
// schema.sql controls what it can do.

const SUPABASE_URL = 'https://pzzsokvuimiobltloxvq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sfhIcoqWffiFxemznhP-Pw_uWQF8cCr';

window.CollectionsConfig = {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
};
})();
