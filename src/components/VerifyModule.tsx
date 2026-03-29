import React from 'react';
import type { ScoredAccount } from '../utils/fraudDetection';
import { Users, UploadCloud, Download } from 'lucide-react';

interface VerifyModuleProps {
  accounts: ScoredAccount[];
}

const createPdf = async () => {
  const { default: jsPDF } = await import('jspdf');
  return new jsPDF();
};

const VerifyModule: React.FC<VerifyModuleProps> = ({ accounts }) => {
  const innocent = accounts.filter((account) => account.legitimacyScore > 70 && account.riskScore < 50);

  const generateLetter = async (account: ScoredAccount) => {
    const doc = await createPdf();
    doc.setFontSize(14);
    doc.text('Anantapur Police Cyber Crime Cell', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('Notice Regarding Account Freeze (Letter of Inquiry)', 105, 30, { align: 'center' });

    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 14, 45);
    doc.text(`To: ${account.AccountHolder}`, 14, 55);
    doc.text(`Account No: ${account.AccountNumber} (${account.BankName})`, 14, 62);

    const textBody = `Dear Account Holder,

Your bank account limit has been partially frozen due to a suspected
fraudulent transaction chain linked to this account.
If you believe this is an error and you are a legitimate recipient of these funds,
please approach the Anantapur Cyber Crime Cell immediately.

Please bring the following for verification:
1. Original ID Proof (Aadhaar/PAN)
2. Proof of business transaction (Invoice, bill, etc.)
3. Last 3 months bank statement

This document serves as an official notice from Anantapur Police.`;

    const splitText = doc.splitTextToSize(textBody, 180);
    doc.text(splitText, 14, 75);
    doc.save(`Verification_Notice_${account.AccountNumber}.pdf`);
  };

  return (
    <div className="card glass-panel h-full" style={{ minHeight: '600px' }}>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', marginTop: 0 }}>
        <Users className="text-primary" /> Innocent Verification Module
      </h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        These accounts have high legitimacy scores. Generate official letters and verify their documents before taking any full freeze action.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {innocent.map((account) => (
          <div key={account.AccountNumber} style={{ background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem' }}>{account.AccountHolder}</h4>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  {account.BankName} - {account.AccountNumber} | Balance: Rs. {(account.CurrentBalance || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-outline" style={{ fontSize: '0.75rem' }} onClick={() => void generateLetter(account)}>
                  <Download size={14} /> Gen Notice
                </button>
                <button className="btn btn-primary" style={{ fontSize: '0.75rem' }} onClick={() => alert('Simulating invoice upload check...')}>
                  <UploadCloud size={14} /> Upload Invoice
                </button>
              </div>
            </div>
          </div>
        ))}
        {innocent.length === 0 && <div style={{ color: 'var(--text-muted)' }}>No legitimate priority accounts currently flagged.</div>}
      </div>
    </div>
  );
};

export default VerifyModule;
