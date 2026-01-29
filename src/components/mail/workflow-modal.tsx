/**
 * Workflow Trigger Modals
 *
 * Modals for triggering workflows from emails:
 * - Contract Intake
 * - Dust Permit
 * - Response Queue
 * - Archive
 */

import { format } from "date-fns";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  FileText,
  Loader2,
  TrendingUp,
  X,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { CensusEmail, EmailClassification } from "@/lib/census-types";
import { cn } from "@/lib/utils";

export type WorkflowType =
  | "contract-intake"
  | "dust-permit"
  | "response-queue"
  | "archive";

interface WorkflowModalProps {
  type: WorkflowType;
  email: CensusEmail;
  onClose: () => void;
  onSubmit: (data: WorkflowSubmission) => Promise<void>;
}

export interface WorkflowSubmission {
  type: WorkflowType;
  emailId: number;
  classification?: EmailClassification;
  notes?: string;
  projectName?: string;
  dueDate?: string;
}

const WORKFLOW_CONFIG: Record<
  WorkflowType,
  {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    classification: EmailClassification | null;
    color: string;
  }
> = {
  "contract-intake": {
    title: "Contract Intake",
    description:
      "Start contract review workflow. The contract will be analyzed and validated.",
    icon: FileText,
    classification: "CONTRACT",
    color: "text-blue-600",
  },
  "dust-permit": {
    title: "Dust Permit",
    description:
      "Initiate dust permit workflow. Deadline tracking will be set up.",
    icon: TrendingUp,
    classification: "DUST_PERMIT",
    color: "text-orange-600",
  },
  "response-queue": {
    title: "Needs Response",
    description: "Add to response queue. You'll be reminded to respond.",
    icon: AlertTriangle,
    classification: null,
    color: "text-yellow-600",
  },
  archive: {
    title: "Archive",
    description: "Archive this email. It will be marked as processed.",
    icon: Archive,
    classification: null,
    color: "text-gray-600",
  },
};

export function WorkflowModal({
  type,
  email,
  onClose,
  onSubmit,
}: WorkflowModalProps) {
  const config = WORKFLOW_CONFIG[type];
  const Icon = config.icon;

  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [projectName, setProjectName] = useState(email.projectName ?? "");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit({
        type,
        emailId: email.id,
        classification: config.classification ?? undefined,
        notes: notes || undefined,
        projectName: projectName || undefined,
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Workflow error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-background shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-3">
            <Icon className={cn("h-5 w-5", config.color)} />
            <h2 className="font-semibold text-lg">{config.title}</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[60vh]">
          <div className="p-4 space-y-4">
            {success ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="mb-4 h-12 w-12 text-green-500" />
                <p className="text-lg font-medium">Workflow Started!</p>
                <p className="text-sm text-muted-foreground">
                  {config.title} has been initiated.
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  {config.description}
                </p>

                {/* Email Preview */}
                <div className="rounded-lg border p-3 bg-muted/50">
                  <div className="font-medium">{email.subject}</div>
                  <div className="text-sm text-muted-foreground">
                    From: {email.fromName ?? email.fromEmail}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(email.receivedAt), "PPp")}
                  </div>
                  {email.hasAttachments && (
                    <Badge variant="outline" className="mt-2 text-xs">
                      📎 {email.attachmentNames?.length ?? 0} attachments
                    </Badge>
                  )}
                </div>

                <Separator />

                {/* Project Name (for contract/dust permit) */}
                {(type === "contract-intake" || type === "dust-permit") && (
                  <div className="space-y-2">
                    <Label htmlFor="projectName">Project Name</Label>
                    <Input
                      id="projectName"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="Enter project name..."
                    />
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any notes..."
                    rows={3}
                  />
                </div>

                {/* Classification Info */}
                {config.classification && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Email will be classified as:
                    </span>
                    <Badge>{config.classification}</Badge>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        {!success && (
          <div className="flex justify-end gap-2 border-t p-4">
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Start {config.title}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
