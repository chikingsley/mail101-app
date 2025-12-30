import type React from "react";
import { useState } from "react";
import type { User } from "../types";

interface SidebarProps {
  currentUser: User;
  activeView: string;
  onViewChange: (view: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  activeView,
  onViewChange,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const sidebarWidth = isHovered ? "w-64" : "w-16";
  const showText = isHovered;

  return (
    <div
      className={`${sidebarWidth} relative z-30 flex h-full flex-shrink-0 flex-col border-slate-800 border-r bg-slate-900 text-slate-300 transition-all duration-300 ease-in-out`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* User Profile Header */}
      <div className="flex h-16 items-center gap-3 overflow-hidden whitespace-nowrap border-slate-800 border-b p-4">
        <img
          alt="Me"
          className="h-8 w-8 min-w-[2rem] rounded-full border border-slate-600"
          src={currentUser.avatarUrl}
        />
        <div
          className={`transition-opacity duration-200 ${showText ? "opacity-100" : "opacity-0"}`}
        >
          <div className="font-semibold text-sm text-white">
            {currentUser.name}
          </div>
          <div className="text-slate-500 text-xs">Connected</div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="mt-4 space-y-1 p-2">
        <div
          className={`h-8 overflow-hidden whitespace-nowrap px-3 py-2 font-bold text-slate-500 text-xs uppercase tracking-wider transition-opacity duration-200 ${showText ? "opacity-100" : "opacity-0"}`}
        >
          Work
        </div>

        <button
          className={`flex w-full items-center gap-4 overflow-hidden whitespace-nowrap rounded-md px-3 py-3 text-left text-sm transition-colors ${activeView === "inbox" ? "bg-indigo-600 text-white" : "hover:bg-slate-800"}`}
          onClick={() => onViewChange("inbox")}
          title="Inbox"
        >
          <i className="fa-solid fa-inbox w-5 text-center text-lg" />
          <span
            className={`transition-opacity duration-200 ${showText ? "opacity-100" : "opacity-0"}`}
          >
            Inbox
          </span>
          {showText && (
            <span className="ml-auto rounded-full bg-indigo-500 px-1.5 text-[10px] text-white">
              3
            </span>
          )}
        </button>

        <button
          className={`flex w-full items-center gap-4 overflow-hidden whitespace-nowrap rounded-md px-3 py-3 text-left text-sm transition-colors ${activeView === "projects_board" ? "bg-indigo-600 text-white" : "hover:bg-slate-800"}`}
          onClick={() => onViewChange("projects_board")}
          title="Projects Board"
        >
          <i className="fa-solid fa-table-columns w-5 text-center text-lg" />
          <span
            className={`transition-opacity duration-200 ${showText ? "opacity-100" : "opacity-0"}`}
          >
            Projects Board
          </span>
        </button>

        <button
          className="flex w-full items-center gap-4 overflow-hidden whitespace-nowrap rounded-md px-3 py-3 text-left text-sm transition-colors hover:bg-slate-800"
          title="Estimates"
        >
          <i className="fa-solid fa-calculator w-5 text-center text-lg" />
          <span
            className={`transition-opacity duration-200 ${showText ? "opacity-100" : "opacity-0"}`}
          >
            Estimates
          </span>
        </button>
      </div>

      <div className="mt-4 space-y-1 border-slate-800 border-t p-2 pt-4">
        <div
          className={`h-8 overflow-hidden whitespace-nowrap px-3 py-2 font-bold text-slate-500 text-xs uppercase tracking-wider transition-opacity duration-200 ${showText ? "opacity-100" : "opacity-0"}`}
        >
          Mailbox
        </div>
        <button
          className="flex w-full items-center gap-4 overflow-hidden whitespace-nowrap rounded-md px-3 py-3 text-left text-sm transition-colors hover:bg-slate-800"
          title="Sent"
        >
          <i className="fa-regular fa-paper-plane w-5 text-center text-lg" />
          <span
            className={`transition-opacity duration-200 ${showText ? "opacity-100" : "opacity-0"}`}
          >
            Sent
          </span>
        </button>
        <button
          className="flex w-full items-center gap-4 overflow-hidden whitespace-nowrap rounded-md px-3 py-3 text-left text-sm transition-colors hover:bg-slate-800"
          title="Archive"
        >
          <i className="fa-solid fa-box-archive w-5 text-center text-lg" />
          <span
            className={`transition-opacity duration-200 ${showText ? "opacity-100" : "opacity-0"}`}
          >
            Archive
          </span>
        </button>
      </div>

      {/* Bottom Settings */}
      <div className="mt-auto overflow-hidden whitespace-nowrap border-slate-800 border-t p-4">
        <button
          className="flex w-full items-center gap-4 text-sm transition-colors hover:text-white"
          title="Settings"
        >
          <i className="fa-solid fa-gear w-5 text-center text-lg" />
          <span
            className={`transition-opacity duration-200 ${showText ? "opacity-100" : "opacity-0"}`}
          >
            Settings
          </span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
