const PLAN_DEFINITIONS = Object.freeze({
  monthly: { id: 'monthly', name: 'Mensal', days: 30, priceEnv: 'PLAN_MONTHLY_PRICE', defaultPrice: 19.9 },
  semiannual: { id: 'semiannual', name: 'Semestral', days: 180, priceEnv: 'PLAN_SEMIANNUAL_PRICE', defaultPrice: 99.9 },
  yearly: { id: 'yearly', name: 'Anual', days: 365, priceEnv: 'PLAN_YEARLY_PRICE', defaultPrice: 179.9 }
});

export function getPlans() {
  return Object.fromEntries(
    Object.entries(PLAN_DEFINITIONS).map(([id, plan]) => {
      const price = Number(process.env[plan.priceEnv] || plan.defaultPrice);
      if (!Number.isFinite(price) || price <= 0) throw new Error(`${plan.priceEnv} deve ser um valor positivo.`);
      return [id, { id, name: plan.name, days: plan.days, price }];
    })
  );
}

export function listPlans() {
  return Object.values(getPlans());
}

export function getPlan(planId) {
  return getPlans()[planId] || null;
}

export function getPlanDays(planId) {
  return PLAN_DEFINITIONS[planId]?.days || null;
}

