import type React from "react";
import type { Email } from "../types";

interface EmailViewProps {
  email: Email | null;
}

const EmailView: React.FC<EmailViewProps> = ({ email }) => {
  if (!email) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-white text-slate-300">
        <i className="fa-regular fa-envelope mb-4 text-6xl opacity-20" />
        <p>Select an email to read</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex h-16 shrink-0 items-center justify-between border-slate-100 border-b px-6">
        <div className="flex gap-4 text-slate-500">
          <button className="hover:text-slate-800" title="Reply">
            <i className="fa-solid fa-reply" />
          </button>
          <button className="hover:text-slate-800" title="Reply All">
            <i className="fa-solid fa-reply-all" />
          </button>
          <button className="hover:text-slate-800" title="Forward">
            <i className="fa-solid fa-share" />
          </button>
          <div className="mx-2 h-5 w-px bg-slate-200" />
          <button className="hover:text-red-500" title="Delete">
            <i className="fa-regular fa-trash-can" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {email.projectId && (
            <div className="flex items-center gap-2 rounded border border-indigo-100 bg-indigo-50 px-2 py-1 font-medium text-indigo-600 text-xs">
              <i className="fa-solid fa-briefcase" />
              Linked to Project
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <h1 className="mb-6 font-semibold text-2xl text-slate-900">
          {email.subject}
        </h1>

        <div className="mb-8 flex items-start gap-4">
          <img
            alt={email.sender.name}
            className="h-10 w-10 rounded-full"
            src={email.sender.avatarUrl}
          />
          <div className="flex-1">
            <div className="flex items-baseline justify-between">
              <span className="font-bold text-slate-800">
                {email.sender.name}
              </span>
              <span className="text-slate-500 text-sm">{email.date}</span>
            </div>
            <div className="text-slate-500 text-sm">{`<${email.sender.email}>`}</div>
            <div className="mt-1 text-slate-400 text-xs">
              To: Me, Project Team
            </div>
          </div>
        </div>

        <div className="prose prose-slate max-w-none text-slate-700">
          {email.body.split("\n").map((line, i) => (
            <p className="mb-2 min-h-[1rem]" key={i}>
              {line}
            </p>
          ))}
        </div>

        {/* Fake Attachment */}
        <div className="mt-8 border-slate-100 border-t pt-6">
          <h4 className="mb-3 font-bold text-slate-500 text-sm">
            1 Attachment
          </h4>
          <div className="inline-flex cursor-pointer items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 transition-all hover:border-slate-300 hover:bg-slate-100">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-red-100 text-red-500">
              <i className="fa-regular fa-file-pdf text-xl" />
            </div>
            <div>
              <div className="font-medium text-slate-800 text-sm">
                Project_Brief_v2.pdf
              </div>
              <div className="text-slate-500 text-xs">2.4 MB</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailView;
