const express = require('express');
const axios = require('axios');

const app = express();

app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('No URL provided');
  }

  try {
    const response = await axios.get(targetUrl);
    res.set('Content-Type', response.headers['content-type']);
    res.status(200).send(response.data);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

module.exports = app;
