# Sample Data Files for ATP Fraud Mapper

This folder contains sample CSV files for testing the ATP Fraud Mapper application.

## Files Included

### 1. **accounts.csv**
Contains account holder information with 20 sample accounts.

**Columns:**
- `AccountNumber` - Unique account identifier (ACC001-ACC020)
- `AccountHolder` - Name of the account holder
- `EmailID` - Email address
- `Mobile` - Phone number (Indian format)
- `IPAddress` - Device IP address
- `BankName` - Associated bank name (HDFC, ICICI, Axis, SBI, etc.)
- `Location` - City/Location in India
- `CreationDate` - Account creation date
- `DeviceID` - Device identifier

### 2. **transactions.csv**
Contains 25 sample transactions between various accounts.

**Columns:**
- `TxID` - Unique transaction ID
- `SenderAccount` - Source account number
- `ReceiverAccount` - Destination account number
- `Amount` - Transaction amount in INR
- `Timestamp` - Date and time of transaction
- `Type` - Transfer type (NEFT, IMPS, RTGS)
- `UTR` - Unique Transaction Reference number
- `Status` - Transaction status (Success/Failed/Pending)

### 3. **case_info.csv**
Contains case information for fraud investigations.

**Columns:**
- `CaseID` - Unique case identifier
- `CaseName` - Name of the fraud case
- `Department` - Investigating department
- `Status` - Investigation status (Active/Closed/Under Review)
- `Amount` - Total amount involved in fraud
- `Description` - Case details
- `CreatedDate` - Case creation date

## How to Upload

1. Open the ATP Fraud Mapper application
2. Navigate to the "Data Management" tab
3. Select the data type you want to upload (Accounts or Transactions)
4. Click on the upload area or drag and drop the CSV file
5. The system will validate and import the data
6. Check the "Audit Trail" tab to see the import logs

## Data Notes

- All amounts are in Indian Rupees (₹)
- Phone numbers follow Indian format (10 digits)
- IP addresses are fictional for testing purposes
- Transaction dates are in August 2024 for consistency
- All bank names are actual Indian banks
- Locations are major Indian cities

## Fraud Detection Features

Once data is uploaded, the system will:
- Analyze transaction patterns
- Calculate risk scores for each account
- Detect potential fraud networks
- Generate audit logs for all operations
- Provide real-time notifications
- Create network analysis clusters
