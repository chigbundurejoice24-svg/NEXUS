# AEGIS Backend - Development TODO

## Phase 1: Price Engine & Portfolio System (IN PROGRESS)

- [x] Create price engine module (`lib/prices/fetch-prices.ts`)
  - [x] Implement CoinGecko ID mapping for all supported tokens
  - [x] Build in-memory cache with 1-minute TTL
  - [x] Fetch USD prices from CoinGecko API
  - [x] Handle API errors gracefully with fallback to stale cache
  
- [x] Implement portfolio aggregator (`lib/wallets/portfolio-aggregator.ts`)
  - [x] Multi-chain balance fetcher (Ethereum, BSC, Polygon, Arbitrum) - BUG FIXED
  - [x] Raw bigint balance aggregation
  - [x] Per-wallet asset tracking
  - [x] Support for native tokens and ERC20 tokens
  
- [x] Create enriched portfolio service (`lib/wallets/enriched-portfolio.ts`)
  - [x] Combine raw balances with live prices
  - [x] Calculate USD values for each asset
  - [x] Compute total portfolio value
  - [x] Format values for display

- [ ] Create tRPC procedures for portfolio data
  - [x] `portfolio.getAggregated` - Get aggregated portfolio with prices
  - [x] `portfolio.getByWallet` - Get per-wallet breakdown
  - [x] `portfolio.getTotalValue` - Get total portfolio USD value
  - [x] `portfolio.getPrices` - Get prices for specific assets
  - [ ] Integration tests passing reliably

## Identified Issues to Fix

- [x] Fix ERC20 portfolio aggregation bug (chainName parameter was incorrect)
- [ ] Stabilize portfolio router integration tests (address validation and timeout issues)
- [ ] Verify multi-chain balance fetching works correctly across all chains
- [ ] Ensure portfolio tests pass reliably before marking Phase 1 complete

## Phase 2: Wallet Management

- [ ] User wallet storage in database
  - [ ] Create users_wallets table
  - [ ] Support multiple wallets per user
  - [ ] Track wallet labels and addresses
  
- [ ] Wallet address management procedures
  - [ ] `wallets.addWallet` - Add new wallet address
  - [ ] `wallets.removeWallet` - Remove wallet
  - [ ] `wallets.listWallets` - List user's wallets
  - [ ] `wallets.updateLabel` - Update wallet label

## Phase 3: Transaction Management

- [ ] Transaction history storage
  - [ ] Create transactions table
  - [ ] Track transaction type (send, receive, fund, exchange, withdraw)
  - [ ] Store status (completed, pending, failed)
  - [ ] Record fees and network information
  
- [ ] Transaction procedures
  - [ ] `transactions.list` - Get user transactions with filtering
  - [ ] `transactions.getById` - Get transaction details
  - [ ] `transactions.create` - Create new transaction record
  - [ ] `transactions.updateStatus` - Update transaction status

## Phase 4: Exchange Rates & Market Data

- [ ] Live exchange rates service
  - [ ] Fetch rates for USDT, USDC, BTC, ETH, BNB vs NGN
  - [ ] Cache rates with appropriate TTL
  - [ ] Track 24h change, high/low, volume
  
- [ ] Exchange rate procedures
  - [ ] `rates.getAll` - Get all supported rates
  - [ ] `rates.getPair` - Get specific trading pair rate
  - [ ] `rates.getHistory` - Get historical rate data

## Phase 5: Fund Wallet Providers

- [ ] Provider integration setup
  - [ ] Create providers table (Yellow Card, MoonPay, Transak, Binance P2P)
  - [ ] Store provider metadata (fees, ETA, trust scores)
  - [ ] Track supported tokens and chains
  
- [ ] Provider procedures
  - [ ] `providers.list` - Get all available providers
  - [ ] `providers.getQuote` - Get pricing quote from provider
  - [ ] `providers.initiate` - Start funding flow with provider

## Phase 6: Send Money Flow

- [ ] Transaction validation
  - [ ] Recipient validation
  - [ ] Network selection logic
  - [ ] Fee calculation
  
- [ ] Send procedures
  - [ ] `send.validateRecipient` - Validate recipient address
  - [ ] `send.calculateFee` - Calculate network fees
  - [ ] `send.preview` - Preview transaction before sending
  - [ ] `send.submit` - Submit transaction

## Phase 7: Receive Money Flow

- [ ] QR code generation
  - [ ] Generate QR codes for wallet addresses
  - [ ] Support per-token/chain QR codes
  
- [ ] Receive procedures
  - [ ] `receive.getAddress` - Get user's wallet address
  - [ ] `receive.generateQR` - Generate QR code for address
  - [ ] `receive.trackIncoming` - Monitor for incoming transactions

## Phase 8: Crypto Exchange

- [ ] Swap execution
  - [ ] Slippage calculation
  - [ ] Rate preview
  - [ ] Swap confirmation
  
- [ ] Exchange procedures
  - [ ] `exchange.getRate` - Get swap rate
  - [ ] `exchange.preview` - Preview swap with slippage
  - [ ] `exchange.execute` - Execute swap

## Phase 9: Aegis AI Assistant

- [ ] AI integration setup
  - [ ] Connect to LLM service
  - [ ] Create AI context from user portfolio
  
- [ ] AI procedures
  - [ ] `ai.getInsight` - Get AI routing suggestion
  - [ ] `ai.getRiskAlert` - Get risk assessment
  - [ ] `ai.getLiquidityUpdate` - Get liquidity insights
  - [ ] `ai.chat` - Chat with Aegis AI

## Phase 10: Rewards System

- [ ] Rewards tracking
  - [ ] Create rewards table
  - [ ] Track points and achievements
  - [ ] Referral program logic
  
- [ ] Rewards procedures
  - [ ] `rewards.list` - Get available rewards
  - [ ] `rewards.getProgress` - Get user progress
  - [ ] `rewards.claim` - Claim completed reward
  - [ ] `rewards.getReferralCode` - Get referral code

## Phase 11: User Profile & KYC

- [ ] Profile management
  - [ ] Extend user table with profile fields
  - [ ] KYC verification status tracking
  - [ ] XP/level progression
  
- [ ] Profile procedures
  - [ ] `profile.get` - Get user profile
  - [ ] `profile.update` - Update profile
  - [ ] `profile.getKYCStatus` - Get verification status
  - [ ] `profile.submitKYC` - Submit KYC verification

## Phase 12: Testing & Deployment

- [ ] Unit tests for price engine
- [ ] Integration tests for portfolio system
- [ ] End-to-end tests for transaction flows
- [ ] Performance testing with real data
- [ ] Security audit
- [ ] Deploy to production

---

## Current Status

**Phase 1 (In Progress)**

✅ Completed:
- Price engine with CoinGecko integration (live USD prices)
- In-memory caching with 1-minute TTL
- Graceful error handling with fallback to stale cache
- Enriched portfolio service combining balances + prices
- 4 tRPC procedures exposed for frontend integration
- Fixed ERC20 balance fetching bug in portfolio aggregator

🔧 In Progress:
- Portfolio router integration tests (address validation and timeout issues)
- Multi-chain balance fetching verification

**Next**: Stabilize tests and move to Phase 2 - Wallet Management
