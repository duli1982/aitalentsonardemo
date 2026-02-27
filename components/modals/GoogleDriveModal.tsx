import React, { useState, useEffect } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import type { UploadedCandidate } from '../../types';
import { X, Cloud, FolderOpen, RefreshCw, CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react';
import * as driveService from '../../services/googleDriveService';
import { TIMING } from '../../config/timing';

interface GoogleDriveModalProps {
  onClose: () => void;
  onImportCandidates: (candidates: UploadedCandidate[]) => void;
  existingCandidates?: UploadedCandidate[];
}

type ScanStatus = 'idle' | 'connecting' | 'scanning' | 'complete' | 'error';

const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({ onClose, onImportCandidates, existingCandidates = [] }) => {
  const [connectionStatus, setConnectionStatus] = useState(driveService.checkDriveConnection());
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0, fileName: '', isSkipped: false });
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const driveMode = driveService.getDriveMode();

  useEffect(() => {
    // Check connection status on mount
    setConnectionStatus(driveService.checkDriveConnection());
  }, []);

  // Google OAuth login hook for production mode
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setScanStatus('connecting');
      setError(null);

      try {
        const status = await driveService.connectToDrive(tokenResponse.access_token);
        setConnectionStatus(status);
        setScanStatus('idle');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to Google Drive');
        setScanStatus('error');
      }
    },
    onError: () => {
      setError('Failed to authenticate with Google');
      setScanStatus('error');
    },
    scope: 'https://www.googleapis.com/auth/drive.readonly'
  });

  const handleConnect = async () => {
    setScanStatus('connecting');
    setError(null);

    try {
      if (driveMode === 'production') {
        // Trigger OAuth login
        googleLogin();
      } else {
        // Demo mode - direct connection
        const status = await driveService.connectToDrive();
        setConnectionStatus(status);
        setScanStatus('idle');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to Google Drive');
      setScanStatus('error');
    }
  };

  const handleDisconnect = () => {
    driveService.disconnectDrive();
    setConnectionStatus({ isConnected: false, mode: driveMode });
    setScanStatus('idle');
    setImportedCount(0);
  };

  const handleScanAndImport = async () => {
    if (!connectionStatus.folderId) return;

    setScanStatus('scanning');
    setError(null);
    setImportedCount(0);
    setSkippedCount(0);

    try {
      const candidates = await driveService.scanAndImportCVs(
        connectionStatus.folderId,
        existingCandidates,
        (current, total, fileName, isSkipped = false) => {
          setScanProgress({ current, total, fileName, isSkipped });
          if (isSkipped) {
            setSkippedCount(prev => prev + 1);
          }
        }
      );

      setImportedCount(candidates.length);
      setScanStatus('complete');

      // Import candidates into the app (only if there are new ones)
      if (candidates.length > 0) {
        onImportCandidates(candidates);
      }

      // Auto-close after 3 seconds (increased to show duplicate info)
      setTimeout(() => {
        onClose();
      }, TIMING.GOOGLE_DRIVE_MODAL_CLOSE_DELAY_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scan Google Drive folder');
      setScanStatus('error');
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-slate-800 shadow-2xl rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-700">
          <div>
            <h3 className="text-xl font-semibold text-sky-400 flex items-center">
              <Cloud className="h-6 w-6 mr-2" />
              Google Drive CV Database
            </h3>
            <p className="text-sm text-gray-400 mt-1">
              Connect to automatically scan and import CVs from Google Drive
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
            aria-label="Close modal"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Connection Status */}
          {!connectionStatus.isConnected ? (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-blue-900/30 to-sky-900/30 border border-blue-500/30 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="bg-sky-500/20 p-3 rounded-full">
                    <Cloud className="h-6 w-6 text-sky-400" />
                  </div>
                  <div className="flex-grow">
                    <h4 className="text-lg font-semibold text-sky-300 mb-2">Connect Your CV Database</h4>
                    <p className="text-sm text-gray-300 mb-4">
                      Connect to Google Drive to automatically scan and import candidate CVs.
                      The system will parse each CV using AI and add candidates to your talent pool.
                    </p>
                    <ul className="text-xs text-gray-400 space-y-1 mb-4">
                      <li>• CVs are parsed automatically using AI</li>
                      <li>• Candidates are matched against open jobs instantly</li>
                      <li>• Only PDF and DOCX files are processed</li>
                      <li>• Secure read-only access to your Drive folder</li>
                    </ul>
                  </div>
                </div>
              </div>

              {scanStatus === 'connecting' && (
                <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4 flex items-center">
                  <Loader2 className="h-5 w-5 mr-3 animate-spin text-blue-400" />
                  <span className="text-blue-300 text-sm">Connecting to Google Drive...</span>
                </div>
              )}

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center">
                  <AlertCircle className="h-5 w-5 mr-3 text-red-400 flex-shrink-0" />
                  <span className="text-red-300 text-sm">{error}</span>
                </div>
              )}

              {driveMode === 'demo' && (
                <div className="bg-slate-700/40 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-yellow-300 mb-2 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Demo Mode
                  </h4>
                  <p className="text-xs text-gray-400">
                    This is a demonstration with simulated Google Drive integration.
                    To enable real Google Drive access, add your VITE_GOOGLE_CLIENT_ID to the .env file.
                  </p>
                </div>
              )}

              {driveMode === 'production' && (
                <div className="bg-slate-700/40 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-green-300 mb-2 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Production Mode
                  </h4>
                  <p className="text-xs text-gray-400 mb-2">
                    Real Google Drive integration is enabled. Click "Connect to Drive" to authenticate with your Google account.
                  </p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• You'll be asked to sign in with Google</li>
                    <li>• Grant read-only access to your Drive files</li>
                    <li>• Select or confirm the folder containing CVs</li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Connected Status */}
              <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-500/20 p-2 rounded-full">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-green-300">Connected to Google Drive</h4>
                      <p className="text-xs text-gray-400">Folder: {connectionStatus.folderName}</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">CVs Found</p>
                    <p className="text-gray-200 font-semibold">{connectionStatus.cvCount || 0}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Last Synced</p>
                    <p className="text-gray-200 font-semibold">{formatDate(connectionStatus.lastSync)}</p>
                  </div>
                </div>
              </div>

              {/* Scanning Progress */}
              {scanStatus === 'scanning' && (
                <div className="bg-purple-500/20 border border-purple-500/50 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <Loader2 className="h-5 w-5 mr-2 animate-spin text-purple-400" />
                    <span className="text-purple-300 text-sm font-semibold">
                      Scanning CVs... ({scanProgress.current} of {scanProgress.total})
                    </span>
                  </div>
                  <div className="mb-2">
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center text-gray-400">
                      <FileText className="h-3 w-3 mr-1" />
                      <span className="truncate max-w-xs">{scanProgress.fileName}</span>
                    </div>
                    {scanProgress.isSkipped && (
                      <span className="text-yellow-400 text-xs ml-2">(already imported)</span>
                    )}
                  </div>
                  {skippedCount > 0 && (
                    <div className="mt-2 text-xs text-yellow-300">
                      Skipped {skippedCount} already imported file{skippedCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              )}

              {/* Success Message */}
              {scanStatus === 'complete' && (
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <CheckCircle className="h-5 w-5 mr-3 text-green-400" />
                    <div>
                      <p className="text-green-300 text-sm font-semibold">
                        {importedCount > 0
                          ? `Successfully imported ${importedCount} new candidate${importedCount !== 1 ? 's' : ''}!`
                          : 'Scan complete!'
                        }
                      </p>
                      <p className="text-gray-400 text-xs">
                        {importedCount > 0
                          ? 'They are now available in your talent pool'
                          : 'No new candidates to import'
                        }
                      </p>
                    </div>
                  </div>
                  {skippedCount > 0 && (
                    <div className="mt-2 pl-8 text-xs text-yellow-300">
                      Skipped {skippedCount} file{skippedCount !== 1 ? 's' : ''} (already imported)
                    </div>
                  )}
                </div>
              )}

              {/* Error Message */}
              {error && scanStatus === 'error' && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 flex items-center">
                  <AlertCircle className="h-5 w-5 mr-3 text-red-400 flex-shrink-0" />
                  <span className="text-red-300 text-sm">{error}</span>
                </div>
              )}

              {/* Available CVs */}
              {scanStatus === 'idle' && connectionStatus.cvCount && connectionStatus.cvCount > 0 && (
                <div className="bg-slate-700/40 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-sky-300 flex items-center">
                      <FolderOpen className="h-4 w-4 mr-2" />
                      Available CVs in Folder
                    </h4>
                    <span className="text-sky-400 font-bold">{connectionStatus.cvCount}</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    Click "Scan & Import CVs" to parse these files and add candidates to your pool.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-6 flex justify-between">
          <div>
            {connectionStatus.isConnected && scanStatus === 'idle' && (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300 font-medium transition-colors text-sm"
              >
                Disconnect
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-slate-600 hover:bg-slate-500 text-gray-200 font-medium transition-colors"
            >
              {scanStatus === 'complete' ? 'Done' : 'Cancel'}
            </button>
            {!connectionStatus.isConnected ? (
              <button
                onClick={handleConnect}
                disabled={scanStatus === 'connecting'}
                className="px-6 py-2 rounded-md bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {scanStatus === 'connecting' ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Cloud size={18} />
                    Connect to Drive
                  </>
                )}
              </button>
            ) : (
              scanStatus === 'idle' && (
                <button
                  onClick={handleScanAndImport}
                  className="px-6 py-2 rounded-md bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold transition-all flex items-center gap-2"
                >
                  <RefreshCw size={18} />
                  Scan & Import CVs
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoogleDriveModal;
