export type ModalTab = "infos" | "famille" | "pointages" | "evenement";

export interface ParentItem {
  id?: string;
  name: string;
  phone: string;
  address?: string;
}
