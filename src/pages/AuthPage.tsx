import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const HERO_IMG = '/src/assets/images/hero_skill_campus_1794833153943.jpg';

export const AuthPage: React.FC = () => {
  const { login, register, showToast } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const passwordHasLength = password.length >= 8;
  const passwordHasLetter = /[A-Za-z]/.test(password);
  const passwordHasNumber = /[0-9]/.test(password);
  const passwordValid = passwordHasLength && passwordHasLetter && passwordHasNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'register') {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }
      if (!passwordValid) {
        setError('Password must be at least 8 characters and include both a letter and a number.');
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const user = await login(email, password);
        showToast(`Welcome back, ${user.name}.`, 'success');
        navigate(user.onboarding_completed ? '/dashboard' : '/onboarding');
      } else {
        const user = await register(name, email, password);
        showToast('Account created with 5 starter credits!', 'success');
        navigate('/onboarding');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setMode('login');
    setEmail(demoEmail);
    setPassword('SkillSwap123!');
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#F5F1E8] flex items-center justify-center p-4 sm:p-6 lg:p-10">
      <div className="w-full max-w-6xl rounded-2xl bg-white border border-[#1B2A41]/12 shadow-lg overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        {/* Left Editorial Hero Column */}
        <div className="lg:col-span-6 relative bg-[#1B2A41] text-white flex flex-col justify-between min-h-[280px] lg:min-h-[640px]">
          <img
            src={HERO_IMG}
            alt="Students collaborating on laptops and sketchbooks at a sunlit campus table"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-45"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1B2A41] via-[#1B2A41]/70 to-[#1B2A41]/40" />

          <div className="relative z-10 p-6 sm:p-10">
            <div className="inline-flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#F47735] flex items-center justify-center font-display font-bold text-white">
                S
              </div>
              <span className="font-display font-bold text-xl tracking-tight text-white">SkillSwap</span>
            </div>
          </div>

          <div className="relative z-10 p-6 sm:p-10 space-y-5">
            <h1 className="font-display font-bold text-3xl sm:text-4xl leading-tight text-white">
              Learn by Sharing. Grow Together.
            </h1>
            <p className="text-sm sm:text-base text-[#F5F1E8]/85 max-w-md leading-relaxed">
              Trade skills directly with classmates or earn learning credits by mentoring peers. Build verified Skill Passports, join group circles, and follow AI-guided learning roadmaps.
            </p>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/15 text-xs text-[#F5F1E8]/85">
              <div>
                <p className="font-display font-bold text-lg text-white tabular-nums">1:1 Swaps</p>
                <p>Direct two-way trades</p>
              </div>
              <div>
                <p className="font-display font-bold text-lg text-[#2CA69A] tabular-nums">Credits</p>
                <p>Settled on completion</p>
              </div>
              <div>
                <p className="font-display font-bold text-lg text-[#F47735] tabular-nums">Passport</p>
                <p>Verified peer badges</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Auth Form Column */}
        <div className="lg:col-span-6 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <div className="flex items-center gap-1 p-1 bg-[#F5F1E8] rounded-lg mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'login' ? 'bg-white text-[#1B2A41] shadow-sm' : 'text-[#1B2A41]/70 hover:text-[#1B2A41]'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError('');
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'register' ? 'bg-white text-[#1B2A41] shadow-sm' : 'text-[#1B2A41]/70 hover:text-[#1B2A41]'
                }`}
              >
                Create Account
              </button>
            </div>

            <h2 className="font-display font-bold text-2xl text-[#1B2A41]">
              {mode === 'login' ? 'Sign in to your workspace' : 'Join your campus skill network'}
            </h2>
            <p className="mt-1 text-sm text-[#1B2A41]/70">
              {mode === 'login'
                ? 'Continue your active exchanges, sessions, and learning roadmaps.'
                : 'Start with 5 free learning credits and unlock peer matches.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-name" className="block text-xs font-medium text-[#1B2A41]/80 mb-1.5">
                    Full Name
                  </label>
                  <input
                    id="auth-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jordan Rivera"
                    className="w-full rounded-lg border border-[#1B2A41]/20 px-3.5 py-2.5 text-sm text-[#1B2A41] focus:outline-none focus:ring-2 focus:ring-[#2CA69A]"
                  />
                </div>
              )}

              <div>
                <label htmlFor="auth-email" className="block text-xs font-medium text-[#1B2A41]/80 mb-1.5">
                  Campus Email
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@skillswap.edu"
                  className="w-full rounded-lg border border-[#1B2A41]/20 px-3.5 py-2.5 text-sm text-[#1B2A41] focus:outline-none focus:ring-2 focus:ring-[#2CA69A]"
                />
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-xs font-medium text-[#1B2A41]/80 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 chars, letters + numbers"
                    className="w-full rounded-lg border border-[#1B2A41]/20 px-3.5 py-2.5 pr-10 text-sm text-[#1B2A41] focus:outline-none focus:ring-2 focus:ring-[#2CA69A]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#1B2A41]/50 hover:text-[#1B2A41]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {mode === 'register' && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span className={passwordHasLength ? 'text-[#2CA69A] font-medium' : 'text-[#1B2A41]/55'}>
                      {passwordHasLength ? '✓' : '·'} 8+ characters
                    </span>
                    <span className={passwordHasLetter ? 'text-[#2CA69A] font-medium' : 'text-[#1B2A41]/55'}>
                      {passwordHasLetter ? '✓' : '·'} Letter
                    </span>
                    <span className={passwordHasNumber ? 'text-[#2CA69A] font-medium' : 'text-[#1B2A41]/55'}>
                      {passwordHasNumber ? '✓' : '·'} Number
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <div role="alert" className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 font-medium">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#F47735] hover:bg-[#E06322] text-white font-medium text-sm py-2.5 px-4 transition-colors disabled:opacity-60"
              >
                <span>{submitting ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            {/* Quick Demo Credentials for evaluators */}
            <div className="mt-7 pt-6 border-t border-[#1B2A41]/10">
              <p className="text-xs font-medium text-[#1B2A41]/70 mb-2.5">
                Quick demo accounts (password: <span className="font-mono">SkillSwap123!</span>)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { label: 'Maya Lin', email: 'maya@skillswap.edu' },
                  { label: 'Marcus Vance', email: 'marcus@skillswap.edu' },
                  { label: 'Priya Nair', email: 'priya@skillswap.edu' },
                ].map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => fillDemo(demo.email)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#1B2A41]/15 bg-[#F5F1E8]/60 hover:bg-[#F5F1E8] text-xs font-medium text-[#1B2A41] transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2CA69A] shrink-0" />
                    <span className="truncate">{demo.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
