import { X } from "lucide-react";
import type React from "react";
import { useRef, useState } from "react";

interface RecipientInputProps {
  value: string[];
  onChange: (recipients: string[]) => void;
  placeholder?: string;
}

// Basic email validation
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export function RecipientInput({
  value,
  onChange,
  placeholder = "Add recipients...",
}: RecipientInputProps) {
  const [input, setInput] = useState("");
  const [invalidEmail, setInvalidEmail] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAddRecipient = (email: string) => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) return;

    if (!isValidEmail(trimmedEmail)) {
      setInvalidEmail(true);
      setTimeout(() => setInvalidEmail(false), 3000);
      return;
    }

    if (value.includes(trimmedEmail)) {
      return; // Already added
    }

    onChange([...value, trimmedEmail]);
    setInput("");
    setInvalidEmail(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab" || e.key === ",") {
      e.preventDefault();
      handleAddRecipient(input);
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      // Remove last recipient when backspace is pressed and input is empty
      onChange(value.slice(0, -1));
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData("text");
    // Split by common delimiters: comma, semicolon, newline
    const emails = pastedText
      .split(/[,;\n]/)
      .map((e) => e.trim())
      .filter((e) => e);

    const validEmails: string[] = [];
    for (const email of emails) {
      if (isValidEmail(email.toLowerCase())) {
        validEmails.push(email.toLowerCase());
      }
    }

    if (validEmails.length > 0) {
      // Add only new emails
      const newEmails = validEmails.filter((e) => !value.includes(e));
      onChange([...value, ...newEmails]);
      setInput("");
      setInvalidEmail(false);
    } else if (emails.length > 0) {
      setInvalidEmail(true);
      setTimeout(() => setInvalidEmail(false), 3000);
    }
  };

  return (
    <div className="space-y-2">
      <div
        className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
          invalidEmail
            ? "border-red-500 bg-red-50 dark:bg-red-900/20"
            : "border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-700"
        }`}
      >
        {/* Recipient Chips */}
        {value.map((recipient) => (
          <div
            className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-blue-900 text-sm dark:bg-blue-900 dark:text-blue-100"
            key={recipient}
          >
            <span>{recipient}</span>
            <button
              aria-label={`Remove ${recipient}`}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
              onClick={() => onChange(value.filter((r) => r !== recipient))}
              type="button"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Input Field */}
        <input
          autoComplete="off"
          className="min-w-[150px] flex-1 bg-transparent outline-none dark:text-white"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={value.length === 0 ? placeholder : ""}
          ref={inputRef}
          type="email"
          value={input}
        />
      </div>

      {/* Error Message */}
      {invalidEmail && (
        <p className="text-red-600 text-sm dark:text-red-400">
          Invalid email address. Please check and try again.
        </p>
      )}

      {/* Helper Text */}
      <p className="text-gray-500 text-xs dark:text-gray-400">
        Separate emails with commas, semicolons, or paste multiple at once
      </p>
    </div>
  );
}
