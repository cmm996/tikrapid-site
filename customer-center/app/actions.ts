"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ServiceStatus, TicketStatus, UserRole } from "@prisma/client";
import { createSession, clearSession, hashPassword, requireAdmin, requireCustomer, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveUploadedImage } from "@/lib/uploads";

function value(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function dateValue(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (!raw) throw new Error(`${key} is required`);
  return new Date(`${raw}T00:00:00`);
}

function numberValue(formData: FormData, key: string, fallback = 1) {
  const raw = Number(value(formData, key) || fallback);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

export async function loginAction(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=1");
  }

  await createSession(user);
  redirect(user.role === UserRole.ADMIN ? "/admin" : "/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function createCustomerAction(formData: FormData) {
  await requireAdmin();
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  const name = value(formData, "name");

  if (!email || !password || !name) {
    throw new Error("客户邮箱、姓名和初始密码必填");
  }

  const passwordHash = await hashPassword(password);
  const customer = await prisma.customer.create({
    data: {
      company: value(formData, "company"),
      phone: value(formData, "phone"),
      wechat: value(formData, "wechat"),
      telegram: value(formData, "telegram"),
      note: value(formData, "note"),
      user: {
        create: {
          email,
          name,
          passwordHash,
          role: UserRole.CUSTOMER,
        },
      },
    },
  });

  redirect(`/admin/customers/${customer.id}`);
}

export async function updateCustomerAction(formData: FormData) {
  await requireAdmin();
  const customerId = value(formData, "customerId");
  const password = value(formData, "password");
  const isActive = value(formData, "isActive") === "on";

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error("客户不存在");

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      company: value(formData, "company"),
      phone: value(formData, "phone"),
      wechat: value(formData, "wechat"),
      telegram: value(formData, "telegram"),
      note: value(formData, "note"),
      user: {
        update: {
          email: value(formData, "email").toLowerCase(),
          name: value(formData, "name"),
          isActive,
          ...(password ? { passwordHash: await hashPassword(password) } : {}),
        },
      },
    },
  });

  revalidatePath(`/admin/customers/${customerId}`);
}

export async function createServiceAction(formData: FormData) {
  await requireAdmin();
  const customerId = value(formData, "customerId");
  const qrFile = formData.get("qrCodeFile");
  const uploadedQrUrl = qrFile instanceof File ? await saveUploadedImage(qrFile, "qrcodes") : "";

  await prisma.serviceOrder.create({
    data: {
      customerId,
      title: value(formData, "title"),
      packageType: value(formData, "packageType"),
      targetRegion: value(formData, "targetRegion"),
      deviceCount: numberValue(formData, "deviceCount"),
      startAt: dateValue(formData, "startAt"),
      expiresAt: dateValue(formData, "expiresAt"),
      subscriptionUrl: value(formData, "subscriptionUrl"),
      qrCodeUrl: uploadedQrUrl || value(formData, "qrCodeUrl"),
      instructions: value(formData, "instructions"),
      status: ServiceStatus.ACTIVE,
    },
  });

  revalidatePath(`/admin/customers/${customerId}`);
}

export async function updateServiceAction(formData: FormData) {
  await requireAdmin();
  const serviceId = value(formData, "serviceId");
  const customerId = value(formData, "customerId");
  const status = value(formData, "status") as ServiceStatus;

  await prisma.serviceOrder.update({
    where: { id: serviceId },
    data: {
      title: value(formData, "title"),
      packageType: value(formData, "packageType"),
      targetRegion: value(formData, "targetRegion"),
      deviceCount: numberValue(formData, "deviceCount"),
      startAt: dateValue(formData, "startAt"),
      expiresAt: dateValue(formData, "expiresAt"),
      subscriptionUrl: value(formData, "subscriptionUrl"),
      qrCodeUrl: value(formData, "qrCodeUrl"),
      instructions: value(formData, "instructions"),
      status: Object.values(ServiceStatus).includes(status) ? status : ServiceStatus.ACTIVE,
    },
  });

  revalidatePath(`/admin/customers/${customerId}`);
}

export async function updateTicketStatusAction(formData: FormData) {
  await requireAdmin();
  const ticketId = value(formData, "ticketId");
  const status = value(formData, "status") as TicketStatus;

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: Object.values(TicketStatus).includes(status) ? status : TicketStatus.OPEN,
      adminNote: value(formData, "adminNote"),
    },
  });

  revalidatePath("/admin/tickets");
}

export async function createTicketAction(formData: FormData) {
  const user = await requireCustomer();
  const imageFile = formData.get("image");
  const imageUrl = imageFile instanceof File ? await saveUploadedImage(imageFile, "tickets") : "";

  await prisma.ticket.create({
    data: {
      customerId: user.customer.id,
      serviceOrderId: value(formData, "serviceOrderId") || null,
      issueType: value(formData, "issueType"),
      useCase: value(formData, "useCase"),
      targetRegion: value(formData, "targetRegion"),
      deviceCount: numberValue(formData, "deviceCount"),
      description: value(formData, "description"),
      imageUrl,
      occurredAt: new Date(value(formData, "occurredAt") || Date.now()),
    },
  });

  revalidatePath("/dashboard");
}

export async function acceptComplianceAction(formData: FormData) {
  const user = await requireCustomer();
  if (value(formData, "accepted") !== "on") {
    throw new Error("必须勾选服务合规使用告知");
  }

  const headerStore = await headers();
  await prisma.complianceConfirmation.create({
    data: {
      customerId: user.customer.id,
      userId: user.id,
      version: "2026-06-10",
      ipAddress: headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
      userAgent: headerStore.get("user-agent") || "",
    },
  });

  redirect("/dashboard");
}
