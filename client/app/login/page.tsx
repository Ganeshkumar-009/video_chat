"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', email) // 'email' state is reused for username
        .eq('password', password)
        .single();

      if (error || !user) {
        throw new Error('Invalid username or password');
      }
      
      toast.success('Welcome back!');
      localStorage.setItem('currentUser', JSON.stringify(user));
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([{ 
          username: email, // Reusing email state for username
          password: password,
          status: 'offline'
        }])
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Account created! Please sign in.');
      setIsSignup(false);
    } catch (error: any) {
      toast.error(error.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleForm = () => {
    setIsSignup(!isSignup);
    setEmail('');
    setPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] p-4 sm:p-8">
      {/* Ambient background blur elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[128px] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/[0.08] p-8 sm:p-10 transition-all duration-500 hover:shadow-purple-500/10 hover:border-white/[0.12]">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-violet-400 mb-3 tracking-tight">
              {isSignup ? 'Join Us' : 'Welcome Back'}
            </h1>
            <p className="text-gray-400 text-sm font-medium">
              {isSignup 
                ? 'Create an account to get started'
                : 'Sign in to access your dashboard'}
            </p>
          </div>

          <form 
            onSubmit={isSignup ? handleSignUp : handleSignIn} 
            className="space-y-6"
          >
              <div className="space-y-4 fade-in">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2 ml-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-5 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white placeholder-gray-500 transition-all duration-300 outline-none"
                    placeholder="enter your username"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2 ml-1">
                    <label className="block text-gray-300 text-sm font-medium">
                      Password
                    </label>
                    {!isSignup && (
                      <a href="#" className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                        Forgot password?
                      </a>
                    )}
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-5 py-3.5 bg-white/[0.03] border border-white/[0.08] rounded-xl focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 text-white placeholder-gray-500 transition-all duration-300 outline-none"
                    placeholder="••••••••"
                  />
                </div>
              </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-6 mt-4 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-500 hover:to-violet-500 text-white font-semibold rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transform hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 8 0 0 1 12 20v-4c-4.042 0-7.964-.979-4 0z" className="opacity-75" />
                  </svg>
                  <span>Processing...</span>
                </>
              ) : isSignup ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-400 text-sm">
              {isSignup ? "Already have an account?" : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={toggleForm}
                className="font-medium text-purple-400 hover:text-purple-300 transition-colors focus:outline-none"
              >
                {isSignup ? 'Sign in instead' : 'Create one now'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
