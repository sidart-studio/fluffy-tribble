// Balance sheet for Short Order Tycoon. Everything tunable lives here.

export const DAY_LENGTH = 120;          // game seconds per business day
export const START_CASH = 150;
export const START_REPUTATION = 50;     // 0..100 -> 0..5 stars
export const QUEUE_PATIENCE = 32;       // seconds a customer waits in line
export const FOOD_PATIENCE = 60;        // seconds a customer waits for food after ordering
export const EAT_TIME = 9;
export const SAVE_KEY = 'short-order-tycoon:save:v1';

export const MENU = [
  // Every skewer uses the Poly kebab model; `meat` tints its meat cubes.
  { id: 'soda', name: 'Fizzy Soda', price: 3.5, cook: 1.5, tier: 0, color: 0x8d3b2f, shape: 'cup' },
  { id: 'chicken', name: 'Chicken Kebab', price: 8, cook: 6, tier: 0, color: 0xf2c14e, shape: 'kebab', meat: 0xf0c987 },
  { id: 'beef', name: 'Beef Kebab', price: 10, cook: 7, tier: 0, color: 0xb5651d, shape: 'kebab', meat: 0x6b3a26 },
  { id: 'veggie', name: 'Veggie Kebab', price: 7.5, cook: 4.5, tier: 1, color: 0x6abf4b, shape: 'kebab', meat: 0x7cb342 },
  { id: 'shake', name: 'Malt Shake', price: 7, cook: 3, tier: 1, color: 0xf7b6c2, shape: 'cup' },
  { id: 'smoothie', name: 'Berry Smoothie', price: 6.5, cook: 2.5, tier: 1, color: 0x8e44ad, shape: 'cup' },
  { id: 'lamb', name: 'Lamb Kebab', price: 14, cook: 9, tier: 2, color: 0x8d4a3a, shape: 'kebab', meat: 0x8d4a3a },
  { id: 'platter', name: 'Mixed Platter', price: 21, cook: 12, tier: 2, color: 0xe8a33d, shape: 'platter' },
  { id: 'special', name: "Chef's Special", price: 34, cook: 14, tier: 3, color: 0xc63d5c, shape: 'special' },
];

// Upgrades: cost grows by `growth` per level. `max` null = unlimited.
export const UPGRADES = [
  { id: 'runner', name: 'Hire a runner', desc: 'Another Retail Worker carries plates from the kitchen pass.', cost: 120, growth: 1.9, max: 3, icon: '🏃', start: 1, cat: 'staff' },
  { id: 'shoes', name: 'Runner sneakers', desc: 'Runners walk 20% faster per level.', cost: 60, growth: 1.6, max: 5, icon: '👟', cat: 'staff' },
  { id: 'cashier', name: 'Cashier training', desc: 'Orders are taken 15% faster per level.', cost: 80, growth: 1.6, max: 5, icon: '🧾', cat: 'staff' },
  { id: 'knife', name: "Chef's knife", desc: 'A proper knife on the pass. Prep is 20% faster per level.', cost: 90, growth: 1.7, max: 4, icon: '🔪', cat: 'kitchen' },
  { id: 'chef2', name: 'Sous chef', desc: 'A second cook with their own prep board and burner. Doubles what the kitchen can turn out.', cost: 480, growth: 1, max: 1, icon: '👨‍🍳', cat: 'kitchen' },
  { id: 'stove', name: 'Extra stove', desc: 'One more dish cooks at the same time.', cost: 180, growth: 1.8, max: 3, icon: '🔥', start: 1, cat: 'kitchen' },
  { id: 'cabinet', name: 'Kitchen cabinet', desc: 'Wall storage. Each cabinet trims 12% off cook time.', cost: 110, growth: 1.7, max: 3, icon: '🗄️', cat: 'kitchen' },
  { id: 'tables', name: 'Dining table', desc: 'Four seats in the dining room. Seated guests eat in, tip, and rate you higher.', cost: 100, growth: 1.5, max: 4, icon: '🪑', cat: 'dining' },
  { id: 'lamps', name: 'Mood lighting', desc: 'Two more hanging lamps over the dining room. Guests wait 12% longer and tip 10% more per level.', cost: 95, growth: 1.6, max: 3, icon: '💡', cat: 'dining' },
  { id: 'sign', name: 'Neon sign', desc: 'Word gets around. 25% more walk-ins per level.', cost: 90, growth: 1.7, max: 5, icon: '✨', cat: 'marketing' },
  { id: 'menu', name: 'Expand the menu', desc: 'Unlock more dishes: veggie skewers, shakes & smoothies, then lamb & the mixed platter, then the special.', cost: 220, growth: 2.2, max: 3, icon: '📖', cat: 'kitchen' },
  { id: 'register2', name: 'Second register', desc: 'A second cash register and cashier. Guests split into two lines.', cost: 450, growth: 1, max: 1, icon: '🧮', cat: 'staff' },
  { id: 'auto', name: 'Cash drawer', desc: 'The cashier banks the register every 6 seconds. No more clicking.', cost: 300, growth: 1, max: 1, icon: '💵', cat: 'staff' },
];

export const CATEGORIES = [
  { id: 'staff', name: 'Staff', icon: '👥' },
  { id: 'kitchen', name: 'Kitchen', icon: '🍳' },
  { id: 'dining', name: 'Dining room', icon: '🪑' },
  { id: 'marketing', name: 'Marketing', icon: '📣' },
];

// Quests: one at a time, in order. `check` gets (stats, game).
export const QUESTS = [
  { id: 'q_serve5', text: 'Serve 5 guests', reward: 60, check: (st) => st.servedTotal >= 5 },
  { id: 'q_collect3', text: 'Bank the register 3 times (click it or press Space)', reward: 60, check: (st) => st.collects >= 3 },
  { id: 'q_table', text: 'Buy a Dining table in the Shop (B)', reward: 90, check: (st, g) => g.lvl('tables') >= 1 },
  { id: 'q_hustle', text: 'Click a staff member to make them hustle', reward: 60, check: (st) => st.hustles >= 1 },
  { id: 'q_runner', text: 'Hire a second runner', reward: 120, check: (st, g) => g.lvl('runner') >= 2 },
  { id: 'q_stars3', text: 'Reach a 3-star rating', reward: 120, check: (st, g) => g.stars() >= 3 },
  { id: 'q_serve25', text: 'Serve 25 guests', reward: 150, check: (st) => st.servedTotal >= 25 },
  { id: 'q_knife', text: "Buy the chef a knife", reward: 120, check: (st, g) => g.lvl('knife') >= 1 },
  { id: 'q_menu', text: 'Expand the menu', reward: 200, check: (st, g) => g.lvl('menu') >= 1 },
  { id: 'q_streak10', text: 'Serve 10 guests in a row with no walkouts', reward: 250, check: (st) => st.streakBest >= 10 },
  { id: 'q_vip', text: 'Impress a food critic (the golden guest)', reward: 300, check: (st) => st.vipHappy >= 1 },
  { id: 'q_stars4', text: 'Reach 4 stars', reward: 400, check: (st, g) => g.stars() >= 4 },
  { id: 'q_register2', text: 'Open a second register', reward: 500, check: (st, g) => g.lvl('register2') >= 1 },
  { id: 'q_chef2', text: 'Hire a sous chef', reward: 500, check: (st, g) => g.lvl('chef2') >= 1 },
  { id: 'q_serve100', text: 'Serve 100 guests', reward: 600, check: (st) => st.servedTotal >= 100 },
  { id: 'q_lamps', text: 'Light the dining room (Mood lighting ×3)', reward: 500, check: (st, g) => g.lvl('lamps') >= 3 },
  { id: 'q_special', text: "Serve the Chef's Special", reward: 800, check: (st) => st.specialsServed >= 1 },
  { id: 'q_cash10k', text: 'Earn $10,000 in total', reward: 1000, check: (st) => st.earnedTotal >= 10000 },
  { id: 'q_stars5', text: 'Five stars. The best diner in the world.', reward: 2500, check: (st, g) => g.stars() >= 5 },
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
