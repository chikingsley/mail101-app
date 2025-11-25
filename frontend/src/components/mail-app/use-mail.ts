import { create } from "zustand";
import type { EmailWithFlags } from "@/App";

type MailStore = {
	selectedMail: EmailWithFlags | null;
	setSelectedMail: (mail: EmailWithFlags | null) => void;
};

export const useMailStore = create<MailStore>((set) => ({
	selectedMail: null,
	setSelectedMail: (mail) => set({ selectedMail: mail }),
}));
