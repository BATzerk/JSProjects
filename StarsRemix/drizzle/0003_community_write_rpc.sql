CREATE OR REPLACE FUNCTION starsremix_publish_community_board(
  candidate_id uuid,
  candidate_author_name text,
  candidate_title text,
  candidate_puzzle jsonb,
  candidate_solution jsonb,
  candidate_difficulty jsonb,
  candidate_fingerprint text
)
RETURNS SETOF community_boards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  authenticated_user text;
BEGIN
  authenticated_user := auth.user_id();
  IF authenticated_user IS NULL OR authenticated_user = '' THEN
    RAISE EXCEPTION 'Sign in with Google to publish a board.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  INSERT INTO public.community_boards (
    id,
    owner_id,
    author_name,
    title,
    puzzle,
    solution,
    difficulty,
    fingerprint
  )
  VALUES (
    candidate_id,
    authenticated_user,
    candidate_author_name,
    candidate_title,
    candidate_puzzle,
    candidate_solution,
    candidate_difficulty,
    candidate_fingerprint
  )
  RETURNING *;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION starsremix_delete_community_board(candidate_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  authenticated_user text;
BEGIN
  authenticated_user := auth.user_id();
  IF authenticated_user IS NULL OR authenticated_user = '' THEN
    RAISE EXCEPTION 'Sign in with Google to remove a board.' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.community_boards
  WHERE id = candidate_id
    AND owner_id = authenticated_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That board was not found or does not belong to you.' USING ERRCODE = 'P0002';
  END IF;
  RETURN true;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION starsremix_publish_community_board(
  uuid, text, text, jsonb, jsonb, jsonb, text
) FROM PUBLIC, anonymous, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION starsremix_delete_community_board(uuid)
  FROM PUBLIC, anonymous, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION starsremix_publish_community_board(
  uuid, text, text, jsonb, jsonb, jsonb, text
) TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION starsremix_delete_community_board(uuid)
  TO authenticated;
--> statement-breakpoint
REVOKE INSERT, DELETE ON TABLE community_boards FROM authenticated;
