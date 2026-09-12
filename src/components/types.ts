import type { Role } from "@/lib/repo";

export interface SessionProp {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  role: Role;
}

export interface HomeworkItemView {
  id: string;
  subject: string;
  description: string;
  dueDate: string;
  details: string | null;
  mineDone: boolean;
  submissions: {
    userId: string;
    userName: string;
    imagePath: string;
    createdAt: string;
  }[];
}

export interface TodayResponse {
  date: string;
  items: HomeworkItemView[];
  user: SessionProp;
}
