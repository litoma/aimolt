const https = require('https');
const fs = require('fs');
const path = require('path');

async function downloadTestFile() {
  const url = 'https://cdn.discordapp.com/attachments/1385044128198430742/1387783537209643079/voice-message.ogg?ex=685e99a3&is=685d4823&hm=50b02ec454b94c8d73f5a1b494ad5643471eb832a4a75a541a0f535d27b33c57&';
  const filePath = path.join(__dirname, 'temp', 'test-voice-message.ogg');
  const tempDir = path.dirname(filePath);

  console.log(`[${new Date().toISOString()}] テスト開始`);

  // ディレクトリ作成
  try {
    await fs.promises.mkdir(tempDir, { recursive: true });
    console.log(`[${new Date().toISOString()}] ディレクトリ確認: ${tempDir}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ディレクトリ作成エラー: ${error.message}`);
    throw error;
  }

  // ダウンロード
  console.log(`[${new Date().toISOString()}] ダウンロード開始: ${url} -> ${filePath}`);
  try {
    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(filePath);
      const request = https.get(url, { timeout: 30000 }, (response) => {
        console.log(`[${new Date().toISOString()}] レスポンス受信: ステータス ${response.statusCode}`);
        if (response.statusCode !== 200) {
          fileStream.close();
          return reject(new Error(`HTTPステータスエラー: ${response.statusCode}`));
        }
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`[${new Date().toISOString()}] ファイル書き込み完了: ${filePath}`);
          resolve();
        });
        fileStream.on('error', (err) => {
          fileStream.close();
          console.error(`[${new Date().toISOString()}] ファイル書き込みエラー: ${err.message}`);
          reject(err);
        });
      });
      request.on('error', (err) => {
        fileStream.close();
        console.error(`[${new Date().toISOString()}] リクエストエラー: ${err.message}`);
        reject(err);
      });
      request.on('timeout', () => {
        request.destroy();
        fileStream.close();
        console.error(`[${new Date().toISOString()}] リクエストタイムアウト`);
        reject(new Error('リクエストタイムアウト'));
      });
    });

    // ファイル存在確認
    const stats = await fs.promises.stat(filePath);
    console.log(`[${new Date().toISOString()}] ファイル存在確認: ${filePath} (サイズ: ${stats.size} bytes)`);
    console.log(`[${new Date().toISOString()}] テスト完了: ダウンロード成功`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] テスト失敗: ${error.message}`);
    throw error;
  }
}

downloadTestFile().catch(err => {
  console.error(`[${new Date().toISOString()}] エラー: ${err.message}`);
  process.exit(1);
});
