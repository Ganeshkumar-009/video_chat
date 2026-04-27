'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

export default function Login() {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState(''); // Reused for Username
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Fast Session Check: If user is already logged in, skip the login page
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      router.push('/dashboard');
    } else {
      setCheckingSession(false);
    }
  }, [router]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', email)
        .eq('password', password)
        .single();

      if (error || !user) {
        throw new Error('Invalid username or password');
      }
      
      // Mark as online
      await supabase.from('users').update({ status: 'online' }).eq('id', user.id);
      user.status = 'online';

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
          username: email,
          password: password,
          status: 'online'
        }])
        .select()
        .single();

      if (error) throw error;
      
      toast.success('Account created! Logging you in...');
      localStorage.setItem('currentUser', JSON.stringify(data));
      router.push('/dashboard');
    } catch (error: any) {
      toast.error(error.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] p-6">
      {/* Simplified background for zero lag */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,rgba(120,119,198,0.1),transparent)] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-500">
        <div className="bg-white/[0.03] backdrop-blur-md rounded-[32px] border border-white/[0.05] p-10 shadow-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">
              {isSignup ? "Create Account" : "Welcome Back"}
            </h1>
            <p className="text-gray-500 text-sm">
              {isSignup ? 'Join your friends today' : 'Sign in to your private chat'}
            </p>
          </div>

          <form onSubmit={isSignup ? handleSignUp : handleSignIn} className="space-y-6">
            <div className="space-y-5">
              <input
                type="text"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl focus:ring-2 focus:ring-purple-500/50 text-white placeholder-gray-600 transition-all outline-none"
                placeholder="Username"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-6 py-4 bg-white/[0.03] border border-white/[0.08] rounded-2xl focus:ring-2 focus:ring-purple-500/50 text-white placeholder-gray-600 transition-all outline-none"
                placeholder="Password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl shadow-lg shadow-purple-600/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? "Please wait..." : (isSignup ? "Sign Up" : "Log In")}
            </button>
          </form>

          <div className="mt-10 text-center">
            <button
              onClick={() => setIsSignup(!isSignup)}
              className="text-sm font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              {isSignup ? "Already have an account? Log In" : "New here? Create an account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
