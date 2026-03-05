import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import axios from 'axios';
import type { AxiosError } from 'axios';
import Alert from '../../components/ui/alert/Alert';
import { ActionMenu } from '../../components/ui/dropdown/ActionMenu';
import Button from '../../components/ui/button/Button';
import { Plus, X, Search, Filter, Loader2 } from 'lucide-react';
import { Modal } from '../../components/ui/modal';

interface RegionOption { id: number; name: string }
interface DistrictOption { id: number; name: string; regionId?: number; region?: { id: number; name: string } }
interface DepotOption { id: number; name: string; districtId?: number; district?: { id: number; name: string } }

interface User {
  id: number;
  firstname?: string;
  lastname?: string;
  email: string;
  phone?: string;
  role?: string;
  region?: string;
  district?: string;
  depot?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

export default function Users() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showView, setShowView] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [active, setActive] = useState<User | null>(null);

  // Form states
  const [firstnameInput, setFirstnameInput] = useState('');
  const [lastnameInput, setLastnameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [roleInput, setRoleInput] = useState('');
  const [regionInput, setRegionInput] = useState('');
  const [districtInput, setDistrictInput] = useState('');
  const [depotInput, setDepotInput] = useState('');
  
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [districts, setDistricts] = useState<DistrictOption[]>([]);
  const [depots, setDepots] = useState<DepotOption[]>([]);
  
  const [selectedRegionId, setSelectedRegionId] = useState<number | ''>('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<number | ''>('');
  const [selectedDepotId, setSelectedDepotId] = useState<number | ''>('');
  
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ variant: 'success' | 'error' | 'info' | 'warning'; title: string; message: string } | null>(null);
  
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordTarget, setPasswordTarget] = useState<User | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const headers = { Authorization: `Bearer ${token}` };
      const usersRes = await axios.get<User[]>(`${API_BASE_URL}/api/v1/auth/users`, { headers });
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : (usersRes.data?.data ?? []));
    } catch (err) {
      const error = err as AxiosError;
      setError(error.message || 'Failed to fetch users');
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const normalizeList = <T,>(payload: unknown): T[] => {
    if (Array.isArray(payload)) return payload as T[];
    const obj = payload as Record<string, unknown>;
    const candidates = ['data', 'content', 'items', 'records'];
    for (const key of candidates) {
      const v = obj?.[key] as unknown;
      if (Array.isArray(v)) return v as T[];
    }
    return [] as T[];
  };

  const fetchRegionsOptions = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_BASE_URL}/api/v1/regions`, { headers });
      const arr = Array.isArray(res.data) ? (res.data as RegionOption[]) : ((res.data?.data as RegionOption[]) ?? []);
      setRegions(arr.map((r) => ({ id: r.id, name: r.name })));
    } catch {
      setRegions([]);
    }
  }, [API_BASE_URL, token]);

  const fetchDistrictsOptions = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_BASE_URL}/api/v1/districts`, { headers });
      const list = normalizeList<DistrictOption>(res.data);
      setDistricts(list.map(d => ({ id: d.id, name: d.name, regionId: d.region?.id ?? d.regionId, region: d.region })));
    } catch {
      setDistricts([]);
    }
  }, [API_BASE_URL, token]);

  const fetchDepotsOptions = useCallback(async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.get(`${API_BASE_URL}/api/v1/depots`, { headers });
      const list = normalizeList<DepotOption>(res.data);
      setDepots(list.map(d => ({ id: d.id, name: d.name, districtId: d.district?.id ?? d.districtId, district: d.district })));
    } catch {
      setDepots([]);
    }
  }, [API_BASE_URL, token]);

  useEffect(() => {
    if (token) {
      fetchRegionsOptions();
      fetchDistrictsOptions();
      fetchDepotsOptions();
    }
  }, [token, fetchRegionsOptions, fetchDistrictsOptions, fetchDepotsOptions]);

  // Filter and paginate users
  const filteredUsers = users.filter(user => {
    const query = search.toLowerCase();
    if (!query) return true;
    return (
      (user.firstname?.toLowerCase().includes(query) ?? false) ||
      (user.lastname?.toLowerCase().includes(query) ?? false) ||
      user.email.toLowerCase().includes(query) ||
      (user.phone?.toLowerCase().includes(query) ?? false) ||
      (user.role?.toLowerCase().includes(query) ?? false) ||
      (user.region?.toLowerCase().includes(query) ?? false) ||
      (user.district?.toLowerCase().includes(query) ?? false) ||
      (user.depot?.toLowerCase().includes(query) ?? false)
    );
  });

  const totalPages = Math.ceil(filteredUsers.length / pageSize);
  const paginatedUsers = filteredUsers.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // Form handlers
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setActive(user);
    setFirstnameInput(user.firstname ?? '');
    setLastnameInput(user.lastname ?? '');
    setEmailInput(user.email ?? '');
    setPasswordInput('');
    setPhoneInput(user.phone ?? '');
    setRoleInput(user.role ?? '');
    setRegionInput(user.region ?? '');
    setDistrictInput(user.district ?? '');
    setDepotInput(user.depot ?? '');
    const r = regions.find(x => x.name === (user.region ?? ''));
    const d = districts.find(x => x.name === (user.district ?? ''));
    const dp = depots.find(x => x.name === (user.depot ?? ''));
    setSelectedRegionId(r?.id ?? '');
    setSelectedDistrictId(d?.id ?? '');
    setSelectedDepotId(dp?.id ?? '');
    setFormError(null);
    setShowEdit(true);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!firstnameInput.trim()) { setFormError('Enter first name'); return; }
      if (!lastnameInput.trim()) { setFormError('Enter last name'); return; }
      if (!emailInput.trim()) { setFormError('Enter email'); return; }
      if (!passwordInput) { setFormError('Enter password'); return; }
      if (!roleInput) { setFormError('Select a role'); return; }
      if (!regionInput) { setFormError('Select a region'); return; }
      if (!districtInput) { setFormError('Select a district'); return; }
      if (!depotInput) { setFormError('Select a depot'); return; }
      setSavingCreate(true);
      setFormError(null);
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      await axios.post(`${API_BASE_URL}/api/v1/auth/register`, {
        firstname: firstnameInput.trim(),
        lastname: lastnameInput.trim(),
        email: emailInput.trim(),
        password: passwordInput,
        phone: phoneInput.trim(),
        role: roleInput.trim(),
        region: regionInput.trim(),
        district: districtInput.trim(),
        depot: depotInput.trim(),
      }, { headers });
      setShowCreate(false);
      setFirstnameInput('');
      setLastnameInput('');
      setEmailInput('');
      setPasswordInput('');
      setPhoneInput('');
      setRoleInput('');
      setRegionInput('');
      setDistrictInput('');
      setDepotInput('');
      await fetchData();
      setNotice({ variant: 'success', title: 'User created', message: 'The user was created successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to create user');
      setNotice({ variant: 'error', title: 'Create failed', message: 'Could not create the user.' });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingCreate(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!active) return;
      if (!firstnameInput.trim()) { setFormError('Enter first name'); return; }
      if (!lastnameInput.trim()) { setFormError('Enter last name'); return; }
      if (!emailInput.trim()) { setFormError('Enter email'); return; }
      if (!roleInput) { setFormError('Select a role'); return; }
      if (!regionInput) { setFormError('Select a region'); return; }
      if (!districtInput) { setFormError('Select a district'); return; }
      if (!depotInput) { setFormError('Select a depot'); return; }
      setSavingEdit(true);
      setFormError(null);
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      await axios.put(`${API_BASE_URL}/api/v1/auth/update/id/${active.id}`, {
        firstname: firstnameInput.trim(),
        lastname: lastnameInput.trim(),
        email: emailInput.trim(),
        phone: phoneInput.trim(),
        role: roleInput.trim(),
        region: regionInput.trim(),
        district: districtInput.trim(),
        depot: depotInput.trim(),
      }, { headers });
      setShowEdit(false);
      setActive(null);
      setFirstnameInput('');
      setLastnameInput('');
      setEmailInput('');
      setPhoneInput('');
      setRoleInput('');
      setRegionInput('');
      setDistrictInput('');
      setDepotInput('');
      await fetchData();
      setNotice({ variant: 'success', title: 'User updated', message: 'Changes were saved successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch {
      setFormError('Failed to update user');
      setNotice({ variant: 'error', title: 'Update failed', message: 'Could not update the user.' });
      setTimeout(() => setNotice(null), 5000);
    } finally {
      setSavingEdit(false);
    }
  };

  const openDelete = (user: User) => {
    setUserToDelete(user);
    setDeleteError(null);
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      setDeleting(true);
      setDeleteError(null);
      const headers = { Authorization: `Bearer ${token}` };
      await axios.delete(`${API_BASE_URL}/api/v1/auth/users/${userToDelete.id}`, { headers });
      setShowDelete(false);
      setUserToDelete(null);
      await fetchData();
      setNotice({ variant: 'success', title: 'User deleted', message: 'The user has been deleted successfully.' });
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      const error = err as AxiosError;
      setDeleteError(error.message || 'Failed to delete user');
      // If 404 or similar, maybe already deleted, but let's assume standard error handling
    } finally {
      setDeleting(false);
    }
  };

  const openChangePassword = (user: User) => {
    setPasswordTarget(user);
    setCurrentPassword('');
    setNewPassword('');
    setShowChangePassword(true);
  };

  const submitChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTarget) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(`${API_BASE_URL}/api/v1/auth/change-password/${passwordTarget.email}/${encodeURIComponent(currentPassword)}/${encodeURIComponent(newPassword)}`, null, { headers });
      setShowChangePassword(false);
      setPasswordTarget(null);
      setCurrentPassword('');
      setNewPassword('');
      setNotice({ variant: 'success', title: 'Password changed', message: 'User password has been updated.' });
      setTimeout(() => setNotice(null), 4000);
    } catch (err) {
      const error = err as AxiosError;
      setError(error.message || 'Failed to change password');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-100 rounded-md">
        Error: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice && (
        <Alert variant={notice.variant} title={notice.title} message={notice.message} />
      )}
      
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            {filteredUsers.length} {filteredUsers.length === 1 ? 'User' : 'Users'}
          </span>
        </div>
        
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Show</span>
            <select 
              value={pageSize} 
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} 
              className="text-sm border-none bg-transparent font-medium focus:ring-0 cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          
          <Button 
            size="sm" 
            onClick={() => {
              setSearch('');
              setPage(1);
            }}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Reset
          </Button>

          <Button 
            size="sm" 
            onClick={() => {
              setFirstnameInput('');
              setLastnameInput('');
              setEmailInput('');
              setPhoneInput('');
              setRoleInput('');
              setRegionInput('');
              setDistrictInput('');
              setDepotInput('');
              setSelectedRegionId('');
              setSelectedDistrictId('');
              setSelectedDepotId('');
              setActive(null);
              setFormError(null);
              setShowCreate(true);
            }} 
            startIcon={<Plus className="w-4 h-4" />}
          >
            Add User
          </Button>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No users found matching your search.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold mr-3">
                          {user.firstname?.[0] || user.email[0].toUpperCase()}
                        </div>
                        <div className="text-sm font-medium text-gray-900">{user.firstname ?? ''} {user.lastname ?? ''}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                        user.role === 'USER' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {user.role ?? '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.phone ?? '—'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <ActionMenu
                        placement="bottom"
                        onView={() => { setActive(user); setShowView(true); }}
                        onEdit={() => handleEditUser(user)}
                        onDelete={() => openDelete(user)}
                        extras={[{
                          label: 'Change Password',
                          onClick: () => openChangePassword(user),
                          icon: (
                            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10 1.667a4.167 4.167 0 00-4.167 4.166v2.5H4.167A1.667 1.667 0 002.5 10v6.667A1.667 1.667 0 004.167 18.333h11.666A1.667 1.667 0 0017.5 16.667V10a1.667 1.667 0 00-1.667-1.667h-1.666v-2.5A4.167 4.167 0 0010 1.667zm-2.5 6.666v-2.5a2.5 2.5 0 115 0v2.5h-5z" />
                            </svg>
                          ),
                        }]}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{(page - 1) * pageSize + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(page * pageSize, filteredUsers.length)}
                  </span>{' '}
                  of <span className="font-medium">{filteredUsers.length}</span> results
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">First</span>
                    &laquo;
                  </button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === pageNum
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                  >
                    <span className="sr-only">Last</span>
                    &raquo;
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={showCreate || showEdit} onClose={() => { setShowCreate(false); setShowEdit(false); }} className="max-w-3xl w-full p-0 overflow-hidden rounded-xl" overlayClassName="bg-black/60 backdrop-blur-sm">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">
            {editingUser ? 'Edit User' : 'Create New User'}
          </h3>
          <button 
            type="button"
            onClick={() => { setShowCreate(false); setShowEdit(false); }}
            className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6">
          <form onSubmit={editingUser ? submitEdit : submitCreate}>
            <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label htmlFor="firstname" className="block text-sm font-medium text-gray-700">First Name *</label>
                <input type="text" name="firstname" id="firstname" placeholder="Enter first name" required value={firstnameInput} onChange={(e) => setFirstnameInput(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm" />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="lastname" className="block text-sm font-medium text-gray-700">Last Name *</label>
                <input type="text" name="lastname" id="lastname" placeholder="Enter last name" required value={lastnameInput} onChange={(e) => setLastnameInput(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm" />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email *</label>
                <input type="email" name="email" id="email" placeholder="Enter email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm" />
              </div>
              {!editingUser && (
                <div className="sm:col-span-3">
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password *</label>
                  <input type="password" name="password" id="password" placeholder="Enter password" required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm" />
                </div>
              )}
              <div className="sm:col-span-3">
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone</label>
                <input type="text" name="phone" id="phone" placeholder="Enter phone" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm" />
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
                <select name="role" id="role" value={roleInput} onChange={(e) => setRoleInput(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm">
                  <option value="">Select role</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="BUSINESSMANAGER">BUSINESSMANAGER</option>
                  <option value="COMMERCIALDIRECTOR">COMMERCIALDIRECTOR</option>
                  <option value="DEPOT_FOREMAN">DEPOT_FOREMAN</option>
                  <option value="DISTRICTMANAGER">DISTRICTMANAGER</option>
                  <option value="FINANCEDIRECTOR">FINANCEDIRECTOR</option>
                  <option value="LOSS_CONTROL">LOSS_CONTROL</option>
                  <option value="MANAGINGDIRECTOR">MANAGINGDIRECTOR</option>
                  <option value="TECHNICALDIRECTOR">TECHNICALDIRECTOR</option>
                  <option value="TECHNICIAN">TECHNICIAN</option>
                  <option value="USER">USER</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="region" className="block text-sm font-medium text-gray-700">Region</label>
                <select
                  id="region"
                  value={selectedRegionId}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : '';
                    setSelectedRegionId(id as number | '');
                    const name = regions.find(r => r.id === Number(e.target.value))?.name ?? '';
                    setRegionInput(name);
                    setSelectedDistrictId('');
                    setSelectedDepotId('');
                    setDistrictInput('');
                    setDepotInput('');
                  }}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Select region</option>
                  {regions.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="district" className="block text-sm font-medium text-gray-700">District</label>
                <select
                  id="district"
                  value={selectedDistrictId}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : '';
                    setSelectedDistrictId(id as number | '');
                    const name = districts.find(d => d.id === Number(e.target.value))?.name ?? '';
                    setDistrictInput(name);
                    setSelectedDepotId('');
                    setDepotInput('');
                  }}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Select district</option>
                  {(selectedRegionId ? districts.filter(d => (d.region?.id ?? d.regionId) === selectedRegionId) : districts).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="depot" className="block text-sm font-medium text-gray-700">Depot</label>
                <select
                  id="depot"
                  value={selectedDepotId}
                  onChange={(e) => {
                    const id = e.target.value ? Number(e.target.value) : '';
                    setSelectedDepotId(id as number | '');
                    const name = depots.find(dp => dp.id === Number(e.target.value))?.name ?? '';
                    setDepotInput(name);
                  }}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Select depot</option>
                  {(selectedDistrictId ? depots.filter(dp => (dp.district?.id ?? dp.districtId) === selectedDistrictId) : depots).map(dp => (
                    <option key={dp.id} value={dp.id}>{dp.name}</option>
                  ))}
                </select>
              </div>
              {formError && (
                <div className="sm:col-span-6 text-sm text-red-600 bg-red-50 p-2 rounded">{formError}</div>
              )}
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={() => { setShowCreate(false); setShowEdit(false); }} className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400">Cancel</button>
              <button type="submit" disabled={editingUser ? savingEdit : savingCreate} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 flex items-center gap-2">
                {(editingUser ? savingEdit : savingCreate) && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={showChangePassword && !!passwordTarget} onClose={() => setShowChangePassword(false)} className="max-w-md w-full p-0 overflow-hidden rounded-xl" overlayClassName="bg-black/60 backdrop-blur-sm">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Change Password</h3>
          <button 
            type="button"
            onClick={() => setShowChangePassword(false)}
            className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6">
          <form onSubmit={submitChangePassword}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Current Password</label>
                <input type="password" placeholder="Enter current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <input type="password" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:text-sm" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowChangePassword(false)} className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">Cancel</button>
              <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Update Password</button>
            </div>
          </form>
        </div>
      </Modal>

      {/* View User Modal */}
      <Modal isOpen={showView && !!active} onClose={() => setShowView(false)} className="max-w-md w-full p-0 overflow-hidden rounded-xl" overlayClassName="bg-black/60 backdrop-blur-sm">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">User Details</h3>
          <button 
            type="button"
            onClick={() => setShowView(false)}
            className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Name</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{(active?.firstname ?? '')} {(active?.lastname ?? '')}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Email</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{active?.email ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Phone</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{active?.phone ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Role</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{active?.role ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Region</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{active?.region ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">District</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{active?.district ?? '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Depot</div>
                <div className="text-sm font-medium text-gray-900 mt-1">{active?.depot ?? '—'}</div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setShowView(false)} className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete User Modal */}
      <Modal isOpen={showDelete} onClose={() => setShowDelete(false)} className="max-w-md w-full p-0 overflow-hidden rounded-xl" overlayClassName="bg-black/60 backdrop-blur-sm">
        <div className="bg-gradient-to-r from-red-600 to-red-800 px-6 py-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white">Delete User</h3>
            <button 
              type="button"
              onClick={() => setShowDelete(false)}
              className="rounded-full bg-white/20 p-1 text-white hover:bg-white/30 transition-colors focus:outline-none"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-2 text-sm text-red-100">This action cannot be undone.</p>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700">
              Are you sure you want to delete <span className="font-bold">{userToDelete?.firstname} {userToDelete?.lastname}</span>?
            </p>
            {deleteError && (
              <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">
                {deleteError}
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-3">
            <button 
              type="button"
              onClick={() => setShowDelete(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 flex items-center gap-2 disabled:opacity-50"
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? 'Deleting...' : 'Delete User'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
