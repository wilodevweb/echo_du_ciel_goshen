import type { AttendanceStatus, Child, ClassLevel } from "@/lib/db";
import type { ChildDetailsDraft } from "../types";

export type ModalTab = "infos" | "famille" | "pointages";

export interface ParentItem {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  address?: string;
}
