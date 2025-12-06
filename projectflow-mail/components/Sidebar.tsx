
import React, { useState } from 'react';
import { User } from '../types';

interface SidebarProps {
  currentUser: User;
  activeView: string;
  onViewChange: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, activeView, onViewChange }) => {
  const [isHovered, setIsHovered] = useState(false);

  const sidebarWidth = isHovered ? 'w-64' : 'w-16';
  const showText = isHovered;

  return (
    <div 
      className={`${sidebarWidth} bg-slate-900 text-slate-300 flex flex-col h-full flex-shrink-0 border-r border-slate-800 transition-all duration-300 ease-in-out z-30 relative`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* User Profile Header */}
      <div className="p-4 h-16 flex items-center gap-3 border-b border-slate-800 overflow-hidden whitespace-nowrap">
        <img src={currentUser.avatarUrl} alt="Me" className="w-8 h-8 min-w-[2rem] rounded-full border border-slate-600" />
        <div className={`transition-opacity duration-200 ${showText ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-sm font-semibold text-white">{currentUser.name}</div>
          <div className="text-xs text-slate-500">Connected</div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="p-2 space-y-1 mt-4">
        <div className={`text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 transition-opacity duration-200 h-8 overflow-hidden whitespace-nowrap ${showText ? 'opacity-100' : 'opacity-0'}`}>
          Work
        </div>
        
        <button 
          onClick={() => onViewChange('inbox')}
          className={`w-full text-left px-3 py-3 rounded-md text-sm flex items-center gap-4 transition-colors overflow-hidden whitespace-nowrap ${activeView === 'inbox' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
          title="Inbox"
        >
          <i className="fa-solid fa-inbox w-5 text-center text-lg"></i>
          <span className={`transition-opacity duration-200 ${showText ? 'opacity-100' : 'opacity-0'}`}>Inbox</span>
          {showText && <span className="ml-auto bg-indigo-500 text-white text-[10px] px-1.5 rounded-full">3</span>}
        </button>

        <button 
          onClick={() => onViewChange('projects_board')}
          className={`w-full text-left px-3 py-3 rounded-md text-sm flex items-center gap-4 transition-colors overflow-hidden whitespace-nowrap ${activeView === 'projects_board' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
          title="Projects Board"
        >
          <i className="fa-solid fa-table-columns w-5 text-center text-lg"></i>
          <span className={`transition-opacity duration-200 ${showText ? 'opacity-100' : 'opacity-0'}`}>Projects Board</span>
        </button>

        <button className="w-full text-left px-3 py-3 rounded-md text-sm flex items-center gap-4 hover:bg-slate-800 transition-colors overflow-hidden whitespace-nowrap" title="Estimates">
          <i className="fa-solid fa-calculator w-5 text-center text-lg"></i>
          <span className={`transition-opacity duration-200 ${showText ? 'opacity-100' : 'opacity-0'}`}>Estimates</span>
        </button>
      </div>

      <div className="p-2 space-y-1 mt-4 border-t border-slate-800 pt-4">
        <div className={`text-xs font-bold text-slate-500 uppercase tracking-wider px-3 py-2 transition-opacity duration-200 h-8 overflow-hidden whitespace-nowrap ${showText ? 'opacity-100' : 'opacity-0'}`}>
            Mailbox
        </div>
        <button className="w-full text-left px-3 py-3 rounded-md text-sm flex items-center gap-4 hover:bg-slate-800 transition-colors overflow-hidden whitespace-nowrap" title="Sent">
          <i className="fa-regular fa-paper-plane w-5 text-center text-lg"></i>
          <span className={`transition-opacity duration-200 ${showText ? 'opacity-100' : 'opacity-0'}`}>Sent</span>
        </button>
        <button className="w-full text-left px-3 py-3 rounded-md text-sm flex items-center gap-4 hover:bg-slate-800 transition-colors overflow-hidden whitespace-nowrap" title="Archive">
          <i className="fa-solid fa-box-archive w-5 text-center text-lg"></i>
          <span className={`transition-opacity duration-200 ${showText ? 'opacity-100' : 'opacity-0'}`}>Archive</span>
        </button>
      </div>

      {/* Bottom Settings */}
      <div className="mt-auto p-4 border-t border-slate-800 overflow-hidden whitespace-nowrap">
        <button className="flex items-center gap-4 text-sm hover:text-white transition-colors w-full" title="Settings">
          <i className="fa-solid fa-gear w-5 text-center text-lg"></i>
          <span className={`transition-opacity duration-200 ${showText ? 'opacity-100' : 'opacity-0'}`}>Settings</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
