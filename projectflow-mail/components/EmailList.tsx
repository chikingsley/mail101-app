
import React from 'react';
import { Email } from '../types';
import { MOCK_PROJECTS } from '../constants';

interface EmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  onSelectEmail: (id: string) => void;
}

const EmailList: React.FC<EmailListProps> = ({ emails, selectedEmailId, onSelectEmail }) => {
  const getProject = (id?: string) => MOCK_PROJECTS.find(p => p.id === id);

  const handleArchive = (e: React.MouseEvent, emailId: string) => {
    e.stopPropagation();
    alert(`Archiving email ${emailId}`);
    // Logic to archive would go here
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200 w-96 flex-shrink-0">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 h-16">
        <h2 className="font-bold text-slate-800 text-lg">Inbox</h2>
        <div className="flex gap-2 text-slate-400">
          <i className="fa-solid fa-filter hover:text-slate-600 cursor-pointer p-2"></i>
        </div>
      </div>
      
      <div className="overflow-y-auto flex-1">
        {emails.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
                <i className="fa-regular fa-folder-open text-4xl mb-2"></i>
                <p>Inbox Zero</p>
            </div>
        ) : (
            emails.map(email => {
                const project = getProject(email.projectId);

                return (
                    <div 
                        key={email.id}
                        onClick={() => onSelectEmail(email.id)}
                        className={`p-4 border-b border-slate-100 cursor-pointer transition-all hover:bg-slate-50 relative group ${selectedEmailId === email.id ? 'bg-indigo-50/60 border-l-4 border-l-indigo-500' : 'border-l-4 border-l-transparent'}`}
                    >
                        <div className="flex justify-between mb-2 items-center">
                            <span className={`text-sm truncate max-w-[70%] ${!email.read ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                                {email.sender.name}
                            </span>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 whitespace-nowrap">{email.date}</span>
                                {/* Archive Action on Hover */}
                                <button 
                                    onClick={(e) => handleArchive(e, email.id)}
                                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-indigo-600 transition-opacity"
                                    title="Archive"
                                >
                                    <i className="fa-solid fa-box-archive"></i>
                                </button>
                            </div>
                        </div>

                        <div className={`text-sm mb-1 ${!email.read ? 'font-bold text-slate-800' : 'text-slate-700'}`}>
                            {email.subject}
                        </div>
                        
                        <div className="text-xs text-slate-500 line-clamp-1 mb-3">
                            {email.preview}
                        </div>

                        <div className="flex items-center justify-between">
                            {/* Project Tag - Clickable to open project context */}
                            {project ? (
                                <div className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2 py-1 rounded text-[10px] font-medium text-slate-700 max-w-[80%] hover:bg-indigo-100 hover:border-indigo-200 hover:text-indigo-800 transition-colors">
                                    <span className={`w-1.5 h-1.5 rounded-full ${project.status === 'Active' ? 'bg-green-500' : 'bg-orange-400'}`}></span>
                                    <span className="truncate">{project.name}</span>
                                </div>
                            ) : (
                                <span className="text-[10px] text-slate-400 italic">No Project Linked</span>
                            )}

                            {/* Email Tags */}
                            <div className="flex gap-1">
                                {email.tags.slice(0,2).map(tag => (
                                    <span key={tag} className="text-[9px] text-slate-400 border border-slate-200 px-1 rounded bg-white">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })
        )}
      </div>
    </div>
  );
};

export default EmailList;
