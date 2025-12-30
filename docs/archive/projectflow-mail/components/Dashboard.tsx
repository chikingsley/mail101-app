import type React from "react";
import type { Project, ProjectStage } from "../types";

interface DashboardProps {
  projects: Project[];
}

const STAGES: ProjectStage[] = [
  "Lead",
  "Estimating",
  "Bid Sent",
  "Awarded",
  "Active",
  "Closeout",
];

const Dashboard: React.FC<DashboardProps> = ({ projects }) => {
  // Helper to categorize projects loosely for the mock
  const getProjectsByStage = (stage: ProjectStage) => {
    return projects.filter((p) => {
      if (p.stage) return p.stage === stage;
      // Fallback mapping for mock data consistency if stage isn't set perfectly
      if (stage === "Active" && p.status === "Active") return true;
      if (stage === "Estimating" && p.status === "Estimating") return true;
      return false;
    });
  };

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden bg-slate-100">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-slate-200 border-b bg-white px-6">
        <div>
          <h1 className="font-bold text-slate-800 text-xl">Projects Board</h1>
          <p className="text-slate-500 text-xs">Pipeline View</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <i className="fa-solid fa-search absolute top-1/2 left-3 -translate-y-1/2 transform text-slate-400 text-xs" />
            <input
              className="w-64 rounded-md border border-slate-200 bg-slate-50 py-1.5 pr-4 pl-8 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Search address or job #..."
              type="text"
            />
          </div>
          <button className="rounded-md bg-indigo-600 px-4 py-1.5 font-medium text-sm text-white shadow-sm transition-colors hover:bg-indigo-700">
            <i className="fa-solid fa-plus mr-2" />
            New Job
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex h-full min-w-max gap-4">
          {STAGES.map((stage) => {
            const stageProjects = getProjectsByStage(stage);

            return (
              <div
                className="flex h-full max-h-full w-80 flex-col rounded-lg bg-slate-200/50"
                key={stage}
              >
                <div className="flex shrink-0 items-center justify-between p-3">
                  <h3 className="flex items-center gap-2 font-bold text-slate-600 text-xs uppercase tracking-wide">
                    {stage}
                    <span className="rounded-full bg-slate-300 px-1.5 py-0.5 text-[10px] text-slate-600">
                      {stageProjects.length}
                    </span>
                  </h3>
                  <i className="fa-solid fa-ellipsis cursor-pointer text-slate-400 hover:text-slate-600" />
                </div>

                <div className="scrollbar-hide flex-1 space-y-3 overflow-y-auto p-2">
                  {stageProjects.map((project) => (
                    <div
                      className="group relative cursor-pointer rounded border border-slate-200 bg-white p-3 shadow-sm transition-all hover:border-indigo-300 hover:shadow-md"
                      key={project.id}
                    >
                      <div className="mb-2 flex items-start justify-between">
                        <span className="rounded border border-indigo-100 bg-indigo-50 px-1.5 py-0.5 font-bold text-[10px] text-indigo-600">
                          {project.clientName}
                        </span>
                        {project.budget && (
                          <span className="font-mono text-[10px] text-slate-500">
                            {project.budget}
                          </span>
                        )}
                      </div>
                      <h4 className="mb-1 font-semibold text-slate-800 text-sm">
                        {project.name}
                      </h4>
                      {project.address && (
                        <div className="mb-3 flex items-center gap-1.5 text-slate-500 text-xs">
                          <i className="fa-solid fa-location-dot text-[10px] text-slate-400" />
                          <span className="truncate">{project.address}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between border-slate-100 border-t pt-2">
                        <div className="flex gap-2 text-[10px] text-slate-400">
                          <span>{project.type}</span>
                        </div>
                        <div className="text-slate-400 text-xs transition-colors group-hover:text-indigo-500">
                          <i className="fa-solid fa-chevron-right" />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button className="w-full rounded border border-transparent border-dashed py-2 text-slate-400 text-sm transition-all hover:border-slate-300 hover:bg-slate-100 hover:text-slate-600">
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
