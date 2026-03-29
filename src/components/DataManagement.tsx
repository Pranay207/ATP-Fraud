import React, { useState } from 'react';
import { Upload, Download, RefreshCw, AlertCircle, FileArchive, FileText } from 'lucide-react';
import { clearImportedData, importInvestigationFiles } from '../services/dataService';
import type { InvestigationData } from '../services/dataService';
import { downloadTemplate } from '../utils/dataImporter';
import { notificationManager } from '../utils/notificationManager';
import { auditTrail } from '../utils/auditTrail';

interface DataManagementProps {
  onDataImported?: (data: InvestigationData) => void;
  onResetToBundled?: () => void;
}

const DataManagement: React.FC<DataManagementProps> = ({ onDataImported, onResetToBundled }) => {
  const [uploading, setUploading] = useState(false);

  const resetInput = (input?: HTMLInputElement | null) => {
    if (input) {
      input.value = '';
    }
  };

  const handleFileImport = async (files: File[], input?: HTMLInputElement | null) => {
    if (!files.length) {
      notificationManager.add({
        type: 'alert',
        title: 'No Files',
        message: 'Select at least one CSV, XLSX, or PDF file'
      });
      resetInput(input);
      return;
    }

    const supportedFiles = files.filter((file) => /\.(csv|xlsx|pdf)$/i.test(file.name));
    const hasTrailFile = supportedFiles.some((file) => /\.(csv|xlsx)$/i.test(file.name));

    if (!hasTrailFile) {
      notificationManager.add({
        type: 'alert',
        title: 'Missing Dataset',
        message: 'Include at least one bank-action CSV or XLSX file'
      });
      resetInput(input);
      return;
    }

    setUploading(true);
    try {
      const dataset = await importInvestigationFiles(supportedFiles);

      notificationManager.add({
        type: 'success',
        title: 'Dataset Imported',
        message: `${dataset.transactions.length} transactions and ${dataset.accounts.length} accounts loaded`
      });

      auditTrail.log(
        'upload',
        supportedFiles.map((file) => file.name).join(', '),
        `${dataset.transactions.length} transactions imported into live portal`
      );

      onDataImported?.(dataset);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error).substring(0, 100);
      notificationManager.add({
        type: 'alert',
        title: 'Import Error',
        message: errorMsg || 'An error occurred during import'
      });
      auditTrail.log('upload', files.map((file) => file.name).join(', '), `Error: ${errorMsg}`, 'failed');
      console.error('Import error', error);
    } finally {
      setUploading(false);
      resetInput(input);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const files = Array.from(input.files || []);

    if (!files.length) {
      resetInput(input);
      notificationManager.add({
        type: 'alert',
        title: 'No File',
        message: 'Please select one or more files to upload'
      });
      return;
    }

    await handleFileImport(files, input);
  };

  const handleDownloadTemplate = () => {
    try {
      downloadTemplate('accounts');
      notificationManager.add({
        type: 'success',
        title: 'Template Downloaded',
        message: 'Bank-action dataset template download started'
      });
      auditTrail.log('export', 'dataset_template', 'Template downloaded');
    } catch (error) {
      notificationManager.add({
        type: 'alert',
        title: 'Download Failed',
        message: 'Could not download template'
      });
      auditTrail.log('export', 'dataset_template', 'Download failed', 'failed');
      console.error('Template download failed', error);
    }
  };

  return (
    <div className="card glass-panel">
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Upload size={18} color="var(--primary)" /> Data Management
      </h3>

      <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '1rem', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.3)', marginBottom: '1.5rem', display: 'flex', gap: '0.5rem' }}>
        <AlertCircle size={16} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.125rem' }} />
        <div style={{ fontSize: '0.85rem', color: 'var(--text-main)' }}>
          Upload the bank-action dataset bundle directly. Supported inputs: full trail workbook (`.xlsx`), individual trail CSVs, and optional case PDF evidence.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { icon: <FileArchive size={16} color="var(--primary)" />, title: 'Workbook Import', desc: 'Accepts full `.xlsx` complete trail files' },
          { icon: <Upload size={16} color="var(--primary)" />, title: 'CSV Trail Import', desc: 'Accepts one or more bank-action trail `.csv` files' },
          { icon: <FileText size={16} color="var(--primary)" />, title: 'Case PDF Support', desc: 'Uses attached complaint PDF as case metadata evidence' }
        ].map((item) => (
          <div
            key={item.title}
            style={{
              padding: '1rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'rgba(6, 182, 212, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>{item.icon}{item.title}</div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.desc}</span>
          </div>
        ))}
      </div>

      <label
        style={{
          display: 'block',
          padding: '2rem',
          borderRadius: '8px',
          border: '2px dashed var(--primary)',
          background: 'rgba(6, 182, 212, 0.05)',
          cursor: 'pointer',
          textAlign: 'center',
          marginBottom: '1rem',
          transition: 'all 0.2s'
        }}
        onDragOver={e => {
          e.preventDefault();
          e.currentTarget.style.background = 'rgba(6, 182, 212, 0.15)';
        }}
        onDragLeave={e => {
          e.currentTarget.style.background = 'rgba(6, 182, 212, 0.05)';
        }}
        onDrop={e => {
          e.preventDefault();
          e.currentTarget.style.background = 'rgba(6, 182, 212, 0.05)';
          const droppedFiles = Array.from(e.dataTransfer.files || []);
          const input = e.currentTarget.querySelector('input[type="file"]');
          if (droppedFiles.length && input instanceof HTMLInputElement) {
            void handleFileImport(droppedFiles, input);
          }
        }}
      >
        <input
          type="file"
          accept=".csv,.xlsx,.pdf"
          multiple
          onChange={handleFileUpload}
          disabled={uploading}
          style={{ display: 'none' }}
        />
        <Upload size={24} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
        <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>
          {uploading ? 'Importing dataset...' : 'Drag dataset files here or click to select'}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Use `.xlsx` or `.csv` for the trail, and optionally include the complaint `.pdf`
        </div>
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
        <button
          onClick={handleDownloadTemplate}
          className="btn btn-outline"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <Download size={14} /> Template
        </button>
        <button
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          onClick={() => {
            const input = document.querySelector('input[type="file"]') as HTMLInputElement;
            input?.click();
          }}
        >
          <RefreshCw size={14} /> Import Bundle
        </button>
        <button
          className="btn btn-outline"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          onClick={() => {
            clearImportedData();
            auditTrail.log('upload', 'bundled_dataset', 'Reverted to bundled attached dataset');
            notificationManager.add({
              type: 'info',
              title: 'Bundled Dataset Restored',
              message: 'Portal reverted to the attached default dataset bundle'
            });
            onResetToBundled?.();
          }}
        >
          <FileArchive size={14} /> Use Bundled
        </button>
      </div>

      <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
        Last updated: {new Date().toLocaleDateString()}
      </div>
    </div>
  );
};

export default DataManagement;
