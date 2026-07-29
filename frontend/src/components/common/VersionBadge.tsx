import packageInfo from "../../../package.json";

const VERSION_LABEL = `v${packageInfo.version.replace("-ip-audit.", " · a")}`;

interface VersionBadgeProps {
  className?: string;
  onBrand?: boolean;
}

export default function VersionBadge({
  className = "",
  onBrand = false,
}: VersionBadgeProps) {
  return (
    <span
      dir="ltr"
      aria-label={`نسخه ${packageInfo.version}`}
      title={`نسخه ${packageInfo.version}`}
      className={[
        "inline-flex h-7 shrink-0 items-center rounded-lg border px-2",
        "text-[10px] font-semibold tabular-nums",
        onBrand
          ? "border-white/40 bg-black/20 text-white"
          : "border-slate-200 bg-slate-50 text-slate-500 dark:border-gray-600 dark:bg-gray-700 dark:text-slate-300",
        className,
      ].join(" ")}
    >
      {VERSION_LABEL}
    </span>
  );
}
