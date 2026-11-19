// Shows a topic's text with its bold / italic / strikethrough marks applied (see richText.ts).
import { memo } from "react";
import { parseRich } from "../richText";

export const RichLabel = memo(function RichLabel({ text }: { text: string }) {
  return (
    <>
      {parseRich(text).map((segment, index) => {
        let node: React.ReactNode = segment.text;
        if (segment.strike) node = <s>{node}</s>;
        if (segment.italic) node = <em>{node}</em>;
        if (segment.bold) node = <strong className="font-semibold">{node}</strong>;
        return <span key={index}>{node}</span>;
      })}
    </>
  );
});
