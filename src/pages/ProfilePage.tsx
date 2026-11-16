import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, Upload, Plus, Trash2, MessageSquare, ArrowLeftRight, Award, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { PreferredMethod, Proficiency, SkillCatalogItem, UserProfile } from '../types';
import { Avatar } from '../components/ui/Avatar';
import { LoadingSkeleton, ErrorBanner } from '../components/ui/StateViews';
import { ExchangeRequestModal } from '../components/ui/ExchangeRequestModal';

const AVAILABILITY_SLOTS = [
  'Mon Morn', 'Mon Aft', 'Mon Eve',
  'Tue Morn', 'Tue Aft', 'Tue Eve',
  'Wed Morn', 'Wed Aft', 'Wed Eve',
  'Thu Morn', 'Thu Aft', 'Thu Eve',
  'Fri Morn', 'Fri Aft', 'Fri Eve',
  'Sat Morn', 'Sat Aft', 'Sun Aft',
];

export const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const { user, refreshUser, showToast } = useAuth();
  const navigate = useNavigate();

  const isOwnProfile = !id || id === user?.id;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [catalog, setCatalog] = useState<SkillCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [method, setMethod] = useState<PreferredMethod>('online');
  const [availability, setAvailability] = useState<string[]>([]);
  const [teachSkills, setTeachSkills] = useState<Array<{ name: string; proficiency: Proficiency; description: string }>>([]);
  const [learnSkills, setLearnSkills] = useState<Array<{ name: string; proficiency: Proficiency; description: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = isOwnProfile ? '/api/profiles/me' : `/api/profiles/${id}`;
      const res = await apiFetch<{ profile: UserProfile }>(endpoint);
      setProfile(res.profile);
      setName(res.profile.name);
      setBio(res.profile.bio || '');
      setMethod(res.profile.preferred_method);
      setAvailability(res.profile.weekly_availability || []);
      setTeachSkills(
        res.profile.teachSkills.map((s) => ({ name: s.name, proficiency: s.proficiency, description: s.description }))
      );
      setLearnSkills(
        res.profile.learnSkills.map((s) => ({ name: s.name, proficiency: s.proficiency, description: s.description }))
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, isOwnProfile]);

  useEffect(() => {
    loadProfile();
    if (isOwnProfile) {
      apiFetch<{ skills: SkillCatalogItem[] }>('/api/skills')
        .then((d) => setCatalog(d.skills))
        .catch(() => {});
    }
  }, [loadProfile, isOwnProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch<{ profile: UserProfile }>('/api/profiles/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim(),
          preferred_method: method,
          weekly_availability: availability,
          teachSkills: teachSkills.filter((s) => s.name.trim()),
          learnSkills: learnSkills.filter((s) => s.name.trim()),
          onboarding_completed: true,
        }),
      });
      setProfile(res.profile);
      await refreshUser();
      setEditing(false);
      showToast('Profile and skills saved.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(file);
      });
      const res = await apiFetch<{ avatarUrl: string }>('/api/storage/avatars', {
        method: 'POST',
        body: JSON.stringify({ dataUrl, fileName: file.name }),
      });
      setProfile((p) => (p ? { ...p, avatar_url: res.avatarUrl } : p));
      await refreshUser();
      showToast('Profile photo updated.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleStartChat = async () => {
    if (!profile) return;
    try {
      const res = await apiFetch<{ conversationId: string }>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ peerId: profile.id }),
      });
      navigate(`/messages?c=${res.conversationId}`);
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={3} />;
  if (error) return <ErrorBanner message={error} onRetry={loadProfile} />;
  if (!profile) return null;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <section className="rounded-xl bg-white border border-[#1B2A41]/10 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="relative">
              <Avatar name={profile.name} src={profile.avatar_url} size="xl" />
              {isOwnProfile && (
                <label
                  title="Upload new avatar"
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#1B2A41] text-white flex items-center justify-center cursor-pointer hover:bg-[#263A57] shadow"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                    className="sr-only"
                  />
                </label>
              )}
            </div>
            <div className="space-y-1.5">
              <h2 className="font-display font-bold text-2xl text-[#1B2A41]">{profile.name}</h2>
              <p className="text-xs text-[#1B2A41]/65">
                {profile.email} · Preferred method: <span className="capitalize font-medium">{profile.preferred_method}</span> ·{' '}
                <span className="tabular-nums">{profile.credits_per_30min} credit / 30 min</span>
              </p>
              <p className="text-sm text-[#1B2A41]/85 max-w-2xl leading-relaxed pt-1">
                {profile.bio || 'No bio added yet.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isOwnProfile ? (
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="px-4 py-2 rounded-lg bg-[#1B2A41] hover:bg-[#263A57] text-white text-sm font-medium transition-colors whitespace-nowrap"
              >
                {editing ? 'Cancel Editing' : 'Edit Profile & Skills'}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleStartChat}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#1B2A41]/20 bg-white hover:bg-[#F5F1E8] text-sm font-medium text-[#1B2A41] whitespace-nowrap"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Message</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConnectOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-sm font-medium whitespace-nowrap"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Request Exchange</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="mt-6 pt-6 border-t border-[#1B2A41]/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-[#1B2A41]/60">Credits Balance</p>
            <p className="font-display font-bold text-lg text-[#1B2A41] tabular-nums">{profile.wallet.balance}</p>
          </div>
          <div>
            <p className="text-xs text-[#1B2A41]/60">Completed Exchanges</p>
            <p className="font-display font-bold text-lg text-[#1B2A41] tabular-nums">{profile.completedExchanges}</p>
          </div>
          <div>
            <p className="text-xs text-[#1B2A41]/60">Average Rating</p>
            <p className="font-display font-bold text-lg text-[#1B2A41] tabular-nums flex items-center gap-1">
              <Star className="w-4 h-4 text-[#F47735] fill-[#F47735]" />
              {profile.reviewCount > 0 ? `${profile.avgRating} (${profile.reviewCount})` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#1B2A41]/60">Weekly Availability</p>
            <p className="text-xs font-medium text-[#1B2A41] mt-1">
              {profile.weekly_availability.join(', ') || 'Flexible'}
            </p>
          </div>
        </div>
      </section>

      {/* Edit Form */}
      {editing && isOwnProfile && (
        <form onSubmit={handleSave} className="rounded-xl bg-white border border-[#1B2A41]/15 p-6 sm:p-8 space-y-6">
          <h3 className="font-display font-semibold text-lg text-[#1B2A41]">Edit Profile & Skills</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1.5">Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-[#1B2A41]/20 px-3.5 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1.5">Preferred Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PreferredMethod)}
                className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3.5 py-2 text-sm"
              >
                <option value="online">Online</option>
                <option value="in-person">In-Person</option>
                <option value="chat">Chat</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#1B2A41]/75 mb-1.5">Bio</label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-lg border border-[#1B2A41]/20 px-3.5 py-2 text-sm"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1B2A41]">Skills You Teach</label>
              <button
                type="button"
                onClick={() => setTeachSkills((p) => [...p, { name: '', proficiency: 'intermediate', description: '' }])}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2CA69A] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add skill
              </button>
            </div>
            {teachSkills.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  list="profile-skill-catalog"
                  value={item.name}
                  placeholder="Skill name"
                  onChange={(e) => {
                    const c = [...teachSkills];
                    c[idx] = { ...c[idx], name: e.target.value };
                    setTeachSkills(c);
                  }}
                  className="sm:col-span-5 rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
                />
                <select
                  value={item.proficiency}
                  onChange={(e) => {
                    const c = [...teachSkills];
                    c[idx] = { ...c[idx], proficiency: e.target.value as Proficiency };
                    setTeachSkills(c);
                  }}
                  className="sm:col-span-3 rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2 text-sm"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="expert">Expert</option>
                </select>
                <input
                  type="text"
                  value={item.description}
                  placeholder="Topic notes"
                  onChange={(e) => {
                    const c = [...teachSkills];
                    c[idx] = { ...c[idx], description: e.target.value };
                    setTeachSkills(c);
                  }}
                  className="sm:col-span-3 rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setTeachSkills((p) => p.filter((_, i) => i !== idx))}
                  className="sm:col-span-1 p-2 text-[#1B2A41]/50 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1B2A41]">Skills You Want to Learn</label>
              <button
                type="button"
                onClick={() => setLearnSkills((p) => [...p, { name: '', proficiency: 'beginner', description: '' }])}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#F47735] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add skill
              </button>
            </div>
            {learnSkills.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  list="profile-skill-catalog"
                  value={item.name}
                  placeholder="Skill name"
                  onChange={(e) => {
                    const c = [...learnSkills];
                    c[idx] = { ...c[idx], name: e.target.value };
                    setLearnSkills(c);
                  }}
                  className="sm:col-span-5 rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
                />
                <select
                  value={item.proficiency}
                  onChange={(e) => {
                    const c = [...learnSkills];
                    c[idx] = { ...c[idx], proficiency: e.target.value as Proficiency };
                    setLearnSkills(c);
                  }}
                  className="sm:col-span-3 rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2 text-sm"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
                <input
                  type="text"
                  value={item.description}
                  placeholder="Learning goal"
                  onChange={(e) => {
                    const c = [...learnSkills];
                    c[idx] = { ...c[idx], description: e.target.value };
                    setLearnSkills(c);
                  }}
                  className="sm:col-span-3 rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setLearnSkills((p) => p.filter((_, i) => i !== idx))}
                  className="sm:col-span-1 p-2 text-[#1B2A41]/50 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <datalist id="profile-skill-catalog">
            {catalog.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>

          <div>
            <label className="block text-xs font-semibold text-[#1B2A41] mb-2">Weekly Availability</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY_SLOTS.map((slot) => {
                const active = availability.includes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() =>
                      setAvailability((p) => (p.includes(slot) ? p.filter((x) => x !== slot) : [...p, slot]))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                      active
                        ? 'bg-[#1B2A41] text-white border-[#1B2A41]'
                        : 'bg-white text-[#1B2A41]/75 border-[#1B2A41]/15'
                    }`}
                  >
                    {active && <Check className="w-3 h-3 inline mr-1" />}
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm rounded-lg border border-[#1B2A41]/15"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-medium rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* Skills & Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-xl bg-white border border-[#1B2A41]/10 p-6 space-y-5">
          <div>
            <h3 className="font-display font-semibold text-base text-[#1B2A41] mb-3">Teaching Offerings</h3>
            {profile.teachSkills.length === 0 ? (
              <p className="text-sm text-[#1B2A41]/60">No teaching skills listed.</p>
            ) : (
              <div className="divide-y divide-[#1B2A41]/8">
                {profile.teachSkills.map((s) => (
                  <div key={s.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#1B2A41]">{s.name}</span>
                      <span className="text-xs font-medium text-[#2CA69A] capitalize">{s.proficiency}</span>
                    </div>
                    {s.description && <p className="mt-0.5 text-xs text-[#1B2A41]/70">{s.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#1B2A41]/10">
            <h3 className="font-display font-semibold text-base text-[#1B2A41] mb-3">Learning Interests</h3>
            {profile.learnSkills.length === 0 ? (
              <p className="text-sm text-[#1B2A41]/60">No learning skills listed.</p>
            ) : (
              <div className="divide-y divide-[#1B2A41]/8">
                {profile.learnSkills.map((s) => (
                  <div key={s.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#1B2A41]">{s.name}</span>
                      <span className="text-xs font-medium text-[#F47735] capitalize">Level: {s.proficiency}</span>
                    </div>
                    {s.description && <p className="mt-0.5 text-xs text-[#1B2A41]/70">{s.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-xl bg-white border border-[#1B2A41]/10 p-6 space-y-5">
          <div>
            <h3 className="font-display font-semibold text-base text-[#1B2A41] mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#F47735]" />
              Achievements
            </h3>
            {profile.achievements.length === 0 ? (
              <p className="text-sm text-[#1B2A41]/60">Badges are awarded automatically upon completing exchanges.</p>
            ) : (
              <div className="space-y-3">
                {profile.achievements.map((b) => (
                  <div key={b.id} className="p-3 rounded-lg bg-[#F5F1E8]/70">
                    <p className="text-sm font-semibold text-[#1B2A41]">{b.badge_name}</p>
                    <p className="text-xs text-[#1B2A41]/70 mt-0.5">{b.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#1B2A41]/10">
            <h3 className="font-display font-semibold text-base text-[#1B2A41] mb-3">Peer Reviews</h3>
            {profile.reviews.length === 0 ? (
              <p className="text-sm text-[#1B2A41]/60">No peer reviews yet.</p>
            ) : (
              <div className="divide-y divide-[#1B2A41]/8">
                {profile.reviews.map((r) => (
                  <div key={r.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#1B2A41]">{r.reviewer_name}</span>
                      <span className="font-mono text-[#F47735] tabular-nums">{r.rating} / 5 ★</span>
                    </div>
                    <p className="mt-1 text-xs text-[#1B2A41]/80 leading-relaxed">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <ExchangeRequestModal
        open={connectOpen}
        peer={profile}
        onClose={() => setConnectOpen(false)}
        onSent={loadProfile}
      />
    </div>
  );
};
