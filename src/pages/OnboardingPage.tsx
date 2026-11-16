import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Plus, Trash2, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../services/api';
import { Avatar } from '../components/ui/Avatar';
import { PreferredMethod, Proficiency, SkillCatalogItem } from '../types';

const AVAILABILITY_SLOTS = [
  'Mon Morn', 'Mon Aft', 'Mon Eve',
  'Tue Morn', 'Tue Aft', 'Tue Eve',
  'Wed Morn', 'Wed Aft', 'Wed Eve',
  'Thu Morn', 'Thu Aft', 'Thu Eve',
  'Fri Morn', 'Fri Aft', 'Fri Eve',
  'Sat Morn', 'Sat Aft', 'Sun Aft',
];

interface DraftSkill {
  name: string;
  proficiency: Proficiency;
  description: string;
}

export const OnboardingPage: React.FC = () => {
  const { user, refreshUser, showToast } = useAuth();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState<SkillCatalogItem[]>([]);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [method, setMethod] = useState<PreferredMethod>(user?.preferred_method || 'online');
  const [availability, setAvailability] = useState<string[]>(user?.weekly_availability || ['Mon Eve', 'Wed Eve']);

  const [teachSkills, setTeachSkills] = useState<DraftSkill[]>(
    user?.teachSkills.length
      ? user.teachSkills.map((s) => ({ name: s.name, proficiency: s.proficiency, description: s.description }))
      : [{ name: '', proficiency: 'intermediate', description: '' }]
  );
  const [learnSkills, setLearnSkills] = useState<DraftSkill[]>(
    user?.learnSkills.length
      ? user.learnSkills.map((s) => ({ name: s.name, proficiency: s.proficiency, description: s.description }))
      : [{ name: '', proficiency: 'beginner', description: '' }]
  );

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ skills: SkillCatalogItem[] }>('/api/skills')
      .then((d) => setCatalog(d.skills))
      .catch(() => {});
  }, []);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
      });
      const res = await apiFetch<{ avatarUrl: string }>('/api/storage/avatars', {
        method: 'POST',
        body: JSON.stringify({ dataUrl, fileName: file.name }),
      });
      setAvatarUrl(res.avatarUrl);
      showToast('Avatar uploaded.', 'success');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const toggleSlot = (slot: string) => {
    setAvailability((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]));
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const validTeach = teachSkills.filter((s) => s.name.trim());
    const validLearn = learnSkills.filter((s) => s.name.trim());

    if (!name.trim()) {
      setError('Please enter your display name.');
      return;
    }
    if (validTeach.length === 0 && validLearn.length === 0) {
      setError('Add at least one skill you can teach or want to learn.');
      return;
    }

    setSaving(true);
    try {
      await apiFetch('/api/profiles/me', {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim(),
          avatar_url: avatarUrl,
          preferred_method: method,
          weekly_availability: availability,
          teachSkills: validTeach,
          learnSkills: validLearn,
          onboarding_completed: true,
        }),
      });
      await refreshUser();
      showToast('Profile setup complete! Explore your personalized matches.', 'success');
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#F5F1E8] py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto rounded-2xl bg-white border border-[#1B2A41]/12 shadow-sm p-6 sm:p-10">
        <div className="border-b border-[#1B2A41]/10 pb-5">
          <p className="text-xs font-medium text-[#2CA69A]">Step 1 of 1 · Profile & Skill Setup</p>
          <h1 className="mt-1 font-display font-bold text-2xl sm:text-3xl text-[#1B2A41]">
            Tell peers what you bring and what you want to learn
          </h1>
          <p className="mt-1.5 text-sm text-[#1B2A41]/70">
            Email: <span className="font-mono text-xs">{user.email}</span> · Starting balance: 5 credits
          </p>
        </div>

        <form onSubmit={handleComplete} className="mt-6 space-y-7">
          {/* Identity & Avatar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <Avatar name={name || user.name} src={avatarUrl} size="xl" />
            <div className="flex-1 space-y-2">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1B2A41]/20 bg-[#F5F1E8]/70 hover:bg-[#F5F1E8] text-xs font-medium text-[#1B2A41] cursor-pointer">
                <Upload className="w-4 h-4" />
                <span>{uploading ? 'Uploading...' : 'Upload Profile Photo'}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarUpload} className="sr-only" />
              </label>
              <p className="text-xs text-[#1B2A41]/60">PNG, JPG, or WEBP up to 4 MB.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="onb-name" className="block text-xs font-medium text-[#1B2A41]/80 mb-1.5">
                Full Name
              </label>
              <input
                id="onb-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-[#1B2A41]/20 px-3.5 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="onb-method" className="block text-xs font-medium text-[#1B2A41]/80 mb-1.5">
                Preferred Exchange Method
              </label>
              <select
                id="onb-method"
                value={method}
                onChange={(e) => setMethod(e.target.value as PreferredMethod)}
                className="w-full rounded-lg border border-[#1B2A41]/20 bg-white px-3.5 py-2.5 text-sm"
              >
                <option value="online">Online (Video / Screen Share)</option>
                <option value="in-person">In-Person (Campus Library / Studio)</option>
                <option value="chat">Async Chat & Code/Work Review</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="onb-bio" className="block text-xs font-medium text-[#1B2A41]/80 mb-1.5">
              Short Bio & Learning Goals
            </label>
            <textarea
              id="onb-bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Share your major, interests, and what makes your sessions helpful..."
              className="w-full rounded-lg border border-[#1B2A41]/20 px-3.5 py-2.5 text-sm"
            />
          </div>

          {/* Skills to Teach */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1B2A41]">Skills You Can Teach</h2>
              <button
                type="button"
                onClick={() => setTeachSkills((p) => [...p, { name: '', proficiency: 'intermediate', description: '' }])}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#2CA69A] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add skill
              </button>
            </div>
            {teachSkills.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                <input
                  type="text"
                  list="skill-catalog-list"
                  placeholder="e.g. React & TypeScript"
                  value={item.name}
                  onChange={(e) => {
                    const copy = [...teachSkills];
                    copy[idx] = { ...copy[idx], name: e.target.value };
                    setTeachSkills(copy);
                  }}
                  className="sm:col-span-5 rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
                />
                <select
                  value={item.proficiency}
                  onChange={(e) => {
                    const copy = [...teachSkills];
                    copy[idx] = { ...copy[idx], proficiency: e.target.value as Proficiency };
                    setTeachSkills(copy);
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
                  placeholder="Focus area (optional)"
                  value={item.description}
                  onChange={(e) => {
                    const copy = [...teachSkills];
                    copy[idx] = { ...copy[idx], description: e.target.value };
                    setTeachSkills(copy);
                  }}
                  className="sm:col-span-3 rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setTeachSkills((p) => p.filter((_, i) => i !== idx))}
                  aria-label="Remove skill"
                  className="sm:col-span-1 p-2 text-[#1B2A41]/50 hover:text-red-600 justify-self-end"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Skills to Learn */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#1B2A41]">Skills You Want to Learn</h2>
              <button
                type="button"
                onClick={() => setLearnSkills((p) => [...p, { name: '', proficiency: 'beginner', description: '' }])}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#F47735] hover:underline"
              >
                <Plus className="w-3.5 h-3.5" /> Add skill
              </button>
            </div>
            {learnSkills.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                <input
                  type="text"
                  list="skill-catalog-list"
                  placeholder="e.g. Acoustic Guitar"
                  value={item.name}
                  onChange={(e) => {
                    const copy = [...learnSkills];
                    copy[idx] = { ...copy[idx], name: e.target.value };
                    setLearnSkills(copy);
                  }}
                  className="sm:col-span-5 rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
                />
                <select
                  value={item.proficiency}
                  onChange={(e) => {
                    const copy = [...learnSkills];
                    copy[idx] = { ...copy[idx], proficiency: e.target.value as Proficiency };
                    setLearnSkills(copy);
                  }}
                  className="sm:col-span-3 rounded-lg border border-[#1B2A41]/20 bg-white px-3 py-2 text-sm"
                >
                  <option value="beginner">Current: Beginner</option>
                  <option value="intermediate">Current: Intermediate</option>
                  <option value="advanced">Current: Advanced</option>
                </select>
                <input
                  type="text"
                  placeholder="Goal (optional)"
                  value={item.description}
                  onChange={(e) => {
                    const copy = [...learnSkills];
                    copy[idx] = { ...copy[idx], description: e.target.value };
                    setLearnSkills(copy);
                  }}
                  className="sm:col-span-3 rounded-lg border border-[#1B2A41]/20 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setLearnSkills((p) => p.filter((_, i) => i !== idx))}
                  aria-label="Remove skill"
                  className="sm:col-span-1 p-2 text-[#1B2A41]/50 hover:text-red-600 justify-self-end"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <datalist id="skill-catalog-list">
            {catalog.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>

          {/* Weekly Availability */}
          <div>
            <h2 className="text-sm font-semibold text-[#1B2A41] mb-2">Weekly Availability</h2>
            <div className="flex flex-wrap gap-2">
              {AVAILABILITY_SLOTS.map((slot) => {
                const active = availability.includes(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => toggleSlot(slot)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      active
                        ? 'bg-[#1B2A41] text-white border-[#1B2A41]'
                        : 'bg-white text-[#1B2A41]/75 border-[#1B2A41]/15 hover:bg-[#F5F1E8]'
                    }`}
                  >
                    {active && <Check className="w-3 h-3 inline mr-1" />}
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 font-medium">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1B2A41]/10">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white text-sm font-medium transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving Profile...' : 'Save & Continue to Dashboard'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
