import axios from 'axios';
import express from 'express';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// No DDoS monkey
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit to 500 requests per window
});
app.use(limiter);

// CORS header
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );
  next();
});

const isAbsoluteURL = (url) => {
  return url.startsWith('http') || url.startsWith('//');
};

const createProxyUrl = (url, baseUrl) => {
  if (!url) return url;
  if (url.startsWith('/api/proxy.js')) return url;

  if (isAbsoluteURL(url)) {
    return `/api/proxy.js?q=${encodeURIComponent(url)}`;
  }

  if (baseUrl) {
    const base = new URL(baseUrl);
    const absoluteUrl = new URL(url, base).href;
    return `/api/proxy.js?q=${encodeURIComponent(absoluteUrl)}`;
  }

  return url;
};

app.get('/api/proxy.js', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter: q' });
  }

  try {
    // Updated User-Agent with Chrome 134.0.6998.44
    const response = await axios.get(q, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/134.0.6998.44',
        'Referer': q,
        'Accept': req.headers['accept'] || '*/*',
        'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
      }
    });

    let contentType = response.headers['content-type'] || '';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    if (contentType.includes('text/html')) {
      let htmlContent = response.data.toString('utf-8');

      htmlContent = htmlContent.replace(
        /(href|src|action)="([^"]*)"/g,
        (match, attr, url) => `${attr}="${createProxyUrl(url, q)}"`
      );

      htmlContent = htmlContent.replace(
        /url\((['"]?)([^'")\s]+)\1\)/g,
        (match, quote, url) => `url(${quote}${createProxyUrl(url, q)}${quote})`
      );

      htmlContent = htmlContent.replace(
        /<form([^>]*)action="([^"]*)"([^>]*)>/g,
        (match, before, url, after) =>
          `<form${before}action="${createProxyUrl(url, q)}"${after}>`
      );

      htmlContent = htmlContent.replace(
        /window\.location\.href\s*=\s*['"]([^'"]+)['"]/g,
        (match, url) => `window.location.href='${createProxyUrl(url, q)}'`
      );

      htmlContent = htmlContent.replace(
        /<script([^>]*)src="([^"]*)"([^>]*)>/gi,
        (match, before, url, after) =>
          `<script${before}src="${createProxyUrl(url, q)}"${after}>`
      );

      htmlContent = htmlContent.replace(
        /<iframe([^>]*)src="([^"]*)"([^>]*)>/gi,
        (match, before, url, after) =>
          `<iframe${before}src="${createProxyUrl(url, q)}"${after}>`
      );

      res.send(htmlContent);
    } else {
      // For raw data (non-HTML content)
      res.send(response.data);
    }
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({
      error: 'Error fetching resource',
      details: error.message
    });
  }
});

// Serve static files from 'public' directory
app.use(express.static('public'));

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
