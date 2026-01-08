import type { ReactNode } from "react";
import LinkifyReact from "linkify-react";
import Link from "next/link";

type LinkifyRenderProps = {
  attributes: {
    href: string;
    [key: string]: string | number | boolean | undefined;
  };
  content: ReactNode;
};

const renderLink = ({ attributes, content }: LinkifyRenderProps) => {
  const { href, ...props } = attributes;

  return (
    <Link
      href={href}
      {...props}
      target="_blank"
      className="font-semibold hover:underline"
    >
      {content}
    </Link>
  );
};

export function Linkify(props: { children: ReactNode }) {
  return (
    <LinkifyReact options={{ render: renderLink }}>
      {props.children}
    </LinkifyReact>
  );
}
