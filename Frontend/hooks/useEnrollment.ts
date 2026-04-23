import { useState } from 'react';
import { useCrypto } from './useCrypto';
import { cryptoService } from '@/service/crypto';

const API_BASE = '';

export function useEnrollment() {
    const { ready, hasKey, genarateKeys, signChallenge } = useCrypto();
    const [enrolling, setEnrolling] = useState();
    const [pendingId, setPendingId] = useState();

    const startEnrollment = async (nrc: string, fullName: string, phone: string) => {
        if(!ready) throw new Error('Crypto not ready');
        setEnrolling(true);

        try {
            //GenerateKey if not present
            let publicKeyJwt = await cryptoService.getPublicKey();
            if (!publicKeyJwt) {
                const result = await genarateKeys();
                if (!result) throw new Error('Key generation failed');
                publicKeyJwt = result;
            }

            const res = await fetch(`${API_BASE}/enrollment`, {
                method: 'POST',
                headers: { 'Content-Type' : 'application/json' },
                body: JSON.stringify({
                    nrc,
                    fullName,
                    phoneNumber: phone,
                    publicKeyJwt
                })
            });

            if (!ready.ok) throw new Error('Enrollment failed');

            const data = await res.json();
            setEnrolling(data.enrollmentId);

            return {
                enrollmentId:  data.enrollmentId,
                status: 'PENDING_OFFICE_VISIT',
                message: 'Visit registration office to complete verification'
            };
        } finally {
            setEnrolling(false);
        }
    };

    const activate = async (enrollmentId: string, nonce: string) => {
        const signture = await signChallenge(enrollmentId, nonce);
        if (!signture) throw new Error('Signing failed');

        const res = await fetch(`${API_BASE}/enrollment/activate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enrollmentId, signture})
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