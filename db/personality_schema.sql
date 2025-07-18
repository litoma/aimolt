-- AImolt動的人格システム用データベーススキーマ
-- 実行前に既存のconversationsテーブルが存在することを確認してください

-- 感情状態管理テーブル
CREATE TABLE IF NOT EXISTS emotion_states (
    user_id VARCHAR(20) PRIMARY KEY,
    energy_level INTEGER DEFAULT 50 CHECK (energy_level >= 0 AND energy_level <= 100),      -- 元気度 (0-100)
    intimacy_level INTEGER DEFAULT 0 CHECK (intimacy_level >= 0 AND intimacy_level <= 100), -- 親密度 (0-100)
    interest_level INTEGER DEFAULT 50 CHECK (interest_level >= 0 AND interest_level <= 100), -- 興味度 (0-100)
    mood_type VARCHAR(20) DEFAULT 'neutral',                                                  -- happy/sad/excited/tired/neutral等
    conversation_count INTEGER DEFAULT 0,                                                     -- 会話回数
    last_interaction TIMESTAMP DEFAULT NOW(),                                                 -- 最後の相互作用
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 記憶システムテーブル
CREATE TABLE IF NOT EXISTS user_memories (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    memory_type VARCHAR(30) NOT NULL,                    -- 'important_event', 'preference', 'trait', 'fact'
    content TEXT NOT NULL,                               -- 記憶内容（要約）
    keywords TEXT[],                                     -- 検索用キーワード配列
    importance_score INTEGER DEFAULT 5 CHECK (importance_score >= 1 AND importance_score <= 10), -- 重要度 (1-10)
    emotional_weight INTEGER DEFAULT 0,                 -- 感情的重み (-10 to 10)
    access_count INTEGER DEFAULT 0,                     -- アクセス回数
    created_at TIMESTAMP DEFAULT NOW(),
    last_accessed TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NULL                           -- 期限切れ日時（NULLなら永続）
);

-- 会話分析結果テーブル
CREATE TABLE IF NOT EXISTS conversation_analysis (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    message_id VARCHAR(50),                             -- Discord message ID
    user_message TEXT NOT NULL,                         -- 分析対象メッセージ
    sentiment VARCHAR(20) DEFAULT 'neutral',            -- positive/negative/neutral
    emotion_detected VARCHAR(30),                       -- joy/anger/sadness/excitement/curiosity等
    topic_category VARCHAR(50),                         -- 話題カテゴリ
    keywords TEXT[],                                    -- 抽出キーワード
    importance_score INTEGER DEFAULT 1 CHECK (importance_score >= 1 AND importance_score <= 10),
    confidence_score DECIMAL(3,2) DEFAULT 0.50,        -- 分析の信頼度 (0.00-1.00)
    analyzed_at TIMESTAMP DEFAULT NOW()
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_emotion_states_user_id ON emotion_states(user_id);
CREATE INDEX IF NOT EXISTS idx_emotion_states_last_interaction ON emotion_states(last_interaction);

CREATE INDEX IF NOT EXISTS idx_user_memories_user_id ON user_memories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memories_type ON user_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memories_importance ON user_memories(importance_score);
CREATE INDEX IF NOT EXISTS idx_user_memories_keywords ON user_memories USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_user_memories_last_accessed ON user_memories(last_accessed);

CREATE INDEX IF NOT EXISTS idx_conversation_analysis_user_id ON conversation_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_analyzed_at ON conversation_analysis(analyzed_at);
CREATE INDEX IF NOT EXISTS idx_conversation_analysis_keywords ON conversation_analysis USING GIN(keywords);

-- 自動更新トリガー（updated_atの自動更新）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_emotion_states_updated_at BEFORE UPDATE
    ON emotion_states FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- サンプルデータ挿入（開発用）
-- INSERT INTO emotion_states (user_id, energy_level, intimacy_level, interest_level, mood_type) 
-- VALUES ('sample_user_123', 75, 25, 80, 'happy')
-- ON CONFLICT (user_id) DO NOTHING;