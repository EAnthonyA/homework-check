import type { Role } from "@/lib/repo";

export interface SessionProp {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  role: Role;
}

export interface SubmissionView {
  userId: string;
  userName: string;
  imagePath: string;
  imagePaths: string[];
  createdAt: string;
  aiDone: boolean | null;
  aiCorrect: boolean | null;
  aiSummary: string | null;
  aiError: string | null;
  aiEvaluatedAt: string | null;
}

export interface HomeworkItemView {
  id: string;
  subject: string;
  description: string;
  dueDate: string;
  details: string | null;
  mineDone: boolean;
  submissions: SubmissionView[];
}

export interface TodayResponse {
  date: string;
  items: HomeworkItemView[];
  user: SessionProp;
}

export interface HistoryItemView {
  id: string;
  subject: string;
  description: string;
  dueDate: string;
  doneAt: string;
  doneDate: string;
  doneByName: string | null;
  doneSource: "parent" | "ai" | null;
  submissions: SubmissionView[];
}

export interface HistoryResponse {
  items: HistoryItemView[];
}

export interface AssessmentItemView {
  id: string;
  date: string;
  type: string;
  group: string;
  topic: string;
  enteredDate: string | null;
}

export interface AssessmentsResponse {
  date: string;
  items: AssessmentItemView[];
}
