import * as React from "react";
// Harness stub for next/link: a plain anchor. The preview has no router.
type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | { pathname?: string | null }; prefetch?: boolean };
export default function Link(props: Props) {
  const { href, children, ...rest } = props;
  delete (rest as { prefetch?: boolean }).prefetch;
  return <a href={typeof href === "string" ? href : href.pathname ?? "#"} {...rest}>{children}</a>;
}
