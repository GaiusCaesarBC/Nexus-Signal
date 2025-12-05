// server/services/plaidService.js - Plaid Integration for US Brokerages
const { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } = require('plaid');

// Plaid client configuration
let plaidClient = null;

/**
 * Initialize Plaid client
 */
function initializePlaidClient() {
    if (plaidClient) return plaidClient;

    const configuration = new Configuration({
        basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
        baseOptions: {
            headers: {
                'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
                'PLAID-SECRET': process.env.PLAID_SECRET,
            },
        },
    });

    plaidClient = new PlaidApi(configuration);
    return plaidClient;
}

/**
 * Create a link token for Plaid Link
 * @param {string} userId - User ID
 * @param {string} clientName - Client application name
 * @returns {Promise<object>} Link token response
 */
async function createLinkToken(userId, clientName = 'Nexus Signal') {
    const client = initializePlaidClient();

    try {
        const linkConfig = {
            user: {
                client_user_id: userId,
            },
            client_name: clientName,
            products: [Products.Investments],
            country_codes: [CountryCode.Us],
            language: 'en',
        };

        // Add webhook URL for production
        if (process.env.PLAID_WEBHOOK_URL) {
            linkConfig.webhook = process.env.PLAID_WEBHOOK_URL;
        }

        // Add OAuth redirect URI for production (required for some institutions)
        if (process.env.PLAID_REDIRECT_URI) {
            linkConfig.redirect_uri = process.env.PLAID_REDIRECT_URI;
        }

        const response = await client.linkTokenCreate(linkConfig);

        return {
            linkToken: response.data.link_token,
            expiration: response.data.expiration
        };
    } catch (error) {
        console.error('Error creating Plaid link token:', error.response?.data || error.message);
        throw new Error('Failed to create link token');
    }
}

/**
 * Exchange public token for access token
 * @param {string} publicToken - Public token from Plaid Link
 * @returns {Promise<object>} Access token and item ID
 */
async function exchangePublicToken(publicToken) {
    const client = initializePlaidClient();

    try {
        const response = await client.itemPublicTokenExchange({
            public_token: publicToken,
        });

        return {
            accessToken: response.data.access_token,
            itemId: response.data.item_id
        };
    } catch (error) {
        console.error('Error exchanging Plaid token:', error.response?.data || error.message);
        throw new Error('Failed to exchange public token');
    }
}

/**
 * Get investment holdings
 * @param {string} accessToken - Plaid access token
 * @returns {Promise<object>} Holdings data
 */
async function getHoldings(accessToken) {
    const client = initializePlaidClient();

    try {
        const response = await client.investmentsHoldingsGet({
            access_token: accessToken,
        });

        const accounts = response.data.accounts;
        const holdings = response.data.holdings;
        const securities = response.data.securities;

        // Create security lookup map
        const securityMap = new Map();
        securities.forEach(sec => {
            securityMap.set(sec.security_id, sec);
        });

        // Format holdings with security info
        const formattedHoldings = holdings.map(holding => {
            const security = securityMap.get(holding.security_id);
            return {
                accountId: holding.account_id,
                securityId: holding.security_id,
                symbol: security?.ticker_symbol || 'Unknown',
                name: security?.name || 'Unknown Security',
                quantity: holding.quantity,
                price: holding.institution_price,
                value: holding.institution_value,
                costBasis: holding.cost_basis,
                priceAsOf: holding.institution_price_as_of,
                type: security?.type || 'unknown',
                closePrice: security?.close_price,
                closePriceAsOf: security?.close_price_as_of
            };
        });

        // Calculate totals per account
        const accountTotals = accounts.map(account => {
            const accountHoldings = formattedHoldings.filter(h => h.accountId === account.account_id);
            const totalValue = accountHoldings.reduce((sum, h) => sum + (h.value || 0), 0);
            const totalCostBasis = accountHoldings.reduce((sum, h) => sum + (h.costBasis || 0), 0);

            return {
                accountId: account.account_id,
                name: account.name,
                officialName: account.official_name,
                type: account.type,
                subtype: account.subtype,
                mask: account.mask,
                currentBalance: account.balances?.current,
                availableBalance: account.balances?.available,
                holdings: accountHoldings,
                totalValue,
                totalCostBasis,
                totalGainLoss: totalValue - totalCostBasis,
                totalGainLossPercent: totalCostBasis > 0 ?
                    ((totalValue - totalCostBasis) / totalCostBasis * 100) : 0
            };
        });

        return {
            accounts: accountTotals,
            holdings: formattedHoldings,
            securities: securities.map(sec => ({
                id: sec.security_id,
                symbol: sec.ticker_symbol,
                name: sec.name,
                type: sec.type,
                closePrice: sec.close_price,
                isin: sec.isin,
                cusip: sec.cusip
            })),
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error fetching Plaid holdings:', error.response?.data || error.message);
        throw new Error('Failed to fetch holdings');
    }
}

/**
 * Get investment transactions
 * @param {string} accessToken - Plaid access token
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<object>} Transactions data
 */
async function getInvestmentTransactions(accessToken, startDate, endDate) {
    const client = initializePlaidClient();

    // Default to last 30 days if not specified
    if (!startDate) {
        const start = new Date();
        start.setDate(start.getDate() - 30);
        startDate = start.toISOString().split('T')[0];
    }
    if (!endDate) {
        endDate = new Date().toISOString().split('T')[0];
    }

    try {
        const response = await client.investmentsTransactionsGet({
            access_token: accessToken,
            start_date: startDate,
            end_date: endDate,
        });

        const transactions = response.data.investment_transactions;
        const securities = response.data.securities;

        // Create security lookup map
        const securityMap = new Map();
        securities.forEach(sec => {
            securityMap.set(sec.security_id, sec);
        });

        // Format transactions
        const formattedTransactions = transactions.map(tx => {
            const security = securityMap.get(tx.security_id);
            return {
                id: tx.investment_transaction_id,
                accountId: tx.account_id,
                securityId: tx.security_id,
                symbol: security?.ticker_symbol || null,
                name: tx.name,
                type: tx.type,
                subtype: tx.subtype,
                quantity: tx.quantity,
                price: tx.price,
                amount: tx.amount,
                fees: tx.fees,
                date: tx.date,
                isoCurrencyCode: tx.iso_currency_code
            };
        });

        return {
            transactions: formattedTransactions.sort((a, b) =>
                new Date(b.date) - new Date(a.date)
            ),
            totalTransactions: response.data.total_investment_transactions,
            securities: securities.map(sec => ({
                id: sec.security_id,
                symbol: sec.ticker_symbol,
                name: sec.name,
                type: sec.type
            }))
        };
    } catch (error) {
        console.error('Error fetching Plaid transactions:', error.response?.data || error.message);
        throw new Error('Failed to fetch transactions');
    }
}

/**
 * Get item (institution connection) info
 * @param {string} accessToken - Plaid access token
 * @returns {Promise<object>} Item info
 */
async function getItemInfo(accessToken) {
    const client = initializePlaidClient();

    try {
        const response = await client.itemGet({
            access_token: accessToken,
        });

        const item = response.data.item;

        // Get institution info
        let institution = null;
        if (item.institution_id) {
            try {
                const instResponse = await client.institutionsGetById({
                    institution_id: item.institution_id,
                    country_codes: [CountryCode.Us],
                });
                institution = {
                    id: instResponse.data.institution.institution_id,
                    name: instResponse.data.institution.name,
                    logo: instResponse.data.institution.logo,
                    primaryColor: instResponse.data.institution.primary_color,
                    url: instResponse.data.institution.url
                };
            } catch (e) {
                console.error('Error fetching institution:', e.message);
            }
        }

        return {
            itemId: item.item_id,
            institutionId: item.institution_id,
            institution,
            products: item.available_products,
            billedProducts: item.billed_products,
            consentExpirationTime: item.consent_expiration_time,
            updateType: item.update_type
        };
    } catch (error) {
        console.error('Error fetching Plaid item:', error.response?.data || error.message);
        throw new Error('Failed to fetch item info');
    }
}

/**
 * Remove an item (disconnect institution)
 * @param {string} accessToken - Plaid access token
 * @returns {Promise<boolean>} Success status
 */
async function removeItem(accessToken) {
    const client = initializePlaidClient();

    try {
        await client.itemRemove({
            access_token: accessToken,
        });
        return true;
    } catch (error) {
        console.error('Error removing Plaid item:', error.response?.data || error.message);
        throw new Error('Failed to remove item');
    }
}

/**
 * Search for institutions
 * @param {string} query - Search query
 * @param {string[]} products - Products to filter by
 * @returns {Promise<array>} List of institutions
 */
async function searchInstitutions(query, products = [Products.Investments]) {
    const client = initializePlaidClient();

    try {
        const response = await client.institutionsSearch({
            query,
            products,
            country_codes: [CountryCode.Us],
        });

        return response.data.institutions.map(inst => ({
            id: inst.institution_id,
            name: inst.name,
            logo: inst.logo,
            primaryColor: inst.primary_color,
            url: inst.url,
            products: inst.products
        }));
    } catch (error) {
        console.error('Error searching institutions:', error.response?.data || error.message);
        throw new Error('Failed to search institutions');
    }
}

/**
 * Create a sandbox public token for testing
 * @param {string} institutionId - Institution ID
 * @returns {Promise<string>} Public token
 */
async function createSandboxPublicToken(institutionId = 'ins_109508') {
    const client = initializePlaidClient();

    if (process.env.PLAID_ENV !== 'sandbox') {
        throw new Error('Sandbox tokens only available in sandbox environment');
    }

    try {
        const response = await client.sandboxPublicTokenCreate({
            institution_id: institutionId,
            initial_products: [Products.Investments],
        });

        return response.data.public_token;
    } catch (error) {
        console.error('Error creating sandbox token:', error.response?.data || error.message);
        throw new Error('Failed to create sandbox token');
    }
}

module.exports = {
    initializePlaidClient,
    createLinkToken,
    exchangePublicToken,
    getHoldings,
    getInvestmentTransactions,
    getItemInfo,
    removeItem,
    searchInstitutions,
    createSandboxPublicToken
};
