
import { Email, Project, ProjectStatus, User, SharePointFile } from './types';

export const CURRENT_USER: User = {
  id: 'u1',
  name: 'Alex Builder',
  email: 'alex@constructco.com',
  avatarUrl: 'https://picsum.photos/id/64/200/200',
  role: 'Senior Estimator'
};

export const MOCK_USERS: Record<string, User> = {
  'sarah': { id: 'sarah', name: 'Sarah Jenkins', email: 'sarah@archdesign.com', avatarUrl: 'https://picsum.photos/id/65/200/200', role: 'Lead Architect' },
  'mike': { id: 'mike', name: 'Mike Ross', email: 'mike@cityplanning.gov', avatarUrl: 'https://picsum.photos/id/91/200/200', role: 'Permit Officer' },
  'jess': { id: 'jess', name: 'Jessica Pearson', email: 'jessica@pearsondev.com', avatarUrl: 'https://picsum.photos/id/103/200/200', role: 'Developer' },
  'tom': { id: 'tom', name: 'Tom Haverford', email: 'tom@subcontract.com', avatarUrl: 'https://picsum.photos/id/100/200/200', role: 'HVAC Sub' },
};

export const MOCK_PROJECTS: Project[] = [
  { 
    id: 'p1', 
    name: 'Skyline Tower Renov', 
    clientName: 'Pearson Dev', 
    status: ProjectStatus.ACTIVE, 
    stage: 'Active', 
    address: '4500 5th Ave, Seattle, WA', 
    description: 'Lobby renovation and HVAC retrofit.',
    siteContact: 'Gary Busey',
    permitNumber: 'SEA-2023-9982',
    budget: '$1.2M',
    startDate: '2023-09-01',
    estimatedCompletion: '2024-03-15',
    type: 'Commercial'
  },
  { 
    id: 'p2', 
    name: 'Riverfront Park Commons', 
    clientName: 'City Council', 
    status: ProjectStatus.ESTIMATING, 
    stage: 'Bid Sent', 
    address: '102 River Rd, Austin, TX', 
    description: 'Landscape architecture and pavilion construction.',
    siteContact: 'Leslie Knope',
    permitNumber: 'PENDING',
    budget: '$450k',
    startDate: 'TBD',
    type: 'Public Works'
  },
  { 
    id: 'p3', 
    name: 'TechHub HQ', 
    clientName: 'StartUp Inc', 
    status: ProjectStatus.ESTIMATING, 
    stage: 'Estimating', 
    address: '1200 Innovation Dr, SF, CA', 
    description: 'Interior fit-out for 3 floors.',
    siteContact: 'Erlich Bachman',
    budget: '$2.5M',
    type: 'Commercial'
  },
  { 
    id: 'p4', 
    name: 'Miller Residence', 
    clientName: 'Private', 
    status: ProjectStatus.ACTIVE, 
    stage: 'Closeout', 
    address: '882 Pine St, Portland, OR', 
    description: 'Full home remodel.',
    siteContact: 'Kenny Miller',
    permitNumber: 'POR-9921',
    budget: '$800k',
    type: 'Residential'
  },
];

export const MOCK_EMAILS: Email[] = [
  {
    id: 'e1',
    sender: MOCK_USERS['sarah'],
    subject: 'Revised Structural Drawings',
    preview: 'Attached are the updated A301 and A302 drawings per the RFI.',
    body: `Hi Alex,

Please find attached the revised structural drawings (A301, A302) addressing the beam issue in the lobby.

Let me know if this impacts the estimate.

Best,
Sarah`,
    date: '10:30 AM',
    timestamp: 1698143400000,
    read: false,
    projectId: 'p1',
    tags: ['Drawings', 'RFI']
  },
  {
    id: 'e2',
    sender: MOCK_USERS['mike'],
    subject: 'Permit Status Update: SEA-2023-9982',
    preview: 'We need one more document regarding fire safety compliance.',
    body: `Alex,

Regarding permit #SEA-2023-9982 for the Skyline Tower. 

We are missing the updated fire safety compliance form. Please submit this via the portal so we can clear the hold.

Thanks,
Mike`,
    date: 'Yesterday',
    timestamp: 1698057000000,
    read: true,
    projectId: 'p1',
    tags: ['Permit', 'Urgent']
  },
  {
    id: 'e3',
    sender: MOCK_USERS['tom'],
    subject: 'HVAC Bid for Riverfront',
    preview: 'Here is our revised number for the pavilion HVAC.',
    body: `Hey team,

Revised bid attached. We managed to get the equipment costs down by switching suppliers.

Total is now $42,500.

Tom`,
    date: '2 days ago',
    timestamp: 1697970600000,
    read: true,
    projectId: 'p2',
    tags: ['Bid', 'Subcontractor']
  },
  {
    id: 'e4',
    sender: MOCK_USERS['jess'],
    subject: 'RFP: New Warehouse Project',
    preview: 'Would you guys be interested in bidding on this?',
    body: `Hi Alex,

We just acquired a site in Jersey. Sending over the RFP. Let me know if you have capacity for an estimate this month.`,
    date: '3 days ago',
    timestamp: 1697884200000,
    read: true,
    tags: ['Lead']
  }
];

export const MOCK_FILES: SharePointFile[] = [
  { id: 'f1', name: 'A301_Structural_Rev2.pdf', type: 'pdf', projectId: 'p1', lastModified: 'Oct 24, 2023', timestamp: 1698144000000, size: '4.2 MB', tag: 'Drawing', uploadedBy: 'Sarah Jenkins' },
  { id: 'f2', name: 'Skyline_Estimate_v4.xlsx', type: 'sheet', projectId: 'p1', lastModified: 'Oct 20, 2023', timestamp: 1697798400000, size: '145 KB', tag: 'Estimate', uploadedBy: 'Alex Builder' },
  { id: 'f3', name: 'Permit_App_SEA.pdf', type: 'pdf', projectId: 'p1', lastModified: 'Oct 15, 2023', timestamp: 1697366400000, size: '2.1 MB', tag: 'Permit', uploadedBy: 'Alex Builder' },
  { id: 'f4', name: 'Riverfront_Site_Plan.pdf', type: 'image', projectId: 'p2', lastModified: 'Oct 23, 2023', timestamp: 1698057600000, size: '12 MB', tag: 'Plan', uploadedBy: 'City Council' },
  { id: 'f5', name: 'Sub_HVAC_Quote.pdf', type: 'pdf', projectId: 'p2', lastModified: 'Oct 22, 2023', timestamp: 1697971200000, size: '450 KB', tag: 'Estimate', uploadedBy: 'Tom H.' },
];
