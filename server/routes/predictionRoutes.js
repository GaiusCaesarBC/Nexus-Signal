const express = require('express');
const router = express.Router();
const axios = require('axios');
const { generatePrediction } = require('../predictionEngine');

// @route   GET api/predict/:symbol
// @desc    Get AI prediction for a stock symbol
// @access  Public
router.get('/:symbol', async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

    // Use the correct, free API endpoint
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}&outputsize=compact`;

    try {
        const response = await axios.get(url);
        const data = response.data;

        // Check for API errors or rate limiting notes
        if (!data['Time Series (Daily)']) {
            console.error('API did not return "Time Series (Daily)". Full API Response:', data);
            return res.status(404).json({ msg: `No data found for symbol: ${symbol}. Check symbol or API limit.` });
        }

        const timeSeries = data['Time Series (Daily)'];
        const historicalData = Object.entries(timeSeries).map(([date, values]) => ({
            date,
            close: parseFloat(values['4. close']),
        })).reverse(); // Reverse to have oldest data first

        if (historicalData.length < 50) {
             return res.status(400).json({ msg: 'Not enough historical data to generate a prediction.' });
        }

        const prediction = generatePrediction(historicalData);

        res.json({
            symbol,
            ...prediction,
            historicalData 
        });

    } catch (err) {
        console.error('Error in prediction route:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
```

---

#### **Step 2: The Final Push to Deploy the Fix**

Now that your local file is guaranteed to be correct, we will upload this change to GitHub. This is the final step that will fix your live website.

1.  **Open your terminal** and navigate to your main `quantum-trade` root folder.
2.  **Run these three commands** one by one:

    ```bash
    git add .
    ```
    *(This stages your corrected file.)*

    ```bash
    git commit -m "Fix production prediction route to use correct API endpoint"
    ```
    *(This saves the change with a clear message.)*

    ```bash
    git push
    

