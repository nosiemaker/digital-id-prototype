"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SESSION_EXPIRED_EVENT } from '@/lib/axios'

export function useAuthGuard() {
    const router = useRouter();

    useEffect(() => {
        function handleSessionExpired() {
            router.push("/login");
        }

        window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
        
        return () => {
            window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired);
        }
    }, [router]);
}