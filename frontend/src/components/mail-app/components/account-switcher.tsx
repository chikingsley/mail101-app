import * as React from "react";
import { useUser, useClerk } from "@clerk/clerk-react";
import { LogOut, Settings } from "lucide-react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface AccountSwitcherProps {
	isCollapsed: boolean;
}

export function AccountSwitcher({ isCollapsed }: AccountSwitcherProps) {
	const { user } = useUser();
	const { signOut, openUserProfile } = useClerk();

	if (!user) return null;

	const userName = user.fullName || user.firstName || "User";
	const userEmail = user.primaryEmailAddress?.emailAddress || "";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<button
					type="button"
					className={cn(
						"hover:bg-accent/70 bg-background flex w-full items-center gap-2 rounded-md border border-transparent p-2 transition-colors",
						isCollapsed && "h-9 w-9 justify-center p-0",
					)}
				>
					<img
						src={user.imageUrl}
						alt={userName}
						className={cn(
							"h-6 w-6 rounded-full",
							isCollapsed ? "h-8 w-8" : "h-6 w-6",
						)}
					/>
					{!isCollapsed && (
						<div className="flex flex-col items-start text-left">
							<span className="text-sm font-medium">{userName}</span>
							<span className="text-xs text-muted-foreground">{userEmail}</span>
						</div>
					)}
				</button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
				<DropdownMenuItem onClick={() => openUserProfile()}>
					<Settings className="mr-2 h-4 w-4" />
					Manage Account
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => signOut()}>
					<LogOut className="mr-2 h-4 w-4" />
					Sign Out
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
