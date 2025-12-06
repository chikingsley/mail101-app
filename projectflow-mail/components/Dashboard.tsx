
import React from 'react';
import { Project, ProjectStage } from '../types';

interface DashboardProps {
  projects: Project[];
}

const STAGES: ProjectStage[] = ['Lead', 'Estimating', 'Bid Sent', 'Awarded', 'Active', 'Closeout'];

const Dashboard: React.FC<DashboardProps> = ({ projects }) => {
  
  // Helper to categorize projects loosely for the mock
  const getProjectsByStage = (stage: ProjectStage) => {
    return projects.filter(p => {
        if (p.stage) return p.stage === stage;
        // Fallback mapping for mock data consistency if stage isn't set perfectly
        if (stage === 'Active' && p.status === 'Active') return true;
        if (stage === 'Estimating' && p.status === 'Estimating') return true;
        return false;
    });
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-100 overflow-hidden">
      {/* Header */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center px-6 justify-between shrink-0">
        <div>
            <h1 className="text-xl font-bold text-slate-800">Projects Board</h1>
            <p className="text-xs text-slate-500">Pipeline View</p>
        </div>
        <div className="flex gap-3">
             <div className="relative">
                <i className="fa-solid fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 text-xs"></i>
                <input 
                    type="text" 
                    placeholder="Search address or job #..." 
                    className="pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 w-64"
                />
             </div>
             <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm">
                <i className="fa-solid fa-plus mr-2"></i>
                New Job
             </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
         <div className="flex h-full gap-4 min-w-max">
            {STAGES.map(stage => {
                const stageProjects = getProjectsByStage(stage);
                
                return (
                    <div key={stage} className="w-80 flex flex-col h-full rounded-lg bg-slate-200/50 max-h-full">
                        <div className="p-3 flex items-center justify-between shrink-0">
                            <h3 className="font-bold text-slate-600 text-xs uppercase tracking-wide flex items-center gap-2">
                                {stage}
                                <span className="bg-slate-300 text-slate-600 text-[10px] px-1.5 py-0.5 rounded-full">{stageProjects.length}</span>
                            </h3>
                            <i className="fa-solid fa-ellipsis text-slate-400 hover:text-slate-600 cursor-pointer"></i>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-2 space-y-3 scrollbar-hide">
                            {stageProjects.map(project => (
                                <div key={project.id} className="bg-white p-3 rounded shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group relative">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">{project.clientName}</span>
                                        {project.budget && <span className="text-[10px] font-mono text-slate-500">{project.budget}</span>}
                                    </div>
                                    <h4 className="font-semibold text-slate-800 text-sm mb-1">{project.name}</h4>
                                    {project.address && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                                            <i className="fa-solid fa-location-dot text-slate-400 text-[10px]"></i>
                                            <span className="truncate">{project.address}</span>
                                        </div>
                                    )}
                                    
                                    <div className="border-t border-slate-100 pt-2 flex items-center justify-between">
                                        <div className="flex gap-2 text-[10px] text-slate-400">
                                            <span>{project.type}</span>
                                        </div>
                                        <div className="text-xs text-slate-400 group-hover:text-indigo-500 transition-colors">
                                            <i className="fa-solid fa-chevron-right"></i>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button className="w-full py-2 text-slate-400 hover:text-slate-600 text-sm border border-transparent hover:border-slate-300 hover:bg-slate-100 border-dashed rounded transition-all">
                                + Add
                            </button>
                        </div>
                    </div>
                );
            })}
         </div>
      </div>
    </div>
  );
};

export default Dashboard;
