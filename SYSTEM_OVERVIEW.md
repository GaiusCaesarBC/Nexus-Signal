# Nexus-Signal System Overview

This is a comprehensive **paper trading and gamification platform** built with Node.js/Express and MongoDB.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (React)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS SERVER                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Middleware │→ │   Routes    │→ │    Controllers      │ │
│  │  (Auth/CORS)│  │  (38 files) │  │  (4 files)          │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    SERVICES     │  │    MODELS       │  │  EXTERNAL APIs  │
│  (22 services)  │  │  (13 models)    │  │                 │
│                 │  │                 │  │ • Alpha Vantage │
│ • Gamification  │  │ • User          │  │ • CoinGecko     │
│ • Predictions   │  │ • Portfolio     │  │ • OpenAI        │
│ • Price Data    │  │ • Prediction    │  │ • Cloudinary    │
│ • Achievements  │  │ • Trade         │  │ • Twitter       │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │   MongoDB Atlas │
                    └─────────────────┘
```

---

## Core Features

### 1. Paper Trading System

Users trade with virtual money ($100K starting balance):

```
User clicks "Buy AAPL" →
  1. Fetch real-time price (Alpha Vantage/CoinGecko)
  2. Calculate position (with leverage up to 20x)
  3. Set TP/SL/Trailing Stop
  4. Deduct from cash balance
  5. Award XP & check achievements
  6. Track for badge progress
```

**Key capabilities:**
- Long & short positions
- Leverage trading (1-20x)
- Take Profit / Stop Loss / Trailing Stop
- Liquidation protection
- Account refills

### 2. AI Prediction Engine

Location: `predictionEngine.js` and `/services/predictionChecker.js`

```
User requests prediction for BTC →
  1. Fetch 100+ days historical data
  2. Calculate technical indicators (RSI, MACD, Bollinger, etc.)
  3. Run linear regression for trend
  4. Generate confidence score (R² - volatility penalty)
  5. Create prediction with target price & timeframe

[Cron job every minute]
  → Check expired predictions
  → Compare actual vs predicted
  → Award XP/coins based on accuracy
```

### 3. Gamification System

All stored in `User.gamification`:

| Component | Description |
|-----------|-------------|
| **XP & Levels** | 1-100+ levels with titles (Rookie → Nexus Legend) |
| **Nexus Coins** | Virtual currency for the Vault |
| **Achievements** | 70+ achievements across trading, predictions, streaks |
| **Badges** | Display on profile (up to 3 equipped) |
| **Daily Rewards** | Streak-based with jackpot chance |

**Level Progression:**
```
Level 1:   0-100 XP     (Rookie Trader)
Level 10:  2,500 XP     (Seasoned Trader)
Level 50:  75,000 XP    (Elite Trader)
Level 100: 500,000 XP   (Nexus Legend)
```

### 4. Vault System

Virtual shop for cosmetics:
- **Avatar Borders** (50-500 coins)
- **Profile Themes** (100-1000 coins)
- **Badges** (200-2000 coins)
- **Perks** with gameplay effects (500-5000 coins)

---

## Data Models

### User Model (Central Hub)

```javascript
{
  // Auth
  email, password (hashed), username,

  // Profile
  profile: { avatar, bio, badges[], verified },

  // Gamification (embedded)
  gamification: {
    xp, level, title,
    nexusCoins,
    achievements: [{id, name, unlockedAt}],
    loginStreak, stats
  },

  // Vault (embedded)
  vault: {
    ownedItems[], equippedBorder, equippedTheme
  },

  // Social
  social: { followers[], following[], blocked[] }
}
```

### Portfolio Model

```javascript
{
  user: ObjectId,
  cashBalance: 10000,
  holdings: [{
    symbol, quantity, purchasePrice, currentPrice,
    gainLoss, gainLossPercent
  }],
  totalValue, dayChange, allTimeHigh
}
```

### Prediction Model

```javascript
{
  user: ObjectId,
  symbol: 'BTC',
  direction: 'UP',
  currentPrice: 43000,
  targetPrice: 48000,
  confidence: 78,
  timeframe: 7, // days
  status: 'pending|correct|incorrect',
  outcome: { actualPrice, wasCorrect, accuracy }
}
```

---

## Key Workflows

### Trade Execution Flow

```
POST /api/paper-trading/buy
  │
  ├─→ Validate balance & leverage
  ├─→ Fetch real-time price
  ├─→ Create position with TP/SL
  ├─→ Record order in history
  ├─→ Award 50 XP
  ├─→ Check achievements ("First Blood", etc.)
  └─→ Track badge progress (Early Bird, Risk Taker)
```

### Daily Reward Flow

```
POST /api/gamification/claim-daily
  │
  ├─→ Check last claim date
  ├─→ Calculate streak (reset if missed)
  ├─→ Apply multiplier (up to 2.5x at 75 days)
  ├─→ Roll for jackpot (5% chance, 10x rewards)
  ├─→ Award XP + coins
  └─→ Check milestone badges (Week Warrior, etc.)
```

---

## External API Integrations

| API | Purpose | Fallback |
|-----|---------|----------|
| **Alpha Vantage** | Stock quotes & history | Yahoo Finance |
| **CoinGecko Pro** | Crypto prices & charts | Binance API |
| **OpenAI** | AI-powered insights | - |
| **Cloudinary** | Avatar storage | - |
| **Twitter API** | Sentiment analysis | - |

---

## Authentication

JWT-based with multiple delivery methods:
1. HTTP-only cookie (primary)
2. `x-auth-token` header
3. `Authorization: Bearer` header

```javascript
// Middleware chain
request → helmet → mongoSanitize → xss → authMiddleware → route
```

---

## Background Jobs

| Job | Frequency | Purpose |
|-----|-----------|---------|
| `predictionChecker` | Every 1 min | Resolve expired predictions |
| `alertChecker` | Every 5 min | Trigger price alerts |

---

## File Structure Summary

```
/config/          # achievements.js, dailyRewards.js, badgeMapping.js
/controllers/     # cryptoController, stockController, predictionController
/middleware/      # authMiddleware, botProtection, subscriptionMiddleware
/models/          # User, Portfolio, Prediction, Trade, Alert, etc.
/routes/          # 38 route files for all API endpoints
/services/        # 22 services (gamification, predictions, prices, etc.)
/utils/           # indicators, sentiment tracking, helpers
```

---

## API Routes Overview

### Authentication
```
POST /api/auth/register          - User registration
POST /api/auth/login             - User login
GET  /api/auth/me                - Get current user
POST /api/auth/logout            - Logout
```

### Portfolio & Trading
```
GET  /api/portfolio              - Get portfolio with prices
POST /api/portfolio/buy          - Buy asset (paper trading)
POST /api/portfolio/sell         - Sell asset
GET  /api/portfolio/history      - Portfolio value history
```

### Paper Trading (Advanced)
```
GET  /api/paper-trading/account  - Get account
POST /api/paper-trading/buy      - Buy with leverage
POST /api/paper-trading/sell     - Sell position
POST /api/paper-trading/set-tp   - Set take profit
POST /api/paper-trading/set-sl   - Set stop loss
POST /api/paper-trading/refill   - Refill balance
```

### Market Data
```
GET  /api/stocks/:symbol/quote       - Stock quote
GET  /api/stocks/:symbol/chart/:range - Historical data
GET  /api/crypto/:symbol/quote       - Crypto quote
GET  /api/crypto/:symbol/chart/:range - Historical data
```

### Predictions
```
POST /api/predictions            - Create AI prediction
GET  /api/predictions            - Get user predictions
GET  /api/predictions/trending   - Trending predictions
POST /api/predictions/:id/like   - Like prediction
```

### Gamification
```
GET  /api/gamification/stats     - User gamification stats
GET  /api/gamification/achievements - Get achievements
POST /api/gamification/claim-daily - Claim daily reward
GET  /api/gamification/leaderboard - XP leaderboard
```

### Vault
```
GET  /api/vault/items            - Browse vault items
POST /api/vault/purchase         - Purchase with coins
POST /api/vault/equip            - Equip item
```

### Leaderboards
```
GET  /api/leaderboard/portfolio  - Portfolio value ranking
GET  /api/leaderboard/xp         - XP/level ranking
GET  /api/leaderboard/predictions - Prediction accuracy ranking
```
