export type PatientRow = {
  id: number;
  patientCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dob: string;
  age: number | null;
  gender: string;
  phone1: string;
  phone2: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  district: string | null;
  postalCode: string | null;
  occupation: string | null;
  referredBy: string | null;
  bloodGroup: string | null;
  knownAllergies: string | null;
  medicalHistory: string | null;
  photoUrl: string | null;
  profileComplete: boolean;
  createdAt: string;
  updatedAt: string;
  createdById: string | null;
  isDeleted: boolean;
  registeredByName?: string | null;
};

export type PatientDetail = PatientRow & {
  registeredByName: string | null;
  registeredByEmail: string | null;
  prescriptionCount: number;
  orderCount: number;
  lastVisit: string | null;
};

export type PatientListResponse = {
  data: PatientRow[];
  total: number;
  page: number;
  pages: number;
  limit: number;
};
