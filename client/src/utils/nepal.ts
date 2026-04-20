export const NEPAL_PROVINCES = [
  "Koshi Province",
  "Madhesh Province",
  "Bagmati Province",
  "Gandaki Province",
  "Lumbini Province",
  "Karnali Province",
  "Sudurpashchim Province",
] as const;

export const NEPAL_DISTRICTS: Record<string, string[]> = {
  "Koshi Province": [
    "Bhojpur",
    "Dhankuta",
    "Ilam",
    "Jhapa",
    "Khotang",
    "Morang",
    "Okhaldhunga",
    "Panchthar",
    "Sankhuwasabha",
    "Solukhumbu",
    "Sunsari",
    "Taplejung",
    "Terhathum",
    "Udayapur",
  ],
  "Madhesh Province": ["Bara", "Dhanusha", "Mahottari", "Parsa", "Rautahat", "Saptari", "Sarlahi", "Siraha"],
  "Bagmati Province": [
    "Bhaktapur",
    "Chitwan",
    "Dhading",
    "Dolakha",
    "Kavrepalanchok",
    "Kathmandu",
    "Lalitpur",
    "Makwanpur",
    "Nuwakot",
    "Ramechhap",
    "Rasuwa",
    "Sindhuli",
    "Sindhupalchok",
  ],
  "Gandaki Province": [
    "Baglung",
    "Gorkha",
    "Kaski",
    "Lamjung",
    "Manang",
    "Mustang",
    "Myagdi",
    "Nawalpur",
    "Parbat",
    "Syangja",
    "Tanahun",
  ],
  "Lumbini Province": [
    "Arghakhanchi",
    "Banke",
    "Bardiya",
    "Dang",
    "Eastern Rukum",
    "Gulmi",
    "Kapilvastu",
    "Nawalparasi West",
    "Palpa",
    "Pyuthan",
    "Rolpa",
    "Rupandehi",
  ],
  "Karnali Province": [
    "Dailekh",
    "Dolpa",
    "Humla",
    "Jajarkot",
    "Jumla",
    "Kalikot",
    "Mugu",
    "Salyan",
    "Surkhet",
    "Western Rukum",
  ],
  "Sudurpashchim Province": [
    "Achham",
    "Baitadi",
    "Bajhang",
    "Bajura",
    "Dadeldhura",
    "Darchula",
    "Doti",
    "Kailali",
    "Kanchanpur",
  ],
};

export const NEPAL_CITIES = [
  "Kathmandu",
  "Lalitpur (Patan)",
  "Bhaktapur",
  "Pokhara",
  "Biratnagar",
  "Birgunj",
  "Butwal",
  "Dharan",
  "Bharatpur (Chitwan)",
  "Itahari",
  "Hetauda",
  "Janakpur",
  "Nepalgunj",
  "Dhangadhi",
  "Tulsipur",
  "Ghorahi",
  "Siddharthanagar (Bhairahawa)",
  "Damak",
  "Inaruwa",
  "Rajbiraj",
  "Lahan",
  "Jaleswar",
  "Kalaiya",
  "Tansen",
  "Baglung",
  "Waling",
  "Besisahar",
  "Gorkha Bazaar",
] as const;

export function getDistrictsByProvince(province: string): string[] {
  return NEPAL_DISTRICTS[province] ?? [];
}

const MOBILE_RE = /^9[678]\d{8}$/;

/** Nepal mobile 10 digits (Ncell / NTC) or landline-style starting with 0. */
export function isValidNepalPhone(digits: string): boolean {
  if (digits.length === 10 && MOBILE_RE.test(digits)) return true;
  if (digits.length >= 9 && digits.length <= 10 && digits.startsWith("0")) return true;
  return false;
}

export function normalizeNepalPhoneInput(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Display: 98X-XXXXXXX for 10-digit mobile */
export function formatPhone(digits: string): string {
  const d = normalizeNepalPhoneInput(digits);
  if (d.length === 10 && d.startsWith("9")) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return digits.trim();
}
