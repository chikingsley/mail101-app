/**
 * Email Command Center
 *
 * The main triage UI with three panels:
 * - Left: Navigation / Filters / Workflow Triggers
 * - Center: Project Context
 * - Right: Email Inbox
 */

"use client";

import {
  AlertTriangle,
  Archive,
  Building2,
  FileText,
  Filter,
  FolderOpen,
  Inbox,
  Mail,
  Search,
  TrendingUp,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CensusEmail } from "@/lib/census-types";
import {
  useAccounts,
  useClassifyEmail,
  useEmailContext,
  useEmails,
  useEstimates,
  useLinkEmail,
  useMailboxes,
  useProjects,
  useStats,
} from "@/lib/use-census";
import { cn } from "@/lib/utils";
import { CensusMailList } from "./census-mail-list";
import { ProjectContext } from "./project-context";
import {
  WorkflowModal,
  type WorkflowSubmission,
  type WorkflowType,
} from "./workflow-modal";

// Shared header height
const HEADER_HEIGHT = "h-14";

// Nav link type
interface NavLink {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  active?: boolean;
  onClick?: () => void;
}

// Filter type
type FilterType = "all" | "needs-triage" | "by-account" | "by-project";

export function CommandCenter() {
  // Mailbox state - default to chi@ (your primary inbox)
  const [selectedMailbox, setSelectedMailbox] = useState<string>("chi@desertservices.net");
  
  // Data hooks
  const { data: mailboxesData } = useMailboxes();
  const { data: emailsData, loading: emailsLoading, refetch: refetchEmails } = useEmails(100, selectedMailbox);
  const { data: statsData } = useStats();
  const { data: _accountsData } = useAccounts();
  const { data: _projectsData } = useProjects();
  const { data: estimatesData } = useEstimates();
  const { linkEmail } = useLinkEmail();
  const { classifyEmail } = useClassifyEmail();

  // State
  const [selectedEmail, setSelectedEmail] = useState<CensusEmail | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowType | null>(null);
  
  // Get actionable mailboxes
  const actionableMailboxes = mailboxesData?.actionable ?? [];
  const allMailboxes = mailboxesData?.mailboxes ?? [];

  // Context for selected email
  const {
    project,
    projectEmails,
    account,
    accountProjects,
    linkSuggestions,
  } = useEmailContext(selectedEmail);

  // Get emails based on filter
  const emails = emailsData?.emails ?? [];
  const filteredEmails = emails.filter((email) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        email.subject?.toLowerCase().includes(query) ||
        email.fromEmail?.toLowerCase().includes(query) ||
        email.fromName?.toLowerCase().includes(query)
      );
    }

    switch (activeFilter) {
      case "needs-triage":
        return !email.projectId && !email.classification;
      case "by-account":
        return email.accountId !== null;
      case "by-project":
        return email.projectId !== null;
      default:
        return true;
    }
  });

  // Handle email selection
  const handleSelectEmail = useCallback((email: CensusEmail) => {
    setSelectedEmail(email);
  }, []);

  // Handle project linking
  const handleLinkProject = useCallback(
    async (projectId: number) => {
      if (!selectedEmail) {
        return;
      }
      const updated = await linkEmail(selectedEmail.id, projectId);
      if (updated) {
        setSelectedEmail(updated);
        refetchEmails();
      }
    },
    [selectedEmail, linkEmail, refetchEmails]
  );

  // Handle workflow submission
  const handleWorkflowSubmit = useCallback(
    async (submission: WorkflowSubmission) => {
      // Classify the email if a classification is specified
      if (submission.classification) {
        const updated = await classifyEmail(
          submission.emailId,
          submission.classification
        );
        if (updated) {
          setSelectedEmail(updated);
        }
      }
      // Refetch emails to reflect any changes
      refetchEmails();
      // Log for now - in a real app this would call a backend workflow endpoint
      console.log("Workflow submitted:", submission);
    },
    [classifyEmail, refetchEmails]
  );

  // Open workflow modal
  const openWorkflow = useCallback((type: WorkflowType) => {
    setActiveWorkflow(type);
  }, []);

  // Nav links - counts are for current mailbox
  const navLinks: NavLink[] = [
    {
      title: "All",
      icon: Inbox,
      count: emailsData?.total,
      active: activeFilter === "all",
      onClick: () => setActiveFilter("all"),
    },
    {
      title: "Needs Triage",
      icon: Filter,
      count: emails.filter((e) => !e.projectId && !e.classification).length,
      active: activeFilter === "needs-triage",
      onClick: () => setActiveFilter("needs-triage"),
    },
    {
      title: "Linked",
      icon: FolderOpen,
      count: emails.filter((e) => e.projectId !== null).length,
      active: activeFilter === "by-project",
      onClick: () => setActiveFilter("by-project"),
    },
    {
      title: "Has Account",
      icon: Building2,
      count: emails.filter((e) => e.accountId !== null).length,
      active: activeFilter === "by-account",
      onClick: () => setActiveFilter("by-account"),
    },
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <ResizablePanelGroup
        className="h-full items-stretch"
        direction="horizontal"
      >
        {/* Left Panel: Navigation */}
        <ResizablePanel
          defaultSize={18}
          minSize={15}
          maxSize={25}
          className="flex flex-col"
        >
          <div className={cn("flex items-center justify-center px-4", HEADER_HEIGHT)}>
            <h1 className="font-semibold text-lg">Command Center</h1>
          </div>
          <Separator />

          <ScrollArea className="flex-1">
            {/* Mailbox Selector */}
            <div className="p-2 space-y-1">
              <h3 className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
                Mailboxes
              </h3>
              {actionableMailboxes.map((email) => {
                const mailbox = allMailboxes.find((m) => m.email === email);
                const shortName = email.split("@")[0];
                return (
                  <button
                    key={email}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      selectedMailbox === email
                        ? "bg-primary text-primary-foreground font-medium"
                        : "hover:bg-muted/50 text-muted-foreground"
                    )}
                    onClick={() => {
                      setSelectedMailbox(email);
                      setSelectedEmail(null);
                    }}
                  >
                    <Mail className="h-4 w-4" />
                    <span className="flex-1 capitalize">{shortName}</span>
                    {mailbox && (
                      <span className="text-xs tabular-nums opacity-70">
                        {mailbox.emailCount.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <Separator className="my-2" />

            {/* Filters */}
            <div className="p-2 space-y-1">
              <h3 className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">
                Filters
              </h3>
              {navLinks.map((link) => (
                <button
                  key={link.title}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    link.active
                      ? "bg-muted font-medium"
                      : "hover:bg-muted/50 text-muted-foreground"
                  )}
                  onClick={link.onClick}
                >
                  <link.icon className="h-4 w-4" />
                  <span className="flex-1">{link.title}</span>
                  {link.count !== undefined && (
                    <span className="text-xs tabular-nums">
                      {link.count.toLocaleString()}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <Separator className="my-2" />

            {/* Stats */}
            <div className="p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Overview
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg border p-2">
                  <div className="text-2xl font-bold tabular-nums">
                    {statsData?.totalEmails?.toLocaleString() ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">Emails</div>
                </div>
                <div className="rounded-lg border p-2">
                  <div className="text-2xl font-bold tabular-nums">
                    {statsData?.totalEstimates?.toLocaleString() ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">Estimates</div>
                </div>
              </div>
            </div>

            <Separator className="my-2" />

            {/* Workflows Section */}
            <div className="p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">
                Workflows
              </h3>
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  disabled={!selectedEmail}
                  onClick={() => openWorkflow("contract-intake")}
                >
                  <FileText className="h-4 w-4" />
                  Contract Intake
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  disabled={!selectedEmail}
                  onClick={() => openWorkflow("dust-permit")}
                >
                  <TrendingUp className="h-4 w-4" />
                  Dust Permit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  disabled={!selectedEmail}
                  onClick={() => openWorkflow("response-queue")}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Needs Response
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2"
                  disabled={!selectedEmail}
                  onClick={() => openWorkflow("archive")}
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </Button>
              </div>
            </div>
          </ScrollArea>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center Panel: Project Context */}
        <ResizablePanel defaultSize={32} minSize={25}>
          <div className="flex h-full flex-col">
            <div className={cn("flex items-center px-4", HEADER_HEIGHT)}>
              <h2 className="font-semibold">Context</h2>
            </div>
            <Separator />
            <div className="flex-1 overflow-hidden">
              <ProjectContext
                email={selectedEmail}
                account={account}
                project={project}
                projectEmails={projectEmails}
                accountProjects={accountProjects}
                linkSuggestions={linkSuggestions}
                estimates={estimatesData?.estimates ?? []}
                onLinkProject={handleLinkProject}
                onSelectEmail={handleSelectEmail}
              />
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right Panel: Email Inbox */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="flex h-full flex-col">
            <div className={cn("flex items-center gap-4 px-4", HEADER_HEIGHT)}>
              <h2 className="font-semibold">
                {selectedMailbox.split("@")[0]}@
                <span className="text-xs text-muted-foreground ml-1">
                  ({emailsData?.total?.toLocaleString() ?? 0} emails)
                </span>
              </h2>
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search emails..."
                    className="h-8 w-48 pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <Separator />

            {emailsLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground">Loading emails...</div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <CensusMailList
                  emails={filteredEmails}
                  selectedId={selectedEmail?.id ?? null}
                  onSelect={handleSelectEmail}
                />
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Workflow Modal */}
      {activeWorkflow && selectedEmail && (
        <WorkflowModal
          type={activeWorkflow}
          email={selectedEmail}
          onClose={() => setActiveWorkflow(null)}
          onSubmit={handleWorkflowSubmit}
        />
      )}
    </TooltipProvider>
  );
}
