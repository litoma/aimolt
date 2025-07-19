-- Supabase同期用トリガーとファンクション
-- PostgreSQL LISTEN/NOTIFY機能を使用してSupabaseとの自動同期を実現

-- 同期通知ファンクション
CREATE OR REPLACE FUNCTION notify_supabase_sync()
RETURNS TRIGGER AS $$
DECLARE
    channel_name TEXT;
    payload TEXT;
    primary_key_value TEXT;
BEGIN
    -- テーブル名に基づいてチャンネル名を決定
    CASE TG_TABLE_NAME
        WHEN 'conversations' THEN
            channel_name := 'sync_conversations';
            IF TG_OP = 'DELETE' THEN
                primary_key_value := OLD.id::TEXT;
            ELSE
                primary_key_value := NEW.id::TEXT;
            END IF;
        WHEN 'emotion_states' THEN
            channel_name := 'sync_emotion_states';
            IF TG_OP = 'DELETE' THEN
                primary_key_value := OLD.user_id;
            ELSE
                primary_key_value := NEW.user_id;
            END IF;
        WHEN 'user_memories' THEN
            channel_name := 'sync_user_memories';
            IF TG_OP = 'DELETE' THEN
                primary_key_value := OLD.id::TEXT;
            ELSE
                primary_key_value := NEW.id::TEXT;
            END IF;
        WHEN 'conversation_analysis' THEN
            channel_name := 'sync_conversation_analysis';
            IF TG_OP = 'DELETE' THEN
                primary_key_value := OLD.id::TEXT;
            ELSE
                primary_key_value := NEW.id::TEXT;
            END IF;
        ELSE
            -- 未知のテーブルの場合は何もしない
            RETURN COALESCE(NEW, OLD);
    END CASE;

    -- ペイロード作成（operation:primary_key形式）
    payload := TG_OP || ':' || primary_key_value;
    
    -- 同期通知を送信
    PERFORM pg_notify(channel_name, payload);
    
    -- ログ出力（デバッグ用）
    RAISE NOTICE 'Supabase sync notification: % - %', channel_name, payload;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 既存のトリガーを削除（存在する場合）
DROP TRIGGER IF EXISTS supabase_sync_conversations ON conversations;
DROP TRIGGER IF EXISTS supabase_sync_emotion_states ON emotion_states;
DROP TRIGGER IF EXISTS supabase_sync_user_memories ON user_memories;
DROP TRIGGER IF EXISTS supabase_sync_conversation_analysis ON conversation_analysis;

-- conversations テーブル用トリガー
CREATE TRIGGER supabase_sync_conversations
    AFTER INSERT OR UPDATE OR DELETE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION notify_supabase_sync();

-- emotion_states テーブル用トリガー
CREATE TRIGGER supabase_sync_emotion_states
    AFTER INSERT OR UPDATE OR DELETE ON emotion_states
    FOR EACH ROW
    EXECUTE FUNCTION notify_supabase_sync();

-- user_memories テーブル用トリガー
CREATE TRIGGER supabase_sync_user_memories
    AFTER INSERT OR UPDATE OR DELETE ON user_memories
    FOR EACH ROW
    EXECUTE FUNCTION notify_supabase_sync();

-- conversation_analysis テーブル用トリガー
CREATE TRIGGER supabase_sync_conversation_analysis
    AFTER INSERT OR UPDATE OR DELETE ON conversation_analysis
    FOR EACH ROW
    EXECUTE FUNCTION notify_supabase_sync();

-- トリガー状態確認用ビュー
CREATE OR REPLACE VIEW supabase_sync_status AS
SELECT 
    schemaname,
    tablename,
    triggername,
    enabled
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE triggername LIKE 'supabase_sync_%'
ORDER BY tablename;

-- 統計情報確認用ファンクション
CREATE OR REPLACE FUNCTION get_supabase_sync_stats()
RETURNS TABLE (
    table_name TEXT,
    row_count BIGINT,
    last_modified TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'conversations'::TEXT,
        COUNT(*)::BIGINT,
        MAX(created_at)
    FROM conversations
    
    UNION ALL
    
    SELECT 
        'emotion_states'::TEXT,
        COUNT(*)::BIGINT,
        MAX(updated_at)
    FROM emotion_states
    
    UNION ALL
    
    SELECT 
        'user_memories'::TEXT,
        COUNT(*)::BIGINT,
        MAX(created_at)
    FROM user_memories
    
    UNION ALL
    
    SELECT 
        'conversation_analysis'::TEXT,
        COUNT(*)::BIGINT,
        MAX(analyzed_at)
    FROM conversation_analysis;
END;
$$ LANGUAGE plpgsql;

-- 手動同期トリガー用ファンクション
CREATE OR REPLACE FUNCTION trigger_manual_sync(table_name TEXT, primary_key_value TEXT)
RETURNS VOID AS $$
DECLARE
    channel_name TEXT;
    payload TEXT;
BEGIN
    -- テーブル名に基づいてチャンネル名を決定
    CASE table_name
        WHEN 'conversations' THEN
            channel_name := 'sync_conversations';
        WHEN 'emotion_states' THEN
            channel_name := 'sync_emotion_states';
        WHEN 'user_memories' THEN
            channel_name := 'sync_user_memories';
        WHEN 'conversation_analysis' THEN
            channel_name := 'sync_conversation_analysis';
        ELSE
            RAISE EXCEPTION 'Unknown table name: %', table_name;
    END CASE;

    -- ペイロード作成
    payload := 'UPDATE:' || primary_key_value;
    
    -- 同期通知を送信
    PERFORM pg_notify(channel_name, payload);
    
    RAISE NOTICE 'Manual sync triggered for % - %', channel_name, payload;
END;
$$ LANGUAGE plpgsql;

-- 使用例とコメント
/*
-- トリガー状態確認
SELECT * FROM supabase_sync_status;

-- 統計情報確認
SELECT * FROM get_supabase_sync_stats();

-- 手動同期トリガー例
SELECT trigger_manual_sync('conversations', '123');
SELECT trigger_manual_sync('emotion_states', 'user123');

-- トリガー無効化（メンテナンス時）
ALTER TABLE conversations DISABLE TRIGGER supabase_sync_conversations;

-- トリガー有効化
ALTER TABLE conversations ENABLE TRIGGER supabase_sync_conversations;

-- 全トリガー無効化
ALTER TABLE conversations DISABLE TRIGGER ALL;
ALTER TABLE emotion_states DISABLE TRIGGER ALL;
ALTER TABLE user_memories DISABLE TRIGGER ALL;
ALTER TABLE conversation_analysis DISABLE TRIGGER ALL;

-- 全トリガー有効化  
ALTER TABLE conversations ENABLE TRIGGER ALL;
ALTER TABLE emotion_states ENABLE TRIGGER ALL;
ALTER TABLE user_memories ENABLE TRIGGER ALL;
ALTER TABLE conversation_analysis ENABLE TRIGGER ALL;
*/