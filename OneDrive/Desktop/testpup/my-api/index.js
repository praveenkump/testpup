const express = require('express');
const bodyParser = require('body-parser');
const { parseString, Builder } = require('xml2js');
const axios = require('axios');
const fs = require('fs').promises; // Use fs.promises for async file operations


const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.text({ type: 'application/xml' }));

async function readXmlFile() {
    try {
        const xmlData = await fs.readFile('tokens.xml', 'utf8');
        return xmlData;
    } catch (error) {
        throw new Error(`Error reading XML file: ${error.message}`);
    }
}

async function parseXml(xml) {
    return new Promise((resolve, reject) => {
        parseString(xml, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });
}

async function saveToXml(tokens) {
    const xmlBuilder = new Builder();
    const xml = xmlBuilder.buildObject({ tokens });

    try {
        // If the file exists, read the existing data and update specific fields
        const existingXml = await readXmlFile();
        const result = await parseXml(existingXml);

       // Check if the expected structure is present in the parsed XML result
       if (result && result.tokens && result.tokens.token && Array.isArray(result.tokens.token)) {
        // Update specific fields (assuming the structure of the XML)
        result.tokens.token.forEach((existingToken, index) => {
            const updatedToken = tokens.find(t => t.id === parseInt(existingToken.id[0]));
            if (updatedToken && existingToken.stars[0] == 0) {
                existingToken.stars[0] = updatedToken.stars.toString();
            }
        });

        // Merge the updated tokens with the rest of the XML structure
        const mergedXml = xmlBuilder.buildObject(result);

         // Write the merged XML back to the file
         await fs.writeFile('tokens.xml', mergedXml, 'utf8');
        } else {
            // If the structure is not as expected, create a new file with the current data
            //await fs.writeFile('tokens.xml', xml, 'utf8');
        }
    } catch (error) { 
        console.log(error);
        let l=error.message;       
        if (l.search("ENOENT")) {
            // If the file doesn't exist, create a new one with the current data
         await fs.writeFile('tokens.xml', xml, 'utf8');
        } else {
            console.error(`Error updating XML file: ${error.message}`);
        }
    }
}

function updateDataFromEndpoint() {
    // Assuming your endpoint returns an array of objects with 'address' and 'total' fields
    axios.get('https://byte-labs.xyz/.netlify/functions/2hot')
        .then(response => {
            const updatedData = response.data.map((item, index) => ({
                id: index + 1,
                stars: 0,
                ...item,
            }));

            tokens = updatedData;
            saveToXml(tokens);  // Update XML data with new values
        })
        .catch(error => {
            console.error('Error updating data from endpoint:', error.message);
        });
}

// Schedule the update every 60 seconds
setInterval(updateDataFromEndpoint, 60 * 1000);

app.get('/tokens', (req, res) => {
    res.json(tokens);
});

app.get('/tokens/:id', (req, res) => {
    const tokenId = parseInt(req.params.id);
    const token = tokens.find(t => t.id === tokenId);

    if (token) {
        res.json(token);
    } else {
        res.status(404).json({ error: 'Token not found' });
    }
});

app.post('/tokens', (req, res) => {
    const { name, quantity, stars } = req.body;

    if (!name || !quantity || !stars) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }

    const newToken = {
        id: tokens.length + 1,
        address,
        name,
        quantity,
        votes,
        stars
    };

    tokens.push(newToken);
    saveToXml(tokens);
    res.status(201).json(newToken);
});

app.post('/tokens/vote', (req, res) => {
    const { id, address } = req.body;

    if (!id || !address) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }

    const existingId = tokens.find(t => t.id === id);
    const existingToken = tokens.find(t => t.address === address);

    if (existingId && existingToken) {
        existingToken.stars += 1;
        saveToXml(tokens);
        res.json(existingToken);
    } else {
        res.status(404).json({ error: 'Token not found' });
    }
});
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
