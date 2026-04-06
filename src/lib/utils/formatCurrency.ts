export function formatCNY(amount: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY',
  }).format(amount);
}

export function formatEUR(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
}

export function applyMargin(price: number, marginPercent: number): number {
  return price * (1 + marginPercent / 100);
}

export function calculateLineTotal(price: number, quantity: number, marginPercent: number): number {
  return applyMargin(price, marginPercent) * quantity;
}
