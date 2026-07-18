import React from "react";
import type { NewChildForm } from "@/components/pointage/types";
import { PointageCard } from "@/components/pointage/PointageCard";

export function AddChildCard(props: {
  value: NewChildForm;
  isAdding: boolean;
  onChange: (value: NewChildForm) => void;
  onSubmit: () => void;
}) {
  return <PointageCard mode="add" {...props} />;
}
