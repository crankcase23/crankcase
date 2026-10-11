/* eslint-disable @next/next/no-img-element */
import * as React from "react";
// Harness stub for next/image: a plain img (src may be a string or a static import object).
type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string | { src: string }; fill?: boolean; priority?: boolean; unoptimized?: boolean; quality?: number };
export default function Image(props: Props) {
  const { src, alt, ...rest } = props;
  for (const k of ["fill", "priority", "unoptimized", "quality"] as const) delete (rest as Record<string, unknown>)[k];
  return <img src={typeof src === "string" ? src : src.src} alt={alt ?? ""} {...rest} />;
}
