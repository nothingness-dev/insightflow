export function RoleBadge({ role }: { role: string }) {
  return role === 'admin'
    ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">مدیر</span>
    : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[color:var(--c-50)] text-[color:var(--c-700)] border border-[color:var(--c-200)]">کارمند</span>;
}
