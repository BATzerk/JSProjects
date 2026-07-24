CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION starsremix_valid_puzzle_shape(candidate jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  board_size integer;
  house_row jsonb;
  house_cell jsonb;
  seen_houses boolean[];
  house_id integer;
BEGIN
  IF jsonb_typeof(candidate) <> 'object'
    OR NOT (candidate ?& ARRAY['id', 'title', 'size', 'starsPerUnit', 'houses'])
    OR jsonb_typeof(candidate->'id') <> 'string'
    OR jsonb_typeof(candidate->'title') <> 'string'
    OR jsonb_typeof(candidate->'size') <> 'number'
    OR jsonb_typeof(candidate->'starsPerUnit') <> 'number'
    OR jsonb_typeof(candidate->'houses') <> 'array'
    OR NOT ((candidate->>'size') ~ '^[0-9]+$')
    OR NOT ((candidate->>'starsPerUnit') ~ '^[0-9]+$')
  THEN
    RETURN false;
  END IF;

  board_size := (candidate->>'size')::integer;
  IF board_size NOT IN (9, 10, 11)
    OR (candidate->>'starsPerUnit')::integer <> 2
    OR length(candidate->>'title') NOT BETWEEN 1 AND 80
    OR jsonb_array_length(candidate->'houses') <> board_size
  THEN
    RETURN false;
  END IF;

  seen_houses := array_fill(false, ARRAY[board_size]);
  FOR house_row IN SELECT value FROM jsonb_array_elements(candidate->'houses')
  LOOP
    IF jsonb_typeof(house_row) <> 'array' OR jsonb_array_length(house_row) <> board_size THEN
      RETURN false;
    END IF;
    FOR house_cell IN SELECT value FROM jsonb_array_elements(house_row)
    LOOP
      IF jsonb_typeof(house_cell) <> 'number' OR NOT (house_cell::text ~ '^[0-9]+$') THEN
        RETURN false;
      END IF;
      house_id := house_cell::text::integer;
      IF house_id < 0 OR house_id >= board_size THEN
        RETURN false;
      END IF;
      seen_houses[house_id + 1] := true;
    END LOOP;
  END LOOP;

  RETURN NOT (false = ANY(seen_houses));
EXCEPTION
  WHEN others THEN RETURN false;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION starsremix_valid_solution(candidate_puzzle jsonb, candidate_solution jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  board_size integer;
  star jsonb;
  star_row integer;
  star_col integer;
  house_id integer;
  star_key text;
  seen_stars text[] := ARRAY[]::text[];
  row_counts integer[];
  column_counts integer[];
  house_counts integer[];
  existing_key text;
  existing_row integer;
  existing_col integer;
BEGIN
  IF NOT starsremix_valid_puzzle_shape(candidate_puzzle)
    OR jsonb_typeof(candidate_solution) <> 'array'
  THEN
    RETURN false;
  END IF;

  board_size := (candidate_puzzle->>'size')::integer;
  IF jsonb_array_length(candidate_solution) <> board_size * 2 THEN
    RETURN false;
  END IF;
  row_counts := array_fill(0, ARRAY[board_size]);
  column_counts := array_fill(0, ARRAY[board_size]);
  house_counts := array_fill(0, ARRAY[board_size]);

  FOR star IN SELECT value FROM jsonb_array_elements(candidate_solution)
  LOOP
    IF jsonb_typeof(star) <> 'object'
      OR jsonb_typeof(star->'row') <> 'number'
      OR jsonb_typeof(star->'col') <> 'number'
      OR NOT ((star->>'row') ~ '^[0-9]+$')
      OR NOT ((star->>'col') ~ '^[0-9]+$')
    THEN
      RETURN false;
    END IF;
    star_row := (star->>'row')::integer;
    star_col := (star->>'col')::integer;
    IF star_row < 0 OR star_col < 0 OR star_row >= board_size OR star_col >= board_size THEN
      RETURN false;
    END IF;

    star_key := star_row::text || ':' || star_col::text;
    IF star_key = ANY(seen_stars) THEN RETURN false; END IF;
    FOREACH existing_key IN ARRAY seen_stars
    LOOP
      existing_row := split_part(existing_key, ':', 1)::integer;
      existing_col := split_part(existing_key, ':', 2)::integer;
      IF abs(existing_row - star_row) <= 1 AND abs(existing_col - star_col) <= 1 THEN
        RETURN false;
      END IF;
    END LOOP;
    seen_stars := array_append(seen_stars, star_key);

    house_id := (candidate_puzzle->'houses'->star_row->>star_col)::integer;
    row_counts[star_row + 1] := row_counts[star_row + 1] + 1;
    column_counts[star_col + 1] := column_counts[star_col + 1] + 1;
    house_counts[house_id + 1] := house_counts[house_id + 1] + 1;
  END LOOP;

  RETURN NOT EXISTS (
    SELECT 1
    FROM generate_series(1, board_size) AS index
    WHERE row_counts[index] <> 2
      OR column_counts[index] <> 2
      OR house_counts[index] <> 2
  );
EXCEPTION
  WHEN others THEN RETURN false;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION starsremix_prepare_community_board()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  authenticated_user text;
  normalized_title text;
  canonical_layout text;
BEGIN
  authenticated_user := auth.user_id();
  IF authenticated_user IS NULL OR authenticated_user = '' THEN
    RAISE EXCEPTION 'Sign in with Google to publish a board.' USING ERRCODE = '42501';
  END IF;

  IF (
    SELECT count(*)
    FROM community_boards
    WHERE owner_id = authenticated_user
  ) >= 25 THEN
    RAISE EXCEPTION 'Each player may publish up to 25 boards.' USING ERRCODE = 'P0001';
  END IF;

  normalized_title := btrim(NEW.puzzle->>'title');
  NEW.owner_id := authenticated_user;
  NEW.title := normalized_title;
  NEW.author_name := left(coalesce(nullif(btrim(NEW.author_name), ''), 'StarsRemix maker'), 80);
  NEW.puzzle := jsonb_set(NEW.puzzle, '{id}', to_jsonb('community-' || NEW.id::text), true);
  NEW.puzzle := jsonb_set(NEW.puzzle, '{title}', to_jsonb(normalized_title), true);
  canonical_layout := jsonb_build_object(
    'size', NEW.puzzle->'size',
    'starsPerUnit', NEW.puzzle->'starsPerUnit',
    'houses', NEW.puzzle->'houses'
  )::text;
  NEW.fingerprint := encode(digest(convert_to(canonical_layout, 'UTF8'), 'sha256'), 'hex');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
ALTER TABLE community_boards
  ALTER COLUMN owner_id SET DEFAULT auth.user_id(),
  ADD CONSTRAINT community_boards_title_nonblank
    CHECK (length(btrim(title)) BETWEEN 1 AND 80),
  ADD CONSTRAINT community_boards_puzzle_shape
    CHECK (octet_length(puzzle::text) <= 20000 AND starsremix_valid_puzzle_shape(puzzle)),
  ADD CONSTRAINT community_boards_solution_valid
    CHECK (octet_length(solution::text) <= 5000 AND starsremix_valid_solution(puzzle, solution)),
  ADD CONSTRAINT community_boards_difficulty_shape
    CHECK (
      octet_length(difficulty::text) <= 2000
      AND jsonb_typeof(difficulty) = 'object'
      AND difficulty->>'label' IN ('Easy', 'Moderate', 'Hard', 'Very Hard', 'Expert')
      AND jsonb_typeof(difficulty->'score') = 'number'
      AND jsonb_typeof(difficulty->'bigTicketCount') = 'number'
      AND jsonb_typeof(difficulty->'logicalSteps') = 'number'
    ),
  ADD CONSTRAINT community_boards_fingerprint_format
    CHECK (fingerprint ~ '^[0-9a-f]{64}$');
--> statement-breakpoint
DROP TRIGGER IF EXISTS community_boards_prepare_insert ON community_boards;
--> statement-breakpoint
CREATE TRIGGER community_boards_prepare_insert
BEFORE INSERT ON community_boards
FOR EACH ROW
EXECUTE FUNCTION starsremix_prepare_community_board();
--> statement-breakpoint
ALTER TABLE community_boards ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE community_boards FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON TABLE community_boards FROM anonymous;
--> statement-breakpoint
REVOKE ALL ON TABLE community_boards FROM authenticated;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO anonymous, authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE community_boards TO anonymous, authenticated;
--> statement-breakpoint
GRANT INSERT (id, author_name, title, puzzle, solution, difficulty, fingerprint)
  ON TABLE community_boards TO authenticated;
--> statement-breakpoint
GRANT DELETE ON TABLE community_boards TO authenticated;
--> statement-breakpoint
DROP POLICY IF EXISTS "Community boards are public" ON community_boards;
--> statement-breakpoint
DROP POLICY IF EXISTS "Signed-in players may publish boards" ON community_boards;
--> statement-breakpoint
DROP POLICY IF EXISTS "Players may delete their own boards" ON community_boards;
--> statement-breakpoint
CREATE POLICY "Community boards are public"
  ON community_boards
  FOR SELECT
  TO anonymous, authenticated
  USING (true);
--> statement-breakpoint
CREATE POLICY "Signed-in players may publish boards"
  ON community_boards
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.user_id());
--> statement-breakpoint
CREATE POLICY "Players may delete their own boards"
  ON community_boards
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.user_id());
