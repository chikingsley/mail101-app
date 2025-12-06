import React from 'react';
import { Email } from '../types';

interface EmailViewProps {
  email: Email | null;
}

const EmailView: React.FC<EmailViewProps> = ({ email }) => {
  if (!email) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white text-slate-300">
        <i className="fa-regular fa-envelope text-6xl mb-4 opacity-20"></i>
        <p>Select an email to read</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
      {/* Toolbar */}
      <div className="h-16 border-b border-slate-100 flex items-center px-6 justify-between shrink-0">
        <div className="flex gap-4 text-slate-500">
          <button className="hover:text-slate-800" title="Reply"><i className="fa-solid fa-reply"></i></button>
          <button className="hover:text-slate-800" title="Reply All"><i className="fa-solid fa-reply-all"></i></button>
          <button className="hover:text-slate-800" title="Forward"><i className="fa-solid fa-share"></i></button>
          <div className="w-px h-5 bg-slate-200 mx-2"></div>
          <button className="hover:text-red-500" title="Delete"><i className="fa-regular fa-trash-can"></i></button>
        </div>
        <div className="flex items-center gap-2">
             {email.projectId && (
                <div className="text-xs font-medium px-2 py-1 bg-indigo-50 text-indigo-600 rounded border border-indigo-100 flex items-center gap-2">
                    <i className="fa-solid fa-briefcase"></i>
                    Linked to Project
                </div>
             )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <h1 className="text-2xl font-semibold text-slate-900 mb-6">{email.subject}</h1>
        
        <div className="flex items-start gap-4 mb-8">
          <img src={email.sender.avatarUrl} alt={email.sender.name} className="w-10 h-10 rounded-full" />
          <div className="flex-1">
            <div className="flex justify-between items-baseline">
              <span className="font-bold text-slate-800">{email.sender.name}</span>
              <span className="text-sm text-slate-500">{email.date}</span>
            </div>
            <div className="text-sm text-slate-500">{`<${email.sender.email}>`}</div>
            <div className="text-xs text-slate-400 mt-1">To: Me, Project Team</div>
          </div>
        </div>

        <div className="prose prose-slate max-w-none text-slate-700">
          {email.body.split('\n').map((line, i) => (
            <p key={i} className="mb-2 min-h-[1rem]">{line}</p>
          ))}
        </div>

        {/* Fake Attachment */}
        <div className="mt-8 pt-6 border-t border-slate-100">
          <h4 className="text-sm font-bold text-slate-500 mb-3">1 Attachment</h4>
          <div className="inline-flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-100 hover:border-slate-300 transition-all">
             <div className="w-10 h-10 bg-red-100 rounded flex items-center justify-center text-red-500">
                <i className="fa-regular fa-file-pdf text-xl"></i>
             </div>
             <div>
                <div className="text-sm font-medium text-slate-800">Project_Brief_v2.pdf</div>
                <div className="text-xs text-slate-500">2.4 MB</div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailView;