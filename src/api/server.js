import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractArticles } from '../core/extractor.js';
import { buildRssXml } from '../core/rss-builder.js';

const app = express();
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// プロジェクトのルートディレクトリ (src/api から見た ../../)
const projectRoot = path.resolve(__dirname, '..', '..');

// Helper function to create a domain name for file storage
const getDomainNameForFile = (url) => {
  try {
    const hostname = new URL(url).hostname;
    let parts = hostname.split('.');

    if (parts.length > 1 && parts[0].toLowerCase() === 'www') {
      parts = parts.slice(1);
    }
    
    const isTwoPartTld = parts.length > 2 && /^(co|ne|or|go|ac|ad|edu|gov|mil)$/.test(parts[parts.length - 2]);

    let domainParts;
    if (isTwoPartTld) {
        domainParts = parts.slice(0, -2);
    } else {
        domainParts = parts.slice(0, -1);
    }
    
    return domainParts.join('-');
  } catch (e) {
    return 'default';
  }
};

// Middleware
app.use(express.json());
app.use(express.static(path.join(projectRoot, 'public')));
app.use('/docs', express.static(path.join(projectRoot, 'docs')));

// API to get sample articles
app.post('/api/sample', async (req, res) => {
  const { url, selectors } = req.body;
  if (!url || !selectors) {
    return res.status(400).json({ message: 'URL and selectors are required.' });
  }

  try {
    const { articles } = await extractArticles(url, selectors, 10);
    res.json({ samples: articles });
  } catch (error) {
    console.error('Sample extraction error:', error);
    res.status(500).json({ message: 'Failed to extract sample articles.', error: error.message });
  }
});

// API to generate RSS feed and save configuration
app.post('/api/generate', async (req, res) => {
  const { url, selectors } = req.body;
  if (!url || !selectors) {
    return res.status(400).json({ message: 'URL and selectors are required.' });
  }

  try {
    const domain = getDomainNameForFile(url);
    
    // まずは最大100件まで探して、現在のサイトの規模を確認する
    const { articles, pageTitle } = await extractArticles(url, selectors, 100);

    // 取得件数の自動計算: 見つかった件数 + 15 (最大100)
    const calculatedMaxItems = Math.min(articles.length + 15, 100);

    // Generate XML using shared builder
    const xml = buildRssXml(domain, url, pageTitle, articles);

    // Save files
    const docsDir = path.join(projectRoot, 'docs');
    const configsDir = path.join(projectRoot, 'configs');
    await fs.mkdir(docsDir, { recursive: true });
    await fs.mkdir(configsDir, { recursive: true });

    const feedPath = path.join(docsDir, `${domain}.xml`);
    const configPath = path.join(configsDir, `${domain}.json`);

    await fs.writeFile(feedPath, xml, 'utf8');

    const configData = {
      url,
      domain,
      selectors,
      maxItems: calculatedMaxItems // 自動計算された件数を保存
    };
    await fs.writeFile(configPath, JSON.stringify(configData, null, 2), 'utf8');

    res.json({
      message: `Docs generated successfully.`,
      feedPath: `/docs/${domain}.xml`
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ message: 'Failed to generate docs.', error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
