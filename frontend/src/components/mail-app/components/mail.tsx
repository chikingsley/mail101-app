import { ArrowLeft, Layers, Search } from "lucide-react";
import * as React from "react";
import type { EmailWithFlags, FolderCounts, MailFolder } from "@/App";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { useEmailActions } from "@/hooks/use-email-actions";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useMailStore } from "../use-mail";
import { CustomThreadView } from "./custom-thread-view";
import { MailDisplay } from "./mail-display";
import { MailDisplayMobile } from "./mail-display-mobile";
import { MailList } from "./mail-list";
import { MergeDialog } from "./merge-dialog";
import { NavDesktop } from "./nav-desktop";
import { NavMobile } from "./nav-mobile";

export type EmailActions = ReturnType<typeof useEmailActions>;

// Folder display names
const FOLDER_NAMES: Record<MailFolder, string> = {
  inbox: "Inbox",
  sentitems: "Sent",
  drafts: "Drafts",
  deleteditems: "Trash",
  junkemail: "Junk",
  archive: "Archive",
};

interface MailProps {
  accounts: {
    label: string;
    email: string;
    icon: React.ReactNode;
  }[];
  mails: EmailWithFlags[];
  defaultLayout: number[] | undefined;
  defaultCollapsed?: boolean;
  navCollapsedSize: number;
  currentFolder: MailFolder;
  folderCounts: FolderCounts;
  onFolderChange: (folder: MailFolder) => void;
  emailActions: EmailActions;
}

export function Mail({
  mails,
  defaultLayout = [20, 32, 48],
  defaultCollapsed = false,
  navCollapsedSize,
  currentFolder,
  folderCounts,
  onFolderChange,
  emailActions,
}: MailProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);
  const isMobile = useIsMobile();
  const {
    selectedMail,
    viewMode,
    setViewMode,
    selectedThread,
    clearSelection,
  } = useMailStore();
  const [tab, setTab] = React.useState("all");

  // Simplified email actions for MailList
  const listEmailActions = React.useMemo(
    () => ({
      markRead: (id: string, read: boolean) => emailActions.markRead(id, read),
      archive: (id: string) => emailActions.archive(id),
      delete: (id: string) => emailActions.delete(id),
      flag: (id: string, status: string, color?: string) =>
        emailActions.flag(id, status as any, color as any),
    }),
    [emailActions]
  );

  const handleBackToEmail = React.useCallback(() => {
    setViewMode("email");
    clearSelection();
  }, [setViewMode, clearSelection]);

  return (
    <TooltipProvider delayDuration={0}>
      {/* Merge Dialog */}
      <MergeDialog emails={mails} />

      <ResizablePanelGroup
        className="items-stretch"
        direction="horizontal"
        onLayout={(sizes: number[]) => {
          localStorage.setItem(
            "react-resizable-panels:layout:mail",
            JSON.stringify(sizes)
          );
        }}
      >
        <ResizablePanel
          className={cn(
            isCollapsed &&
              "min-w-[50px] transition-all duration-300 ease-in-out"
          )}
          collapsedSize={navCollapsedSize}
          collapsible={true}
          defaultSize={defaultLayout[0]}
          hidden={isMobile}
          maxSize={20}
          minSize={15}
          onCollapse={() => {
            setIsCollapsed(true);
            localStorage.setItem(
              "react-resizable-panels:collapsed",
              JSON.stringify(true)
            );
          }}
          onResize={() => {
            setIsCollapsed(false);
            localStorage.setItem(
              "react-resizable-panels:collapsed",
              JSON.stringify(false)
            );
          }}
        >
          <NavDesktop
            currentFolder={currentFolder}
            folderCounts={folderCounts}
            isCollapsed={isCollapsed}
            onFolderChange={onFolderChange}
          />
        </ResizablePanel>
        <ResizableHandle hidden={isMobile} withHandle />
        <ResizablePanel defaultSize={defaultLayout[1]} minSize={30}>
          <Tabs
            className="flex h-full flex-col gap-0"
            defaultValue="all"
            onValueChange={(value) => setTab(value)}
          >
            <div className="flex items-center px-4 py-2">
              <div className="flex items-center gap-2">
                {isMobile && <NavMobile />}
                <h1 className="font-bold text-xl">
                  {FOLDER_NAMES[currentFolder]}
                </h1>
              </div>
              <TabsList className="ml-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="unread">Unread</TabsTrigger>
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
            <div className="min-h-0 flex-1">
              <MailList
                emailActions={listEmailActions}
                items={
                  tab === "all" ? mails : mails.filter((item) => !item.read)
                }
              />
            </div>
          </Tabs>
        </ResizablePanel>
        <ResizableHandle hidden={isMobile} withHandle />
        <ResizablePanel
          defaultSize={defaultLayout[2]}
          hidden={isMobile}
          minSize={30}
        >
          {viewMode === "thread" && selectedThread ? (
            <div className="flex h-full flex-col">
              {/* Thread header with back button */}
              <div className="flex items-center gap-2 border-b p-2">
                <Button onClick={handleBackToEmail} size="sm" variant="ghost">
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
                <Separator className="h-6" orientation="vertical" />
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Layers className="h-4 w-4" />
                  Custom Thread
                </div>
              </div>
              <CustomThreadView emailActions={emailActions} />
            </div>
          ) : isMobile ? (
            <MailDisplayMobile
              emailActions={emailActions}
              mail={mails.find((item) => item.id === selectedMail?.id) || null}
            />
          ) : (
            <MailDisplay
              emailActions={emailActions}
              mail={mails.find((item) => item.id === selectedMail?.id) || null}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </TooltipProvider>
  );
}
