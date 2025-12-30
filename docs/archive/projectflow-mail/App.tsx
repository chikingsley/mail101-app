import type React from "react";
import { useState } from "react";
import ContextPanel from "./components/ContextPanel";
import Dashboard from "./components/Dashboard"; // This is now the Kanban Board
import EmailList from "./components/EmailList";
import EmailView from "./components/EmailView";
import Sidebar from "./components/Sidebar";
import { CURRENT_USER, MOCK_EMAILS, MOCK_PROJECTS } from "./constants";
import type { Email } from "./types";

const App: React.FC = () => {
  const [activeView, setActiveView] = useState("inbox");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);

  const selectedEmail: Email | null = selectedEmailId
    ? MOCK_EMAILS.find((e) => e.id === selectedEmailId) || null
    : null;

  const handleViewChange = (view: string) => {
    setActiveView(view);
    // Optional: Reset email selection when switching major views
    if (view === "projects_board") {
      setSelectedEmailId(null);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-100 font-sans text-slate-800">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeView={activeView}
        currentUser={CURRENT_USER}
        onViewChange={handleViewChange}
      />

      {/* Main Content Area */}
      {activeView === "projects_board" ? (
        <Dashboard projects={MOCK_PROJECTS} />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Email List (Middle Column) */}
          <EmailList
            emails={MOCK_EMAILS}
            onSelectEmail={setSelectedEmailId}
            selectedEmailId={selectedEmailId}
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
