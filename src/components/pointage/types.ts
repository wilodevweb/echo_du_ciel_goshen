import type { ClassLevel } from "@/lib/db";

export type NewChildForm = {
  firstName: string;
  lastName: string;
  postName: string;
  gender: 'M' | 'F';
  classLevel: ClassLevel;
  parentPhone: string;
  parentName: string;
  address: string;
  birthDate: string;
  notes: string;
  parentId?: string;
  photoUrl?: string;
};

export type ChildDetailsDraft = NewChildForm;

export const emptyNewChild: NewChildForm = {
  firstName: "",
  lastName: "",
  postName: "",
  gender: "M",
  classLevel: "FIRST",
  parentPhone: "",
  parentName: "",
  address: "",
  birthDate: "",
  notes: "",
  photoUrl: "",
};
