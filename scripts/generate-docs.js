import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractArticles } from '../src/core/extractor.js';
import { buildRssXml } from '../src/core/rss-builder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const configsDir = path.join(projectRoot, 'configs');
const docsDir = path.join(projectRoot, 'docs');

/**
 * 指定されたミリ秒間待機するヘルパー関数
 * @param {number} ms - 待機するミリ秒数
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * エラーが再試行可能かどうかを判定する
 * @param {Error} error 
 */
function isRetryable(error) {
  // 1. タイムアウト (AbortError)
  if (error.name === 'AbortError') return true;
  // 2. HTTP 429 (Rate Limit) または 5xx (Server Error)
  if (error.status === 429 || (error.status >= 500 && error.status <= 599)) return true;
  // 3. ネットワークレベルのエラーコード
  const networkErrorCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENOTFOUND'];
  if (networkErrorCodes.includes(error.code)) return true;
  return false;
}

async function generateFeeds() {
  console.log('Starting docs generation…');
  const failedFiles = []; // 失敗したファイルを記録する配列

  try {
    await fs.mkdir(docsDir, { recursive: true });
    
    const configFiles = await fs.readdir(configsDir);
    const jsonFiles = configFiles.filter(file => file.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.log('No config files found in /configs directory.');
      return;
    }
    
    for (let i = 0; i < jsonFiles.length; i++) {
      const file = jsonFiles[i];
      try {
        // 2サイト目以降の処理の前にランダムな待機を入れる
        if (i > 0) {
          const delay = 500 + Math.random() * 500;
          console.log(`Rate limit delay: ${Math.floor(delay)}ms`);
          await sleep(delay);
        }

        const filePath = path.join(configsDir, file);
        console.log(`Processing ${file}...`);
        
        const fileContent = await fs.readFile(filePath, 'utf8');
        const config = JSON.parse(fileContent);
        
        const { url, domain, selectors, maxItems } = config;
        
        if (!url || !domain || !selectors || maxItems == null) {
          console.warn(`Skipping ${file} due to missing configuration.`);
          continue;
        }

        // 指数バックオフを用いた再試行ロジック (1s, 2s, 4s)
        let result;
        const maxRetries = 3;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            result = await extractArticles(url, selectors, maxItems);
            break; // 成功
          } catch (error) {
            if (attempt < maxRetries && isRetryable(error)) {
              const waitTime = Math.pow(2, attempt) * 1000;
              console.warn(`Attempt ${attempt + 1} failed for ${file}. Retrying in ${waitTime}ms... (${error.message || error.name})`);
              await sleep(waitTime);
              continue;
            }
            throw error; // 再試行不可、または回数上限
          }
        }

        const { articles, pageTitle } = result;

        // Generate XML using shared builder
        const xml = buildRssXml(domain, url, pageTitle, articles);
        
        const feedPath = path.join(docsDir, `${domain}.xml`);
        await fs.writeFile(feedPath, xml, 'utf8');
        console.log(`Successfully generated docs: ${feedPath}`);
      } catch (error) {
        // エラーオブジェクトをそのまま出力することでスタックトレースを表示
        console.error(`Error processing ${file}:`, error);
        failedFiles.push(file); // 失敗したファイル名を配列に追加
      }
    }

    if (failedFiles.length > 0) {
      console.warn('Docs generation completed with some errors in the following files:', failedFiles);
    } else {
      console.log('All docs generated successfully.');
    }
    
  } catch (error) {
    console.error('An unexpected fatal error occurred during docs generation:', error);
    process.exit(1);
  }
}

generateFeeds();
