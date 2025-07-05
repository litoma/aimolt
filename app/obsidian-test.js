const axios = require('axios');

// 設定（実際の値に置き換えてください）
const OBSIDIAN_URL = 'http://zmshabin:27123';  // TailscaleのIP
const API_KEY = '1a0c4a2add3af1081e2e1f110bcb0ddcefed1dd02638e65bc8d55cd2f7b93612';

// HTTPクライアント設定
const apiClient = axios.create({
    baseURL: OBSIDIAN_URL,
    headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
    },
    timeout: 10000 // 10秒タイムアウト
});

// テスト関数
async function testObsidianConnection() {
    console.log('🔍 Obsidian REST API接続テストを開始します...');
    console.log(`📍 接続先: ${OBSIDIAN_URL}`);
    console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...`);
    console.log('=' * 50);

    let testsPassed = 0;
    let totalTests = 0;

    // テスト1: 基本接続確認
    console.log('\n📋 テスト1: 基本接続確認');
    totalTests++;
    try {
        const response = await apiClient.get('/vault/');
        console.log('✅ 成功: 基本接続が確立されました');
        console.log(`📁 取得したファイル数: ${response.data.files ? response.data.files.length : 'N/A'}`);
        if (response.data.files && response.data.files.length > 0) {
            console.log(`📄 最初のファイル: ${response.data.files[0].path || response.data.files[0]}`);
        }
        testsPassed++;
    } catch (error) {
        console.log('❌ 失敗: 基本接続エラー');
        console.log(`💡 エラー内容: ${error.message}`);
        if (error.response) {
            console.log(`📊 ステータス: ${error.response.status}`);
            console.log(`📋 レスポンス: ${JSON.stringify(error.response.data, null, 2)}`);
        }
        if (error.code === 'ECONNREFUSED') {
            console.log('🔧 対処法: Obsidianでプラグインが起動しているか確認してください');
        }
    }

    // テスト2: 検索機能（修正済み）
    console.log('\n🔍 テスト2: 検索機能');
    totalTests++;
    try {
        const response = await apiClient.post('/search/simple/', null, {
            params: { query: 'test' }
        });
        console.log('✅ 成功: 検索機能が動作しています');
        console.log(`🔍 検索結果数: ${response.data.length}`);
        if (response.data.length > 0) {
            console.log(`📄 最初の検索結果: ${response.data[0].filename || response.data[0].path}`);
        }
        testsPassed++;
    } catch (error) {
        console.log('❌ 失敗: 検索機能エラー');
        console.log(`💡 エラー内容: ${error.message}`);
        if (error.response) {
            console.log(`📊 ステータス: ${error.response.status}`);
            console.log(`📋 レスポンス: ${JSON.stringify(error.response.data, null, 2)}`);
        }
    }

    // テスト3: ファイル作成
    console.log('\n📝 テスト3: ファイル作成');
    totalTests++;
    const testFilename = 'connection-test.md';
    const testContent = `# 接続テスト

このファイルは Obsidian REST API の接続テストで作成されました。

- 作成日時: ${new Date().toISOString()}
- テスト成功: ✅

## 削除について
このファイルは自動的に削除されます。`;

    try {
        const response = await apiClient.put(`/vault/${encodeURIComponent(testFilename)}`, {
            content: testContent
        });
        console.log('✅ 成功: ファイルが作成されました');
        console.log(`📄 ファイル名: ${testFilename}`);
        testsPassed++;
    } catch (error) {
        console.log('❌ 失敗: ファイル作成エラー');
        console.log(`💡 エラー内容: ${error.message}`);
        if (error.response) {
            console.log(`📊 ステータス: ${error.response.status}`);
            console.log(`📋 レスポンス: ${JSON.stringify(error.response.data, null, 2)}`);
        }
    }

    // テスト4: ファイル取得
    console.log('\n📖 テスト4: ファイル取得');
    totalTests++;
    try {
        const response = await apiClient.get(`/vault/${encodeURIComponent(testFilename)}`);
        console.log('✅ 成功: ファイルが取得されました');
        console.log(`📄 内容の一部: ${response.data.content.substring(0, 50)}...`);
        testsPassed++;
    } catch (error) {
        console.log('❌ 失敗: ファイル取得エラー');
        console.log(`💡 エラー内容: ${error.message}`);
        if (error.response) {
            console.log(`📊 ステータス: ${error.response.status}`);
        }
    }

    // テスト5: ファイル削除（クリーンアップ）
    console.log('\n🗑️ テスト5: ファイル削除');
    totalTests++;
    try {
        await apiClient.delete(`/vault/${encodeURIComponent(testFilename)}`);
        console.log('✅ 成功: テストファイルが削除されました');
        testsPassed++;
    } catch (error) {
        console.log('❌ 失敗: ファイル削除エラー');
        console.log(`💡 エラー内容: ${error.message}`);
        if (error.response) {
            console.log(`📊 ステータス: ${error.response.status}`);
        }
    }

    // 結果サマリー
    console.log('\n' + '=' * 50);
    console.log('📊 テスト結果サマリー');
    console.log(`✅ 成功: ${testsPassed}/${totalTests} テスト`);
    console.log(`❌ 失敗: ${totalTests - testsPassed}/${totalTests} テスト`);

    if (testsPassed === totalTests) {
        console.log('🎉 全てのテストが成功しました！ObsidianのREST APIは正常に動作しています。');
    } else {
        console.log('⚠️  一部のテストが失敗しました。設定を確認してください。');
    }

    return testsPassed === totalTests;
}

// 接続診断関数
async function diagnoseConnection() {
    console.log('\n🔧 接続診断を実行中...');

    // 1. ネットワーク接続確認
    console.log('🌐 ネットワーク接続確認');
    try {
        const response = await axios.get(OBSIDIAN_URL, { timeout: 5000 });
        console.log('✅ HTTPサーバーに接続可能');
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ サーバーが起動していません');
            console.log('💡 Obsidianでプラグインが有効になっているか確認してください');
        } else if (error.code === 'ENOTFOUND') {
            console.log('❌ ホストが見つかりません');
            console.log('💡 TailscaleのIPアドレスが正しいか確認してください');
        } else {
            console.log(`❌ 接続エラー: ${error.message}`);
        }
    }

    // 2. 認証確認
    console.log('🔐 認証確認');
    try {
        const response = await apiClient.get('/vault');
        console.log('✅ 認証成功');
    } catch (error) {
        if (error.response && error.response.status === 401) {
            console.log('❌ 認証失敗');
            console.log('💡 API Keyが正しく設定されているか確認してください');
        } else if (error.response && error.response.status === 403) {
            console.log('❌ アクセス拒否');
            console.log('💡 APIキーの権限を確認してください');
        }
    }
}

// メイン実行
async function main() {
    console.log('🚀 Obsidian REST API 接続テストツール');
    console.log('=' * 50);

    try {
        // 診断実行
        await diagnoseConnection();

        // テスト実行
        const success = await testObsidianConnection();

        console.log('\n🏁 テスト完了');
        process.exit(success ? 0 : 1);
    } catch (error) {
        console.error('💥 予期しないエラーが発生しました:', error);
        process.exit(1);
    }
}

// 実行
if (require.main === module) {
    main();
}

module.exports = { testObsidianConnection, diagnoseConnection };
