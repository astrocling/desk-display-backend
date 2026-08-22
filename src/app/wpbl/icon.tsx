import { wpblAppIcon } from "@/lib/brand-app-icons";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return wpblAppIcon(size.width);
}
