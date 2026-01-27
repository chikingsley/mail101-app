"use client";

import {
  AlertCircle,
  Archive,
  ArchiveX,
  File,
  Inbox,
  MessagesSquare,
  Search,
  Send,
  ShoppingCart,
  Trash2,
  Users2,
} from "lucide-react";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { useCallback, useRef, useState } from "react";
import { AccountSwitcher } from "@/components/mail/account-switcher";
import { MailDisplay } from "@/components/mail/mail-display";
import { MailList } from "@/components/mail/mail-list";
import { Nav } from "@/components/mail/nav";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Mail as MailType } from "@/data";
import { cn } from "@/lib/utils";
import { useMail } from "@/use-mail";

// Shared header height for alignment across panels
const HEADER_HEIGHT = "h-14";

interface MailProps {
  accounts: {
    id?: string;
    label: string;
    email: string;
    icon: React.ReactNode;
  }[];
  mails: MailType[];
  defaultLayout: number[] | undefined;
  defaultCollapsed?: boolean;
  navCollapsedSize: number;
}

export function Mail({
  accounts,
  mails,
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize,
}: MailProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [mail] = useMail();
  const navPanelRef = useRef<ImperativePanelHandle>(null);

  // Handle panel resize to detect collapse state
  const handlePanelResize = useCallback((size: number) => {
    setIsCollapsed(size <= navCollapsedSize);
  }, [navCollapsedSize]);

  return (
    <TooltipProvider delayDuration={0}>
      <ResizablePanelGroup
        className="h-full items-stretch"
        direction="horizontal"
      >
        <ResizablePanel
          ref={navPanelRef}
          className={cn(
            isCollapsed &&
              "min-w-[50px] transition-all duration-300 ease-in-out"
          )}
          collapsedSize={navCollapsedSize}
          collapsible={true}
          defaultSize={defaultLayout[0]}
          maxSize={20}
          minSize={15}
          onResize={handlePanelResize}
        >
          <div
            className={cn(
              "flex items-center justify-center",
              HEADER_HEIGHT,
              !isCollapsed && "px-2"
            )}
          >
            <AccountSwitcher accounts={accounts} isCollapsed={isCollapsed} />
          </div>
          <Separator />
          <Nav
            isCollapsed={isCollapsed}
            links={[
              {
                title: "Inbox",
                label: "128",
                icon: Inbox,
                variant: "default",
              },
              {
                title: "Drafts",
                label: "9",
                icon: File,
                variant: "ghost",
              },
              {
                title: "Sent",
                label: "",
                icon: Send,
                variant: "ghost",
              },
              {
                title: "Junk",
                label: "23",
                icon: ArchiveX,
                variant: "ghost",
              },
              {
                title: "Trash",
                label: "",
                icon: Trash2,
                variant: "ghost",
              },
              {
                title: "Archive",
                label: "",
                icon: Archive,
                variant: "ghost",
              },
            ]}
          />
          <Separator />
          <Nav
            isCollapsed={isCollapsed}
            links={[
              {
                title: "Social",
                label: "972",
                icon: Users2,
                variant: "ghost",
              },
              {
                title: "Updates",
                label: "342",
                icon: AlertCircle,
                variant: "ghost",
              },
              {
                title: "Forums",
                label: "128",
                icon: MessagesSquare,
                variant: "ghost",
              },
              {
                title: "Shopping",
                label: "8",
                icon: ShoppingCart,
                variant: "ghost",
              },
              {
                title: "Promotions",
                label: "21",
                icon: Archive,
                variant: "ghost",
              },
            ]}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={defaultLayout[1]} minSize={30}>
          <Tabs defaultValue="all">
            <div className={cn("flex items-center px-4", HEADER_HEIGHT)}>
              <h1 className="font-bold text-xl">Inbox</h1>
              <TabsList className="ml-auto">
                <TabsTrigger
                  className="text-zinc-600 dark:text-zinc-200"
                  value="all"
                >
                  All mail
                </TabsTrigger>
                <TabsTrigger
                  className="text-zinc-600 dark:text-zinc-200"
                  value="unread"
                >
                  Unread
                </TabsTrigger>
              </TabsList>
            </div>
            <Separator />
            <div className="bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <form>
                <div className="relative">
                  <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Search" />
                </div>
              </form>
            </div>
            <TabsContent className="m-0" value="all">
              <MailList items={mails} />
            </TabsContent>
            <TabsContent className="m-0" value="unread">
              <MailList items={mails.filter((item) => !item.read)} />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={defaultLayout[2]} minSize={30}>
          <MailDisplay
            mail={mails.find((item) => item.id === mail.selected) || null}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </TooltipProvider>
  );
}
