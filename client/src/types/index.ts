export interface Wallet {
  id: string;
  name: string;
  symbol: string;
  chain: string;
  balance: number;
  fiatValue: number;
  fiatCurrency: string;
  icon: string;
  color: string;
  gradient: string;
  address: string;
  decimals: number;
}

export interface Transaction {
  id: string;
  type: 'send' | 'receive' | 'fund' | 'exchange' | 'withdraw';
  amount: number;
  symbol: string;
  fiatValue: number;
  fiatCurrency: string;
  recipient?: string;
  sender?: string;
  status: 'completed' | 'pending' | 'failed';
  timestamp: string;
  description: string;
  provider?: string;
  fee?: number;
  network?: string;
}

export interface Provider {
  id: string;
  name: string;
  logo: string;
  estimatedReceive: number;
  fees: number;
  eta: string;
  trustScore: number;
  isRecommended: boolean;
  supportedTokens: string[];
  supportedChains: string[];
}

export interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  href: string;
  gradient: string;
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  level: string;
  xp: number;
  maxXp: number;
  verificationStatus: 'verified' | 'pending' | 'unverified';
  memberSince: string;
  totalTransactions: number;
  country: string;
}

export interface AegisInsight {
  id: string;
  type: 'routing' | 'risk' | 'liquidity' | 'suggestion' | 'alert';
  title: string;
  description: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'success';
}

export interface Reward {
  id: string;
  title: string;
  points: number;
  description: string;
  category: 'referral' | 'activity' | 'milestone';
  completed: boolean;
}
