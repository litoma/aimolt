-- Drop permissive RLS policies identified by security advisor
drop policy if exists "Allow anon select" on conversations;
drop policy if exists "Allow anon insert" on conversations;
drop policy if exists "Allow anon update" on conversations;

drop policy if exists "Allow anon insert" on emotions;
drop policy if exists "Allow anon update" on emotions;

drop policy if exists "Allow anon insert" on relationships;
drop policy if exists "Allow anon update" on relationships;

drop policy if exists "Allow anon insert" on transcripts;
drop policy if exists "Allow anon update" on transcripts;

drop policy if exists "Enable all access" on system;

-- Recreate functions with secure search_path
-- 1. match_transcripts
CREATE OR REPLACE FUNCTION public.match_transcripts(query_embedding vector, match_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 10, filter jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(id bigint, text text, similarity double precision)
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        t.id,
        t.text,
        1 - (t.embedding <=> query_embedding::halfvec(3072)) AS similarity
    FROM transcripts t
    WHERE 1 - (t.embedding <=> query_embedding::halfvec(3072)) > match_threshold
    ORDER BY t.embedding <=> query_embedding::halfvec(3072)
    LIMIT match_count;
END;
$function$;

-- 2. match_conversations
CREATE OR REPLACE FUNCTION public.match_conversations(query_embedding vector, match_threshold double precision DEFAULT 0.5, match_count integer DEFAULT 10, filter jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(id bigint, user_message text, bot_response text, similarity double precision)
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.user_message,
        c.bot_response,
        1 - (c.embedding <=> query_embedding::halfvec(3072)) AS similarity
    FROM conversations c
    WHERE 1 - (c.embedding <=> query_embedding::halfvec(3072)) > match_threshold
    ORDER BY c.embedding <=> query_embedding::halfvec(3072)
    LIMIT match_count;
END;
$function$;

-- 3. get_table_columns
CREATE OR REPLACE FUNCTION public.get_table_columns(t_name text)
 RETURNS TABLE(column_name text, data_type text, is_nullable text, column_default text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  select column_name, data_type, is_nullable, column_default
  from information_schema.columns
  where table_schema = 'public'
    and table_name = t_name
  order by ordinal_position;
$function$;

-- 4. get_all_tables
CREATE OR REPLACE FUNCTION public.get_all_tables()
 RETURNS TABLE(table_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path = public
AS $function$
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE';
$function$;
