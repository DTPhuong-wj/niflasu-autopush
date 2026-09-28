import { BookOpen, ClipboardCheck, FileText, Headphones } from "lucide-react";

export type Section = "review" | "test" | "mock" | "listening";

const ITEMS: { key: Section; label: string; Icon: typeof BookOpen }[] = [
  { key: "review", label: "Ôn tập", Icon: BookOpen },
  { key: "test", label: "Kiểm tra", Icon: ClipboardCheck },
  { key: "mock", label: "Thi thử", Icon: FileText },
  { key: "listening", label: "Nghe", Icon: Headphones },
];

interface Props {
  current: Section;
  onChange: (section: Section) => void;
}

export default function Sidebar({ current, onChange }: Props) {
  return (
    <nav className="nf-sidebar">
      {ITEMS.map(({ key, label, Icon }) => (
        <button
          key={key}
          className={`nf-side-item${current === key ? " is-active" : ""}`}
          onClick={() => onChange(key)}
          title={label}
        >
          <Icon size={18} strokeWidth={1.75} />
          <span className="nf-side-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
