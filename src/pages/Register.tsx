import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Leaf,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      await register(name, email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create account. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="dot-grid flex min-h-screen items-center justify-center px-5 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-line bg-cream shadow-xl md:grid-cols-2">
        <section className="flex flex-col justify-between bg-ink p-9 text-cream md:p-12">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-limepop text-ink">
                <Leaf size={23} />
              </div>

              <span className="font-display text-2xl font-bold tracking-tight">
                ticked<span className="text-limepop">.</span>
              </span>
            </div>

            <div className="mt-20">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-limepop">
                Start something good
              </p>

              <h1 className="mt-5 font-display text-5xl font-bold leading-[1.08] md:text-6xl">
                Build habits.
                <br />
                <span className="text-limepop">Build yourself.</span>
              </h1>

              <p className="mt-6 max-w-sm text-sm leading-7 text-cream/65">
                Great things don't happen overnight. Create your account,
                start with small actions, and build a routine that lasts.
              </p>
            </div>
          </div>

          <div className="mt-16 space-y-4">
            {[
              'Start with your daily goals',
              'Track every small achievement',
              'Turn consistency into a lifestyle',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 text-sm text-cream/80"
              >
                <CheckCircle2 size={17} className="text-limepop" />
                {item}
              </div>
            ))}

            <p className="pt-8 font-mono text-[10px] uppercase tracking-widest text-cream/35">
              One day at a time.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center p-8 md:p-12">
          <div className="w-full max-w-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-clay">
              Your journey begins
            </p>

            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">
              Create account.
            </h2>

            <p className="mt-3 text-sm leading-6 text-clay">
              Join Ticked and make every day count.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-semibold"
                >
                  Full name
                </label>

                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  minLength={2}
                  maxLength={60}
                  required
                  className="w-full rounded-xl border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-ink"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-semibold"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  className="w-full rounded-xl border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-ink"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-sm font-semibold"
                >
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    minLength={8}
                    required
                    className="w-full rounded-xl border border-line bg-white px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-ink"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-clay hover:text-ink"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-2 block text-sm font-semibold"
                >
                  Confirm password
                </label>

                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-line bg-white px-4 py-3.5 text-sm outline-none transition focus:border-ink"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-4 text-sm font-semibold text-cream transition hover:bg-inksoft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Creating account...' : 'Create account'}
                {!submitting && <ArrowRight size={17} />}
              </button>
            </form>

            <p className="mt-7 text-center text-sm text-clay">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-bold text-ink underline decoration-limepop decoration-2 underline-offset-4"
              >
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}