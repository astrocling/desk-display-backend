import { radarAppIcon } from "@/lib/brand-app-icons";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return radarAppIcon(size.width);
}
