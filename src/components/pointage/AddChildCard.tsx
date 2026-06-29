import React, { FormEvent } from "react";
import type { NewChildForm } from "./types";
import { PointageCard } from "./PointageCard";

export function AddChildCard(props: {
  value: NewChildForm;
  isAdding: boolean;
  onChange: (value: NewChildForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <PointageCard mode="add" {...props} />;
}
