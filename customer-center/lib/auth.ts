import "server-only";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "tikrapid_customer_session";
const SESSION_DAYS = 7;

type SessionPayload = {
  userId: string;
  role: UserRole;
  exp: number;
};

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("AUTH_SECRET must be set to at least 24 characters.");
  }
  return secret;
}

function sign(value: string) {
  return crypto.createHmac("sha256", authSecret()).update(value).digest("base64url");
}

function encodeSession(payload: SessionPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(value: string): SessionPayload | null {
  const [body, signature] = value.split(".");
  if (!body || !signature || sign(body) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.userId || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(user: { id: string; role: UserRole }) {
  const cookieStore = await cookies();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  cookieStore.set(
    SESSION_COOKIE,
    encodeSession({ userId: user.id, role: user.role, exp: expires.getTime() }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires,
    },
  );
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  const session = decodeSession(raw);
  if (!session) return null;

  const user = await prisma.user.findFirst({
    where: { id: session.userId, isActive: true },
    include: { customer: true },
  });

  if (!user) return null;
  return user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) redirect("/dashboard");
  return user;
}

export async function requireCustomer() {
  const user = await requireUser();
  if (user.role !== UserRole.CUSTOMER || !user.customer) redirect("/admin");
  return user as typeof user & { customer: NonNullable<typeof user.customer> };
}
