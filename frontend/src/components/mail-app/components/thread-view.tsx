import { useEffect, useState } from "react";
import { useSession } from "@clerk/clerk-react";
import { ChevronDown, ChevronRight, Loader2, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { EmailBody } from "./email-body";
import type { EmailActions } from "./mail";

const BACKEND_URL = process.env.BUN_PUBLIC_BACKEND_URL || "http://localhost:8000";

interface ThreadEmail {
	id: number;
	outlook_id: string;
	conversation_id: string | null;
	from_email: string;
	from_name: string | null;
	subject: string | null;
	body_preview: string | null;
	to_emails: string[];
	cc_emails: string[];
	is_read: boolean;
	has_attachments: boolean;
	received_at: string;
	sent_at: string | null;
	flag_status: string;
	flag_color: string | null;
}

interface Thread {
	conversationId: string;
	subject: string;
	participantCount: number;
	messageCount: number;
	emails: ThreadEmail[];
}

interface ThreadViewProps {
	conversationId: string;
	emailActions: EmailActions;
}

export function ThreadView({ conversationId, emailActions }: ThreadViewProps) {
	const { session } = useSession();
	const [thread, setThread] = useState<Thread | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [expandedEmails, setExpandedEmails] = useState<Set<number>>(new Set());

	useEffect(() => {
		const fetchThread = async () => {
			if (!session || !conversationId) return;

			setLoading(true);
			setError(null);

			try {
				const token = await session.getToken();
				const response = await fetch(
					`${BACKEND_URL}/api/emails/thread/${encodeURIComponent(conversationId)}`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
						},
					}
				);

				const data = await response.json();

				if (data.success && data.thread) {
					setThread(data.thread);
					// Expand the last email by default
					if (data.thread.emails.length > 0) {
						const lastEmail = data.thread.emails[data.thread.emails.length - 1];
						setExpandedEmails(new Set([lastEmail.id]));
					}
				} else {
					setError(data.error || "Failed to load thread");
				}
			} catch (err) {
				console.error("Failed to fetch thread:", err);
				setError("Failed to load thread");
			} finally {
				setLoading(false);
			}
		};

		fetchThread();
	}, [session, conversationId]);

	const toggleEmail = (emailId: number) => {
		setExpandedEmails((prev) => {
			const next = new Set(prev);
			if (next.has(emailId)) {
				next.delete(emailId);
			} else {
				next.add(emailId);
			}
			return next;
		});
	};

	const formatDate = (dateStr: string) => {
		return new Date(dateStr).toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	};

	if (loading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (error || !thread) {
		return (
			<div className="flex h-full items-center justify-center">
				<p className="text-muted-foreground">{error || "Thread not found"}</p>
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col min-h-0">
			{/* Thread header */}
			<div className="border-b p-4">
				<h2 className="text-lg font-semibold">{thread.subject}</h2>
				<div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
					<span className="flex items-center gap-1">
						<Users className="h-4 w-4" />
						{thread.participantCount} participants
					</span>
					<span>{thread.messageCount} messages in this conversation</span>
				</div>
			</div>

			{/* Thread messages */}
			<div className="flex-1 overflow-auto">
				<div className="divide-y">
					{thread.emails.map((email, index) => {
						const isExpanded = expandedEmails.has(email.id);
						const isLast = index === thread.emails.length - 1;

						return (
							<Collapsible
								key={email.id}
								open={isExpanded}
								onOpenChange={() => toggleEmail(email.id)}
							>
								<CollapsibleTrigger asChild>
									<button
										className={cn(
											"flex w-full items-start gap-3 p-4 text-left hover:bg-accent/50 transition-colors",
											isExpanded && "bg-accent/30"
										)}
									>
										<div className="mt-1">
											{isExpanded ? (
												<ChevronDown className="h-4 w-4 text-muted-foreground" />
											) : (
												<ChevronRight className="h-4 w-4 text-muted-foreground" />
											)}
										</div>
										<Avatar className="h-8 w-8">
											<AvatarFallback className="text-xs">
												{(email.from_name || email.from_email)
													.split(" ")
													.map((chunk) => chunk[0])
													.join("")
													.slice(0, 2)
													.toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<span className={cn("font-medium", !email.is_read && "font-semibold")}>
													{email.from_name || email.from_email}
												</span>
												{!email.is_read && (
													<span className="h-2 w-2 rounded-full bg-blue-600" />
												)}
											</div>
											{!isExpanded && (
												<p className="text-sm text-muted-foreground line-clamp-1">
													{email.body_preview}
												</p>
											)}
										</div>
										<span className="text-xs text-muted-foreground whitespace-nowrap">
											{formatDate(email.received_at)}
										</span>
									</button>
								</CollapsibleTrigger>
								<CollapsibleContent>
									<div className="border-l-2 border-muted ml-6 pl-4">
										{/* Email details */}
										<div className="px-4 py-2 text-sm text-muted-foreground">
											<div>
												<span className="font-medium">From:</span> {email.from_name || email.from_email} &lt;{email.from_email}&gt;
											</div>
											{email.to_emails.length > 0 && (
												<div>
													<span className="font-medium">To:</span> {email.to_emails.join(", ")}
												</div>
											)}
											{email.cc_emails.length > 0 && (
												<div>
													<span className="font-medium">Cc:</span> {email.cc_emails.join(", ")}
												</div>
											)}
										</div>
										<Separator />
										{/* Email body */}
										<EmailBody
											emailId={email.id.toString()}
											fallbackText={email.body_preview || ""}
										/>
									</div>
								</CollapsibleContent>
							</Collapsible>
						);
					})}
				</div>
			</div>
		</div>
	);
}
