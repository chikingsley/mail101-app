/**
 * Project Context Panel
 *
 * Shows full context when an email is selected:
 * - Account info (contractor)
 * - Project info if linked
 * - Estimate details
 * - Email history
 */

import { format } from "date-fns";
import {
  Building2,
  Calendar,
  DollarSign,
  ExternalLink,
  FileText,
  Link2,
  Mail,
  MapPin,
  MessageSquare,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type {
  CensusAccount,
  CensusEmail,
  CensusEstimate,
  CensusProject,
  LinkSuggestion,
} from "@/lib/census-types";
import { cn } from "@/lib/utils";
import { DecisionChecks } from "./decision-checks";

interface ProjectContextProps {
  email: CensusEmail | null;
  account: CensusAccount | null;
  project: CensusProject | null;
  projectEmails: CensusEmail[];
  accountProjects: CensusProject[];
  linkSuggestions: LinkSuggestion[];
  estimates: CensusEstimate[];
  onLinkProject?: (projectId: number) => void;
  onSelectEmail?: (email: CensusEmail) => void;
}

export function ProjectContext({
  email,
  account,
  project,
  projectEmails,
  accountProjects,
  linkSuggestions,
  estimates,
  onLinkProject,
  onSelectEmail,
}: ProjectContextProps) {
  if (!email) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-muted-foreground">
        <div className="text-center">
          <Mail className="mx-auto mb-4 h-12 w-12 opacity-50" />
          <p>Select an email to see context</p>
        </div>
      </div>
    );
  }

  // Find matching estimate by project name or account domain
  const matchingEstimate = estimates.find(
    (e) =>
      (project && e.name.toLowerCase().includes(project.name.toLowerCase())) ||
      (account && e.accountDomain === account.domain)
  );

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Breadcrumb / Current Selection */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {account && (
              <>
                <span>{account.name}</span>
                {project && (
                  <>
                    <span>/</span>
                    <span className="font-medium text-foreground">
                      {project.name}
                    </span>
                  </>
                )}
              </>
            )}
            {!account && !project && (
              <span className="italic">No linked context</span>
            )}
          </div>
        </div>

        <Separator />

        {/* Decision Checks */}
        <section className="space-y-3">
          <h3 className="font-semibold text-sm">Checks</h3>
          <DecisionChecks email={email} estimate={matchingEstimate ?? null} />
        </section>

        <Separator />

        {/* Account Section */}
        {account && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-sm">
              <Building2 className="h-4 w-4" />
              Account
            </h3>
            <div className="rounded-lg border p-3 space-y-2">
              <div className="font-medium">{account.name}</div>
              <div className="text-sm text-muted-foreground">
                {account.domain}
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{account.emailCount} emails</span>
                <span>{account.contactCount} contacts</span>
              </div>
              <Badge variant="secondary" className="capitalize">
                {account.type}
              </Badge>
            </div>
          </section>
        )}

        {/* Project Section (if linked) */}
        {project && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-sm">
              <FileText className="h-4 w-4" />
              Project
            </h3>
            <div className="rounded-lg border p-3 space-y-2">
              <div className="font-medium">{project.name}</div>
              {project.address && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {project.address}
                </div>
              )}
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{project.emailCount} emails</span>
                {project.firstSeen && (
                  <span>
                    Since {format(new Date(project.firstSeen), "MMM yyyy")}
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Estimate Section */}
        {matchingEstimate && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-sm">
              <DollarSign className="h-4 w-4" />
              Estimate
            </h3>
            <div className="rounded-lg border p-3 space-y-2">
              <div className="font-medium">{matchingEstimate.name}</div>
              {matchingEstimate.estimateNumber && (
                <div className="text-sm text-muted-foreground">
                  #{matchingEstimate.estimateNumber}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {matchingEstimate.bidValue && (
                  <Badge variant="outline">
                    ${matchingEstimate.bidValue.toLocaleString()}
                  </Badge>
                )}
                {matchingEstimate.bidStatus && (
                  <Badge
                    variant={
                      matchingEstimate.awarded ? "default" : "secondary"
                    }
                  >
                    {matchingEstimate.bidStatus}
                  </Badge>
                )}
                {matchingEstimate.location && (
                  <Badge variant="outline">
                    <MapPin className="mr-1 h-3 w-3" />
                    {matchingEstimate.location}
                  </Badge>
                )}
              </div>
              {matchingEstimate.dueDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Due: {format(new Date(matchingEstimate.dueDate), "MMM d, yyyy")}
                </div>
              )}
              {matchingEstimate.sharepointUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  asChild
                >
                  <a
                    href={matchingEstimate.sharepointUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    Open in SharePoint
                  </a>
                </Button>
              )}
            </div>
          </section>
        )}

        {/* Link Suggestions (if not linked) */}
        {!project && linkSuggestions.length > 0 && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-sm">
              <Link2 className="h-4 w-4" />
              Suggested Links
            </h3>
            <div className="space-y-2">
              {linkSuggestions.map((suggestion) => {
                // Get signal icon based on type
                const SignalIcon =
                  suggestion.signalType === "conversation"
                    ? MessageSquare
                    : suggestion.signalType === "sender"
                      ? User
                      : suggestion.signalType === "domain"
                        ? Building2
                        : FileText;

                return (
                  <div
                    key={suggestion.projectId}
                    className={cn(
                      "rounded-lg border p-3 space-y-2 transition-colors",
                      suggestion.confidence > 0.8 && "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SignalIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium text-sm">
                          {suggestion.project?.name ??
                            `Project #${suggestion.projectId}`}
                        </span>
                      </div>
                      <Badge
                        variant={
                          suggestion.confidence > 0.8
                            ? "default"
                            : suggestion.confidence > 0.6
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {Math.round(suggestion.confidence * 100)}%
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {suggestion.reason}
                    </p>
                    {onLinkProject && (
                      <Button
                        size="sm"
                        variant={
                          suggestion.confidence > 0.8 ? "default" : "secondary"
                        }
                        onClick={() => onLinkProject(suggestion.projectId)}
                      >
                        Link to this project
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Account's Other Projects */}
        {accountProjects.length > 1 && (
          <section className="space-y-3">
            <h3 className="font-semibold text-sm">
              Other Projects ({accountProjects.length - 1})
            </h3>
            <div className="space-y-1">
              {accountProjects
                .filter((p) => p.id !== project?.id)
                .slice(0, 5)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-muted"
                  >
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.emailCount} emails
                    </span>
                  </div>
                ))}
            </div>
          </section>
        )}

        <Separator />

        {/* Email History for Project */}
        {projectEmails.length > 0 && (
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 font-semibold text-sm">
              <Mail className="h-4 w-4" />
              Email History ({projectEmails.length})
            </h3>
            <div className="space-y-1">
              {projectEmails.slice(0, 10).map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={cn(
                    "w-full text-left rounded px-2 py-1.5 text-sm hover:bg-muted",
                    e.id === email.id && "bg-muted"
                  )}
                  onClick={() => onSelectEmail?.(e)}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate font-medium">
                      {e.subject ?? "(No subject)"}
                    </span>
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {format(new Date(e.receivedAt), "MMM d")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {e.fromName ?? e.fromEmail}
                  </div>
                </button>
              ))}
              {projectEmails.length > 10 && (
                <div className="text-center text-xs text-muted-foreground py-2">
                  + {projectEmails.length - 10} more
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </ScrollArea>
  );
}
