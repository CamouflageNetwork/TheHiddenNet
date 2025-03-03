const axios = require('axios');

export default async function handler(req, res) {
    try {
        const url = req.query.url;
        if (!url) return res.status(400).send("No URL provided");

        const response = await axios.get(url, {
            responseType: 'arraybuffer', 
            headers: { 'User-Agent': req.headers['user-agent'] }
        });

        res.setHeader('Content-Type', response.headers['content-type']);
        res.send(response.data);
    } catch (error) {
        res.status(500).send("Error fetching resource");
    }
}
