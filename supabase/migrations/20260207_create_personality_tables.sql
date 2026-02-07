-- Create emotions table
CREATE TABLE IF NOT EXISTS emotions (
  user_id TEXT PRIMARY KEY,
  valence FLOAT NOT NULL DEFAULT 50,
  arousal FLOAT NOT NULL DEFAULT 50,
  dominance FLOAT NOT NULL DEFAULT 50,
  energy_level FLOAT NOT NULL DEFAULT 50,
  interest_level FLOAT NOT NULL DEFAULT 50,
  intimacy_level FLOAT NOT NULL DEFAULT 0,
  mood_type TEXT NOT NULL DEFAULT 'neutral',
  conversation_count INT NOT NULL DEFAULT 0,
  last_interaction TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create relationships table
CREATE TABLE IF NOT EXISTS relationships (
  user_id TEXT PRIMARY KEY,
  affection_level FLOAT NOT NULL DEFAULT 30,
  trust_level FLOAT NOT NULL DEFAULT 20,
  comfort_level FLOAT NOT NULL DEFAULT 20,
  last_interaction TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  relationship_stage TEXT NOT NULL DEFAULT 'stranger', // 'stranger' | 'acquaintance' | 'friend' | 'close_friend'
  known_interests TEXT[] DEFAULT '{}',
  preferred_formality TEXT NOT NULL DEFAULT 'formal', // 'formal' | 'casual' | 'intimate'
  conversation_count INT NOT NULL DEFAULT 0,
  meaningful_interactions INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
