import React, { useState, useCallback } from 'react';
import type { UploadedCandidate } from '../../types';
import { X, UploadCloud, FileText, Loader2, CheckCircle } from 'lucide-react';
import { parseCvContent } from '../../services/geminiService';

interface UploadCvModalProps {
  onClose: () => void;
  onAddCandidates: (candidates: UploadedCandidate[]) => void;
}

type FileStatus = 'pending' | 'parsing' | 'success' | 'error';

interface UploadFile {
  file: File;
  status: FileStatus;
  result?: UploadedCandidate;
  error?: string;
}

const UploadCvModal: React.FC<UploadCvModalProps> = ({ onClose, onAddCandidates }) => {
  const [files, setFiles] = useState<UploadFile[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      // Fix: Use spread syntax for better type inference from FileList.
      const newFiles: UploadFile[] = [...event.target.files].map(file => ({ file, status: 'pending' }));
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleParse = useCallback(async () => {
    setFiles(currentFiles => currentFiles.map(f => f.status === 'pending' ? { ...f, status: 'parsing' } : f));

    const pendingFiles = files.filter(f => f.status === 'pending');
    
    for (const uploadFile of pendingFiles) {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const dataUrl = e.target?.result as string;
          if (dataUrl) {
            try {
              const [header, base64Data] = dataUrl.split(',');
              if (!base64Data) {
                throw new Error("Invalid file format");
              }
              const mimeType = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
              const parsedCandidate = await parseCvContent(base64Data, mimeType, uploadFile.file.name);
              setFiles(currentFiles => currentFiles.map(f => f.file.name === uploadFile.file.name ? { ...f, status: 'success', result: parsedCandidate } : f));
            } catch (error) {
               setFiles(currentFiles => currentFiles.map(f => f.file.name === uploadFile.file.name ? { ...f, status: 'error', error: 'AI parsing failed.' } : f));
            }
          } else {
             setFiles(currentFiles => currentFiles.map(f => f.file.name === uploadFile.file.name ? { ...f, status: 'error', error: 'Could not read file.' } : f));
          }
        };
        reader.onerror = () => {
             setFiles(currentFiles => currentFiles.map(f => f.file.name === uploadFile.file.name ? { ...f, status: 'error', error: 'File read error.' } : f));
        };
        reader.readAsDataURL(uploadFile.file);
      } catch (error) {
         setFiles(currentFiles => currentFiles.map(f => f.file.name === uploadFile.file.name ? { ...f, status: 'error', error: 'An unexpected error occurred.' } : f));
      }
    }
  }, [files]);
  
  const handleFinish = () => {
      const successfulCandidates = files.filter(f => f.status === 'success' && f.result).map(f => f.result!);
      if(successfulCandidates.length > 0) {
          onAddCandidates(successfulCandidates);
      }
      onClose();
  }

  const isParsing = files.some(f => f.status === 'parsing');
  const hasPending = files.some(f => f.status === 'pending');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-slate-800 shadow-2xl rounded-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-sky-400 flex items-center">
            <UploadCloud className="h-6 w-6 mr-2" /> Upload Candidate CVs
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200 transition-colors"><X size={24} /></button>
        </div>
        <div className="flex-grow overflow-y-auto custom-scrollbar pr-2 space-y-4">
          <div className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center">
            <input type="file" id="cv-upload" multiple onChange={handleFileChange} accept=".txt,.md,.pdf,.docx" className="hidden" />
            <label htmlFor="cv-upload" className="cursor-pointer text-sky-400 hover:text-sky-300 font-semibold">
              <UploadCloud className="h-12 w-12 mx-auto text-slate-500 mb-2" />
              Click to select files or drag and drop
              <p className="text-xs text-slate-400 mt-1">(Supports .txt, .md, .pdf, .docx)</p>
            </label>
          </div>
          {files.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-lg font-medium text-gray-300">Files to Process:</h4>
              {files.map((upload, index) => (
                <div key={index} className="flex items-center justify-between bg-slate-700/50 p-2 rounded-md">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 mr-3 text-slate-400" />
                    <span className="text-sm text-gray-200">{upload.file.name}</span>
                  </div>
                  <div>
                    {upload.status === 'pending' && <span className="text-xs text-yellow-400">Pending</span>}
                    {upload.status === 'parsing' && <Loader2 className="h-5 w-5 text-sky-400 animate-spin" />}
                    {upload.status === 'success' && <CheckCircle className="h-5 w-5 text-green-400" />}
                    {upload.status === 'error' && <span className="text-xs text-red-400">{upload.error}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end space-x-3 pt-4">
          <button onClick={handleFinish} className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 text-gray-200 font-medium transition-colors">
            {files.some(f => f.status === 'success') ? 'Add Parsed & Close' : 'Close'}
          </button>
          <button onClick={handleParse} disabled={!hasPending || isParsing} className="px-6 py-2 rounded-md bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold transition-all disabled:opacity-50">
            {isParsing ? 'Parsing...' : 'Parse CVs with AI'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadCvModal;