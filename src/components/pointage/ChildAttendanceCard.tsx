import React from "react";
import type { AttendanceStatus, Child } from "@/lib/db";
import { PointageCard } from "./PointageCard";

export function ChildAttendanceCard(props: {
  child: Child;
  status: AttendanceStatus | null;
  recentStatuses: AttendanceStatus[];
  hasBirthdayThisWeek: boolean;
  onNameClick: () => void;
  onPhotoChange: (file: File) => Promise<void>;
  onSetStatus: (status: AttendanceStatus) => void;
}) {
  return <PointageCard mode="attendance" {...props} />;
}
