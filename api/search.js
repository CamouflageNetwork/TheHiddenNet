import axios from 'axios'; //adding this note for redeplopy fix
import { Transform } from 'stream'; //nah, glitch ur a retard bro - "redeplopy"
// NO IM NOT
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { q } = req.query;
  if (!q) {
    res.status(400).json({ error: 'Missing query parameter: q' });
    return;
  }

  try {
    const searxInstance = 'https://searx.be';
    const searchQuery = Array.isArray(q) ? q[0] : q;
    let searchUrl;
    try {
      const urlTest = new URL(searchQuery);
      searchUrl = searchQuery;
    } catch {
      searchUrl = `${searxInstance}/search`;
    }
    
    // Get the content type from the original URL before making the request
    let isAsset = false;
    try {
      const assetCheck = searchQuery.toLowerCase();
      isAsset = assetCheck.endsWith('.css') || assetCheck.endsWith('.js') || 
                assetCheck.endsWith('.jpg') || assetCheck.endsWith('.png') || 
                assetCheck.endsWith('.gif') || assetCheck.endsWith('.svg') ||
                assetCheck.endsWith('.woff') || assetCheck.endsWith('.woff2') ||
                assetCheck.endsWith('.ttf');
    } catch {}
    
    const response = await axios({
      method: 'GET',
      url: searchUrl,
      ...(searchUrl === `${searxInstance}/search` ? {
        params: {
          q: searchQuery, //define q because we for somereason need to
          format: 'html',
          language: 'en-US',
          categories: 'general,images,videos,news',
          theme: 'simple',
          safesearch: 1 // watch your fucking porn weirdos | NO NO PORN
        }
      } : {}),
      responseType: 'stream',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'DNT': '1',
        'Connection': 'keep-alive', //stay the fuck awake
        'Referer': searxInstance
      },
      maxRedirects: 10, //virus block
      timeout: 10000  
    });
    const contentType = response.headers['content-type'] || '';
    if (isAsset || !contentType.includes('text/html')) {
      const headers = response.headers;
      for (const [key, value] of Object.entries(headers)) {
        if (!['content-length', 'content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }
      response.data.pipe(res);
      return;
    }
    
    const transformStream = new Transform({
      transform(chunk, encoding, callback) {
        let chunkStr = chunk.toString('utf8');
        const resourceTypes = ['href', 'src', 'action', 'data-url', 'poster'];
        
        resourceTypes.forEach(type => {
          chunkStr = chunkStr.replace(
            new RegExp(`${type}=["'](\/[^"']+)["']`, 'gi'),
            (match, url) => `${type}="/api/proxy?q=${encodeURIComponent(searxInstance + url)}"`
          );
          chunkStr = chunkStr.replace(
            new RegExp(`${type}=["'](?!http|\/\/|data:|blob:|javascript:)([^\/][^"']+)["']`, 'gi'),
            (match, url) => `${type}="/api/proxy?q=${encodeURIComponent(searxInstance + '/' + url)}"`
          );
          
          chunkStr = chunkStr.replace(
            new RegExp(`${type}=["'](https?:\/\/[^"']+)["']`, 'gi'), //HOLY SHIT, i love regex
            (match, url) => `${type}="/api/proxy?q=${encodeURIComponent(url)}"`
          );
        });
        
        chunkStr = chunkStr.replace(
          /url\(['"]?([^")]+)['"]?\)/gi,
          (match, url) => {
            if (url.startsWith('data:') || url.startsWith('blob:')) {
              return match;
            }
            const fullUrl = url.startsWith('/') 
              ? searxInstance + url 
              : url.startsWith('http') 
                ? url 
                : searxInstance + '/' + url;
            return `url("/api/proxy?q=${encodeURIComponent(fullUrl)}")`;
          }
        );
        
        if (chunkStr.includes('<head>')) {
          const csp = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: *;\">";
          chunkStr = chunkStr.replace('<head>', `<head>${csp}`);
        }

        callback(null, chunkStr);
      }
    });
    
    const headers = response.headers;
    for (const [key, value] of Object.entries(headers)) {
      if (!['content-length', 'content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    response.data.pipe(transformStream).pipe(res);
    transformStream.on('error', (err) => {
      console.error('Transform stream error:', err);
      res.end();
    });
    response.data.on('error', (err) => {
      console.error('SearX stream error:', err);
      res.end();
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).send(`
      <html>
        <head>
          <title>U BROKE IT</title>
          <style>
            body { font-family: system-ui; padding: 2rem; }
            .error { color: #e11d48; }
          </style>
        </head>
        <body>
          <h1 class="error">U Broke It!</h1>
          <p>An error occurred while processing your request: ${error.message}</p>
          <p>Bastard.</p>
          <p>HA i added an extra p tag just cus i can </p>
          <p>Is oreo a retard for the extra p tag??</p>
        </body>
      </html>
    `);
  }
}

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};
