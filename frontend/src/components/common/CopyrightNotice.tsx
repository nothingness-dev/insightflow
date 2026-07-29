const GITHUB_URL = "https://github.com/nothingness-dev";

export default function CopyrightNotice({
  className = "",
}: {
  className?: string;
}) {
  return (
    <p className={`text-center text-xs leading-6 text-gray-400 ${className}`}>
      این محصول توسط{" "}
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noreferrer"
        title={GITHUB_URL}
        className="compact-link align-middle font-semibold text-gray-600 underline decoration-transparent underline-offset-4 transition-colors hover:text-[color:var(--c-700)] hover:decoration-current"
      >
        nothingness-dev
      </a>{" "}
      توسعه یافته است. تمامی حقوق محفوظ میباشد. | © ۱۴۰۵
    </p>
  );
}
