import { formatDistanceToNow } from "date-fns";
import { Flag, MessageSquare } from "lucide-react";
import { memo, useCallback, type ComponentProps } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { EmailWithFlags } from "@/App";
import { useMailStore } from "../use-mail";

// Flag color mapping
const FLAG_COLOR_CLASSES: Record<string, string> = {
	red: 'text-red-500',
	orange: 'text-orange-500',
	yellow: 'text-yellow-500',
	green: 'text-green-500',
	blue: 'text-blue-500',
	purple: 'text-purple-500',
};

// Animation variants - kept minimal for performance
const itemVariants = {
	initial: { opacity: 0, x: -20 },
	animate: { opacity: 1, x: 0 },
	exit: { opacity: 0, x: 100, transition: { duration: 0.2 } },
};

interface EmailItemProps {
	item: EmailWithFlags;
	isSelected: boolean;
	onSelect: (item: EmailWithFlags) => void;
}

// Memoized email item - only re-renders when its specific props change
const EmailItem = memo(function EmailItem({ item, isSelected, onSelect }: EmailItemProps) {
	const handleClick = useCallback(() => {
		onSelect(item);
	}, [onSelect, item]);

	return (
		<motion.button
			type="button"
			layout
			variants={itemVariants}
			initial="initial"
			animate="animate"
			exit="exit"
			transition={{ duration: 0.15 }}
			className={cn(
				"hover:bg-accent/70 flex flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm transition-colors w-full",
				isSelected && "bg-accent/70",
			)}
			onClick={handleClick}
		>
			<div className="flex w-full flex-col gap-1">
				<div className="flex items-center">
					<div className="flex items-center gap-2">
						<div className="font-semibold">{item.name}</div>
						{!item.read && (
							<span className="flex h-2 w-2 rounded-full bg-blue-600" />
						)}
						{item.flagStatus === 'flagged' && item.flagColor && (
							<Flag className={cn("h-3 w-3", FLAG_COLOR_CLASSES[item.flagColor])} />
						)}
						{item.threadCount > 1 && (
							<span className="flex items-center gap-0.5 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
								<MessageSquare className="h-3 w-3" />
								{item.threadCount}
							</span>
						)}
					</div>
					<div
						className={cn(
							"ml-auto text-xs",
							isSelected
								? "text-foreground"
								: "text-muted-foreground",
						)}
					>
						{formatDistanceToNow(new Date(item.date), {
							addSuffix: true,
						})}
					</div>
				</div>
				<div className="text-xs font-medium">{item.subject}</div>
			</div>
			<div className="text-muted-foreground line-clamp-2 text-xs">
				{item.text.substring(0, 300)}
			</div>
			{item.labels.length ? (
				<div className="flex items-center gap-2">
					{item.labels.map((label) => (
						<Badge key={label} variant={getBadgeVariantFromLabel(label)}>
							{label}
						</Badge>
					))}
				</div>
			) : null}
		</motion.button>
	);
}, (prevProps, nextProps) => {
	// Custom comparison - only re-render if THIS email's relevant data changed
	return (
		prevProps.item.id === nextProps.item.id &&
		prevProps.item.read === nextProps.item.read &&
		prevProps.item.flagStatus === nextProps.item.flagStatus &&
		prevProps.item.flagColor === nextProps.item.flagColor &&
		prevProps.item.threadCount === nextProps.item.threadCount &&
		prevProps.isSelected === nextProps.isSelected
	);
});

interface MailListProps {
	items: EmailWithFlags[];
}

export function MailList({ items }: MailListProps) {
	const { selectedMail, setSelectedMail } = useMailStore();

	// Stable callback reference - prevents child re-renders
	const handleSelect = useCallback((item: EmailWithFlags) => {
		setSelectedMail(item);
	}, [setSelectedMail]);

	return (
		<div className="h-full">
			{items.length === 0 ? (
				<div className="flex h-full items-center justify-center p-8">
					<p className="text-muted-foreground text-sm">No emails in this folder</p>
				</div>
			) : (
				<ScrollArea className="h-full">
					<div className="flex flex-col gap-2 p-4 pt-0">
						<AnimatePresence mode="popLayout">
							{items.map((item) => (
								<EmailItem
									key={item.id}
									item={item}
									isSelected={selectedMail?.id === item.id}
									onSelect={handleSelect}
								/>
							))}
						</AnimatePresence>
					</div>
				</ScrollArea>
			)}
		</div>
	);
}

function getBadgeVariantFromLabel(
	label: string,
): ComponentProps<typeof Badge>["variant"] {
	if (["work"].includes(label.toLowerCase())) {
		return "default";
	}

	if (["personal"].includes(label.toLowerCase())) {
		return "outline";
	}

	return "secondary";
}
