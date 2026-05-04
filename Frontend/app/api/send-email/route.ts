import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(request: Request) {
    try {
        const { to, subject, text, secret } = await request.json();

        // Security check: Only allow requests with the correct secret
        if (secret !== process.env.EMAIL_API_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: parseInt(process.env.EMAIL_PORT || '587'),
            secure: process.env.EMAIL_PORT === '465',
            auth: {
                user: process.env.EMAIL_HOST_USER,
                pass: process.env.EMAIL_HOST_PASSWORD,
            },
        });

        await transporter.sendMail({
            from: process.env.DEFAULT_FROM_EMAIL || process.env.EMAIL_HOST_USER,
            to,
            subject,
            text,
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Email API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
