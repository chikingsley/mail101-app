import * as Dialog from "@radix-ui/react-dialog";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  Save,
  Send,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AttachmentList } from "./attachment-list";
import { RecipientInput } from "./recipient-input";

interface ComposeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "new" | "reply" | "reply-all" | "forward";
  emailData?: {
    id: string;
    subject: string;
    from: { emailAddress: { address: string; name?: string } };
    toRecipients?: { emailAddress: { address: string; name?: string } }[];
    ccRecipients?: { emailAddress: { address: string; name?: string } }[];
    body?: { content: string };
  };
  onSuccess?: () => void;
}

export function ComposeDialog({
  isOpen,
  onClose,
  mode,
  emailData,
  onSuccess,
}: ComposeDialogProps) {
  const [recipients, setRecipients] = useState<string[]>([]);
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);
  const [bccRecipients, setBccRecipients] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm focus:outline-none min-h-[200px] p-3 text-gray-900 dark:text-gray-100",
      },
    },
  });

  // Initialize form based on mode
  useEffect(() => {
    if (isOpen && emailData) {
      if (mode === "reply") {
        setRecipients([emailData.from.emailAddress.address]);
        setSubject(`Re: ${emailData.subject}`);
      } else if (mode === "reply-all") {
        const addresses = [emailData.from.emailAddress.address];
        if (emailData.toRecipients) {
          addresses.push(
            ...emailData.toRecipients.map((r) => r.emailAddress.address)
          );
        }
        if (emailData.ccRecipients) {
          setCcRecipients(
            emailData.ccRecipients.map((r) => r.emailAddress.address)
          );
        }
        setRecipients(addresses);
        setSubject(`Re: ${emailData.subject}`);
      } else if (mode === "forward") {
        setSubject(`Fwd: ${emailData.subject}`);
      }

      // Add quoted text
      if (emailData.body?.content) {
        const quotedBody = `<blockquote style="border-left: 3px solid #ccc; margin: 10px 0; padding-left: 10px; color: #666;">
          <p><strong>On ${new Date().toLocaleDateString()}, ${emailData.from.emailAddress.name || emailData.from.emailAddress.address} wrote:</strong></p>
          <p>${emailData.body.content}</p>
        </blockquote>
        <br />
        <p></p>`;
        editor?.commands.setContent(quotedBody);
      }
    }
  }, [isOpen, mode, emailData, editor]);

  // Auto-save to localStorage every 30 seconds
  useEffect(() => {
    if (!(isOpen && editor)) return;

    const interval = setInterval(() => {
      const draft = {
        recipients,
        ccRecipients,
        bccRecipients,
        subject,
        content: editor.getHTML(),
        timestamp: Date.now(),
      };
      localStorage.setItem("compose-draft", JSON.stringify(draft));
    }, 30_000);

    return () => clearInterval(interval);
  }, [isOpen, editor, recipients, ccRecipients, bccRecipients, subject]);

  const handleSend = useCallback(async () => {
    if (!(editor && subject.trim()) || recipients.length === 0) {
      alert("Please fill in all required fields");
      return;
    }

    setIsSending(true);
    try {
      const endpoint =
        mode === "reply"
          ? "/api/compose/reply"
          : mode === "reply-all"
            ? "/api/compose/reply-all"
            : mode === "forward"
              ? "/api/compose/forward"
              : "/api/compose/send";

      const body =
        mode === "forward"
          ? {
              emailId: emailData?.id,
              toRecipients: recipients,
              comment: editor.getHTML(),
            }
          : mode === "reply" || mode === "reply-all"
            ? {
                emailId: emailData?.id,
                comment: editor.getHTML(),
                ...(mode === "reply" && { toRecipients: recipients }),
              }
            : {
                to: recipients,
                subject,
                body: editor.getHTML(),
                cc: ccRecipients.length > 0 ? ccRecipients : undefined,
                bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
              };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("clerk-token")}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Failed to send email");
      }

      // Clear draft
      localStorage.removeItem("compose-draft");

      // Reset form
      setRecipients([]);
      setCcRecipients([]);
      setBccRecipients([]);
      setSubject("");
      setAttachments([]);
      editor?.commands.setContent("");

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Send error:", error);
      alert("Failed to send email");
    } finally {
      setIsSending(false);
    }
  }, [
    editor,
    recipients,
    ccRecipients,
    bccRecipients,
    subject,
    mode,
    emailData,
    onClose,
    onSuccess,
  ]);

  const handleSaveDraft = useCallback(async () => {
    if (!subject.trim() || recipients.length === 0) {
      alert("Please add at least a subject and recipient");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch("/api/compose/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("clerk-token")}`,
        },
        body: JSON.stringify({
          to: recipients,
          subject,
          body: editor?.getHTML() || "",
          cc: ccRecipients.length > 0 ? ccRecipients : undefined,
          bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save draft");
      }

      const data = await response.json();
      alert(`Draft saved (ID: ${data.draftId})`);
      localStorage.removeItem("compose-draft");
    } catch (error) {
      console.error("Save draft error:", error);
      alert("Failed to save draft");
    } finally {
      setIsSending(false);
    }
  }, [editor, recipients, ccRecipients, bccRecipients, subject]);

  const toggleBold = () => editor?.chain().focus().toggleBold().run();
  const toggleItalic = () => editor?.chain().focus().toggleItalic().run();
  const toggleList = () => editor?.chain().focus().toggleBulletList().run();

  const addLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      editor
        ?.chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: url })
        .run();
    }
  };

  const getTitle = () => {
    switch (mode) {
      case "reply":
        return "Reply";
      case "reply-all":
        return "Reply All";
      case "forward":
        return "Forward";
      default:
        return "New Message";
    }
  };

  return (
    <Dialog.Root onOpenChange={onClose} open={isOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between border-gray-200 border-b px-6 py-4 dark:border-gray-700">
            <Dialog.Title className="font-semibold text-gray-900 text-lg dark:text-white">
              {getTitle()}
            </Dialog.Title>
            <Dialog.Close className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <div
            className="space-y-4 overflow-y-auto p-6"
            style={{ maxHeight: "calc(90vh - 100px)" }}
          >
            {/* Recipients */}
            <div>
              <label className="block font-medium text-gray-700 text-sm dark:text-gray-300">
                To
              </label>
              <RecipientInput
                onChange={setRecipients}
                placeholder="Add recipients..."
                value={recipients}
              />
            </div>

            {/* CC/BCC Toggle */}
            {!showCcBcc && (
              <button
                className="text-blue-600 text-sm hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                onClick={() => setShowCcBcc(true)}
                type="button"
              >
                + CC/BCC
              </button>
            )}

            {/* CC */}
            {showCcBcc && (
              <div>
                <label className="block font-medium text-gray-700 text-sm dark:text-gray-300">
                  CC
                </label>
                <RecipientInput
                  onChange={setCcRecipients}
                  placeholder="Add CC recipients..."
                  value={ccRecipients}
                />
              </div>
            )}

            {/* BCC */}
            {showCcBcc && (
              <div>
                <label className="block font-medium text-gray-700 text-sm dark:text-gray-300">
                  BCC
                </label>
                <RecipientInput
                  onChange={setBccRecipients}
                  placeholder="Add BCC recipients..."
                  value={bccRecipients}
                />
              </div>
            )}

            {/* Subject */}
            {mode === "new" && (
              <div>
                <label className="block font-medium text-gray-700 text-sm dark:text-gray-300">
                  Subject
                </label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject..."
                  type="text"
                  value={subject}
                />
              </div>
            )}

            {/* Editor Toolbar */}
            <div className="flex gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-700">
              <button
                className="rounded p-2 hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={toggleBold}
                title="Bold (Cmd+B)"
                type="button"
              >
                <Bold className="h-4 w-4" />
              </button>
              <button
                className="rounded p-2 hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={toggleItalic}
                title="Italic (Cmd+I)"
                type="button"
              >
                <Italic className="h-4 w-4" />
              </button>
              <div className="w-px bg-gray-300 dark:bg-gray-600" />
              <button
                className="rounded p-2 hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={toggleList}
                title="Bullet List"
                type="button"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                className="rounded p-2 hover:bg-gray-200 dark:hover:bg-gray-600"
                onClick={addLink}
                title="Add Link"
                type="button"
              >
                <LinkIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Editor */}
            <div className="min-h-[200px] rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700">
              <EditorContent editor={editor} />
            </div>

            {/* Attachments */}
            <div>
              <label className="block font-medium text-gray-700 text-sm dark:text-gray-300">
                Attachments
              </label>
              <AttachmentList
                attachments={attachments}
                onFilesSelected={setAttachments}
                onRemove={(index) => {
                  setAttachments(attachments.filter((_, i) => i !== index));
                }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 border-gray-200 border-t px-6 py-4 dark:border-gray-700">
            <button
              className="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-300 dark:hover:bg-gray-700"
              disabled={isSending}
              onClick={handleSaveDraft}
              type="button"
            >
              <Save className="h-4 w-4" />
              Save Draft
            </button>
            <button
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={isSending}
              onClick={handleSend}
              type="button"
            >
              <Send className="h-4 w-4" />
              {isSending ? "Sending..." : "Send"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
