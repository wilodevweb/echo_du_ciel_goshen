export type ModalTab = "infos" | "famille" | "pointages";

export interface ParentItem {
  id?: string;
  name: string;
  phone: string;
  address?: string;
}
