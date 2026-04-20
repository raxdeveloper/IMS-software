import { apiFetch } from "./client";

export type OrderListRow = {
  id: number;
  orderNumber: string;
  patientName: string;
  patientPhone: string;
  createdAt: string;
  itemsSummary: string;
  totalPaise: number;
  advancePaise: number;
  balancePaise: number;
  status: string;
  deliveryDate: string | null;
};

export type OrderItemRow = {
  id: number;
  itemType: string;
  itemId: number | null;
  description: string;
  qty: number;
  unitPricePaise: number;
  amountPaise: number;
};

export type OrderPaymentRow = {
  id: number;
  amountPaise: number;
  paymentMode: string;
  reference: string | null;
  createdAt: string;
  collectedByName: string | null;
};

export type OrderStatusLogRow = {
  id: number;
  fromStatus: string | null;
  toStatus: string;
  note: string | null;
  createdAt: string;
  changedByName: string | null;
};

export type OrderDetail = {
  id: number;
  orderNumber: string;
  patientId: number;
  prescriptionId: number | null;
  noRxOnFile: boolean;
  doctorName: string | null;
  status: string;
  subtotalPaise: number;
  discountMode: string;
  discountFlatPaise: number;
  discountPercent: number;
  taxablePaise: number;
  gstPercent: number;
  gstAmountPaise: number;
  totalPaise: number;
  deliveryDate: string | null;
  orderNotes: string | null;
  labInstructions: string | null;
  stockDeducted: boolean;
  stockWarning: string[] | null;
  createdAt: string;
  patient: {
    id: number;
    patientCode: string;
    fullName: string;
    phone1: string;
    address: string | null;
    city: string | null;
    province: string | null;
    district: string | null;
    postalCode: string | null;
  };
  prescription: {
    id: number;
    rxNumber: string;
    dvReSph: number;
    dvReCyl: number;
    dvReAxis: number | null;
    dvLeSph: number;
    dvLeCyl: number;
    dvLeAxis: number | null;
  } | null;
  items: OrderItemRow[];
  payments: OrderPaymentRow[];
  statusLogs: OrderStatusLogRow[];
  createdByName: string | null;
  balancePaise: number;
  paidPaise: number;
};

export type OrderListResponse = {
  data: OrderListRow[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};

export function listOrders(params: Record<string, string | number | undefined>): Promise<OrderListResponse> {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  });
  const q = sp.toString();
  return apiFetch(`/api/orders${q ? `?${q}` : ""}`);
}

export function getOrder(id: number): Promise<OrderDetail> {
  return apiFetch(`/api/orders/${id}`);
}

export function getOrderDoctors(): Promise<{ doctors: string[] }> {
  return apiFetch("/api/orders/doctors");
}

export function createOrder(body: Record<string, unknown>): Promise<OrderDetail> {
  return apiFetch("/api/orders", { method: "POST", body: JSON.stringify(body) });
}

export function patchOrder(
  id: number,
  body: { deliveryDate?: string | null; orderNotes?: string | null; labInstructions?: string | null },
): Promise<{ id: number; updated: boolean }> {
  return apiFetch(`/api/orders/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function updateOrderStatus(id: number, body: { toStatus: string; note?: string | null }): Promise<OrderDetail> {
  return apiFetch(`/api/orders/${id}/status`, { method: "POST", body: JSON.stringify(body) });
}

export function collectOrderPayment(
  id: number,
  body: { amountPaise: number; paymentMode: string; reference?: string | null },
): Promise<{ payments: OrderPaymentRow[]; paidPaise: number; balancePaise: number }> {
  return apiFetch(`/api/orders/${id}/payments`, { method: "POST", body: JSON.stringify(body) });
}
