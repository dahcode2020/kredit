import { apiFetch } from "./api.client";
export type SimulateDto = { amount: number; termMonths: number; productType?: string; country?: string };
export function simulate(dto: SimulateDto) {
  return apiFetch("/credit/simulations", { method:"POST", body: JSON.stringify(dto) });
}
