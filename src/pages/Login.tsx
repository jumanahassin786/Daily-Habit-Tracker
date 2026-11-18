import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Eye, EyeOff, Leaf } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to login. Please try again.'
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
                Your progress, your pace
              </p>

              <h1 className="mt-5 font-display text-5xl font-bold leading-[1.08] md:text-6xl">
                Small steps.
                <br />
                <span className="text-limepop">Big changes.</span>
              </h1>

              <p className="mt-6 max-w-sm text-sm leading-7 text-cream/65">
                Build better routines, stay consistent, and make every day
                count. Your next chapter starts with one small habit.
              </p>
            </div>
          </div>

          <div className="mt-16 space-y-4">
            {[
              'Track your daily habits',
              'Celebrate your consistency',
              'See your progress grow',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-cream/80">
                <CheckCircle2 size={17} className="text-limepop" />
                {item}
              </div>
            ))}

            <p className="pt-8 font-mono text-[10px] uppercase tracking-widest text-cream/35">
              Make today count.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center p-8 md:p-12">
          <div className="w-full max-w-sm">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-clay">
              Welcome back
            </p>

            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">
              Sign in.
            </h2>

            <p className="mt-3 text-sm leading-6 text-clay">
              Pick up where you left off. Your habits are waiting.
            </p>

            <form onSubmit={handleSubmit} className="mt-9 space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold">
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
                <label htmlFor="password" className="mb-2 block text-sm font-semibold">
                  Password
                </label>

                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
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

              {error && (
                <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 py-4 text-sm font-semibold text-cream transition hover:bg-inksoft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Signing in...' : 'Sign in'}
                {!submitting && <ArrowRight size={17} />}
              </button>
            </form>

            <p className="mt-8 text-center text-sm text-clay">
              Don't have an account?{' '}
              <Link to="/register" className="font-bold text-ink underline decoration-limepop decoration-2 underline-offset-4">
                Create account
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}