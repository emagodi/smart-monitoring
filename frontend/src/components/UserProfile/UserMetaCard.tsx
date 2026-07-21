import { useAuth } from "../../context/AuthContext";
import { useUserAccess } from "../../hooks/useUserAccess";

export default function UserMetaCard() {
  const { user } = useAuth();
  const { userProfile } = useUserAccess();
  const displayName = user ? ([user.first_name, user.last_name].filter(Boolean).join(" ") || user.username) : "";
  const email = user?.email || "";
  const locationLabel = userProfile
    ? (userProfile.is_national_level
        ? "National Level"
        : userProfile.is_region_level
          ? (userProfile.region_name ? `Region: ${userProfile.region_name}` : "Region User")
          : userProfile.is_depot_level
            ? (userProfile.depot_name ? `Depot: ${userProfile.depot_name}` : "Depot User")
            : "")
    : "";

  return (
    <>
      <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800 lg:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex w-full flex-col items-center gap-4 xl:flex-row">
            <div className="h-16 w-16 overflow-hidden rounded-full border border-gray-200 dark:border-gray-800">
              <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xl font-semibold text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                {user ? (user.first_name?.[0] || user.last_name?.[0] || user.username?.[0] || "U").toUpperCase() : "U"}
              </div>
            </div>
            <div className="order-3 xl:order-2">
              <h4 className="mb-1 text-base font-semibold text-center text-gray-800 dark:text-white/90 xl:text-left">
                {displayName}
              </h4>
              <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {email}
                </p>
                <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {locationLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
