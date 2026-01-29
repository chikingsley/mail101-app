/**
 * Decision Checks
 *
 * Analyzes email context and surfaces important flags:
 * - At-risk threshold (contract value > $22k)
 * - Location-based rules (Tucson vs Phoenix)
 * - Urgency scoring
 * - VIP sender detection
 */

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  DollarSign,
  MapPin,
  Star,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CensusEmail, CensusEstimate } from "@/lib/census-types";
import { cn } from "@/lib/utils";

// VIP senders that should always surface
const VIP_SENDERS = [
  "jayson@desertservices.net",
  "jeff@desertservices.net",
];

// Urgent keywords in subject
const URGENT_KEYWORDS = [
  "urgent",
  "asap",
  "eod",
  "action required",
  "deadline",
  "immediate",
  "past due",
  "final notice",
  "time sensitive",
  "today",
];

// At-risk threshold in dollars
const AT_RISK_THRESHOLD = 22000;

export interface DecisionCheck {
  id: string;
  type: "warning" | "info" | "success" | "error";
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface DecisionChecksProps {
  email: CensusEmail;
  estimate: CensusEstimate | null;
}

export function runDecisionChecks(
  email: CensusEmail,
  estimate: CensusEstimate | null
): DecisionCheck[] {
  const checks: DecisionCheck[] = [];
  const now = new Date();
  const receivedDate = new Date(email.receivedAt);
  const daysSinceReceived = Math.floor(
    (now.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Check 1: At-risk threshold
  if (estimate?.bidValue && estimate.bidValue >= AT_RISK_THRESHOLD) {
    checks.push({
      id: "at-risk",
      type: "warning",
      title: "At-Risk Territory",
      description: `Contract value $${estimate.bidValue.toLocaleString()} exceeds $22k threshold`,
      icon: DollarSign,
    });
  }

  // Check 2: Location rules
  if (estimate?.location) {
    const location = estimate.location.toLowerCase();
    if (location.includes("tucson")) {
      checks.push({
        id: "tucson",
        type: "info",
        title: "Tucson Location",
        description: "Apply Tucson rules: No rock entrances, different rates",
        icon: MapPin,
      });
    } else if (
      location.includes("out of state") ||
      location.includes("out-of-state")
    ) {
      checks.push({
        id: "out-of-state",
        type: "warning",
        title: "Out of State",
        description: "Review travel and logistics requirements",
        icon: MapPin,
      });
    }
  }

  // Check 3: VIP sender
  if (email.fromEmail && VIP_SENDERS.includes(email.fromEmail.toLowerCase())) {
    checks.push({
      id: "vip",
      type: "warning",
      title: "VIP Sender",
      description: `Email from ${email.fromName ?? email.fromEmail} - always review`,
      icon: Star,
    });
  }

  // Check 4: Urgent keywords in subject
  const subjectLower = email.subject?.toLowerCase() ?? "";
  const foundUrgentKeyword = URGENT_KEYWORDS.find((kw) =>
    subjectLower.includes(kw)
  );
  if (foundUrgentKeyword) {
    checks.push({
      id: "urgent-keyword",
      type: "warning",
      title: "Urgent Language",
      description: `Subject contains "${foundUrgentKeyword}"`,
      icon: AlertTriangle,
    });
  }

  // Check 5: Age-based urgency
  if (daysSinceReceived > 7) {
    checks.push({
      id: "overdue",
      type: "error",
      title: "Overdue",
      description: `Email is ${daysSinceReceived} days old - needs immediate attention`,
      icon: Clock,
    });
  } else if (daysSinceReceived > 3) {
    checks.push({
      id: "aging",
      type: "warning",
      title: "Aging",
      description: `Email is ${daysSinceReceived} days old - needs attention soon`,
      icon: Clock,
    });
  }

  // Check 6: Has attachments (potential contract/document)
  if (email.hasAttachments) {
    const attachmentNames = email.attachmentNames ?? [];
    const hasPdf = attachmentNames.some((name) =>
      name.toLowerCase().endsWith(".pdf")
    );
    if (hasPdf) {
      checks.push({
        id: "pdf-attachment",
        type: "info",
        title: "PDF Attachment",
        description: `Contains PDF that may need review`,
        icon: CheckCircle2,
      });
    }
  }

  // Check 7: Already linked (positive check)
  if (email.projectId) {
    checks.push({
      id: "linked",
      type: "success",
      title: "Linked to Project",
      description: `Email is linked to project`,
      icon: CheckCircle2,
    });
  }

  // Check 8: Already classified (positive check)
  if (email.classification) {
    checks.push({
      id: "classified",
      type: "success",
      title: "Classified",
      description: `Classified as ${email.classification}`,
      icon: CheckCircle2,
    });
  }

  return checks;
}

export function DecisionChecks({ email, estimate }: DecisionChecksProps) {
  const checks = runDecisionChecks(email, estimate);

  if (checks.length === 0) {
    return null;
  }

  // Group by type
  const warnings = checks.filter(
    (c) => c.type === "warning" || c.type === "error"
  );
  const infos = checks.filter((c) => c.type === "info");
  const successes = checks.filter((c) => c.type === "success");

  return (
    <div className="space-y-2">
      {warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((check) => (
            <CheckItem key={check.id} check={check} />
          ))}
        </div>
      )}
      {infos.length > 0 && (
        <div className="space-y-1">
          {infos.map((check) => (
            <CheckItem key={check.id} check={check} />
          ))}
        </div>
      )}
      {successes.length > 0 && (
        <div className="space-y-1">
          {successes.map((check) => (
            <CheckItem key={check.id} check={check} />
          ))}
        </div>
      )}
    </div>
  );
}

function CheckItem({ check }: { check: DecisionCheck }) {
  const Icon = check.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg p-2 text-sm",
        check.type === "error" && "bg-red-50 dark:bg-red-950/20",
        check.type === "warning" && "bg-yellow-50 dark:bg-yellow-950/20",
        check.type === "info" && "bg-blue-50 dark:bg-blue-950/20",
        check.type === "success" && "bg-green-50 dark:bg-green-950/20"
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          check.type === "error" && "text-red-600",
          check.type === "warning" && "text-yellow-600",
          check.type === "info" && "text-blue-600",
          check.type === "success" && "text-green-600"
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="font-medium">{check.title}</div>
        <div className="text-xs text-muted-foreground">{check.description}</div>
      </div>
    </div>
  );
}

/**
 * Calculate overall urgency score (0-1)
 */
export function calculateUrgencyScore(
  email: CensusEmail,
  estimate: CensusEstimate | null
): number {
  let score = 0;

  const now = new Date();
  const receivedDate = new Date(email.receivedAt);
  const daysSince = Math.floor(
    (now.getTime() - receivedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Age factor (0.3 max)
  if (daysSince > 7) {
    score += 0.3;
  } else if (daysSince > 3) {
    score += 0.15;
  }

  // VIP sender (0.3 max)
  if (
    email.fromEmail &&
    VIP_SENDERS.includes(email.fromEmail.toLowerCase())
  ) {
    score += 0.3;
  }

  // Urgent keywords (0.2 max)
  const subjectLower = email.subject?.toLowerCase() ?? "";
  if (URGENT_KEYWORDS.some((kw) => subjectLower.includes(kw))) {
    score += 0.2;
  }

  // At-risk value (0.2 max)
  if (estimate?.bidValue && estimate.bidValue >= AT_RISK_THRESHOLD) {
    score += 0.2;
  }

  return Math.min(score, 1);
}

/**
 * Get urgency level based on score
 */
export function getUrgencyLevel(
  score: number
): "high" | "medium" | "low" {
  if (score >= 0.5) {
    return "high";
  }
  if (score >= 0.25) {
    return "medium";
  }
  return "low";
}
