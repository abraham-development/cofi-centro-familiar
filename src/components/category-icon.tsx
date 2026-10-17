import {
  Briefcase,
  DoorOpen,
  House,
  type LucideIcon,
  Receipt,
  School,
  Stethoscope,
  Tag,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "door-open": DoorOpen,
  school: School,
  stethoscope: Stethoscope,
  house: House,
  briefcase: Briefcase,
  receipt: Receipt,
  tag: Tag,
};

export function CategoryIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  const Icon = (icon && ICONS[icon]) || Tag;
  return <Icon aria-hidden className={className ?? "size-4"} />;
}
