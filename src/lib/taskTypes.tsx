import { Music, BookOpen, Radio, Smile, Users, Star, LucideIcon } from "lucide-react";
import { TaskType } from "./db";

export const TASK_TYPES: { value: TaskType; label: string; icon: LucideIcon }[] = [
  { value: "chant", label: "Chant", icon: Music },
  { value: "poeme", label: "Poème", icon: BookOpen },
  { value: "emission", label: "Émission", icon: Radio },
  { value: "sketch", label: "Sketch", icon: Smile },
  { value: "theatre", label: "Théâtre", icon: Users },
  { value: "autre", label: "Autre", icon: Star },
];

export const getTaskTypeConfig = (type?: TaskType) => {
  return TASK_TYPES.find((t) => t.value === type) || TASK_TYPES.find((t) => t.value === "autre")!;
};
