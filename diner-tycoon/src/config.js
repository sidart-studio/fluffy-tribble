// Balance sheet for Short Order Tycoon. Everything tunable lives here.

export const DAY_LENGTH = 120;          // game seconds per business day
export const START_CASH = 120;
export const START_REPUTATION = 50;     // 0..100 -> 0..5 stars
export const QUEUE_PATIENCE = 32;       // seconds a customer waits in line
export const FOOD_PATIENCE = 60;        // seconds a customer waits for food after ordering
export const EAT_TIME = 9;
export const SAVE_KEY = 'short-order-tycoon:save:v1';

export const MENU = [
  { id: 'soda', name: 'Fizzy Soda', price: 3.5, cook: 1.5, tier: 0, color: 0x8d3b2f, shape: 'cup' },
  { id: 'fries', name: 'Crispy Fries', price: 5, cook: 4, tier: 0, color: 0xf2c14e, shape: 'fries' },
  { id: 'burger', name: 'Diner Burger', price: 9, cook: 6, tier: 0, color: 0xb5651d, shape: 'burger' },
  { id: 'shake', name: 'Malt Shake', price: 7, cook: 3, tier: 1, color: 0xf7b6c2, shape: 'cup' },
  { id: 'pizza', name: 'Pizza Slice', price: 11, cook: 8, tier: 1, color: 0xe8a33d, shape: 'slice' },
  { id: 'pasta', name: 'Pasta Night', price: 15, cook: 9, tier: 2, color: 0xffd97a, shape: 'bowl' },
  { id: 'steak', name: 'Steak Plate', price: 22, cook: 12, tier: 2, color: 0x7a3e2a, shape: 'steak' },
  { id: 'special', name: "Chef's Special", price: 34, cook: 14, tier: 3, color: 0xc63d5c, shape: 'special' },
];

// Upgrades: cost grows by `growth` per level. `max` null = unlimited.
export const UPGRADES = [
  { id: 'runner', name: 'Hire a runner', desc: 'Another Retail Worker carries plates from the kitchen pass.', cost: 120, growth: 1.9, max: 3, icon: '🏃', start: 1 },
  { id: 'shoes', name: 'Runner sneakers', desc: 'Runners walk 20% faster per level.', cost: 60, growth: 1.6, max: 5, icon: '👟' },
  { id: 'cashier', name: 'Cashier training', desc: 'Orders are taken 15% faster per level.', cost: 80, growth: 1.6, max: 5, icon: '🧾' },
  { id: 'knife', name: "Chef's knife", desc: 'A proper knife on the pass. Prep is 20% faster per level.', cost: 90, growth: 1.7, max: 4, icon: '🔪' },
  { id: 'stove', name: 'Extra stove', desc: 'One more dish cooks at the same time.', cost: 180, growth: 1.8, max: 3, icon: '🔥', start: 1 },
  { id: 'cabinet', name: 'Kitchen cabinet', desc: 'Wall storage. Each cabinet trims 12% off cook time.', cost: 110, growth: 1.7, max: 3, icon: '🗄️' },
  { id: 'tables', name: 'Dining table', desc: 'Four seats. Seated guests eat in and tip.', cost: 100, growth: 1.5, max: 4, icon: '🪑' },
  { id: 'sign', name: 'Neon sign', desc: 'Word gets around. 25% more walk-ins per level.', cost: 90, growth: 1.7, max: 5, icon: '💡' },
  { id: 'menu', name: 'Expand the menu', desc: 'Unlock pricier dishes: shakes & pizza, then pasta & steak, then the special.', cost: 220, growth: 2.2, max: 3, icon: '📖' },
  { id: 'auto', name: 'Cash drawer', desc: 'The cashier banks the register every 6 seconds. No more clicking.', cost: 300, growth: 1, max: 1, icon: '💵' },
];

export function upgradeCost(def, level) {
  return Math.round(def.cost * Math.pow(def.growth, level));
}

export const MILESTONES = [
  { id: 'first50', label: 'Serve 50 guests', check: (s) => s.servedTotal >= 50 },
  { id: 'cash1k', label: 'Bank $1,000', check: (s) => s.earnedTotal >= 1000 },
  { id: 'stars4', label: 'Reach 4 stars', check: (s) => s.reputation >= 80 },
  { id: 'menu3', label: 'Serve the Chef\'s Special', check: (s) => s.specialsServed >= 1 },
  { id: 'cash10k', label: 'Bank $10,000', check: (s) => s.earnedTotal >= 10000 },
  { id: 'stars5', label: 'Five stars', check: (s) => s.reputation >= 100 },
];
