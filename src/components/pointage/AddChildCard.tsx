import React from "react";
import type { AttendanceStatus } from "@/lib/db";
import type { NewChildForm } from "./types";
import { PointageCard } from "./PointageCard";

export function AddChildCard(props: {
  value: NewChildForm;
  isAdding: boolean;
  onChange: (value: NewChildForm) => void;
  onSubmit: (status: AttendanceStatus) => void;
}) {
  return <PointageCard mode="add" {...props} />;
}
