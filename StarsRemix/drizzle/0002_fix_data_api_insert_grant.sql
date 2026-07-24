CREATE OR REPLACE FUNCTION starsremix_set_community_board_created_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS community_boards_set_created_at ON community_boards;
--> statement-breakpoint
CREATE TRIGGER community_boards_set_created_at
BEFORE INSERT ON community_boards
FOR EACH ROW
EXECUTE FUNCTION starsremix_set_community_board_created_at();
--> statement-breakpoint
GRANT INSERT ON TABLE community_boards TO authenticated;
