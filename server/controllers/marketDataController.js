// server/controllers/marketDataController.js
const axios = require('axios'); // Assuming you use axios for external API calls

// --- Configuration for API Keys (Make sure these are in your .env file) ---
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

// Helper function to fetch stock prices from Alpha Vantage
const fetchStockPrice = async (symbol) => {
    try {
        if (!ALPHA_VANTAGE_API_KEY) {
            console.error('ALPHA_VANTAGE_API_KEY is not set.');
            return null;
        }
        // Example: Fetch latest price from Alpha Vantage (replace with your actual Alpha Vantage logic)
        const response = await axios.get(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
        );
        const data = response.data['Global Quote'];
        if (data && data['05. price']) {
            return parseFloat(data['05. price']);
        }
        console.warn(`Alpha Vantage data for ${symbol} not found or malformed.`);
        return null; // Return null if price not found
    } catch (error) {
        console.error(`Error fetching stock price for ${symbol} from Alpha Vantage:`, error.message);
        return null;
    }
};

// Helper function to fetch crypto prices from CoinGecko
const fetchCryptoPrice = async (symbol) => {
    try {
        if (!COINGECKO_API_KEY) {
            console.error('COINGECKO_API_KEY is not set.');
            // CoinGecko has free tier without key for simple price, but use key for stability/rate limits
            // If you're hitting limits, consider adding 'x_cg_demo_api_key' header or similar.
        }
        // CoinGecko typically uses Coin ID, e.g., 'bitcoin' for BTC.
        // You might need a mapping here, or assume symbol is already CoinGecko ID.
        // For simplicity, let's assume `symbol` can be directly used as id (e.g., 'bitcoin', 'ethereum')
        // Or if you pass 'BTC', you need to convert it to 'bitcoin' first.
        // For now, let's assume symbol can be passed directly as a `vs_currency` argument in the simple price API.
        const coingeckoId = symbol.toLowerCase() === 'btc' ? 'bitcoin' : (symbol.toLowerCase() === 'eth' ? 'ethereum' : symbol.toLowerCase());

        const response = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`,
            {
                headers: COINGECKO_API_KEY ? { 'x_cg_demo_api_key': COINGECKO_API_KEY } : {}
            }
        );
        const priceData = response.data[coingeckoId];
        if (priceData && priceData.usd) {
            return parseFloat(priceData.usd);
        }
        console.warn(`CoinGecko data for ${symbol} not found or malformed.`);
        return null;
    } catch (error) {
        console.error(`Error fetching crypto price for ${symbol} from CoinGecko:`, error.message);
        return null;
    }
};


// @desc    Get single quote for a symbol (stock or crypto)
// @route   GET /api/market-data/single/:symbol?type=stock/crypto
// @access  Private
const getSingleQuote = async (req, res) => {
    const { symbol } = req.params;
    const { type } = req.query; // 'stock' or 'crypto'

    if (!symbol) {
        return res.status(400).json({ msg: 'Symbol is required' });
    }
    if (!type || (type !== 'stock' && type !== 'crypto')) {
        return res.status(400).json({ msg: 'Type (stock or crypto) is required' });
    }

    try {
        let price = null;
        if (type === 'stock') {
            price = await fetchStockPrice(symbol);
        } else if (type === 'crypto') {
            price = await fetchCryptoPrice(symbol);
        }

        if (price === null) {
            return res.status(404).json({ msg: `Price not found for ${symbol}` });
        }

        res.json({ symbol: symbol.toUpperCase(), price: price, lastUpdatedAt: new Date().toISOString() });
    } catch (err) {
        console.error('Error in getSingleQuote:', err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get multiple quotes for multiple symbols
// @route   GET /api/market-data/quotes?symbols=AAPL,BTC,ETH
// @access  Private
const getMultipleQuotes = async (req, res) => {
    const { symbols } = req.query; // Expects comma-separated symbols e.g., "AAPL,BTC"

    if (!symbols) {
        return res.status(400).json({ msg: 'Symbols query parameter is required' });
    }

    const symbolList = symbols.split(',').map(s => s.trim().toUpperCase());
    const prices = {};
    const promises = symbolList.map(async (sym) => {
        // Determine if it's stock or crypto (basic heuristic, improve as needed)
        const type = (sym.length <= 5 || sym.endsWith('USD') || sym.endsWith('USDT')) ? 'crypto' : 'stock'; // simplified

        let price = null;
        if (type === 'stock') {
            price = await fetchStockPrice(sym);
        } else if (type === 'crypto') {
            price = await fetchCryptoPrice(sym);
        }
        if (price !== null) {
            prices[sym] = price;
        }
    });

    try {
        await Promise.all(promises);
        res.json({ prices, lastUpdatedAt: new Date().toISOString() });
    } catch (err) {
        console.error('Error in getMultipleQuotes:', err.message);
        res.status(500).send('Server Error');
    }
};


// Export the functions to be used by the router
module.exports = {
    getSingleQuote,
    getMultipleQuotes,
};