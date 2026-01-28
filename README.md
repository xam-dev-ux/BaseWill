# BaseWill

A decentralized inheritance platform on Base Mainnet that enables users to create onchain wills for automatic crypto asset distribution upon death or prolonged inactivity.

## Features

- **Dead Man's Switch**: Automatic will triggering after configurable inactivity period
- **Multi-Asset Support**: ETH, ERC20, ERC721, and ERC1155 tokens
- **Flexible Vesting**: Immediate, linear, cliff, and milestone-based distribution
- **Notary System**: Decentralized death verification with staking and reputation
- **Grace Period**: Time for testators to cancel accidental triggers
- **Disputes**: Bond-based dispute resolution system
- **Emergency Withdrawals**: Testator can recover assets with cooldown
- **Privacy Mode**: Optional encrypted beneficiary information

## Project Structure

```
BaseWill/
├── contracts/                 # Solidity smart contracts
│   ├── BaseWill.sol          # Main will management contract
│   ├── NotaryRegistry.sol    # Notary registration and staking
│   ├── interfaces/           # Contract interfaces
│   └── libraries/            # Shared libraries
├── frontend/                  # Vite + React application
│   ├── src/
│   │   ├── components/       # React components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom hooks
│   │   └── config/           # Wagmi configuration
├── backend/                   # Node.js backend services
│   ├── src/
│   │   ├── api/              # REST API endpoints
│   │   ├── indexer/          # Blockchain event indexer
│   │   ├── notifications/    # Email/push notifications
│   │   └── cron/             # Scheduled jobs
│   └── prisma/               # Database schema
├── keeper/                    # Automation bot
│   └── src/                  # Keeper implementation
├── scripts/                   # Deployment scripts
└── test/                      # Contract tests
```

## Quick Start

### Prerequisites

- Node.js v18+
- PostgreSQL 14+
- Redis (optional, for caching)

### 1. Install Dependencies

```bash
# Root (contracts)
npm install

# Frontend
cd frontend && npm install

# Backend
cd backend && npm install

# Keeper
cd keeper && npm install
```

### 2. Environment Setup

Copy environment examples and configure:

```bash
cp .env.example .env
cp frontend/.env.example frontend/.env
cp backend/.env.example backend/.env
cp keeper/.env.example keeper/.env
```

### 3. Deploy Contracts

```bash
# Compile contracts
npx hardhat compile

# Deploy to Base Sepolia (testnet)
npx hardhat run scripts/deploy.ts --network baseSepolia

# Verify on BaseScan
npx hardhat run scripts/verify.ts --network baseSepolia
```

### 4. Start Services

```bash
# Backend (runs API, indexer, and cron jobs)
cd backend && npm run dev

# Frontend
cd frontend && npm run dev

# Keeper (optional, for automated execution)
cd keeper && npm run dev
```

## Smart Contracts

### BaseWill.sol

Main contract managing will lifecycle:

- `createWill()` - Create a new will with beneficiaries and assets
- `checkIn()` - Prove liveness and reset inactivity timer
- `triggerWill()` - Trigger will when inactivity threshold reached
- `executeWill()` - Execute will and distribute assets
- `claimVestedAssets()` - Beneficiaries claim vested assets

### NotaryRegistry.sol

Notary management with staking:

- `registerNotary()` - Register as notary with ETH stake
- `submitVerification()` - Submit death verification
- `slashNotary()` - Slash stake for false verification

### Configuration Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `minInactivityPeriod` | 365 days | Minimum time before will can trigger |
| `maxBeneficiaries` | 20 | Maximum beneficiaries per will |
| `platformFeePercent` | 1% | Fee on execution |
| `notaryRewardPercent` | 0.5% | Reward for notary verification |
| `executorRewardPercent` | 0.1% | Reward for execution |
| `emergencyWithdrawalCooldown` | 30 days | Cooldown before emergency withdrawal |
| `defaultGracePeriod` | 30 days | Grace period after trigger |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wills/:address` | GET | Get testator's wills |
| `/api/wills/detail/:id` | GET | Get will details |
| `/api/beneficiary/:address` | GET | Get beneficiary wills |
| `/api/notary/:address` | GET | Get notary info |
| `/api/stats` | GET | Platform statistics |
| `/api/notifications/subscribe` | POST | Subscribe to notifications |

## Testing

```bash
# Run contract tests
npx hardhat test

# Run with coverage
npx hardhat coverage
```

## Deployment

### Base Mainnet

```bash
npx hardhat run scripts/deploy.ts --network base
```

### Required Environment Variables

**Contracts:**
- `PRIVATE_KEY` - Deployer wallet private key
- `BASESCAN_API_KEY` - For contract verification

**Backend:**
- `DATABASE_URL` - PostgreSQL connection string
- `BASE_RPC_URL` - Base RPC endpoint
- `BASEWILL_CONTRACT_ADDRESS` - Deployed contract address

**Keeper:**
- `KEEPER_PRIVATE_KEY` - Keeper wallet (needs ETH for gas)

## Base Mini App Configuration

BaseWill is configured as a Base Mini App for discovery and embedding in the Base app.

### Manifest Location

The manifest is located at `frontend/public/.well-known/farcaster.json` and will be accessible at:
```
https://your-domain.com/.well-known/farcaster.json
```

### Required Steps for Indexing

1. **Generate Assets**: Create required images (icon, splash, hero, screenshots)
   - Use [Mini App Assets Generator](https://www.miniappassets.com/)
   - See `frontend/public/MINI_APP_ASSETS.md` for specs

2. **Account Association**:
   - Go to [Base Build Account Association Tool](https://www.base.dev/preview?tab=account)
   - Enter your domain and verify ownership
   - Update `farcaster.json` with generated `header`, `payload`, `signature`

3. **Deploy & Index**:
   - Deploy with manifest accessible at `/.well-known/farcaster.json`
   - Share your Mini App URL in the Base feed
   - Indexing starts automatically on share

### Development vs Production

Set `"noindex": true` in the manifest for staging environments to prevent indexing.

## Security

- All contracts use OpenZeppelin's audited implementations
- ReentrancyGuard on all state-changing functions
- Pausable for emergency stops
- UUPSUpgradeable for future upgrades
- Commission wallet multi-sig recommended

## License

MIT
