export interface RiskProfile {
  id: string;
  name: string;
  description: string;
  patterns: FraudPattern[];
  riskMultiplier: number;
}

export interface FraudPattern {
  name: string;
  indicators: string[];
  weight: number;
}

export const RISK_PROFILES: RiskProfile[] = [
  {
    id: 'romance_scam',
    name: 'Romance Scam Network',
    description: 'Typical romance/matrimony fraud patterns',
    riskMultiplier: 1.2,
    patterns: [
      {
        name: 'Rapid Account Creation',
        indicators: ['Account created within 30 days', 'High login frequency'],
        weight: 0.3
      },
      {
        name: 'Quick Fund Transfer',
        indicators: ['Large deposits followed by immediate withdrawal', 'Multiple small transfers'],
        weight: 0.4
      },
      {
        name: 'Profile Inconsistency',
        indicators: ['KYC mismatch', 'Device location mismatch'],
        weight: 0.3
      }
    ]
  },
  {
    id: 'investment_fraud',
    name: 'Investment Scam',
    description: 'Fake investment scheme patterns',
    riskMultiplier: 1.3,
    patterns: [
      {
        name: 'High Volume Deposits',
        indicators: ['Multiple deposits from different sources', 'Amounts in multiples of 10k'],
        weight: 0.35
      },
      {
        name: 'Quick Consolidation',
        indicators: ['Funds consolidated and withdrawn same day', 'Multiple accounts involved'],
        weight: 0.4
      },
      {
        name: 'Limited Activity Window',
        indicators: ['Account active for short period', 'Sudden activity surge'],
        weight: 0.25
      }
    ]
  },
  {
    id: 'lottery_scam',
    name: 'Lottery/Prize Fraud',
    description: 'Lottery or prize winning fraud patterns',
    riskMultiplier: 1.15,
    patterns: [
      {
        name: 'Mule Account Traits',
        indicators: ['New account', 'No previous transaction history', 'Pass-through behavior'],
        weight: 0.35
      },
      {
        name: 'Quick Disbursement',
        indicators: ['Rapid fund disbursement', 'Small withdrawals to multiple recipients'],
        weight: 0.4
      },
      {
        name: 'Device Switching',
        indicators: ['Multiple devices accessing account', 'Foreign IP access'],
        weight: 0.25
      }
    ]
  },
  {
    id: 'job_scam',
    name: 'Job Offer Fraud',
    description: 'Fake job offer and advance payment fraud',
    riskMultiplier: 1.1,
    patterns: [
      {
        name: 'Advance Payment Extraction',
        indicators: ['Multiple small deposits', 'Immediate withdrawals', 'Frequent transfers out'],
        weight: 0.4
      },
      {
        name: 'Coordinated Network',
        indicators: ['Multiple accounts receiving same deposits', 'Linked via device/IP'],
        weight: 0.35
      },
      {
        name: 'International Movement',
        indicators: ['Foreign IP access', 'Multiple currency conversions'],
        weight: 0.25
      }
    ]
  },
  {
    id: 'crypto_fraud',
    name: 'Cryptocurrency Scam',
    description: 'Crypto pump & dump and fake exchange patterns',
    riskMultiplier: 1.4,
    patterns: [
      {
        name: 'Crypto Exchange Links',
        indicators: ['Transfers to crypto wallets', 'P2P exchanges', 'Large round amounts'],
        weight: 0.45
      },
      {
        name: 'High Velocity Transfers',
        indicators: ['Same-day large movements', 'Multiple transactions in hours'],
        weight: 0.35
      },
      {
        name: 'Network Fragmentation',
        indicators: ['Funds split across accounts', 'Multiple receiver patterns'],
        weight: 0.2
      }
    ]
  }
];

export const getProfileByType = (type: string): RiskProfile | undefined => {
  return RISK_PROFILES.find(p => p.id === type);
};

export const calculateProfileRisk = (profile: RiskProfile, indicators: string[]): number => {
  let totalWeight = 0;
  let matchedWeight = 0;

  profile.patterns.forEach(pattern => {
    totalWeight += pattern.weight;
    const hasMatch = pattern.indicators.some(ind =>
      indicators.some(indicator =>
        indicator.toLowerCase().includes(ind.toLowerCase())
      )
    );
    if (hasMatch) {
      matchedWeight += pattern.weight;
    }
  });

  return totalWeight > 0 ? (matchedWeight / totalWeight) * 100 * profile.riskMultiplier : 0;
};

export const suggestProfile = (reasons: string[], riskScore: number): RiskProfile | null => {
  if (riskScore < 60) return null;

  let bestProfile: RiskProfile | null = null;
  let bestScore = 0;
  const reasonText = reasons.join(' ').toLowerCase();

  RISK_PROFILES.forEach((profile) => {
    let matchScore = 0;

    profile.patterns.forEach(pattern => {
      pattern.indicators.forEach(indicator => {
        if (reasonText.includes(indicator.toLowerCase())) {
          matchScore += pattern.weight;
        }
      });
    });

    if (matchScore > bestScore) {
      bestScore = matchScore;
      bestProfile = profile;
    }
  });

  return bestScore > 0 ? bestProfile : null;
};
