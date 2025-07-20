const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

/**
 * Supabase疑似レプリケーションシステム
 * PostgreSQL LISTEN/NOTIFY機能を使用してSupabaseとの自動同期を実現
 */
class SupabaseSync {
  constructor() {
    this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    this.pgPool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '',
      database: process.env.POSTGRES_DB || 'aimolt',
    });
    
    this.isRunning = false;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1秒
    
    // 同期対象テーブル設定
    this.syncTables = {
      'conversations': {
        channel: 'sync_conversations',
        primaryKey: 'id',
        columns: ['id', 'user_id', 'user_message', 'bot_response', 'created_at']
      },
      'emotion_states': {
        channel: 'sync_emotion_states', 
        primaryKey: 'user_id',
        columns: ['user_id', 'energy_level', 'intimacy_level', 'interest_level', 'mood_type', 'conversation_count', 'last_interaction', 'created_at', 'updated_at', 'valence', 'arousal', 'dominance']
      },
      'user_memories': {
        channel: 'sync_user_memories',
        primaryKey: 'id', 
        columns: ['id', 'user_id', 'memory_type', 'content', 'keywords', 'importance_score', 'emotional_weight', 'access_count', 'created_at', 'last_accessed', 'expires_at']
      },
      'conversation_analysis': {
        channel: 'sync_conversation_analysis',
        primaryKey: 'id',
        columns: ['id', 'user_id', 'message_id', 'user_message', 'sentiment', 'emotion_detected', 'topic_category', 'keywords', 'importance_score', 'confidence_score', 'analyzed_at']
      },
      'user_relationships': {
        channel: 'sync_user_relationships',
        primaryKey: 'user_id',
        columns: ['user_id', 'affection_level', 'trust_level', 'respect_level', 'comfort_level', 'relationship_stage', 'conversation_count', 'meaningful_interactions', 'preferred_formality', 'communication_pace', 'humor_receptivity', 'known_interests', 'avoided_topics', 'positive_triggers', 'negative_triggers', 'first_interaction', 'last_interaction', 'last_mood_detected', 'created_at', 'updated_at']
      }
    };
    
    // 統計情報
    this.stats = {
      syncCount: 0,
      errorCount: 0,
      lastSync: null,
      startTime: null
    };
  }

  /**
   * 同期システムを開始
   */
  async start() {
    if (this.isRunning) {
      console.log('🔄 Supabase sync system is already running');
      return;
    }

    try {
      this.isRunning = true;
      this.stats.startTime = new Date();
      
      console.log('🚀 Starting Supabase sync system...');
      
      // PostgreSQL接続確認
      await this.testConnections();
      
      // LISTENチャンネルをセットアップ
      await this.setupListeners();
      
      console.log('✅ Supabase sync system started successfully');
      console.log(`📊 Monitoring ${Object.keys(this.syncTables).length} tables: ${Object.keys(this.syncTables).join(', ')}`);
      
    } catch (error) {
      this.isRunning = false;
      console.error('❌ Failed to start Supabase sync system:', error.message);
      throw error;
    }
  }

  /**
   * 同期システムを停止
   */
  async stop() {
    if (!this.isRunning) {
      console.log('⏹️ Supabase sync system is not running');
      return;
    }

    try {
      this.isRunning = false;
      
      // PostgreSQL接続をクリーンアップ
      if (this.listenClient) {
        await this.listenClient.end();
        this.listenClient = null;
      }
      
      console.log('⏹️ Supabase sync system stopped');
      this.logStats();
      
    } catch (error) {
      console.error('❌ Error stopping Supabase sync system:', error.message);
    }
  }

  /**
   * 接続テスト
   */
  async testConnections() {
    // PostgreSQL接続テスト
    try {
      const pgResult = await this.pgPool.query('SELECT NOW()');
      console.log('✅ PostgreSQL connection successful');
    } catch (error) {
      throw new Error(`PostgreSQL connection failed: ${error.message}`);
    }

    // Supabase接続テスト
    try {
      const { data, error } = await this.supabase.from('conversations').select('id').limit(1);
      if (error) throw error;
      console.log('✅ Supabase connection successful');
    } catch (error) {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
  }

  /**
   * LISTENチャンネルをセットアップ
   */
  async setupListeners() {
    // 専用のPostgreSQL接続を作成（LISTEN用）
    this.listenClient = new (require('pg').Client)({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || 5432,
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '',
      database: process.env.POSTGRES_DB || 'aimolt',
    });

    await this.listenClient.connect();

    // 各テーブルのチャンネルをLISTEN
    for (const [tableName, config] of Object.entries(this.syncTables)) {
      await this.listenClient.query(`LISTEN ${config.channel}`);
      console.log(`🔊 Listening to channel: ${config.channel} (table: ${tableName})`);
    }

    // NOTIFYイベントのハンドラーを設定
    this.listenClient.on('notification', async (msg) => {
      await this.handleNotification(msg);
    });

    // 接続エラーのハンドリング
    this.listenClient.on('error', (error) => {
      console.error('❌ PostgreSQL LISTEN client error:', error.message);
      this.stats.errorCount++;
    });
  }

  /**
   * NOTIFY通知を処理
   */
  async handleNotification(msg) {
    try {
      const { channel, payload } = msg;
      
      // チャンネルから対応するテーブルを特定
      const tableName = Object.keys(this.syncTables).find(
        table => this.syncTables[table].channel === channel
      );
      
      if (!tableName) {
        console.warn(`⚠️ Unknown sync channel: ${channel}`);
        return;
      }

      console.log(`📨 Sync notification received: ${tableName} (${payload})`);

      // ペイロードを解析（operation:primary_key形式）
      const [operation, primaryKeyValue] = payload.split(':');
      
      await this.syncRecord(tableName, operation, primaryKeyValue);
      
    } catch (error) {
      console.error('❌ Error handling notification:', error.message);
      this.stats.errorCount++;
    }
  }

  /**
   * 個別レコードを同期
   */
  async syncRecord(tableName, operation, primaryKeyValue) {
    const config = this.syncTables[tableName];
    const startTime = Date.now();
    
    try {
      switch (operation) {
        case 'INSERT':
        case 'UPDATE':
          await this.syncUpsert(tableName, config, primaryKeyValue);
          break;
        case 'DELETE':
          await this.syncDelete(tableName, config, primaryKeyValue);
          break;
        default:
          console.warn(`⚠️ Unknown operation: ${operation}`);
          return;
      }

      this.stats.syncCount++;
      this.stats.lastSync = new Date();
      
      const duration = Date.now() - startTime;
      console.log(`✅ Synced ${tableName} (${operation}:${primaryKeyValue}) in ${duration}ms`);
      
    } catch (error) {
      this.stats.errorCount++;
      console.error(`❌ Sync failed for ${tableName} (${operation}:${primaryKeyValue}):`, error.message);
      
      // リトライロジック
      await this.retrySync(tableName, operation, primaryKeyValue, 1);
    }
  }

  /**
   * UPSERT同期
   */
  async syncUpsert(tableName, config, primaryKeyValue) {
    // PostgreSQLからデータを取得
    const pgQuery = `
      SELECT ${config.columns.join(', ')} 
      FROM ${tableName} 
      WHERE ${config.primaryKey} = $1
    `;
    
    const pgResult = await this.pgPool.query(pgQuery, [primaryKeyValue]);
    
    if (pgResult.rows.length === 0) {
      console.warn(`⚠️ Record not found in PostgreSQL: ${tableName}:${primaryKeyValue}`);
      return;
    }

    const record = pgResult.rows[0];
    
    // キーワード配列の処理（PostgreSQL配列 → Supabase形式）
    if (record.keywords) {
      if (Array.isArray(record.keywords)) {
        // 既に配列の場合はそのまま
      } else if (typeof record.keywords === 'string') {
        try {
          // 文字列の場合はパース
          record.keywords = JSON.parse(record.keywords);
        } catch {
          // パースに失敗した場合は配列に変換
          record.keywords = [record.keywords];
        }
      }
    }

    // Supabaseに同期（UPSERT）
    const { data, error } = await this.supabase
      .from(tableName)
      .upsert(record, { 
        onConflict: config.primaryKey,
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('Supabase upsert error:', error.message || error.details || JSON.stringify(error));
      throw new Error(`Supabase upsert error: ${error.message || error.details || JSON.stringify(error)}`);
    }
  }

  /**
   * DELETE同期
   */
  async syncDelete(tableName, config, primaryKeyValue) {
    const { data, error } = await this.supabase
      .from(tableName)
      .delete()
      .eq(config.primaryKey, primaryKeyValue);

    if (error) {
      throw new Error(`Supabase delete error: ${error.message}`);
    }
  }

  /**
   * リトライロジック
   */
  async retrySync(tableName, operation, primaryKeyValue, attempt) {
    if (attempt > this.retryAttempts) {
      console.error(`❌ Max retry attempts reached for ${tableName} (${operation}:${primaryKeyValue})`);
      return;
    }

    console.log(`🔄 Retrying sync ${attempt}/${this.retryAttempts}: ${tableName} (${operation}:${primaryKeyValue})`);
    
    // 指数バックオフ
    const delay = this.retryDelay * Math.pow(2, attempt - 1);
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      await this.syncRecord(tableName, operation, primaryKeyValue);
    } catch (error) {
      await this.retrySync(tableName, operation, primaryKeyValue, attempt + 1);
    }
  }

  /**
   * 手動同期（初期同期用）
   */
  async manualSync(tableName = null, limit = 100) {
    const tables = tableName ? [tableName] : Object.keys(this.syncTables);
    
    console.log(`🔄 Starting manual sync for tables: ${tables.join(', ')}`);
    
    for (const table of tables) {
      await this.manualSyncTable(table, limit);
    }
    
    console.log('✅ Manual sync completed');
  }

  /**
   * テーブル単位の手動同期
   */
  async manualSyncTable(tableName, limit = 100) {
    const config = this.syncTables[tableName];
    
    console.log(`📊 Manual syncing ${tableName}...`);
    
    // PostgreSQLから全レコードを取得
    const pgQuery = `
      SELECT ${config.columns.join(', ')} 
      FROM ${tableName} 
      ORDER BY ${config.primaryKey} 
      LIMIT $1
    `;
    
    const pgResult = await this.pgPool.query(pgQuery, [limit]);
    
    console.log(`📝 Found ${pgResult.rows.length} records in ${tableName}`);
    
    // バッチでSupabaseに同期
    const batchSize = 50;
    for (let i = 0; i < pgResult.rows.length; i += batchSize) {
      const batch = pgResult.rows.slice(i, i + batchSize);
      
      // キーワード配列の処理
      const processedBatch = batch.map(record => {
        if (record.keywords) {
          if (Array.isArray(record.keywords)) {
            // 既に配列の場合はそのまま
          } else if (typeof record.keywords === 'string') {
            try {
              // 文字列の場合はパース
              record.keywords = JSON.parse(record.keywords);
            } catch {
              // パースに失敗した場合は配列に変換
              record.keywords = [record.keywords];
            }
          }
        }
        return record;
      });
      
      const { data, error } = await this.supabase
        .from(tableName)
        .upsert(processedBatch, { 
          onConflict: config.primaryKey,
          ignoreDuplicates: false 
        });
      
      if (error) {
        console.error(`❌ Batch sync error for ${tableName}:`, error.message);
      } else {
        console.log(`✅ Synced batch ${Math.floor(i/batchSize) + 1} for ${tableName} (${processedBatch.length} records)`);
      }
    }
  }

  /**
   * 統計情報を表示
   */
  logStats() {
    const uptime = this.stats.startTime ? Date.now() - this.stats.startTime.getTime() : 0;
    const uptimeMinutes = Math.floor(uptime / 60000);
    
    console.log('📊 Supabase Sync Statistics:');
    console.log(`   Uptime: ${uptimeMinutes} minutes`);
    console.log(`   Sync Count: ${this.stats.syncCount}`);
    console.log(`   Error Count: ${this.stats.errorCount}`);
    console.log(`   Success Rate: ${this.stats.syncCount > 0 ? Math.round((this.stats.syncCount / (this.stats.syncCount + this.stats.errorCount)) * 100) : 0}%`);
    console.log(`   Last Sync: ${this.stats.lastSync ? this.stats.lastSync.toISOString() : 'Never'}`);
  }

  /**
   * ヘルスチェック
   */
  getHealthStatus() {
    return {
      isRunning: this.isRunning,
      stats: this.stats,
      tables: Object.keys(this.syncTables),
      lastError: this.lastError || null
    };
  }
}

// シングルトンインスタンス
const supabaseSync = new SupabaseSync();

module.exports = {
  SupabaseSync,
  supabaseSync
};