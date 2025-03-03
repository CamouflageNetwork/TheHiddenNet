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

// Rate limiting to avoid DDoS attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit to 500 requests per window
});
app.use(limiter);

// CORS middleware
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

// Fetch the resource and handle redirects
const fetchResource = async (url) => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      maxRedirects: 5, // Handle up to 5 redirects
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/134.0.6998.44',
        'Referer': url,
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    return response;
  } catch (error) {
    console.error('Error fetching resource:', error.message);
    throw error;
  }
};

app.get('/api/proxy.js', async (req, res) => {
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Missing query parameter: q' });
  }

  try {
    // Fetch the requested page
    const response = await fetchResource(q);
    let contentType = response.headers['content-type'] || '';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    if (contentType.includes('text/html')) {
      let htmlContent = response.data.toString('utf-8');

      // Rewriting links in href, src, action, and form actions
      htmlContent = htmlContent.replace(
        /(href|src|action)="([^"]*)"/g,
        (match, attr, url) => `${attr}="${createProxyUrl(url, q)}"`
      );

      htmlContent = htmlContent.replace(
        /url\((['"]?)([^'")\s]+)\1\)/g,
        (match, quote, url) => `url(${quote}${createProxyUrl(url, q)}${quote})`
      );

      // Rewriting <form> action URLs
      htmlContent = htmlContent.replace(
        /<form([^>]*)action="([^"]*)"([^>]*)>/g,
        (match, before, url, after) =>
          `<form${before}action="${createProxyUrl(url, q)}"${after}>`
      );

      // Rewriting window.location.href in JS
      htmlContent = htmlContent.replace(
        /window\.location\.href\s*=\s*['"]([^'"]+)['"]/g,
        (match, url) => `window.location.href='${createProxyUrl(url, q)}'`
      );

      // Rewriting <script> src URLs
      htmlContent = htmlContent.replace(
        /<script([^>]*)src="([^"]*)"([^>]*)>/gi,
        (match, before, url, after) =>
          `<script${before}src="${createProxyUrl(url, q)}"${after}>`
      );

      // Rewriting <iframe> src URLs
      htmlContent = htmlContent.replace(
        /<iframe([^>]*)src="([^"]*)"([^>]*)>/gi,
        (match, before, url, after) =>
          `<iframe${before}src="${createProxyUrl(url, q)}"${after}>`
      );

      // Inject the Eruda debugging script at the end of the body
      htmlContent += `
        <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
        <script>eruda.init();</script>
      `;

      // Recursively find and proxy all resources like images, CSS, scripts, etc.
      const resourceRegex = /(href|src|action)="([^"]*)"/g;
      let match;
      while ((match = resourceRegex.exec(htmlContent)) !== null) {
        const url = match[2];
        if (!isAbsoluteURL(url) && !url.startsWith('/api/proxy.js')) {
          const proxifiedUrl = createProxyUrl(url, q);
          htmlContent = htmlContent.replace(url, proxifiedUrl);
        }
      }

      res.send(htmlContent);
    } else {
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

// Serve static files from the 'public' folder
app.use(express.static('public'));

// For all other routes, serve the index.html file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
