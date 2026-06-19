-- Run this once in the Supabase SQL Editor.
-- It makes users.user_id auto-generate as HB-001, HB-002, HB-003, ...
-- Existing HB IDs are detected so the next generated value continues correctly.
-- It also forces clean IDs even if an old browser build sends a junk user_id.

CREATE SEQUENCE IF NOT EXISTS public.users_hb_id_seq;

SELECT setval(
  'public.users_hb_id_seq',
  COALESCE(
    (
      SELECT MAX(SUBSTRING(user_id FROM '^HB-([0-9]+)')::BIGINT)
      FROM public.users
      WHERE user_id ~ '^HB-[0-9]+'
    ),
    1
  ),
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE user_id ~ '^HB-[0-9]+'
  )
);

CREATE OR REPLACE FUNCTION public.next_hb_user_id()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_num BIGINT;
BEGIN
  next_num := nextval('public.users_hb_id_seq');

  RETURN 'HB-' ||
    CASE
      WHEN next_num < 1000 THEN LPAD(next_num::TEXT, 3, '0')
      ELSE next_num::TEXT
    END;
END;
$$;

-- Use the trigger below as the single source of truth. Dropping any old default
-- also removes bad defaults that may have generated IDs like HB-001-xxxx.
ALTER TABLE public.users
  ALTER COLUMN user_id DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.force_clean_hb_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.user_id := public.next_hb_user_id();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS force_clean_hb_user_id_before_insert ON public.users;

CREATE TRIGGER force_clean_hb_user_id_before_insert
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.force_clean_hb_user_id();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_user_id_hb_format'
      AND conrelid = 'public.users'::REGCLASS
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_user_id_hb_format
      CHECK (user_id ~ '^HB-[0-9]+$')
      NOT VALID;
  END IF;
END;
$$;

GRANT USAGE, SELECT ON SEQUENCE public.users_hb_id_seq TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_hb_user_id() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.force_clean_hb_user_id() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_user_with_hb_id(
  p_username TEXT,
  p_pin_hash TEXT,
  p_recovery_key_hash TEXT DEFAULT NULL,
  p_role TEXT DEFAULT 'primary',
  p_created_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  user_id TEXT,
  username TEXT,
  pin_hash TEXT,
  recovery_key_hash TEXT,
  role TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.users AS created_user (
    username,
    pin_hash,
    recovery_key_hash,
    role,
    created_at
  )
  VALUES (
    p_username,
    p_pin_hash,
    p_recovery_key_hash,
    p_role,
    p_created_at
  )
  RETURNING
    created_user.user_id,
    created_user.username,
    created_user.pin_hash,
    created_user.recovery_key_hash,
    created_user.role,
    created_user.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_user_with_hb_id(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_for_cloud_login(p_user_id TEXT)
RETURNS TABLE (
  user_id TEXT,
  username TEXT,
  pin_hash TEXT,
  recovery_key_hash TEXT,
  role TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    users.user_id,
    users.username,
    users.pin_hash,
    users.recovery_key_hash,
    users.role,
    users.created_at
  FROM public.users
  WHERE users.user_id = p_user_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_for_cloud_login(TEXT) TO anon, authenticated;
