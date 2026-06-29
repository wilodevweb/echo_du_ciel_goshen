import type { ClassLevel } from "@/lib/db";

export type NewChildForm = {
  firstName: string;
  lastName: string;
  postName: string;
  gender: 'M' | 'F';
  classLevel: ClassLevel;
  parentPhone: string;
  parentFirstName: string;
  parentLastName: string;
  address: string;
  birthDate: string;
  notes: string;
  parentId?: string;
};

export type ChildDetailsDraft = NewChildForm;

export const emptyNewChild: NewChildForm = {
  firstName: "",
  lastName: "",
  postName: "",
  gender: "M",
  classLevel: "FIRST",
  parentPhone: "",
  parentFirstName: "",
  parentLastName: "",
  address: "",
  birthDate: "",
  notes: "",
};
