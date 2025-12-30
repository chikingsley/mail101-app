import type React from "react";
import { MOCK_PROJECTS } from "../constants";
import type { Email } from "../types";

interface EmailListProps {
  emails: Email[];
  selectedEmailId: string | null;
  onSelectEmail: (id: string) => void;
}

const EmailList: React.FC<EmailListProps> = ({
  emails,
  selectedEmailId,
  onSelectEmail,
}) => {
  const getProject = (id?: string) => MOCK_PROJECTS.find((p) => p.id === id);

  const handleArchive = (e: React.MouseEvent, emailId: string) => {
    e.stopPropagation();
    alert(`Archiving email ${emailId}`);
    // Logic to archive would go here
  };

  return (
    <div className="flex h-full w-96 flex-shrink-0 flex-col border-slate-200 border-r bg-white">
      <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-slate-100 border-b bg-white p-4">
        <h2 className="font-bold text-lg text-slate-800">Inbox</h2>
        <div className="flex gap-2 text-slate-400">
          <i className="fa-solid fa-filter cursor-pointer p-2 hover:text-slate-600" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {emails.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <i className="fa-regular fa-folder-open mb-2 text-4xl" />
            <p>Inbox Zero</p>
          </div>
        ) : (
          emails.map((email) => {
            const project = getProject(email.projectId);

            return (
              <div
                className={`group relative cursor-pointer border-slate-100 border-b p-4 transition-all hover:bg-slate-50 ${selectedEmailId === email.id ? "border-l-4 border-l-indigo-500 bg-indigo-50/60" : "border-l-4 border-l-transparent"}`}
                key={email.id}
                onClick={() => onSelectEmail(email.id)}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={`max-w-[70%] truncate text-sm ${email.read ? "text-slate-600" : "font-bold text-slate-900"}`}
                  >
                    {email.sender.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="whitespace-nowrap text-[10px] text-slate-400">
                      {email.date}
                    </span>
                    {/* Archive Action on Hover */}
                    <button
                      className="text-slate-400 opacity-0 transition-opacity hover:text-indigo-600 group-hover:opacity-100"
                      onClick={(e) => handleArchive(e, email.id)}
                      title="Archive"
                    >
                      <i className="fa-solid fa-box-archive" />
                    </button>
                  </div>
                </div>

                <div
                  className={`mb-1 text-sm ${email.read ? "text-slate-700" : "font-bold text-slate-800"}`}
                >
                  {email.subject}
                </div>

                <div className="mb-3 line-clamp-1 text-slate-500 text-xs">
                  {email.preview}
                </div>

                <div className="flex items-center justify-between">
                  {/* Project Tag - Clickable to open project context */}
                  {project ? (
                    <div className="inline-flex max-w-[80%] items-center gap-1.5 rounded border border-slate-200 bg-slate-100 px-2 py-1 font-medium text-[10px] text-slate-700 transition-colors hover:border-indigo-200 hover:bg-indigo-100 hover:text-indigo-800">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${project.status === "Active" ? "bg-green-500" : "bg-orange-400"}`}
                      />
                      <span className="truncate">{project.name}</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400 italic">
                      No Project Linked
                    </span>
                  )}

                  {/* Email Tags */}
                  <div className="flex gap-1">
                    {email.tags.slice(0, 2).map((tag) => (
                      <span
                        className="rounded border border-slate-200 bg-white px-1 text-[9px] text-slate-400"
                        key={tag}
                      >
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
