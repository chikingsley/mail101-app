
export enum ProjectStatus {
  ESTIMATING = 'Estimating',
  ACTIVE = 'Active',
  COMPLETED = 'Completed',
  ARCHIVED = 'Archived'
}

export type ProjectStage = 'Lead' | 'Estimating' | 'Bid Sent' | 'Awarded' | 'Active' | 'Closeout';

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  role: string;
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  status: ProjectStatus;
  stage: ProjectStage;
  description: string;
  address?: string;
  
  // CRM / Monday.com style fields
  siteContact?: string;
  permitNumber?: string;
  budget?: string;
  startDate?: string;
  estimatedCompletion?: string;
  type: 'Commercial' | 'Residential' | 'Public Works';
}

export interface Email {
  id: string;
  sender: User;
  subject: string;
  preview: string;
  body: string;
  date: string; // Display date
  timestamp: number; // For sorting in timeline
  read: boolean;
  projectId?: string;
  tags: string[]; // e.g. "Bid", "RFI", "Change Order"
}

export type FileTag = 'Drawing' | 'Plan' | 'Estimate' | 'Contract' | 'Permit' | 'Photo';

export interface SharePointFile {
  id: string;
  name: string;
  type: 'folder' | 'pdf' | 'doc' | 'sheet' | 'image';
  projectId: string;
  lastModified: string;
  timestamp: number; // For sorting in timeline
  size?: string;
  tag: FileTag;
  uploadedBy: string;
}
