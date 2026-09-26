// Balance sheet for Short Order Tycoon. Everything tunable lives here.

export const DAY_LENGTH = 150;          // game seconds per day (06:00 to 06:00)
export const DAY_SPLIT = 115;           // seconds of daytime (06:00-18:00); the night takes the rest
export const START_CASH = 400;
export const START_REPUTATION = 50;     // 0..100 -> 0..5 stars
export const QUEUE_PATIENCE = 32;       // seconds a customer waits in line
export const FOOD_PATIENCE = 60;        // seconds a customer waits for food after ordering
export const EAT_TIME = 9;
export const SAVE_KEY = 'short-order-city:save:v2';

export const MENU = [
  // Every skewer uses the Poly kebab model; `meat` tints its meat cubes.
  { id: 'soda', name: 'Fizzy Soda', price: 3.5, cook: 1.5, tier: 0, color: 0x8d3b2f, shape: 'cup' },
  { id: 'hotdog', name: 'Hot Dog', price: 6, cook: 4, tier: 0, color: 0xd9822b, shape: 'hotdog' },
  { id: 'burger', name: 'Diner Burger', price: 9.5, cook: 6.5, tier: 0, color: 0xb5651d, shape: 'burger' },
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
const cityHas = (g, type) => (g.city?.stats().byType[type] ?? 0) > 0;
const cityPop = (g) => g.city?.stats().population ?? 0;
export const QUESTS = [
  { id: 'q_homes', text: 'Build your first homes (Homes → Family houses, then click a block)', reward: 120, check: (st, g) => (g.city?.stats().housing ?? 0) > 0 },
  { id: 'q_food', text: 'Open a food business (Food & shops)', reward: 120, check: (st, g) => cityHas(g, 'hotdogstand') || cityHas(g, 'kebabhouse') || cityHas(g, 'burgerjoint') },
  { id: 'q_jobs', text: 'Give people work: build a Workshop', reward: 150, check: (st, g) => (g.city?.stats().jobs ?? 0) >= 12 },
  { id: 'q_pop10', text: 'Reach 10 residents', reward: 150, check: (st, g) => cityPop(g) >= 10 },
  { id: 'q_collect', text: 'Zoom in on the diner and bank its register (click it or press Space)', reward: 100, check: (st) => st.collects >= 1 },
  { id: 'q_park', text: 'Build a park', reward: 180, check: (st, g) => cityHas(g, 'park') },
  { id: 'q_village', text: 'Become a Village (25 people)', reward: 250, check: (st, g) => cityPop(g) >= 25 },
  { id: 'q_apartments', text: 'Build Apartments', reward: 250, check: (st, g) => cityHas(g, 'apartments') },
  { id: 'q_power', text: 'Build a Power plant before the lights go out', reward: 300, check: (st, g) => cityHas(g, 'powerplant') },
  { id: 'q_level', text: 'Upgrade a building to level 2 (click it)', reward: 250, check: (st) => (st.levelUps ?? 0) >= 1 },
  { id: 'q_office', text: 'Build an Office block', reward: 350, check: (st, g) => cityHas(g, 'office') },
  { id: 'q_table', text: 'Buy the diner a Dining table (Diner upgrades, B)', reward: 200, check: (st, g) => g.lvl('tables') >= 1 },
  { id: 'q_land', text: 'Buy the next ring of land', reward: 500, check: (st, g) => (g.city?.rings ?? 1) >= 2 },
  { id: 'q_town', text: 'Become a Town (100 people)', reward: 600, check: (st, g) => cityPop(g) >= 100 },
  { id: 'q_school', text: 'Build a School', reward: 450, check: (st, g) => cityHas(g, 'school') },
  { id: 'q_stars3', text: 'Get the diner to a 3-star rating', reward: 400, check: (st, g) => g.stars() >= 3 },
  { id: 'q_happy70', text: 'Reach 70% happiness with 100+ people', reward: 700, check: (st, g) => cityPop(g) >= 100 && g.city.stats().happiness >= 70 },
  { id: 'q_income200', text: 'Earn $200 a minute from the city', reward: 800, check: (st, g) => (g.city?.income ?? 0) >= 200 },
  { id: 'q_tower', text: 'Build a Residential tower', reward: 900, check: (st, g) => cityHas(g, 'tower') },
  { id: 'q_mall', text: 'Build a Shopping mall', reward: 900, check: (st, g) => cityHas(g, 'mall') },
  { id: 'q_hospital', text: 'Build a Hospital', reward: 1000, check: (st, g) => cityHas(g, 'hospital') },
  { id: 'q_city', text: 'Become a City (300 people)', reward: 1500, check: (st, g) => cityPop(g) >= 300 },
  { id: 'q_blocks30', text: 'Fill 30 blocks', reward: 1500, check: (st, g) => (g.city?.buildings.size ?? 0) >= 30 },
  { id: 'q_land4', text: 'Own all the land (4 rings)', reward: 2500, check: (st, g) => (g.city?.rings ?? 1) >= 4 },
  { id: 'q_stadium', text: 'Build the Stadium', reward: 3000, check: (st, g) => cityHas(g, 'stadium') },
  { id: 'q_metro', text: 'Metropolis: 800 people', reward: 5000, check: (st, g) => cityPop(g) >= 800 },
  { id: 'q_stars5', text: 'Five-star diner in a five-star city', reward: 5000, check: (st, g) => g.stars() >= 5 },
];

export function upgradeCost(def, level) {
  return Math.round(def.cost * Math.pow(def.growth, level));
}

export const MILESTONES = [
  { id: 'first50', label: 'Serve 50 diner guests', check: (s) => s.servedTotal >= 50 },
  { id: 'cash1k', label: 'Earn $1,000', check: (s) => s.earnedTotal >= 1000 },
  { id: 'stars4', label: 'Diner at 4 stars', check: (s) => s.reputation >= 80 },
  { id: 'menu3', label: 'Serve the Chef\'s Special', check: (s) => s.specialsServed >= 1 },
  { id: 'cash10k', label: 'Earn $10,000', check: (s) => s.earnedTotal >= 10000 },
  { id: 'stars5', label: 'Five stars', check: (s) => s.reputation >= 100 },
];
