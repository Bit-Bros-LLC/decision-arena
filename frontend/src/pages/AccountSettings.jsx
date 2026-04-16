import { useState } from 'react';
import { api, getUser, updateCachedUser } from '../api';

export default function AccountSettings() {
  const user = getUser();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [profileMsg, setProfileMsg] = useState(null);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const isProfessor = user?.role === 'professor';

  const [users, setUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetMsg, setResetMsg] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  async function handleNameSave(e) {
    e.preventDefault();
    setProfileMsg(null);
    const trimmed = displayName.trim();
    if (!trimmed) {
      setProfileMsg({ type: 'error', text: 'Name cannot be empty' });
      return;
    }
    setSavingName(true);
    try {
      const res = await api.updateProfile({ display_name: trimmed });
      updateCachedUser({ display_name: res.display_name });
      setProfileMsg({ type: 'success', text: 'Display name updated!' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update name' });
    } finally {
      setSavingName(false);
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 4) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 4 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    setSavingPassword(true);
    try {
      await api.updateProfile({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
    } catch (err) {
      setPasswordMsg({ type: 'error', text: err.message || 'Failed to change password' });
    } finally {
      setSavingPassword(false);
    }
  }

  async function loadUsers() {
    setLoadingUsers(true);
    try {
      const list = await api.listUsers();
      setUsers(list);
      setUsersLoaded(true);
    } catch (err) {
      setResetMsg({ type: 'error', text: err.message || 'Failed to load users' });
    } finally {
      setLoadingUsers(false);
    }
  }

  async function handleAdminReset(e) {
    e.preventDefault();
    setResetMsg(null);
    if (!resetUserId) {
      setResetMsg({ type: 'error', text: 'Select a user first' });
      return;
    }
    if (resetPassword.length < 4) {
      setResetMsg({ type: 'error', text: 'Password must be at least 4 characters' });
      return;
    }
    setResetting(true);
    try {
      const res = await api.adminResetPassword({ user_id: resetUserId, new_password: resetPassword });
      setResetPassword('');
      setResetUserId('');
      setResetMsg({ type: 'success', text: res.detail || 'Password reset!' });
    } catch (err) {
      setResetMsg({ type: 'error', text: err.message || 'Failed to reset password' });
    } finally {
      setResetting(false);
    }
  }

  function MsgBanner({ msg }) {
    if (!msg) return null;
    const isErr = msg.type === 'error';
    return (
      <div
        className={`rounded-lg border px-3 py-2 text-sm ${
          isErr
            ? 'border-red-500/40 bg-red-950/40 text-red-300'
            : 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
        }`}
        role="alert"
      >
        {msg.text}
      </div>
    );
  }

  const filteredUsers = users.filter(
    (u) =>
      u.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const inputClass =
    'mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500';

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Account Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Signed in as <span className="text-slate-200">{user?.display_name}</span>{' '}
          <span
            className={`ml-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              isProfessor ? 'bg-amber-500/20 text-amber-400' : 'bg-sky-500/20 text-sky-400'
            }`}
          >
            {user?.role}
          </span>
        </p>
      </div>

      {/* ---- Display Name ---- */}
      <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
        <h2 className="text-lg font-medium text-slate-100">Display Name</h2>
        <form onSubmit={handleNameSave} className="mt-4 space-y-4">
          <MsgBanner msg={profileMsg} />
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-slate-300">
              Name
            </label>
            <input
              id="displayName"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={savingName}
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingName ? 'Saving…' : 'Update Name'}
          </button>
        </form>
      </section>

      {/* ---- Change Password ---- */}
      <section className="rounded-xl border border-slate-700 bg-slate-800 p-6 shadow-lg">
        <h2 className="text-lg font-medium text-slate-100">Change Password</h2>
        <form onSubmit={handlePasswordSave} className="mt-4 space-y-4">
          <MsgBanner msg={passwordMsg} />
          <div>
            <label htmlFor="currentPw" className="block text-sm font-medium text-slate-300">
              Current Password
            </label>
            <input
              id="currentPw"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="newPw" className="block text-sm font-medium text-slate-300">
              New Password
            </label>
            <input
              id="newPw"
              type="password"
              required
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              placeholder="At least 4 characters"
            />
          </div>
          <div>
            <label htmlFor="confirmPw" className="block text-sm font-medium text-slate-300">
              Confirm New Password
            </label>
            <input
              id="confirmPw"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={savingPassword}
            className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingPassword ? 'Changing…' : 'Change Password'}
          </button>
        </form>
      </section>

      {/* ---- Professor: Reset Student Password ---- */}
      {isProfessor && (
        <section className="rounded-xl border border-amber-500/30 bg-slate-800 p-6 shadow-lg">
          <h2 className="text-lg font-medium text-amber-400">Reset Student Password</h2>
          <p className="mt-1 text-sm text-slate-400">
            Reset the password for any student in your rooms who got locked out.
          </p>

          {!usersLoaded ? (
            <button
              type="button"
              onClick={loadUsers}
              disabled={loadingUsers}
              className="mt-4 rounded-lg border border-amber-500/40 px-4 py-2 text-sm text-amber-400 transition hover:bg-amber-500/10 disabled:opacity-50"
            >
              {loadingUsers ? 'Loading users…' : 'Load user list'}
            </button>
          ) : (
            <form onSubmit={handleAdminReset} className="mt-4 space-y-4">
              <MsgBanner msg={resetMsg} />
              <div>
                <label htmlFor="searchUser" className="block text-sm font-medium text-slate-300">
                  Search Users
                </label>
                <input
                  id="searchUser"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={inputClass}
                  placeholder="Filter by name or email…"
                />
              </div>
              <div>
                <label htmlFor="resetUser" className="block text-sm font-medium text-slate-300">
                  Select User
                </label>
                <select
                  id="resetUser"
                  value={resetUserId}
                  onChange={(e) => setResetUserId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— choose a user —</option>
                  {filteredUsers.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.display_name} ({u.email}) [{u.role}]
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="resetPw" className="block text-sm font-medium text-slate-300">
                  New Password
                </label>
                <input
                  id="resetPw"
                  type="password"
                  required
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className={inputClass}
                  placeholder="At least 4 characters"
                />
              </div>
              <button
                type="submit"
                disabled={resetting}
                className="rounded-lg bg-amber-500 px-5 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resetting ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
