import type { ClassLevel } from "@/lib/db";

export type NewChildForm = {
  firstName: string;
  lastName: string;
  postName: string;
  classLevel: ClassLevel;
  parentPhone: string;
  address: string;
  birthDate: string;
  notes: string;
};

export type ChildDetailsDraft = NewChildForm;

export const emptyNewChild: NewChildForm = {
  firstName: "",
  lastName: "",
  postName: "",
  classLevel: "FIRST",
  parentPhone: "",
  address: "",
  birthDate: "",
  notes: "",
};
