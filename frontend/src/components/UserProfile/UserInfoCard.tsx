import { useState, useEffect } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useAuth } from "../../context/AuthContext";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import axios from "axios";
import { X, User } from "lucide-react";

export default function UserInfoCard() {
  const { isOpen, openModal, closeModal } = useModal();
  const { user, token, updateUser } = useAuth();
  
  // Profile update state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fullUserData, setFullUserData] = useState<any>(null);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user && token) {
      // Fetch full user data to ensure we preserve other fields (role, region, etc.) during update
      const fetchUserData = async () => {
        try {
          const headers = { Authorization: `Bearer ${token}` };
          const response = await axios.get(`${API_BASE_URL}/api/v1/auth/users`, { headers });
          const users = Array.isArray(response.data) ? response.data : (response.data?.data || []);
          const currentUser = users.find((u: any) => u.id === user.id);
          if (currentUser) {
            setFullUserData(currentUser);
            // Update local state with latest from server
            setFirstName(currentUser.firstname || currentUser.first_name || "");
            setLastName(currentUser.lastname || currentUser.last_name || "");
            setEmail(currentUser.email || "");
            setPhone(currentUser.phone || "");
          }
        } catch (err) {
          console.error("Failed to fetch user details", err);
        }
      };
      fetchUserData();
    }
  }, [isOpen, user, token, API_BASE_URL]);

  const handleProfileUpdate = async () => {
    setProfileError("");
    setProfileSuccess("");
    setProfileLoading(true);

    try {
      if (!firstName.trim() || !lastName.trim() || !email.trim()) {
        setProfileError("First name, last name, and email are required.");
        setProfileLoading(false);
        return;
      }

      const headers = { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      };

      // Construct payload preserving existing fields
      const payload = {
        ...fullUserData,
        firstname: firstName.trim(),
        lastname: lastName.trim(),
        email: email.trim(),
        // Ensure these keys match what the backend expects (from Users.tsx)
        phone: phone.trim(),
        role: fullUserData?.role || "",
        region: fullUserData?.region || "",
        district: fullUserData?.district || "",
        depot: fullUserData?.depot || "",
      };

      await axios.put(`${API_BASE_URL}/api/v1/auth/update/id/${user?.id}`, payload, { headers });

      // Update AuthContext
      updateUser({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim()
      });

      setProfileSuccess("Profile updated successfully.");
      setTimeout(() => {
        setProfileSuccess("");
      }, 3000);
    } catch (err: any) {
      setProfileError(err.response?.data?.message || err.message || "Failed to update profile.");
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (!currentPassword || !newPassword) {
        setPasswordError("Please fill in all password fields.");
        return;
    }

    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(
        `${API_BASE_URL}/api/v1/auth/change-password/${user?.email}/${encodeURIComponent(currentPassword)}/${encodeURIComponent(newPassword)}`, 
        null, 
        { headers }
      );
      
      setPasswordSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
          setPasswordSuccess("");
          closeModal();
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.response?.data?.message || err.message || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
      setPasswordError("");
      setPasswordSuccess("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setProfileError("");
      setProfileSuccess("");
      closeModal();
  }

  return (
    <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800 lg:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-base font-semibold text-gray-800 dark:text-white/90 lg:mb-4">
            Personal Information
          </h4>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-x-10 lg:gap-y-4 2xl:gap-x-20">
            <div>
              <p className="mb-1.5 text-[11px] leading-normal text-gray-500 dark:text-gray-400">
                First Name
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {user?.first_name ?? ""}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] leading-normal text-gray-500 dark:text-gray-400">
                Last Name
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {user?.last_name ?? ""}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] leading-normal text-gray-500 dark:text-gray-400">
                Email address
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {user?.email ?? ""}
              </p>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] leading-normal text-gray-500 dark:text-gray-400">
                Phone
              </p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {user?.phone ?? "—"}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={openModal}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
        >
          <svg
            className="fill-current"
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z"
              fill=""
            />
          </svg>
          Edit
        </button>
      </div>

      <Modal isOpen={isOpen} onClose={handleClose} className="max-w-2xl w-full p-0 overflow-hidden rounded-2xl bg-white shadow-xl transition-all" backdropBlur={true}>
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-6">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-blue-100">Profile</h3>
                <button 
                    type="button"
                    onClick={handleClose}
                    className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
            <div className="mt-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white">
                    <User className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold text-white">Edit Personal Information</h2>
            </div>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[80vh]">
          <form className="flex flex-col space-y-6">
            <div>
              <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                Personal Information
              </h5>
              
              {profileError && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                      {profileError}
                  </div>
              )}
              
              {profileSuccess && (
                  <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm border border-green-100">
                      {profileSuccess}
                  </div>
              )}

              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div className="col-span-2 lg:col-span-1">
                  <Label>First Name</Label>
                  <Input 
                    type="text" 
                    value={firstName} 
                    onChange={(e) => setFirstName(e.target.value)}
                    className="bg-white dark:bg-gray-900" 
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label>Last Name</Label>
                  <Input 
                    type="text" 
                    value={lastName} 
                    onChange={(e) => setLastName(e.target.value)}
                    className="bg-white dark:bg-gray-900" 
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label>Email Address</Label>
                  <Input 
                    type="text" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white dark:bg-gray-900" 
                  />
                </div>

                <div className="col-span-2 lg:col-span-1">
                  <Label>Phone</Label>
                  <Input 
                    type="text" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)}
                    className="bg-white dark:bg-gray-900" 
                  />
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <button 
                    type="button" 
                    onClick={handleProfileUpdate}
                    disabled={profileLoading}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                >
                    {profileLoading ? "Saving..." : "Save Details"}
                </button>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Change Password
                </h5>
                
                {passwordError && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                        {passwordError}
                    </div>
                )}
                
                {passwordSuccess && (
                    <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm border border-green-100">
                        {passwordSuccess}
                    </div>
                )}

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                    <div className="col-span-2">
                        <Label>Current Password</Label>
                        <div className="relative">
                            <Input 
                                type={showPassword ? "text" : "password"} 
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                placeholder="Enter current password" 
                            />
                            <span
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                            >
                                {showPassword ? (
                                    <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                                ) : (
                                    <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                                )}
                            </span>
                        </div>
                    </div>
                    
                    <div className="col-span-2 lg:col-span-1">
                        <Label>New Password</Label>
                        <Input 
                            type={showPassword ? "text" : "password"} 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="New password" 
                        />
                    </div>

                    <div className="col-span-2 lg:col-span-1">
                        <Label>Confirm New Password</Label>
                        <Input 
                            type={showPassword ? "text" : "password"} 
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password" 
                        />
                    </div>
                </div>
            </div>

            <div className="mt-8 flex items-center justify-end gap-3 border-t border-gray-100 pt-6">
                <button 
                    type="button" 
                    onClick={handleClose}
                    className="rounded-md bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 border border-gray-300 shadow-sm"
                >
                    Close
                </button>
                <button 
                    type="button" 
                    onClick={handlePasswordChange}
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[100px]"
                >
                    {loading ? "Changing..." : "Change Password"}
                </button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
