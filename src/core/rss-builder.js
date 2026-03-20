import { create } from 'xmlbuilder2';

/**
 * 抽出した記事データからRSS 2.0形式のXML文字列を生成する
 * @param {string} domain - ドメイン名 (ページタイトルがない場合のフォールバックに使用)
 * @param {string} url - 元ページのURL
 * @param {string} pageTitle - ページのタイトル
 * @param {Array} articles - 記事オブジェクトの配列
 * @returns {string} - 生成されたXML文字列
 */
export function buildRssXml(domain, url, pageTitle, articles) {
  const channelTitle = pageTitle || `${domain} Docs`;
  const feed = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('rss', { version: '2.0' })
    .ele('channel')
      .ele('title').txt(channelTitle).up()
      .ele('link').txt(url).up()
      .ele('description').txt('Latest articles').up();

  for (const article of articles) {
    const item = feed.ele('item');
    item.ele('title').txt(article.title).up();
    
    const itemLink = article.link || url;
    item.ele('link').txt(itemLink).up();
    
    if (article.date) {
      const pubDate = new Date(article.date);
      if (!isNaN(pubDate)) {
        item.ele('pubDate').txt(pubDate.toUTCString()).up();
      }
    }
    
    if (article.summary) {
      item.ele('description').txt(article.summary).up();
    }
  }

  return feed.end({ prettyPrint: true });
}
