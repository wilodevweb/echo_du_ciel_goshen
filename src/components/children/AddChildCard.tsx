import React from "react";
import type { NewChildForm } from "./types";
import { PointageCard } from "./PointageCard";

export function AddChildCard(props: {
  value: NewChildForm;
  isAdding: boolean;
  onChange: (value: NewChildForm) => void;
  onSubmit: () => void;
}) {
  return <PointageCard mode="add" {...props} />;
}
