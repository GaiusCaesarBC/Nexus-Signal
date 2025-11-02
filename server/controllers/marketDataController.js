// server/controllers/marketDataController.js - UPDATED for comprehensive Crypto data
const axios = require('axios');

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;

// Helper function to fetch comprehensive stock quote from Alpha Vantage (NO CHANGE)
const fetchStockQuote = async (symbol) => {
    try {
        if (!ALPHA_VANTAGE_API_KEY) {
            console.error('ALPHA_VANTAGE_API_KEY is not set.');
            return null;
        }

        const response = await axios.get(
            `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
        );
        const globalQuote = response.data['Global Quote'];

        if (globalQuote && Object.keys(globalQuote).length > 0) {
            const formattedQuote = {
                symbol: globalQuote['01. symbol'],
                open: parseFloat(globalQuote['02. open']),
                high: parseFloat(globalQuote['03. high']),
                low: parseFloat(globalQuote['04. low']),
                price: parseFloat(globalQuote['05. price']),
                volume: parseInt(globalQuote['06. volume']),
                latestTradingDay: globalQuote['07. latest trading day'],
                previousClose: parseFloat(globalQuote['08. previous close']),
                change: parseFloat(globalQuote['09. change']),
                changePercent: globalQuote['10. change percent'],
            };
            return formattedQuote;
        }
        console.warn(`Alpha Vantage GLOBAL_QUOTE data for ${symbol} not found or malformed. Response keys:`, Object.keys(response.data));
        if (response.data["Error Message"]) {
            console.error("Alpha Vantage Error Message:", response.data["Error Message"]);
        }
        return null;
    } catch (error) {
        console.error(`Error fetching stock quote for ${symbol} from Alpha Vantage:`, error.message);
        if (error.response && error.response.status === 429) {
            console.error("Alpha Vantage rate limit likely exceeded. Please wait and try again.");
        }
        return null;
    }
};

// Helper function to fetch comprehensive crypto quote from CoinGecko (MODIFIED)
const fetchCryptoQuote = async (symbol) => { // Renamed from fetchCryptoPrice
    try {
        const headers = COINGECKO_API_KEY ? { 'x-cg-pro-api-key': COINGECKO_API_KEY } : {};

        // --- Step 1: Get CoinGecko ID from symbol ---
        // CoinGecko's /coins/{id} endpoint needs the full ID (e.g., 'bitcoin'), not the symbol ('BTC').
        // We need a mapping. For simplicity, we'll try to get a list and find it.
        // A more robust solution would cache this list or use a predefined map.
        const coinListResponse = await axios.get('https://api.coingecko.com/api/v3/coins/list', { headers });
        const coin = coinListResponse.data.find(c =>
            c.symbol.toLowerCase() === symbol.toLowerCase() || c.id.toLowerCase() === symbol.toLowerCase()
        );

        if (!coin) {
            console.warn(`CoinGecko ID not found for symbol: ${symbol}.`);
            return null;
        }
        const coingeckoId = coin.id;
        console.log(`Mapped symbol ${symbol} to CoinGecko ID: ${coingeckoId}`);


        // --- Step 2: Fetch detailed quote using the ID ---
        const response = await axios.get(
            `https://api.coingecko.com/api/v3/coins/${coingeckoId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`,
            { headers: headers }
        );
        const data = response.data;

        if (data && data.market_data) {
            const marketData = data.market_data;
            const currentPrice = marketData.current_price?.usd;
            const high24h = marketData.high_24h?.usd;
            const low24h = marketData.low_24h?.usd;
            const totalVolume = marketData.total_volume?.usd;
            const marketCap = marketData.market_cap?.usd;
            const priceChange24h = marketData.price_change_24h_in_currency?.usd;
            const priceChangePercentage24h = marketData.price_change_percentage_24h_in_currency?.usd;

            const formattedQuote = {
                symbol: symbol.toUpperCase(), // Use original symbol for consistency
                name: data.name,
                id: data.id,
                price: currentPrice ? parseFloat(currentPrice) : null,
                high24h: high24h ? parseFloat(high24h) : null,
                low24h: low24h ? parseFloat(low24h) : null,
                volume: totalVolume ? parseFloat(totalVolume) : null, // Approximate stock 'volume'
                marketCap: marketCap ? parseFloat(marketCap) : null,
                priceChange24h: priceChange24h ? parseFloat(priceChange24h) : null,
                priceChangePercentage24h: priceChangePercentage24h ? `${priceChangePercentage24h.toFixed(2)}%` : null,
                // Add more fields as needed from CoinGecko response
            };
            return formattedQuote;
        }
        console.warn(`CoinGecko detailed market data for ${symbol} not found or malformed.`);
        return null;
    } catch (error) {
        console.error(`Error fetching crypto quote for ${symbol} from CoinGecko:`, error.message);
        if (error.response && error.response.status === 429) {
            console.error("CoinGecko rate limit likely exceeded. Please wait and try again.");
        } else if (error.response && error.response.data && error.response.data.error) {
            console.error("CoinGecko API Error:", error.response.data.error);
        }
        return null;
    }
};


// @desc    Get single quote for a symbol (stock or crypto)
// @route   GET /api/market-data/quote/:symbol?type=stock/crypto
// @access  Private
const getSingleQuote = async (req, res) => {
    const { symbol } = req.params;
    const { type } = req.query; // 'stock' or 'crypto'

    if (!symbol) {
        return res.status(400).json({ msg: 'Symbol is required' });
    }
    if (!type || (type !== 'stock' && type !== 'crypto')) {
        return res.status(400).json({ msg: 'Type (stock or crypto) is required and must be "stock" or "crypto"' });
    }

    try {
        let quoteData = null;
        if (type === 'stock') {
            quoteData = await fetchStockQuote(symbol);
        } else if (type === 'crypto') {
            quoteData = await fetchCryptoQuote(symbol); // Using the new fetchCryptoQuote
        }

        if (quoteData === null) {
            return res.status(404).json({ msg: `Quote data not found for ${symbol} of type ${type}. Please check the symbol and type.` });
        }

        res.json({ ...quoteData, lastUpdatedAt: new Date().toISOString() });
    } catch (err) {
        console.error('Error in getSingleQuote:', err.message);
        res.status(500).send('Server Error fetching single quote data');
    }
};

// @desc    Get multiple quotes for multiple symbols
// @route   GET /api/market-data/quotes?symbols=AAPL,BTC,ETH
// @access  Private
const getMultipleQuotes = async (req, res) => {
    const { symbols } = req.query;

    if (!symbols) {
        return res.status(400).json({ msg: 'Symbols query parameter is required' });
    }

    const symbolList = symbols.split(',').map(s => s.trim().toUpperCase());
    const quotes = {};
    const promises = symbolList.map(async (sym) => {
        // Basic heuristic for multiple quotes - improve as needed
        const isCrypto = ['BTC', 'ETH', 'XRP', 'DOGE', 'LTC'].includes(sym);
        const type = isCrypto ? 'crypto' : 'stock';

        let quoteData = null;
        if (type === 'stock') {
            quoteData = await fetchStockQuote(sym);
        } else if (type === 'crypto') {
            quoteData = await fetchCryptoQuote(sym); // Using the new fetchCryptoQuote
        }

        if (quoteData !== null) {
            quotes[sym] = quoteData;
        }
    });

    try {
        await Promise.all(promises);
        res.json({ quotes, lastUpdatedAt: new Date().toISOString() });
    } catch (err) {
        console.error('Error in getMultipleQuotes:', err.message);
        res.status(500).send('Server Error fetching multiple quotes data');
    }
};


module.exports = {
    getSingleQuote,
    getMultipleQuotes,
};