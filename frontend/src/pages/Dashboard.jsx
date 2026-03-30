import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getUser } from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getUser());
  const [rooms, setRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomsError, setRoomsError] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [lastCreated, setLastCreated] = useState(null);

  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const isProfessor = user?.role === 'professor';

  async function loadRooms() {
    setRoomsError('');
    setLoadingRooms(true);
    try {
      const list = await api.getRooms();
      setRooms(list);
    } catch (err) {
      setRoomsError(err.message || 'Failed to load rooms');
    } finally {
      setLoadingRooms(false);
    }
  }

  useEffect(() => {
    const u = getUser();
    if (!u) {
      navigate('/login', { replace: true });
      return;
    }
    setUser(u);
    loadRooms();
  }, [navigate]);

  async function handleCreateRoom(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const room = await api.createRoom(roomName.trim());
      setLastCreated({ name: room.name });
      setRoomName('');
      setShowCreateForm(false);
      await loadRooms();
    } catch (err) {
      setCreateError(err.message || 'Could not create room');
    } finally {
      setCreating(false);
    }
  }

  async function handleJoinRoom(e) {
    e.preventDefault();
    setJoinError('');
    setJoining(true);
    try {
      const res = await api.joinRoom(joinRoomId.trim(), joinCode.trim());
      setJoinRoomId('');
      setJoinCode('');
      await loadRooms();
      if (res.room_id) navigate(`/room/${res.room_id}`);
    } catch (err) {
      setJoinError(err.message || 'Could not join room');
    } finally {
      setJoining(false);
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-8">
        {lastCreated && (
          <div className="rounded-xl border-2 border-amber-500/60 bg-slate-800 p-6 shadow-lg">
            <p className="text-sm font-medium text-amber-400">Room created</p>
            <p className="mt-1 text-lg text-slate-200">{lastCreated.name}</p>
            <p className="mt-3 text-sm text-slate-400">
              Open the room to see the invite code and manage rounds.
            </p>
            <button
              type="button"
              onClick={() => setLastCreated(null)}
              className="mt-4 text-sm text-slate-400 underline hover:text-slate-200"
            >
              Dismiss
            </button>
          </div>
        )}

        {isProfessor && (
          <section className="rounded-xl border border-slate-700 bg-slate-800 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-slate-200">Create room</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm((v) => !v);
                  setCreateError('');
                }}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
              >
                {showCreateForm ? 'Cancel' : 'Create Room'}
              </button>
            </div>
            {showCreateForm && (
              <form onSubmit={handleCreateRoom} className="mt-4 space-y-3">
                {createError && (
                  <p className="text-sm text-red-400" role="alert">
                    {createError}
                  </p>
                )}
                <input
                  type="text"
                  required
                  placeholder="Room name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 placeholder:text-slate-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 sm:max-w-md"
                />
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-60"
                >
                  {creating ? 'Creating…' : 'Submit'}
                </button>
              </form>
            )}
          </section>
        )}

        <section className="rounded-xl border border-slate-700 bg-slate-800 p-6">
          <h2 className="text-lg font-medium text-slate-200">Join room</h2>
          <p className="mt-1 text-sm text-slate-400">
            Enter the room ID and invite code from your instructor.
          </p>
          <form onSubmit={handleJoinRoom} className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            {joinError && (
              <p className="w-full text-sm text-red-400" role="alert">
                {joinError}
              </p>
            )}
            <div className="flex-1 min-w-[140px]">
              <label htmlFor="join-room-id" className="block text-xs text-slate-400">
                Room ID
              </label>
              <input
                id="join-room-id"
                type="text"
                required
                value={joinRoomId}
                onChange={(e) => setJoinRoomId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label htmlFor="join-code" className="block text-xs text-slate-400">
                Invite code
              </label>
              <input
                id="join-code"
                type="text"
                required
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-slate-200 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <button
              type="submit"
              disabled={joining}
              className="rounded-lg border border-amber-500/60 bg-transparent px-4 py-2 text-sm font-semibold text-amber-400 hover:bg-amber-500/10 disabled:opacity-60"
            >
              {joining ? 'Joining…' : 'Join'}
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-lg font-medium text-slate-200">Your rooms</h2>
          {loadingRooms && <p className="mt-4 text-slate-400">Loading…</p>}
          {roomsError && (
            <p className="mt-4 text-sm text-red-400" role="alert">
              {roomsError}
            </p>
          )}
          {!loadingRooms && !roomsError && rooms.length === 0 && (
            <p className="mt-4 text-slate-400">You are not in any rooms yet.</p>
          )}
          <ul className="mt-4 space-y-3">
            {rooms.map((room) => (
              <li key={room.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/room/${room.id}`)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 p-4 text-left transition hover:border-amber-500/40 hover:bg-slate-800/80"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-100">{room.name}</span>
                    <span className="text-sm text-slate-400">
                      {room.member_count} member{room.member_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">
                    <span className="text-slate-500">Status: </span>
                    <span
                      className={
                        room.round_display === 'Complete'
                          ? 'text-emerald-400'
                          : room.round_display?.startsWith('Round ')
                            ? 'text-amber-400'
                            : 'text-slate-300'
                      }
                    >
                      {room.round_display ?? '—'}
                    </span>
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
    </div>
  );
}
