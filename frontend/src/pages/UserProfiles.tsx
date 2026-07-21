import { Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import UserMetaCard from "../components/UserProfile/UserMetaCard";
import UserInfoCard from "../components/UserProfile/UserInfoCard";
import PageMeta from "../components/common/PageMeta";
import { useAuth } from "../context/AuthContext";
import { AdminShell, DataCard } from "./UserManagement/AdminShared";

export default function UserProfiles() {
  const { user } = useAuth();
  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Profile";
  const roles = user?.roles?.length ? user.roles : ["Standard access"];
  const primaryRole = roles[0];
  const accountStatus = user?.status || "ACTIVE";
  const accessScope = /admin/i.test(primaryRole) ? "Enterprise" : user?.userType || "Standard";
  const contactMode = user?.phone ? "Email and phone" : "Email only";
  const profileHighlights = [
    {
      label: "Username",
      value: user?.username || "Not available",
      icon: <UserRound className="h-4 w-4" />,
    },
    {
      label: "Email",
      value: user?.email || "Not available",
      icon: <Mail className="h-4 w-4" />,
    },
    {
      label: "Phone",
      value: user?.phone || "Not provided",
      icon: <Phone className="h-4 w-4" />,
    },
    {
      label: "Primary role",
      value: primaryRole,
      icon: <ShieldCheck className="h-4 w-4" />,
    },
  ];

  return (
    <>
      <PageMeta
        title="User Profile | Transformer Monitoring System"
        description="Enterprise profile workspace for reviewing account details, access roles, and contact information."
      />
      <AdminShell
        title="User Profile"
        description="Manage your account identity, review contact details, and keep access information aligned with the enterprise administration workspace."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Account Status", value: accountStatus, tone: "green" },
            { label: "Primary Role", value: primaryRole, tone: "blue" },
            { label: "Role Assignments", value: roles.length, tone: "purple" },
            { label: "Contact Mode", value: contactMode, tone: "amber" },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border border-slate-200/80 px-4 py-3 shadow-sm dark:border-gray-800 ${
                stat.tone === "green"
                  ? "bg-emerald-50/70 dark:bg-emerald-500/5"
                  : stat.tone === "blue"
                    ? "bg-blue-50/70 dark:bg-blue-500/5"
                    : stat.tone === "purple"
                      ? "bg-violet-50/70 dark:bg-violet-500/5"
                      : "bg-amber-50/70 dark:bg-amber-500/5"
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400">
                {stat.label}
              </p>
              <p className="mt-1.5 text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_320px]">
          <div className="space-y-4">
            <DataCard>
              <div className="p-4 lg:p-5">
                <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 dark:border-gray-800 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg font-semibold text-slate-700 dark:bg-white/5 dark:text-white">
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-1.5">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                          Profile Overview
                        </p>
                        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                          {displayName}
                        </h2>
                      </div>
                      <p className="text-sm leading-5 text-slate-500 dark:text-gray-400">
                        Access scope: {accessScope}. Keep personal details current so notifications, approvals, and audit trails remain accurate.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-gray-700 dark:bg-white/5 dark:text-gray-300"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {profileHighlights.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-3 dark:border-gray-800 dark:bg-white/[0.03]"
                    >
                      <div className="flex items-center gap-2 text-slate-500 dark:text-gray-400">
                        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm dark:bg-gray-900 dark:text-gray-300">
                          {item.icon}
                        </span>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{item.label}</p>
                      </div>
                      <p className="mt-2.5 text-sm font-semibold text-slate-900 dark:text-white">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </DataCard>

            <UserInfoCard />
          </div>

          <div className="space-y-4">
            <DataCard>
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-gray-400">
                      Access Summary
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                      Account at a glance
                    </h3>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    {accountStatus}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400">
                      User Type
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.userType || "Standard user"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400">
                      Employee Number
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.employeeNumber || "Not assigned"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 dark:border-gray-800 dark:bg-white/[0.03]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-gray-400">
                      Supplier
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                      {user?.supplierName || user?.supplierCode || "Internal account"}
                    </p>
                  </div>
                </div>
              </div>
            </DataCard>

            <UserMetaCard />
          </div>
        </div>
      </AdminShell>
    </>
  );
}
