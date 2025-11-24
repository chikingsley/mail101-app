import {
	Archive,
	ArchiveX,
	File,
	Inbox,
	Send,
	Trash2,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AccountSwitcher } from "./account-switcher";
import { Nav } from "./nav";
import type { MailFolder, FolderCounts } from "@/App";

interface NavDesktopProps {
	isCollapsed: boolean;
	currentFolder: MailFolder;
	folderCounts: FolderCounts;
	onFolderChange: (folder: MailFolder) => void;
}

export function NavDesktop({
	isCollapsed,
	currentFolder,
	folderCounts,
	onFolderChange,
}: NavDesktopProps) {
	// Helper to format count - show unread count or empty string if 0
	const formatCount = (folder: MailFolder): string => {
		const count = folderCounts[folder]?.unread || 0;
		return count > 0 ? count.toString() : "";
	};

	return (
		<>
			<div
				className={cn(
					"flex h-[52px] items-center justify-center",
					isCollapsed ? "h-[52px]" : "px-2",
				)}
			>
				<AccountSwitcher isCollapsed={isCollapsed} />
			</div>

			<Separator />

			<Nav
				isCollapsed={isCollapsed}
				links={[
					{
						title: "Inbox",
						label: formatCount("inbox"),
						icon: Inbox,
						variant: currentFolder === "inbox" ? "default" : "ghost",
						onClick: () => onFolderChange("inbox"),
					},
					{
						title: "Drafts",
						label: formatCount("drafts"),
						icon: File,
						variant: currentFolder === "drafts" ? "default" : "ghost",
						onClick: () => onFolderChange("drafts"),
					},
					{
						title: "Sent",
						label: formatCount("sentitems"),
						icon: Send,
						variant: currentFolder === "sentitems" ? "default" : "ghost",
						onClick: () => onFolderChange("sentitems"),
					},
					{
						title: "Junk",
						label: formatCount("junkemail"),
						icon: ArchiveX,
						variant: currentFolder === "junkemail" ? "default" : "ghost",
						onClick: () => onFolderChange("junkemail"),
					},
					{
						title: "Trash",
						label: formatCount("deleteditems"),
						icon: Trash2,
						variant: currentFolder === "deleteditems" ? "default" : "ghost",
						onClick: () => onFolderChange("deleteditems"),
					},
					{
						title: "Archive",
						label: formatCount("archive"),
						icon: Archive,
						variant: currentFolder === "archive" ? "default" : "ghost",
						onClick: () => onFolderChange("archive"),
					},
				]}
			/>
		</>
	);
}
