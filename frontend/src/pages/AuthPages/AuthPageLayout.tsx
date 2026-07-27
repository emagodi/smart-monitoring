import React from "react";
import { Activity, BellRing, ChartColumn, ShieldCheck } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#042b63_0%,#0a4ec6_100%)] px-4 py-6 dark:bg-[linear-gradient(180deg,#031c42_0%,#083b93_100%)] sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.22),transparent_30%),radial-gradient(circle_at_bottom_center,rgba(37,99,235,0.16),transparent_35%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[1240px] items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[28px] border border-white/12 bg-white/96 shadow-[0_26px_80px_rgba(2,6,23,0.26)] dark:border-slate-800 dark:bg-slate-950/96 lg:grid-cols-[minmax(0,1.05fr)_480px]">
          <section
            className="relative hidden min-h-full overflow-hidden border-r border-slate-200/80 px-9 py-7 text-white lg:flex lg:flex-col lg:justify-between dark:border-slate-800"
            style={{
              backgroundColor: "#02122d",
              backgroundImage:
                "linear-gradient(to right, rgba(2, 18, 45, 1) 0%, rgba(2, 18, 45, 0.85) 45%, rgba(2, 18, 45, 0.1) 100%), url('https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?q=80&w=2000&auto=format&fit=crop')",
              backgroundSize: "cover",
              backgroundPosition: "right center",
            }}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_bottom_center,rgba(37,99,235,0.38),transparent_32%)]" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(37,99,235,0.34))]" />
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute inset-y-0 right-[18%] w-px bg-white/10" />
              <div className="absolute inset-y-0 right-[30%] w-px bg-white/6" />
              <div className="absolute bottom-0 right-[10%] h-[62%] w-px bg-white/12" />
              <div className="absolute bottom-[18%] right-[18%] h-px w-[34%] bg-white/10" />
              <div className="absolute bottom-[30%] right-[23%] h-px w-[20%] bg-white/8" />
              <div className="absolute bottom-[10%] left-0 right-0 h-24 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.34),transparent_60%)]" />
            </div>

            <div className="relative">
              <img
                src="/images/powertel.png"
                alt="Powertel"
                className="mx-auto h-12 w-auto object-contain"
              />

              <h1 className="mt-10 max-w-md text-[30px] font-semibold tracking-tight text-white">
                Transformer Monitoring
                <span className="block text-blue-400">System</span>
              </h1>
              <p className="mt-4 max-w-md text-sm leading-7 text-blue-50/86">
                Real-time monitoring, analytics, and intelligent alerts for transformers,
                sensors, and electrical assets across regions and depots.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  {
                    icon: <Activity className="h-4.5 w-4.5" />,
                    title: "Real-time Telemetry",
                    description: "Live data from sensors and transformers",
                    tone: "bg-blue-500/18 text-blue-200",
                  },
                  {
                    icon: <BellRing className="h-4.5 w-4.5" />,
                    title: "Smart Alerts",
                    description: "Instant notifications and anomaly detection",
                    tone: "bg-emerald-500/18 text-emerald-200",
                  },
                  {
                    icon: <ChartColumn className="h-4.5 w-4.5" />,
                    title: "Operational Insights",
                    description: "Analytics and reports for better decisions",
                    tone: "bg-violet-500/18 text-violet-200",
                  },
                  {
                    icon: <ShieldCheck className="h-4.5 w-4.5" />,
                    title: "Role Based Access",
                    description: "Secure access for teams and partners",
                    tone: "bg-amber-500/18 text-amber-200",
                  },
                ].map((feature) => (
                  <div key={feature.title} className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${feature.tone}`}>
                      {feature.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{feature.title}</p>
                      <p className="mt-1 text-[12px] text-blue-100/80">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative rounded-[22px] border border-white/10 bg-white/10 p-5 backdrop-blur-md">
              <div className="grid grid-cols-4 gap-3">
                {[
                  { value: "1,248", label: "Transformers", sublabel: "Monitored" },
                  { value: "24/7", label: "System", sublabel: "Uptime" },
                  { value: "125", label: "Active Alerts", sublabel: "Tracked" },
                  { value: "3", label: "Regions", sublabel: "Online" },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-[24px] font-semibold tracking-tight text-white">{item.value}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-100/70">
                      {item.label}
                    </p>
                    <p className="mt-1 text-[12px] text-blue-100/72">{item.sublabel}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="flex min-h-full items-center justify-center bg-slate-50 px-5 py-8 dark:bg-slate-950 sm:px-7 lg:px-8">
            <div className="w-full">{children}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
