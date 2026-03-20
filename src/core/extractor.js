import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { URL } from 'url';

/**
 * 指定されたURLから記事データとページタイトルを抽出する
 * @param {string} url - 取得対象のURL
 * @param {object} selectors - CSSセレクタ
 * @param {string} selectors.article - 記事全体を囲む要素
 * @param {string} selectors.title - 記事タイトル
 * @param {string} selectors.link - 記事リンク
 * @param {string} selectors.date - 日付
 * @param {string} selectors.summary - 概要
 * @param {number} maxItems - 最大取得件数
 * @returns {Promise<{articles: Array<object>, pageTitle: string}>} - 抽出した記事オブジェクトの配列とページタイトル
 */
export async function extractArticles(url, selectors, maxItems) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

  try {
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSSFeedGenerator/1.0)'
      }
    });
    clearTimeout(timeoutId); // Request succeeded, clear the timeout

    if (!response.ok) {
      const error = new Error(`Failed to fetch ${url}: ${response.statusText}`);
      error.status = response.status; // HTTPステータスコードを保持
      throw error;
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const baseUrl = new URL(url);

    const pageTitle = $('title').text().trim();

    const articles = [];
    $(selectors.article).each((i, el) => {
      if (maxItems && articles.length >= maxItems) {
        return false; // ループを抜ける
      }

      const articleElement = $(el);
      const title = articleElement.find(selectors.title).text().trim();
      
      let link = articleElement.find(selectors.link).attr('href');
      if (link) {
        link = new URL(link, baseUrl).href;
      }

      const date = articleElement.find(selectors.date).text().trim();
      const summary = articleElement.find(selectors.summary).text().trim();

      if (title) {
        articles.push({ title, link, date, summary });
      }
    });

    return { articles, pageTitle };
  } catch (error) {
    // name (AbortError) や code (ECONNRESET等) を保持したまま投げる
    throw error;
  } finally {
    clearTimeout(timeoutId); // Ensure timeout is cleared in all cases
  }
}
