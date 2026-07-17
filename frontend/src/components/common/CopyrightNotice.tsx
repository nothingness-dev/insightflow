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
        className="font-semibold text-gray-500 underline decoration-transparent underline-offset-4 transition-colors hover:text-[color:var(--c-700)] hover:decoration-current focus:outline-none focus:ring-2 focus:ring-[color:var(--c-300)] focus:ring-offset-2"
      >
        nothingness-dev
      </a>{" "}
      توسعه یافته است. تمامی حقوق محفوظ میباشد. | © ۱۴۰۵
    </p>
  );
}
