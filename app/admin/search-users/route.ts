import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
      });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase() || '';
  
  if (!query) return NextResponse.json({ users: [] });

  // Pega todos e filtra (solução rápida)
  const usersRef = admin.firestore().collection('users');
  const snapshot = await usersRef.get();
  
  const users = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((user: any) => {
      const name = user.name?.toLowerCase() || '';
      const email = user.email?.toLowerCase() || '';
      return name.includes(query) || email.includes(query);
    })
    .slice(0, 5); // Retorna só os 5 primeiros

  return NextResponse.json({ users });
}