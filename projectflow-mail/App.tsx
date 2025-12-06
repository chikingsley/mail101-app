import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import EmailList from './components/EmailList';
import EmailView from './components/EmailView';
import ContextPanel from './components/ContextPanel';
import Dashboard from './components/Dashboard'; // This is now the Kanban Board
import { CURRENT_USER, MOCK_EMAILS, MOCK_PROJECTS } from './constants';
import { Email } from './types';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState('inbox');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const selectedEmail: Email | null = selectedEmailId 
    ? MOCK_EMAILS.find(e => e.id === selectedEmailId) || null
    : null;

  const handleViewChange = (view: string) => {
    setActiveView(view);
    // Optional: Reset email selection when switching major views
    if (view === 'projects_board') {
        setSelectedEmailId(null);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-100 text-slate-800 font-sans">
      {/* Left Navigation Sidebar */}
      <Sidebar 
        currentUser={CURRENT_USER}
        activeView={activeView}
        onViewChange={handleViewChange}
      />

      {/* Main Content Area */}
      {activeView === 'projects_board' ? (
        <Dashboard projects={MOCK_PROJECTS} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
            {/* Email List (Middle Column) */}
            <EmailList 
                emails={MOCK_EMAILS}
                selectedEmailId={selectedEmailId}
                onSelectEmail={setSelectedEmailId}
            />

            {/* Email Reading Pane */}
            <EmailView email={selectedEmail} />

            {/* Context Panel (Right Sidebar) - "Intertwined" logic */}
            <ContextPanel 
                email={selectedEmail} 
                sender={selectedEmail?.sender || null}
            />
        </div>
      )}
    </div>
  );
};

export default App;