import { ShieldAlert } from "lucide-react";
import Button from "../../components/ui/button/Button";
import { useNavigate } from "react-router-dom";

export default function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-error-50 text-error-500 dark:bg-error-500/15">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.24em] text-error-500">403 Access Denied</p>
        <h1 className="mt-3 text-3xl font-semibold text-gray-900 dark:text-white">You do not have access to this page.</h1>
        <p className="mt-4 text-sm leading-6 text-gray-500 dark:text-gray-400">
          Your current role or permissions do not allow this action. Contact an administrator if you need additional access.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Go Back
          </Button>
          <Button onClick={() => navigate("/dashboard")}>Open Dashboard</Button>
        </div>
      </div>
    </div>
  );
}
