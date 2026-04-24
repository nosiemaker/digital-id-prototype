import { useState } from 'react';
import { useCrypto } from './useCrypto';
import { cryptoService } from '@/service/crypto';
import { enrollmentApi, CitizenBase } from '@/lib/axios';
import { AwardIcon } from 'lucide-react';

export function useEnrollment() {
    const { ready, hasKey, genarateKeys, signChallenge } = useCrypto();
    const [enrolling, setEnrolling] = useState(false);
    const [pendingId, setPendingId] = useState<number | null>(null);

    const startEnrollment = async (data: Omit<CitizenBase, 'public_key'>) => {
        if(!ready) throw new Error('Crypto not ready');
        setEnrolling(true);

        try {
            // Generate key if not present
            let publicKeyJwt: string | JsonWebKey | null = await cryptoService.getPublicKey();
            if (!publicKeyJwt) {
                const result = await genarateKeys();
                if (!result) throw new Error('Key generation failed');
                publicKeyJwt = result;
            }

            const publicKeyString = typeof publicKeyJwt === 'string'
                ? publicKeyJwt
                : JSON.stringify(publicKeyJwt);

            const response = await enrollmentApi.submit({
                ...data,
                public_key: publicKeyString
            });

            setPendingId(response.id);

            return {
                enrollmentId:  response.id,
                status: response.status,
                message: 'Visit registration office to complete verification'
            };
        } finally {
            setEnrolling(false);
        }
    };

    const activate = async (enrollmentId: string, nonce: string) => {
        const signature = await signChallenge(enrollmentId, nonce);
        if (!signature) throw new Error('Signing failed');
        // todo: write endpoint for activition challenge
        const res = await fetch(`${process.env.NODE_ENV}/enrollment/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enrollmentId, signature})
        });

        if (!res.ok) throw new Error('Activation failed');
        
        const digitalID = await res.json();

        localStorage.setItem('zdid_digital_id', JSON.stringify(digitalID));

        return digitalID;
    };

    return {
        ready,
        hasKey,
        enrolling,
        pendingId,
        startEnrollment,
        activate
    };
}