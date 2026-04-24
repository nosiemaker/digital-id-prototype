"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AUTH_EXPIRED_EVENT } from '@/lib/axios'

export function useAuthGuard() {
    const router = useRouter();

    useEffect(() => {
        function handleSessionExpired() {
            router.push("/login");
        }

        window.addEventListener(AUTH_EXPIRED_EVENT, handleSessionExpired);
        
        return () => {
            window.removeEventListener(AUTH_EXPIRED_EVENT, handleSessionExpired);
        }
    }, [router]);
}