
import React, { useState, useEffect } from 'react';
import { Email, Project, SharePointFile } from '../types';
import { MOCK_PROJECTS, MOCK_FILES, MOCK_EMAILS } from '../constants';
import { analyzeEmailContent } from '../services/geminiService';

interface ContextPanelProps {
  email: Email | null;
  sender: any;
}

type ViewTab = 'history' | 'data' | 'files';

const ContextPanel: React.FC<ContextPanelProps> = ({ email }) => {
  const [activeTab, setActiveTab] = useState<ViewTab>('history');
  const [project, setProject] = useState<Project | null>(null);
  const [timelineItems, setTimelineItems] = useState<any[]>([]);
  const [projectFiles, setProjectFiles] = useState<SharePointFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiData, setAiData] = useState<any>(null);

  useEffect(() => {
    if (email && email.projectId) {
      const proj = MOCK_PROJECTS.find(p => p.id === email.projectId) || null;
      setProject(proj);
    } else {
      setProject(null);
    }
    setAiData(null);
  }, [email]);

  useEffect(() => {
    if (project) {
      // 1. Build Timeline (Emails + Files)
      const relatedEmails = MOCK_EMAILS.filter(e => e.projectId === project.id);
      const relatedFiles = MOCK_FILES.filter(f => f.projectId === project.id);
      
      const timeline = [
        ...relatedEmails.map(e => ({ ...e, itemType: 'email' })),
        ...relatedFiles.map(f => ({ ...f, itemType: 'file' }))
      ].sort((a, b) => b.timestamp - a.timestamp);

      setTimelineItems(timeline);
      setProjectFiles(relatedFiles);
    } else {
        setTimelineItems([]);
        setProjectFiles([]);
    }
  }, [project]);

  const handleAnalyze = async () => {
    if (!email) return;
    setIsAnalyzing(true);
    const result = await analyzeEmailContent(email, MOCK_PROJECTS);
    setAiData(result);
    setIsAnalyzing(false);
  };

  // -- Render Helpers --

  if (!email) {
    return (
      <div className="w-[450px] bg-slate-50 border-l border-slate-200 p-8 flex flex-col items-center justify-center text-slate-400 text-center h-full">
        <i className="fa-solid fa-hard-hat text-4xl mb-4 opacity-50"></i>
        <p className="text-sm">Select an email to view<br/>Project Context & History</p>
      </div>
    );
  }

  // No project linked state
  if (!project) {
    return (
       <div className="w-[450px] bg-white border-l border-slate-200 flex flex-col h-full shadow-xl z-20">
         <div className="p-6 border-b border-slate-100 bg-slate-50">
            <h3 className="font-bold text-slate-800">Unlinked Email</h3>
            <p className="text-xs text-slate-500">This email is not associated with a project.</p>
         </div>
         <div className="p-6 space-y-4">
            <button 
                onClick={handleAnalyze}
                className="w-full py-3 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-200 hover:bg-indigo-100 flex items-center justify-center gap-2 text-sm font-medium transition-colors"
            >
                {isAnalyzing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-wand-magic-sparkles"></i>}
                Analyze & Suggest Project
            </button>
            
            {aiData && aiData.suggestedProjectId && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-md animate-fade-in">
                    <p className="text-xs text-green-800 font-bold mb-2">Suggestion Found:</p>
                    <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-700">
                            {MOCK_PROJECTS.find(p => p.id === aiData.suggestedProjectId)?.name}
                        </span>
                        <button className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">Link</button>
                    </div>
                </div>
            )}

            <div className="border-t border-slate-200 pt-4">
                 <p className="text-xs font-bold text-slate-500 uppercase mb-3">All Active Projects</p>
                 <div className="space-y-2 max-h-96 overflow-y-auto">
                    {MOCK_PROJECTS.map(p => (
                        <div key={p.id} onClick={() => setProject(p)} className="p-3 border border-slate-200 rounded hover:border-indigo-500 cursor-pointer flex justify-between items-center group">
                            <div className="text-sm font-medium text-slate-700 group-hover:text-indigo-600">{p.name}</div>
                            <i className="fa-solid fa-plus text-slate-300 group-hover:text-indigo-500"></i>
                        </div>
                    ))}
                 </div>
            </div>
         </div>
       </div>
    );
  }

  // Linked Project View
  return (
    <div className="w-[450px] bg-white border-l border-slate-200 flex flex-col h-full flex-shrink-0 shadow-xl z-20">
      {/* Project Header */}
      <div className="p-5 bg-slate-50 border-b border-slate-200">
        <div className="flex justify-between items-start mb-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wide ${project.status === 'Active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                {project.status}
            </span>
            <button onClick={() => setProject(null)} className="text-slate-400 hover:text-red-500 text-xs" title="Unlink Project">
                <i className="fa-solid fa-link-slash"></i>
            </button>
        </div>
        <h2 className="text-lg font-bold text-slate-800 leading-tight mb-1">{project.name}</h2>
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
            <i className="fa-solid fa-location-dot"></i>
            {project.address || "No address set"}
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex gap-1 bg-slate-200/50 p-1 rounded-lg">
             <button 
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'history' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <i className="fa-solid fa-clock-rotate-left mr-2"></i>Timeline
            </button>
            <button 
                onClick={() => setActiveTab('files')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'files' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <i className="fa-solid fa-folder-open mr-2"></i>Files
            </button>
            <button 
                onClick={() => setActiveTab('data')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'data' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <i className="fa-solid fa-table mr-2"></i>Data
            </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-white relative">
        
        {/* --- TIMELINE VIEW --- */}
        {activeTab === 'history' && (
            <div className="p-4 pb-20">
                 <div className="absolute left-8 top-4 bottom-4 w-0.5 bg-slate-100"></div>
                 
                 {timelineItems.map((item, idx) => (
                    <div key={`${item.itemType}-${item.id}`} className="relative pl-10 mb-6 group">
                        {/* Icon Bubble */}
                        <div className={`absolute left-0 top-0 w-16 flex justify-center`}>
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 bg-white ${item.itemType === 'email' ? (item.id === email.id ? 'border-indigo-500 text-indigo-600' : 'border-slate-200 text-slate-400') : 'border-orange-200 text-orange-500'}`}>
                                <i className={`fa-solid ${item.itemType === 'email' ? 'fa-envelope' : 'fa-file-arrow-up'}`}></i>
                            </div>
                        </div>

                        {/* Content Card */}
                        <div className={`rounded-lg border p-3 transition-all ${item.id === email.id ? 'bg-indigo-50 border-indigo-200 shadow-sm ring-1 ring-indigo-200' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-bold text-slate-700">
                                    {item.itemType === 'email' ? item.sender.name : item.uploadedBy}
                                </span>
                                <span className="text-[10px] text-slate-400">{item.date || item.lastModified}</span>
                            </div>
                            
                            {item.itemType === 'email' ? (
                                <>
                                    <div className="text-sm font-medium text-slate-800 mb-1">{item.subject}</div>
                                    <div className="text-xs text-slate-500 line-clamp-2">{item.preview}</div>
                                    {item.id === email.id && (
                                         <div className="mt-2 inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded font-bold">CURRENTLY VIEWING</div>
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center gap-3 mt-1">
                                    <i className="fa-solid fa-file-pdf text-red-500 text-xl"></i>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-slate-800 truncate">{item.name}</div>
                                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">{item.tag}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                 ))}
            </div>
        )}

        {/* --- FILES VIEW --- */}
        {activeTab === 'files' && (
            <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold uppercase text-slate-500">Project Documents</h3>
                    <button className="text-indigo-600 text-xs font-medium hover:underline"><i className="fa-solid fa-cloud-arrow-up mr-1"></i>Upload</button>
                </div>

                {['Drawing', 'Estimate', 'Permit', 'Plan', 'Contract'].map(category => {
                    const catFiles = projectFiles.filter(f => f.tag === category);
                    if (catFiles.length === 0) return null;

                    return (
                        <div key={category} className="mb-6">
                             <h4 className="text-xs font-bold text-slate-400 mb-2 pl-1 border-l-2 border-indigo-500">{category}s</h4>
                             <div className="space-y-2">
                                {catFiles.map(f => (
                                    <div key={f.id} className="flex items-center p-2 bg-slate-50 border border-slate-200 rounded hover:bg-white hover:shadow-sm cursor-pointer transition-all">
                                        <i className="fa-solid fa-file-lines text-slate-400 text-lg w-8 text-center"></i>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-slate-700 truncate">{f.name}</div>
                                            <div className="text-[10px] text-slate-400">{f.lastModified} • {f.size}</div>
                                        </div>
                                        <i className="fa-solid fa-download text-slate-300 hover:text-indigo-600 p-2"></i>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )
                })}
            </div>
        )}

        {/* --- DATA/FIELDS VIEW --- */}
        {activeTab === 'data' && (
            <div className="p-0">
                <table className="w-full text-sm text-left">
                    <tbody>
                        <tr className="border-b border-slate-100">
                            <td className="py-3 px-4 bg-slate-50 text-slate-500 font-medium w-1/3">Status</td>
                            <td className="py-3 px-4">
                                <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-bold ${project.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                    {project.status}
                                </span>
                            </td>
                        </tr>
                        <tr className="border-b border-slate-100">
                            <td className="py-3 px-4 bg-slate-50 text-slate-500 font-medium">Client</td>
                            <td className="py-3 px-4 text-slate-800">{project.clientName}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                            <td className="py-3 px-4 bg-slate-50 text-slate-500 font-medium">Budget</td>
                            <td className="py-3 px-4 text-slate-800 font-mono">{project.budget || '—'}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                            <td className="py-3 px-4 bg-slate-50 text-slate-500 font-medium">Site Contact</td>
                            <td className="py-3 px-4 text-slate-800">
                                {project.siteContact ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">{project.siteContact.charAt(0)}</div>
                                        {project.siteContact}
                                    </div>
                                ) : '—'}
                            </td>
                        </tr>
                        <tr className="border-b border-slate-100">
                            <td className="py-3 px-4 bg-slate-50 text-slate-500 font-medium">Permit #</td>
                            <td className="py-3 px-4 text-slate-800 font-mono bg-yellow-50/50">{project.permitNumber || 'Not Filed'}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                            <td className="py-3 px-4 bg-slate-50 text-slate-500 font-medium">Type</td>
                            <td className="py-3 px-4 text-slate-800">{project.type}</td>
                        </tr>
                        <tr className="border-b border-slate-100">
                            <td className="py-3 px-4 bg-slate-50 text-slate-500 font-medium align-top">Notes</td>
                            <td className="py-3 px-4 text-slate-600 text-xs leading-relaxed">{project.description}</td>
                        </tr>
                    </tbody>
                </table>
                
                <div className="p-4 bg-slate-50 mt-4 mx-4 rounded border border-slate-200">
                    <h4 className="text-xs font-bold text-slate-500 mb-2">Map Location</h4>
                    <div className="h-32 bg-slate-200 rounded flex items-center justify-center text-slate-400">
                        <div className="text-center">
                            <i className="fa-solid fa-map-location-dot text-2xl mb-1"></i>
                            <p className="text-[10px]">Map View Placeholder</p>
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 mt-2 text-center">{project.address}</div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default ContextPanel;
