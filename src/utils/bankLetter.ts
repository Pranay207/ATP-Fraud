import type { CaseInfo } from '../services/dataService';
import type { ScoredAccount } from './fraudDetection';

const createPdf = async () => {
  const { default: jsPDF } = await import('jspdf');
  return new jsPDF();
};

export const generateBankLetter = async (account: ScoredAccount, caseInfo: CaseInfo | null) => {
  const doc = await createPdf();
  const complaintId = caseInfo?.ComplaintID || 'CASE-NOT-SET';

  doc.setFontSize(14);
  doc.text('Police Request Letter To Bank', 14, 18);

  doc.setFontSize(11);
  doc.text(`Complaint ID: ${complaintId}`, 14, 30);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 14, 37);

  const bodyLines = [
    `To, The Branch Manager / Nodal Officer, ${account.BankName}`,
    '',
    'Subject: Request for account verification / hold action / beneficiary trace',
    '',
    `The following account has been marked as suspicious during fraud investigation linked to complaint ${complaintId}.`,
    '',
    `Account Holder: ${account.AccountHolder}`,
    `Account Number / ID: ${account.AccountNumber}`,
    `Mobile: ${account.Mobile || 'Not available'}`,
    `Email: ${account.EmailID || 'Not available'}`,
    `KYC ID: ${account.KYCID || 'Not available'}`,
    `Location: ${account.Location || 'Not available'}`,
    `Risk Score: ${account.riskScore.toFixed(0)}/100`,
    '',
    'Requested actions:',
    '1. Confirm account holder and KYC details.',
    '2. Confirm whether disputed funds are present / held / withdrawn.',
    '3. Provide linked UPI / wallet / device / branch details if available.',
    '4. Preserve statement trail and freeze / lien status details for police follow-up.',
    '',
    'Issued for immediate investigation support.'
  ];

  let y = 50;
  bodyLines.forEach((line) => {
    doc.text(line, 14, y);
    y += line === '' ? 6 : 7;
  });

  doc.save(`bank_letter_${account.AccountNumber}_${complaintId}.pdf`);
};

export const generateInnocentNotice = async (account: ScoredAccount, caseInfo: CaseInfo | null) => {
  const doc = await createPdf();
  const complaintId = caseInfo?.ComplaintID || 'CASE-NOT-SET';

  doc.setFontSize(16);
  doc.text('Anantapur Police Cyber Crime Cell', 105, 20, { align: 'center' });

  doc.setFontSize(13);
  doc.text('NOTICE - CLEARANCE CERTIFICATE', 105, 30, { align: 'center' });

  doc.setFontSize(11);
  doc.text(`Complaint ID: ${complaintId}`, 14, 45);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 14, 52);

  const bodyLines = [
    `To: ${account.AccountHolder}`,
    `Account Number: ${account.AccountNumber}`,
    `Bank: ${account.BankName}`,
    `Mobile: ${account.Mobile || 'Not available'}`,
    `Email: ${account.EmailID || 'Not available'}`,
    '',
    'SUBJECT: CLEARANCE NOTICE - ACCOUNT VERIFIED AS LEGITIMATE',
    '',
    `This is to certify that following our investigation into complaint ${complaintId},`,
    `your account (${account.AccountNumber}) has been verified and cleared.`,
    '',
    'Our analysis confirms that:',
    '- Your account is NOT involved in fraudulent activities',
    '- Your account has been marked as LEGITIMATE (High legitimacy score)',
    '- No coercive action is required on your account',
    '- Your account is safe to use normally',
    '',
    'Actions taken:',
    '- Account added to whitelist',
    '- Any temporary restrictions have been lifted',
    '- You may resume normal banking operations',
    '',
    'For any queries or clarifications, you may contact:',
    'Anantapur Police Cyber Crime Cell',
    `Investigation Reference: ${complaintId}`,
    '',
    'This clearance is valid and transferable for all banking operations.',
    'Issued under authority of Anantapur Police Department.'
  ];

  let y = 65;
  bodyLines.forEach((line) => {
    if (line === '') {
      y += 4;
    } else {
      doc.text(line, 14, y);
      y += 6;
    }
  });

  doc.save(`innocent_clearance_${account.AccountNumber}_${complaintId}.pdf`);
};
