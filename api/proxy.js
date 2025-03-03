const axios = require('axios');

module.exports = async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).send('Error: Missing "url" parameter');
  }

  try {
    const response = await axios.get(url);
    res.set('Content-Type', response.headers['content-type']);
    res.status(200).send(response.data);
  } catch (error) {
    res.status(500).send(`Error fetching the URL: ${error.message}`);
  }
};
