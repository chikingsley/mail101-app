import {
	Archive,
	ArchiveX,
	Flag,
	Forward,
	Mail,
	MailOpen,
	MoreVertical,
	MousePointerClickIcon,
	Reply,
	ReplyAll,
	Trash2,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { EmailWithFlags } from "@/App";
import type { EmailActions } from "./mail";
import type { FlagColor } from "@/hooks/use-email-actions";
import { EmailBody } from "./email-body";
import { ThreadView } from "./thread-view";

// Flag color options
const FLAG_COLORS: { color: FlagColor; label: string; className: string }[] = [
	{ color: 'red', label: 'Red', className: 'bg-red-500' },
	{ color: 'orange', label: 'Orange', className: 'bg-orange-500' },
	{ color: 'yellow', label: 'Yellow', className: 'bg-yellow-500' },
	{ color: 'green', label: 'Green', className: 'bg-green-500' },
	{ color: 'blue', label: 'Blue', className: 'bg-blue-500' },
	{ color: 'purple', label: 'Purple', className: 'bg-purple-500' },
];

interface MailDisplayProps {
	mail: EmailWithFlags | null;
	emailActions: EmailActions;
}

export function MailDisplay({ mail, emailActions }: MailDisplayProps) {
	const [isDeleting, setIsDeleting] = useState(false);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const lastMarkedReadId = useRef<string | null>(null);

	// Auto mark as read when viewing an email
	useEffect(() => {
		if (mail && !mail.read && mail.id !== lastMarkedReadId.current) {
			lastMarkedReadId.current = mail.id;
			// Small delay to avoid marking as read on quick scrolls
			const timer = setTimeout(() => {
				emailActions.markAsRead(mail.id).catch(console.error);
			}, 500);
			return () => clearTimeout(timer);
		}
	}, [mail?.id, mail?.read, emailActions]);

	const handleToggleRead = async () => {
		if (!mail) return;
		try {
			if (mail.read) {
				await emailActions.markAsUnread(mail.id);
			} else {
				await emailActions.markAsRead(mail.id);
			}
		} catch (error) {
			console.error('Failed to toggle read status:', error);
		}
	};

	const handleSetFlag = async (color: FlagColor) => {
		if (!mail) return;
		try {
			await emailActions.addFlag(mail.id, color);
		} catch (error) {
			console.error('Failed to set flag:', error);
		}
	};

	const handleRemoveFlag = async () => {
		if (!mail) return;
		try {
			await emailActions.removeFlag(mail.id);
		} catch (error) {
			console.error('Failed to remove flag:', error);
		}
	};

	const handleArchive = async () => {
		if (!mail) return;
		try {
			await emailActions.archive(mail.id);
		} catch (error) {
			console.error('Failed to archive:', error);
		}
	};

	const handleMoveToJunk = async () => {
		if (!mail) return;
		try {
			await emailActions.moveToJunk(mail.id);
		} catch (error) {
			console.error('Failed to move to junk:', error);
		}
	};

	const handleMoveToTrash = async () => {
		if (!mail) return;
		try {
			await emailActions.moveToTrash(mail.id);
		} catch (error) {
			console.error('Failed to move to trash:', error);
		}
	};

	const handleDelete = async () => {
		if (!mail) return;
		setIsDeleting(true);
		try {
			await emailActions.deleteEmail(mail.id);
			setShowDeleteDialog(false);
		} catch (error) {
			console.error('Failed to delete:', error);
		} finally {
			setIsDeleting(false);
		}
	};

	// Get the current flag color class for display
	const getFlagColorClass = () => {
		if (!mail?.flagColor) return '';
		const found = FLAG_COLORS.find(f => f.color === mail.flagColor);
		return found?.className || '';
	};

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 p-2">
				{/* Left action buttons */}
				<div className="flex items-center gap-2">
					{/* Read/Unread toggle */}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								disabled={!mail}
								onClick={handleToggleRead}
							>
								{mail?.read ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
								<span className="sr-only">{mail?.read ? 'Mark as unread' : 'Mark as read'}</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>{mail?.read ? 'Mark as unread' : 'Mark as read'}</TooltipContent>
					</Tooltip>

					{/* Flag dropdown */}
					<DropdownMenu>
						<Tooltip>
							<TooltipTrigger asChild>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="icon" disabled={!mail} className="relative">
										<Flag className="h-4 w-4" />
										{mail?.flagStatus === 'flagged' && mail?.flagColor && (
											<span className={`absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${getFlagColorClass()}`} />
										)}
										<span className="sr-only">Flag</span>
									</Button>
								</DropdownMenuTrigger>
							</TooltipTrigger>
							<TooltipContent>Flag</TooltipContent>
						</Tooltip>
						<DropdownMenuContent align="start">
							{FLAG_COLORS.map(({ color, label, className }) => (
								<DropdownMenuItem
									key={color}
									onClick={() => handleSetFlag(color)}
									className="flex items-center gap-2"
								>
									<span className={`h-3 w-3 rounded-full ${className}`} />
									{label}
								</DropdownMenuItem>
							))}
							{mail?.flagStatus === 'flagged' && (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={handleRemoveFlag}>
										Clear flag
									</DropdownMenuItem>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>

					<Separator orientation="vertical" className="h-6" />

					{/* Archive */}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								disabled={!mail}
								onClick={handleArchive}
							>
								<Archive className="h-4 w-4" />
								<span className="sr-only">Archive</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Archive</TooltipContent>
					</Tooltip>

					{/* Move to Junk */}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								disabled={!mail}
								onClick={handleMoveToJunk}
							>
								<ArchiveX className="h-4 w-4" />
								<span className="sr-only">Move to junk</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Move to junk</TooltipContent>
					</Tooltip>

					{/* Move to Trash */}
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								disabled={!mail}
								onClick={handleMoveToTrash}
							>
								<Trash2 className="h-4 w-4" />
								<span className="sr-only">Move to trash</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Move to trash</TooltipContent>
					</Tooltip>
				</div>

				{/* Right action buttons */}
				<div className="ml-auto flex items-center gap-2">
					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="icon" disabled={!mail}>
								<Reply className="h-4 w-4" />
								<span className="sr-only">Reply</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Reply</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="icon" disabled={!mail}>
								<ReplyAll className="h-4 w-4" />
								<span className="sr-only">Reply all</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Reply all</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button variant="ghost" size="icon" disabled={!mail}>
								<Forward className="h-4 w-4" />
								<span className="sr-only">Forward</span>
							</Button>
						</TooltipTrigger>
						<TooltipContent>Forward</TooltipContent>
					</Tooltip>
				</div>

				<Separator orientation="vertical" className="h-6" />

				{/* More menu */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" size="icon" disabled={!mail}>
							<MoreVertical className="h-4 w-4" />
							<span className="sr-only">More</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={handleToggleRead}>
							{mail?.read ? 'Mark as unread' : 'Mark as read'}
						</DropdownMenuItem>
						<DropdownMenuItem onClick={handleArchive}>
							Archive
						</DropdownMenuItem>
						<DropdownMenuItem onClick={handleMoveToJunk}>
							Move to junk
						</DropdownMenuItem>
						<DropdownMenuItem onClick={handleMoveToTrash}>
							Move to trash
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							onClick={() => setShowDeleteDialog(true)}
							className="text-destructive focus:text-destructive"
						>
							Delete permanently
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<Separator />

			{mail ? (
				mail.threadCount > 1 && mail.conversationId ? (
					// Show thread view for emails with multiple messages in conversation
					<ThreadView
						conversationId={mail.conversationId}
						emailActions={emailActions}
					/>
				) : (
					// Show single email view
					<div className="flex flex-1 flex-col min-h-0">
						<div className="flex items-start p-4">
							<div className="flex items-start gap-4 text-sm">
								<Avatar>
									<AvatarFallback>
										{mail.name
											.split(" ")
											.map((chunk) => chunk[0])
											.join("")}
									</AvatarFallback>
								</Avatar>
								<div className="grid gap-1">
									<div className="font-semibold">{mail.name}</div>
									<div className="line-clamp-1 text-xs">{mail.subject}</div>
									<div className="line-clamp-1 text-xs">
										<span className="font-medium">Reply-To:</span> {mail.email}
									</div>
								</div>
							</div>
							{mail.date && (
								<div className="text-muted-foreground ml-auto text-xs">
									{mail.date}
								</div>
							)}
						</div>
						<Separator />
						<div className="flex-1 overflow-auto">
							<EmailBody emailId={mail.id} fallbackText={mail.text} />
						</div>
					</div>
				)
			) : (
				<div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
					<MousePointerClickIcon className="size-8 opacity-50" />
					No message selected
				</div>
			)}

			{/* Delete confirmation dialog */}
			<AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete email permanently?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the email
							from your account.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							disabled={isDeleting}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{isDeleting ? 'Deleting...' : 'Delete'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
