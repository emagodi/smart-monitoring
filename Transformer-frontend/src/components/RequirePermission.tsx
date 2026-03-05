import React from "react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "../context/PermissionContext";

type Props = {
  permission: string;
  children: React.ReactNode;
};

const RequirePermission: React.FC<Props> = ({ permission, children }) => {
  const { hasPermission } = usePermissions();
  if (!hasPermission(permission)) {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
};

export default RequirePermission;