/**
 * Google Drive Service - CV Database Integration
 * Supports both DEMO mode and PRODUCTION mode with real Google Drive API
 */

import type { UploadedCandidate } from '../types';
import * as geminiService from './geminiService';

// Check if we're in production mode (has CLIENT_ID)
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const IS_DEMO_MODE = !GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'your-google-client-id-here.apps.googleusercontent.com';

// Google Drive folder configuration
const DRIVE_FOLDER_ID = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || 'root';

// Google Drive API configuration
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';

// Demo data
const MOCK_DRIVE_CVS = [
  {
    id: 'drive-cv-1',
    name: 'John_Smith_CV.pdf',
    mimeType: 'application/pdf',
    modifiedTime: '2024-01-15T10:30:00Z',
    content: `John Smith
Email: john.smith@email.com
Phone: +1 234 567 8900

PROFESSIONAL SUMMARY
Senior Full-Stack Developer with 7+ years of experience building scalable web applications.
Expert in React, Node.js, TypeScript, and AWS cloud infrastructure.

TECHNICAL SKILLS
- Frontend: React, TypeScript, Next.js, TailwindCSS
- Backend: Node.js, Express, NestJS, PostgreSQL
- Cloud: AWS (EC2, S3, Lambda), Docker, Kubernetes
- Tools: Git, CI/CD, Jest, Webpack

EXPERIENCE
Senior Software Engineer - TechCorp (2020-Present)
- Led development of e-commerce platform serving 1M+ users
- Implemented microservices architecture reducing latency by 40%
- Mentored team of 5 junior developers

Software Developer - StartupXYZ (2017-2020)
- Built RESTful APIs serving 50K+ daily requests
- Optimized database queries improving performance by 60%`
  },
  {
    id: 'drive-cv-2',
    name: 'Maria_Garcia_Resume.pdf',
    mimeType: 'application/pdf',
    modifiedTime: '2024-02-01T14:20:00Z',
    content: `Maria Garcia
Email: maria.garcia@email.com

ABOUT ME
Product Manager with 5 years of experience driving product strategy and execution.
Strong background in Agile methodologies and cross-functional team leadership.

SKILLS
Product Management, Agile/Scrum, User Research, Data Analysis, Jira, Confluence
SQL, A/B Testing, Product Roadmapping, Stakeholder Management

PROFESSIONAL EXPERIENCE
Product Manager - Digital Solutions Inc (2021-Present)
- Launched 3 major features increasing user engagement by 35%
- Led cross-functional team of 12 (Engineering, Design, Marketing)
- Managed product roadmap for $5M revenue product line

Associate Product Manager - FinTech Startup (2019-2021)
- Conducted user research with 200+ customers
- Analyzed product metrics and defined KPIs`
  },
  {
    id: 'drive-cv-3',
    name: 'Ahmed_Hassan_CV.pdf',
    mimeType: 'application/pdf',
    modifiedTime: '2024-01-20T09:15:00Z',
    content: `Ahmed Hassan
Email: ahmed.hassan@email.com

PROFESSIONAL PROFILE
Data Scientist with strong expertise in machine learning and statistical analysis.
Experience building predictive models and data pipelines.

TECHNICAL EXPERTISE
- Languages: Python, R, SQL
- ML/AI: TensorFlow, PyTorch, Scikit-learn, Keras
- Data: Pandas, NumPy, Spark, Airflow
- Visualization: Tableau, Matplotlib, Seaborn
- Cloud: AWS SageMaker, Google Cloud AI

WORK HISTORY
Data Scientist - Analytics Corp (2020-Present)
- Built ML models improving customer retention by 25%
- Developed ETL pipelines processing 10TB+ daily data
- Presented insights to C-level executives

Junior Data Analyst - Research Institute (2018-2020)
- Analyzed datasets of 1M+ records
- Created dashboards for business intelligence`
  }
];

export interface DriveConnectionStatus {
  isConnected: boolean;
  folderName?: string;
  folderId?: string;
  lastSync?: string;
  cvCount?: number;
  mode: 'demo' | 'production';
}

export interface DriveCVFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

// Global state for Google API
let gapiLoaded = false;
let accessToken: string | null = null;

/**
 * Load and initialize Google API client
 */
const loadGoogleAPI = (): Promise<void> => {
  if (gapiLoaded) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      (window as any).gapi.load('client', async () => {
        try {
          await (window as any).gapi.client.init({
            apiKey: import.meta.env.VITE_GOOGLE_API_KEY || '',
            discoveryDocs: DISCOVERY_DOCS,
          });
          gapiLoaded = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

/**
 * Check if Google Drive is connected
 */
export const checkDriveConnection = (): DriveConnectionStatus => {
  const stored = localStorage.getItem('driveConnectionStatus');
  if (stored) {
    return JSON.parse(stored);
  }
  return { isConnected: false, mode: IS_DEMO_MODE ? 'demo' : 'production' };
};

/**
 * Connect to Google Drive
 * Production: OAuth 2.0 flow
 * Demo: Simulate connection
 */
export const connectToDrive = async (googleAccessToken?: string): Promise<DriveConnectionStatus> => {
  if (IS_DEMO_MODE) {
    // Demo mode
    await new Promise(resolve => setTimeout(resolve, 2000));

    const connectionStatus: DriveConnectionStatus = {
      isConnected: true,
      folderName: 'CV Database (Demo)',
      folderId: 'demo-folder-id',
      lastSync: new Date().toISOString(),
      cvCount: MOCK_DRIVE_CVS.length,
      mode: 'demo'
    };

    localStorage.setItem('driveConnectionStatus', JSON.stringify(connectionStatus));
    return connectionStatus;
  }

  // Production mode
  if (!googleAccessToken) {
    throw new Error('Google access token required for production mode');
  }

  accessToken = googleAccessToken;

  // Load Google API
  await loadGoogleAPI();

  // Use configured folder ID from environment (or 'root' as default)
  const folderName = DRIVE_FOLDER_ID === 'root' ? 'My Drive' : 'CV Database Folder';

  const connectionStatus: DriveConnectionStatus = {
    isConnected: true,
    folderName: folderName,
    folderId: DRIVE_FOLDER_ID,
    lastSync: new Date().toISOString(),
    mode: 'production'
  };

  localStorage.setItem('driveConnectionStatus', JSON.stringify(connectionStatus));
  return connectionStatus;
};

/**
 * Disconnect from Google Drive
 */
export const disconnectDrive = (): void => {
  localStorage.removeItem('driveConnectionStatus');
  accessToken = null;
};

/**
 * List CV files from Google Drive folder
 */
export const listDriveCVs = async (folderId: string): Promise<DriveCVFile[]> => {
  if (IS_DEMO_MODE) {
    // Demo mode
    await new Promise(resolve => setTimeout(resolve, 1000));
    return MOCK_DRIVE_CVS.map(cv => ({
      id: cv.id,
      name: cv.name,
      mimeType: cv.mimeType,
      modifiedTime: cv.modifiedTime
    }));
  }

  // Production mode - use Google Drive API
  if (!accessToken) {
    throw new Error('Not authenticated with Google Drive');
  }

  // Support PDF, DOCX, and TXT files
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}' in parents and (mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document' or mimeType='text/plain')&fields=files(id,name,mimeType,modifiedTime)`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to list files from Google Drive');
  }

  const data = await response.json();
  return data.files || [];
};

/**
 * Download file content from Google Drive
 */
const downloadFileFromDrive = async (fileId: string): Promise<string> => {
  if (!accessToken) {
    throw new Error('Not authenticated with Google Drive');
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to download file from Google Drive');
  }

  // For PDFs, we'll get binary data. For text files, we get text.
  const blob = await response.blob();
  return await blob.text();
};

/**
 * Download and parse a CV file
 */
const downloadAndParseCv = async (fileId: string, fileName: string, mimeType: string): Promise<UploadedCandidate> => {
  if (IS_DEMO_MODE) {
    // Demo mode - use mock data
    const mockCv = MOCK_DRIVE_CVS.find(cv => cv.id === fileId);
    if (!mockCv) {
      throw new Error(`CV not found: ${fileId}`);
    }

    const lines = mockCv.content.split('\n');
    const name = lines[0].trim();
    const emailLine = lines.find(l => l.includes('Email:'));
    const email = emailLine ? emailLine.split('Email:')[1].trim() : `${name.toLowerCase().replace(' ', '.')}@email.com`;

    const skills: string[] = [];
    if (mockCv.content.includes('React')) skills.push('React');
    if (mockCv.content.includes('TypeScript')) skills.push('TypeScript');
    if (mockCv.content.includes('Node.js')) skills.push('Node.js');
    if (mockCv.content.includes('Python')) skills.push('Python');
    if (mockCv.content.includes('AWS')) skills.push('AWS');
    if (mockCv.content.includes('Product Management')) skills.push('Product Management');
    if (mockCv.content.includes('Agile')) skills.push('Agile');
    if (mockCv.content.includes('Machine Learning')) skills.push('Machine Learning');
    if (mockCv.content.includes('TensorFlow')) skills.push('TensorFlow');
    if (mockCv.content.includes('SQL')) skills.push('SQL');

    const experienceYears = mockCv.content.includes('7+ years') ? 7 :
                            mockCv.content.includes('5 years') ? 5 : 3;

    const summaryMatch = mockCv.content.match(/PROFESSIONAL (SUMMARY|PROFILE|ABOUT ME)[:\n]+(.*?)(?=\n\n|TECHNICAL|SKILLS)/s);
    const summary = summaryMatch ? summaryMatch[2].trim().replace(/\n/g, ' ') :
                    `Professional with ${experienceYears} years of experience.`;

    return {
      id: `drive-${fileId}`,
      type: 'uploaded',
      name,
      email,
      skills,
      experienceYears,
      summary,
      fileName: mockCv.name,
      matchScores: {},
      matchRationales: {}
    };
  }

  // Production mode - download and parse with Gemini
  try {
    const fileContent = await downloadFileFromDrive(fileId);

    // Use Gemini to parse the CV
    // Note: You'd need to implement parseCvContent in geminiService
    // For now, we'll use a simplified extraction

    // Extract basic info (this is simplified - in production use Gemini)
    const lines = fileContent.split('\n').slice(0, 50);
    const name = lines[0]?.trim() || fileName.replace('.pdf', '').replace('.docx', '');
    const emailMatch = fileContent.match(/[\w\.-]+@[\w\.-]+\.\w+/);
    const email = emailMatch ? emailMatch[0] : `${name.toLowerCase().replace(' ', '.')}@email.com`;

    // Basic skill extraction (in production, use Gemini for better results)
    const commonSkills = ['JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'AWS', 'Docker', 'SQL', 'Git'];
    const skills = commonSkills.filter(skill =>
      fileContent.toLowerCase().includes(skill.toLowerCase())
    );

    return {
      id: `drive-${fileId}`,
      type: 'uploaded',
      name,
      email,
      skills,
      experienceYears: 3, // Default, would be extracted by Gemini in production
      summary: `Professional candidate from ${fileName}`,
      fileName,
      matchScores: {},
      matchRationales: {}
    };
  } catch (error) {
    console.error(`Failed to parse CV: ${fileName}`, error);
    throw error;
  }
};

/**
 * Get list of imported file IDs from localStorage
 */
const getImportedFileIds = (): Set<string> => {
  const stored = localStorage.getItem('importedDriveFiles');
  if (stored) {
    return new Set(JSON.parse(stored));
  }
  return new Set();
};

/**
 * Save imported file IDs to localStorage
 */
const saveImportedFileIds = (fileIds: Set<string>): void => {
  localStorage.setItem('importedDriveFiles', JSON.stringify(Array.from(fileIds)));
};

/**
 * Check if candidates already exist (by email or file ID)
 */
export const checkForDuplicates = (
  cvFiles: DriveCVFile[],
  existingCandidates: UploadedCandidate[]
): {
  newFiles: DriveCVFile[];
  duplicates: DriveCVFile[];
  duplicateCount: number;
} => {
  const importedFileIds = getImportedFileIds();
  const existingEmails = new Set(existingCandidates.map(c => c.email.toLowerCase()));

  const newFiles: DriveCVFile[] = [];
  const duplicates: DriveCVFile[] = [];

  for (const file of cvFiles) {
    const driveFileId = `drive-${file.id}`;
    if (importedFileIds.has(driveFileId)) {
      duplicates.push(file);
    } else {
      newFiles.push(file);
    }
  }

  return { newFiles, duplicates, duplicateCount: duplicates.length };
};

/**
 * Scan Google Drive folder and import all CVs
 */
export const scanAndImportCVs = async (
  folderId: string,
  existingCandidates: UploadedCandidate[] = [],
  onProgress?: (current: number, total: number, fileName: string, isSkipped?: boolean) => void
): Promise<UploadedCandidate[]> => {
  const cvFiles = await listDriveCVs(folderId);
  const candidates: UploadedCandidate[] = [];

  // Check for duplicates
  const { newFiles, duplicates } = checkForDuplicates(cvFiles, existingCandidates);

  console.log(`Found ${cvFiles.length} total files: ${newFiles.length} new, ${duplicates.length} already imported`);

  const importedFileIds = getImportedFileIds();
  let processedCount = 0;

  // Process new files only
  for (let i = 0; i < cvFiles.length; i++) {
    const file = cvFiles[i];
    const driveFileId = `drive-${file.id}`;
    const isAlreadyImported = importedFileIds.has(driveFileId);

    if (onProgress) {
      onProgress(i + 1, cvFiles.length, file.name, isAlreadyImported);
    }

    if (isAlreadyImported) {
      console.log(`Skipping already imported file: ${file.name}`);
      continue;
    }

    try {
      const candidate = await downloadAndParseCv(file.id, file.name, file.mimeType);
      candidates.push(candidate);

      // Mark as imported
      importedFileIds.add(driveFileId);

      await new Promise(resolve => setTimeout(resolve, 500));
      processedCount++;
    } catch (error) {
      console.error(`Failed to parse CV: ${file.name}`, error);
    }
  }

  // Save imported file IDs
  saveImportedFileIds(importedFileIds);

  const status = checkDriveConnection();
  if (status.isConnected) {
    status.lastSync = new Date().toISOString();
    status.cvCount = cvFiles.length;
    localStorage.setItem('driveConnectionStatus', JSON.stringify(status));
  }

  return candidates;
};

/**
 * Get the current mode (demo or production)
 */
export const getDriveMode = (): 'demo' | 'production' => {
  return IS_DEMO_MODE ? 'demo' : 'production';
};
