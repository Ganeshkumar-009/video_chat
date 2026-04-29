'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login or dashboard based on auth
    router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a0a0b]"></div>
  );
}

