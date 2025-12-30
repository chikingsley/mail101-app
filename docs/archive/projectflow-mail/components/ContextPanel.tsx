import type React from "react";
import { useEffect, useState } from "react";
import { MOCK_EMAILS, MOCK_FILES, MOCK_PROJECTS } from "../constants";
import { analyzeEmailContent } from "../services/geminiService";
import type { Email, Project, SharePointFile } from "../types";

interface ContextPanelProps {
  email: Email | null;
  sender: any;
}

type ViewTab = "history" | "data" | "files";

const ContextPanel: React.FC<ContextPanelProps> = ({ email }) => {
  const [activeTab, setActiveTab] = useState<ViewTab>("history");
  const [project, setProject] = useState<Project | null>(null);
  const [timelineItems, setTimelineItems] = useState<any[]>([]);
  const [projectFiles, setProjectFiles] = useState<SharePointFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiData, setAiData] = useState<any>(null);

  useEffect(() => {
    if (email && email.projectId) {
      const proj = MOCK_PROJECTS.find((p) => p.id === email.projectId) || null;
      setProject(proj);
    } else {
      setProject(null);
    }
    setAiData(null);
  }, [email]);

  useEffect(() => {
    if (project) {
      // 1. Build Timeline (Emails + Files)
      const relatedEmails = MOCK_EMAILS.filter(
        (e) => e.projectId === project.id
      );
      const relatedFiles = MOCK_FILES.filter((f) => f.projectId === project.id);

      const timeline = [
        ...relatedEmails.map((e) => ({ ...e, itemType: "email" })),
        ...relatedFiles.map((f) => ({ ...f, itemType: "file" })),
      ].sort((a, b) => b.timestamp - a.timestamp);

      setTimelineItems(timeline);
      setProjectFiles(relatedFiles);
    } else {
      setTimelineItems([]);
      setProjectFiles([]);
    }
  }, [project]);

  const handleAnalyze = async () => {
    if (!email) return;
    setIsAnalyzing(true);
    const result = await analyzeEmailContent(email, MOCK_PROJECTS);
    setAiData(result);
    setIsAnalyzing(false);
  };

  // -- Render Helpers --

  if (!email) {
    return (
      <div className="flex h-full w-[450px] flex-col items-center justify-center border-slate-200 border-l bg-slate-50 p-8 text-center text-slate-400">
        <i className="fa-solid fa-hard-hat mb-4 text-4xl opacity-50" />
        <p className="text-sm">
          Select an email to view
          <br />
          Project Context & History
        </p>
      </div>
    );
  }

  // No project linked state
  if (!project) {
    return (
      <div className="z-20 flex h-full w-[450px] flex-col border-slate-200 border-l bg-white shadow-xl">
        <div className="border-slate-100 border-b bg-slate-50 p-6">
          <h3 className="font-bold text-slate-800">Unlinked Email</h3>
          <p className="text-slate-500 text-xs">
            This email is not associated with a project.
          </p>
        </div>
        <div className="space-y-4 p-6">
          <button
            className="flex w-full items-center justify-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 py-3 font-medium text-indigo-700 text-sm transition-colors hover:bg-indigo-100"
            onClick={handleAnalyze}
          >
            {isAnalyzing ? (
              <i className="fa-solid fa-circle-notch fa-spin" />
            ) : (
              <i className="fa-solid fa-wand-magic-sparkles" />
            )}
            Analyze & Suggest Project
          </button>

          {aiData && aiData.suggestedProjectId && (
            <div className="animate-fade-in rounded-md border border-green-200 bg-green-50 p-4">
              <p className="mb-2 font-bold text-green-800 text-xs">
                Suggestion Found:
              </p>
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-700 text-sm">
                  {
                    MOCK_PROJECTS.find(
                      (p) => p.id === aiData.suggestedProjectId
                    )?.name
                  }
                </span>
                <button className="rounded bg-green-600 px-3 py-1 text-white text-xs hover:bg-green-700">
                  Link
                </button>
              </div>
            </div>
          )}

          <div className="border-slate-200 border-t pt-4">
            <p className="mb-3 font-bold text-slate-500 text-xs uppercase">
              All Active Projects
            </p>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {MOCK_PROJECTS.map((p) => (
                <div
                  className="group flex cursor-pointer items-center justify-between rounded border border-slate-200 p-3 hover:border-indigo-500"
                  key={p.id}
                  onClick={() => setProject(p)}
                >
                  <div className="font-medium text-slate-700 text-sm group-hover:text-indigo-600">
                    {p.name}
                  </div>
                  <i className="fa-solid fa-plus text-slate-300 group-hover:text-indigo-500" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Linked Project View
  return (
    <div className="z-20 flex h-full w-[450px] flex-shrink-0 flex-col border-slate-200 border-l bg-white shadow-xl">
      {/* Project Header */}
      <div className="border-slate-200 border-b bg-slate-50 p-5">
        <div className="mb-2 flex items-start justify-between">
          <span
            className={`rounded border px-2 py-0.5 font-bold text-[10px] uppercase tracking-wide ${project.status === "Active" ? "border-green-200 bg-green-100 text-green-700" : "border-orange-200 bg-orange-100 text-orange-700"}`}
          >
            {project.status}
          </span>
          <button
            className="text-slate-400 text-xs hover:text-red-500"
            onClick={() => setProject(null)}
            title="Unlink Project"
          >
            <i className="fa-solid fa-link-slash" />
          </button>
        </div>
        <h2 className="mb-1 font-bold text-lg text-slate-800 leading-tight">
          {project.name}
        </h2>
        <div className="mb-3 flex items-center gap-2 text-slate-500 text-xs">
          <i className="fa-solid fa-location-dot" />
          {project.address || "No address set"}
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 rounded-lg bg-slate-200/50 p-1">
          <button
            className={`flex-1 rounded-md py-1.5 font-medium text-xs transition-all ${activeTab === "history" ? "bg-white text-indigo-600 shadow" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setActiveTab("history")}
          >
            <i className="fa-solid fa-clock-rotate-left mr-2" />
            Timeline
          </button>
          <button
            className={`flex-1 rounded-md py-1.5 font-medium text-xs transition-all ${activeTab === "files" ? "bg-white text-indigo-600 shadow" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setActiveTab("files")}
          >
            <i className="fa-solid fa-folder-open mr-2" />
            Files
          </button>
          <button
            className={`flex-1 rounded-md py-1.5 font-medium text-xs transition-all ${activeTab === "data" ? "bg-white text-indigo-600 shadow" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setActiveTab("data")}
          >
            <i className="fa-solid fa-table mr-2" />
            Data
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 overflow-y-auto bg-white">
        {/* --- TIMELINE VIEW --- */}
        {activeTab === "history" && (
          <div className="p-4 pb-20">
            <div className="absolute top-4 bottom-4 left-8 w-0.5 bg-slate-100" />

            {timelineItems.map((item, idx) => (
              <div
                className="group relative mb-6 pl-10"
                key={`${item.itemType}-${item.id}`}
              >
                {/* Icon Bubble */}
                <div
                  className={"absolute top-0 left-0 flex w-16 justify-center"}
                >
                  <div
                    className={`z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white ${item.itemType === "email" ? (item.id === email.id ? "border-indigo-500 text-indigo-600" : "border-slate-200 text-slate-400") : "border-orange-200 text-orange-500"}`}
                  >
                    <i
                      className={`fa-solid ${item.itemType === "email" ? "fa-envelope" : "fa-file-arrow-up"}`}
                    />
                  </div>
                </div>

                {/* Content Card */}
                <div
                  className={`rounded-lg border p-3 transition-all ${item.id === email.id ? "border-indigo-200 bg-indigo-50 shadow-sm ring-1 ring-indigo-200" : "border-slate-200 bg-white hover:border-slate-300"}`}
                >
                  <div className="mb-1 flex items-start justify-between">
                    <span className="font-bold text-slate-700 text-xs">
                      {item.itemType === "email"
                        ? item.sender.name
                        : item.uploadedBy}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {item.date || item.lastModified}
                    </span>
                  </div>

                  {item.itemType === "email" ? (
                    <>
                      <div className="mb-1 font-medium text-slate-800 text-sm">
                        {item.subject}
                      </div>
                      <div className="line-clamp-2 text-slate-500 text-xs">
                        {item.preview}
                      </div>
                      {item.id === email.id && (
                        <div className="mt-2 inline-block rounded bg-indigo-100 px-2 py-0.5 font-bold text-[10px] text-indigo-700">
                          CURRENTLY VIEWING
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mt-1 flex items-center gap-3">
                      <i className="fa-solid fa-file-pdf text-red-500 text-xl" />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-800 text-sm">
                          {item.name}
                        </div>
                        <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                          {item.tag}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- FILES VIEW --- */}
        {activeTab === "files" && (
          <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-500 text-xs uppercase">
                Project Documents
              </h3>
              <button className="font-medium text-indigo-600 text-xs hover:underline">
                <i className="fa-solid fa-cloud-arrow-up mr-1" />
                Upload
              </button>
            </div>

            {["Drawing", "Estimate", "Permit", "Plan", "Contract"].map(
              (category) => {
                const catFiles = projectFiles.filter((f) => f.tag === category);
                if (catFiles.length === 0) return null;

                return (
                  <div className="mb-6" key={category}>
                    <h4 className="mb-2 border-indigo-500 border-l-2 pl-1 font-bold text-slate-400 text-xs">
                      {category}s
                    </h4>
                    <div className="space-y-2">
                      {catFiles.map((f) => (
                        <div
                          className="flex cursor-pointer items-center rounded border border-slate-200 bg-slate-50 p-2 transition-all hover:bg-white hover:shadow-sm"
                          key={f.id}
                        >
                          <i className="fa-solid fa-file-lines w-8 text-center text-lg text-slate-400" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium text-slate-700 text-sm">
                              {f.name}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {f.lastModified} • {f.size}
                            </div>
                          </div>
                          <i className="fa-solid fa-download p-2 text-slate-300 hover:text-indigo-600" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}

        {/* --- DATA/FIELDS VIEW --- */}
        {activeTab === "data" && (
          <div className="p-0">
            <table className="w-full text-left text-sm">
              <tbody>
                <tr className="border-slate-100 border-b">
                  <td className="w-1/3 bg-slate-50 px-4 py-3 font-medium text-slate-500">
                    Status
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-bold text-xs ${project.status === "Active" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {project.status}
                    </span>
                  </td>
                </tr>
                <tr className="border-slate-100 border-b">
                  <td className="bg-slate-50 px-4 py-3 font-medium text-slate-500">
                    Client
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    {project.clientName}
                  </td>
                </tr>
                <tr className="border-slate-100 border-b">
                  <td className="bg-slate-50 px-4 py-3 font-medium text-slate-500">
                    Budget
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-800">
                    {project.budget || "—"}
                  </td>
                </tr>
                <tr className="border-slate-100 border-b">
                  <td className="bg-slate-50 px-4 py-3 font-medium text-slate-500">
                    Site Contact
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    {project.siteContact ? (
                      <div className="flex items-center gap-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 font-bold text-[10px] text-indigo-600">
                          {project.siteContact.charAt(0)}
                        </div>
                        {project.siteContact}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                <tr className="border-slate-100 border-b">
                  <td className="bg-slate-50 px-4 py-3 font-medium text-slate-500">
                    Permit #
                  </td>
                  <td className="bg-yellow-50/50 px-4 py-3 font-mono text-slate-800">
                    {project.permitNumber || "Not Filed"}
                  </td>
                </tr>
                <tr className="border-slate-100 border-b">
                  <td className="bg-slate-50 px-4 py-3 font-medium text-slate-500">
                    Type
                  </td>
                  <td className="px-4 py-3 text-slate-800">{project.type}</td>
                </tr>
                <tr className="border-slate-100 border-b">
                  <td className="bg-slate-50 px-4 py-3 align-top font-medium text-slate-500">
                    Notes
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs leading-relaxed">
                    {project.description}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mx-4 mt-4 rounded border border-slate-200 bg-slate-50 p-4">
              <h4 className="mb-2 font-bold text-slate-500 text-xs">
                Map Location
              </h4>
              <div className="flex h-32 items-center justify-center rounded bg-slate-200 text-slate-400">
                <div className="text-center">
                  <i className="fa-solid fa-map-location-dot mb-1 text-2xl" />
                  <p className="text-[10px]">Map View Placeholder</p>
                </div>
              </div>
              <div className="mt-2 text-center text-slate-500 text-xs">
                {project.address}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContextPanel;
