# ATP Fraud Mapper 🚨

An intelligent financial fraud detection and investigation platform for law enforcement agencies. Visualize complex fraud networks, detect organized crime operations, and build prosecution-ready cases with complete digital evidence trails.

## 🎯 Overview

**ATP Fraud Mapper** combines advanced pattern recognition, network analysis, and transaction intelligence to help police departments:
- Map fraud ring connections across multiple accounts and institutions
- Identify money mules and fraudster networks in real-time
- Automate evidence collection for court proceedings
- Coordinate investigations across multiple agencies

## ✨ Key Features

### 🔍 Fraud Detection & Profiling
- **5 Fraud Pattern Types**: Romance scams, investment fraud, crypto schemes, lottery fraud, job offer schemes
- **Risk Scoring**: AI-driven 0-100 risk score based on account behavior, transaction velocity, and banking history
- **Mule Detection**: Automatically identifies pass-through accounts using 9 behavioral indicators
- **Real-time Analysis**: Processes thousands of accounts in seconds

### 📊 Network Intelligence
- **Transaction Graph Visualization**: See money flows and connections between accounts
- **Network Statistics**: Hubs, clusters, and key players in fraud rings
- **Layered Trail Detection**: Identify money laundering across multiple transaction layers
- **Counterparty Analysis**: Track incoming/outgoing connections and patterns

### 📋 Investigation Management
- **Audit Logs**: Complete chain of custody for every action (court-admissible)
- **Case Tracking**: Link related cases and suspects across investigations
- **Bulk Operations**: Freeze accounts, flag suspects, or export evidence in bulk
- **Timeline View**: Chronological transaction history with context

### 📈 Reporting & Export
- **Evidence Reports**: Risk assessments, transaction flows, and network diagrams
- **Bank Letters**: Generate formal bank communications for compliance
- **Data Import/Export**: Support for CSV imports and multiple export formats
- **Suspicious Pattern Reports**: Formatted findings for prosecution

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Data Processing**: CSV parsing, graph algorithms, pattern matching
- **UI Components**: React components with CSS styling
- **Analysis**: Network analysis, fraud pattern detection algorithms

## 📦 Project Structure

```
src/
├── components/              # React UI components
│   ├── Dashboard.tsx       # Main dashboard view
│   ├── TransactionGraph.tsx # Network visualization
│   ├── NetworkStats.tsx    # Statistics panel
│   ├── InvestigationTree.tsx # Case tree view
│   ├── SearchFilter.tsx    # Search and filtering
│   ├── SuspiciousPatternDetection.tsx # Pattern detection UI
│   ├── TimelineView.tsx    # Transaction timeline
│   ├── FreezeManager.tsx   # Account freeze operations
│   ├── BulkOperations.tsx  # Bulk action interface
│   ├── AuditLog.tsx        # Audit trail viewer
│   ├── VerifyModule.tsx    # Verification tools
│   ├── DataManagement.tsx  # Data import/export
│   ├── NotificationPanel.tsx # Alerts and notifications
│   └── ...other components
├── services/
│   └── dataService.ts      # Data loading and API calls
├── utils/
│   ├── fraudDetection.ts   # Account scoring & fraud detection
│   ├── riskProfiles.ts     # Fraud pattern definitions
│   ├── graphBuilder.ts     # Transaction graph construction
│   ├── networkAnalysis.ts  # Network statistics
│   ├── suspiciousPatterns.ts # Pattern matching
│   ├── aiInsights.ts       # AI-driven analysis
│   ├── auditTrail.ts       # Audit logging
│   ├── bankLetter.ts       # Bank communication generation
│   ├── caseReuseDetection.ts # Cross-case linking
│   ├── reportGenerator.ts  # Report generation
│   └── ...other utilities
├── types/
│   └── autoFreeze.ts       # TypeScript interfaces
├── App.tsx                 # Main app component
└── main.tsx               # Entry point

public/data/              # Sample datasets
sample_data/              # Additional sample data
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Pranay207/ATP-Fraud.git
   cd ATP-FRAUD-MAPPER-main
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

4. **Build for production**
   ```bash
   npm run build
   ```

## 📊 How Risk Calculation Works

### Account Risk Scoring
The system evaluates each account on 9 behavioral indicators:
- **Account Age** (+35 points if < 30 days old)
- **Pass-through Behavior** (+25 points if receives AND sends funds)
- **Bank Actions** (+35 points if frozen/restricted/under lien)
- **Investigation Status** (+20 points if marked suspicious)
- **Multiple Incoming Credits** (+20 points per additional sender)
- **High Exposure** (+15/10 points based on transaction amounts)
- **Rapid Withdrawals** (+30 points for high balance with large withdrawal)

**Final Score**: 0-100 (capped). Accounts scoring ≥70 are flagged as **mule accounts**.

### Fraud Profile Matching
5 predefined fraud profiles with pattern weights:
```
Risk = (Matched Pattern Weights / Total Pattern Weights) × 100 × Risk Multiplier
```
- Romance Scam (1.2x multiplier)
- Investment Fraud (1.3x multiplier)
- Lottery/Prize Fraud (1.15x multiplier)
- Job Offer Fraud (1.1x multiplier)
- Cryptocurrency Fraud (1.4x multiplier)

## 📥 Data Import

### Supported Formats
- **CSV files** with the following structures:

**accounts.csv**
```
AccountNumber, AccountHolder, CreationDate, CurrentBalance, LastWithdrawalAmount, AccountStatus
```

**transactions.csv**
```
TransactionID, SenderAccount, ReceiverAccount, Amount, Timestamp, Type, Status
```

**case_info.csv**
```
CaseID, CaseName, Description, Status, CreatedDate
```

### Sample Data
Pre-loaded sample datasets available in `sample_data/` directory for testing and demos.

## 🔐 Features for Law Enforcement

### Investigation Tools
- ✅ Real-time account risk assessment
- ✅ Fraud ring network visualization  
- ✅ Multi-agency case coordination
- ✅ Automated evidence extraction
- ✅ Chain of custody documentation

### Compliance & Legal
- ✅ Audit trails for all investigative actions
- ✅ Court-ready evidence reports
- ✅ GDPR/compliance-friendly data handling
- ✅ Secure case file management

### Performance
- ✅ Analyzes large datasets (100k+ transactions)
- ✅ Real-time filtering and searching
- ✅ Bulk operations on thousands of accounts
- ✅ Optimized network rendering

## 📈 Usage Workflow

1. **Import Data**: Load transaction and account CSV files
2. **Analyze**: System automatically calculates risk scores and detects patterns
3. **Visualize**: View fraud networks, timelines, and connections
4. **Investigate**: Search, filter, and drill down into specific cases
5. **Act**: Freeze accounts, flag suspects, or bulk export evidence
6. **Report**: Generate prosecution-ready reports with audit trails
7. **Collaborate**: Share case findings with partner agencies

## 🎓 Example Scenarios

### Scenario 1: Romance Scam Detection
- Account created last week ✓
- Multiple incoming transfers from different people ✓
- Quick withdrawal of all funds ✓
- **System flags**: HIGH RISK (Romance Scam Pattern)

### Scenario 2: Mule Network
- 10 accounts all created same week ✓
- All receive larger deposits, forward to same central account ✓
- Central account wires to crypto exchange ✓
- **System flags**: ORGANIZED CRIME NETWORK

## 🤝 Contributing

Contributions are welcome! Please:
1. Create a feature branch
2. Make your changes
3. Submit a pull request

## 📝 License

[Add appropriate license]

## 📞 Support & Contact

For questions or issues:
- 📧 Email: [team contact]
- 🐛 Report bugs on GitHub Issues
- 💬 Join our community discussions

---

**Built with ❤️ for law enforcement agencies to combat financial fraud**
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
