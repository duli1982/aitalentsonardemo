import React, { useState } from 'react';
import { Brain, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    const result = isSignUp ? await signUp(email, password) : await signIn(email, password);
    setIsSubmitting(false);
    if (result.error) setMessage(result.error);
    else if ('needsEmailConfirmation' in result && result.needsEmailConfirmation) {
      setMessage('Check your email to confirm your account, then sign in.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 p-3"><Brain /></div>
          <div><h1 className="text-xl font-bold">Talent Sonar</h1><p className="text-sm text-slate-400">Sign in to your workspace</p></div>
        </div>
        <label className="mb-4 block text-sm font-medium">Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2" /></label>
        <label className="mb-5 block text-sm font-medium">Password<input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2" /></label>
        {message && <p className="mb-4 rounded-lg bg-slate-800 p-3 text-sm text-slate-200">{message}</p>}
        <button disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 font-semibold hover:bg-sky-500 disabled:opacity-60">
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}{isSignUp ? 'Create workspace' : 'Sign in'}
        </button>
        <button type="button" onClick={() => { setIsSignUp((value) => !value); setMessage(null); }} className="mt-4 w-full text-sm text-sky-300 hover:text-sky-200">
          {isSignUp ? 'Already have an account? Sign in' : 'New here? Create a workspace'}
        </button>
      </form>
    </main>
  );
};

export default LoginPage;
