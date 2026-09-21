// Canned rounds for demo mode (no API key). Each entry has one answer per
// contestant, written to echo how the four models tend to sound. The game
// shuffles them into slots exactly like live answers.

export const DEMO_BANK = [
  {
    prompt: 'Explain black holes to a five-year-old in two sentences.',
    answers: {
      fable:
        'Imagine a place in space that pulls so hard that even light, the fastest thing there is, cannot climb back out once it falls in. It is not a hole you could fall through, more like the strongest hug in the universe, so tight nothing ever leaves.',
      opus:
        'A black hole is a spot in space where gravity is so strong it swallows everything nearby, even light, which is why it looks black. Think of it as a cosmic drain that is really, really good at its job.',
      sonnet:
        'A black hole is a place in space where gravity pulls so strongly that nothing can escape, not even light. That is why it looks black: it is the darkest, hungriest spot in the whole sky.',
      haiku:
        'A black hole is a spot in space that pulls everything in and never lets go, even light. It is like the strongest vacuum cleaner ever, hiding in the dark.',
    },
  },
  {
    prompt: 'Settle it once and for all: is a hot dog a sandwich?',
    answers: {
      fable:
        'Structurally, yes: filling enclosed by bread. Culturally, no: nobody at a cookout has ever asked for a sandwich and meant a hot dog. The honest answer is that the word sandwich is doing two jobs, and the hot dog only qualifies for one of them. Call it a sandwich in court and a hot dog at the table.',
      opus:
        'Yes, and I will die on this hill. Bread, filling, handheld, eaten at lunch: that is the whole job description. The hot dog is simply a sandwich that got famous enough to drop its last name.',
      sonnet:
        'Technically yes, since it is a filling served in bread, but practically no, because language follows how people actually eat. Most people would never call it a sandwich, and that everyday usage matters. So: a sandwich by definition, a hot dog by consensus.',
      haiku:
        'Yes. Bread on the outside, filling on the inside, eaten with your hands. That is a sandwich. The bun being connected on one side does not change the rules.',
    },
  },
  {
    prompt: 'Write a haiku about Monday mornings.',
    answers: {
      fable:
        'Alarm, then silence.\nThe weekend folds itself up\nand hands me the keys.',
      opus:
        'Coffee not yet brewed,\nthe inbox already full.\nMonday clears its throat.',
      sonnet:
        'Gray light through the blinds,\nthe kettle hums its slow song.\nMonday starts again.',
      haiku:
        'Alarm rings too soon.\nCoffee, keys, the door, the world.\nMonday, here we go.',
    },
  },
  {
    prompt: 'Describe the color blue to someone who has never seen.',
    answers: {
      fable:
        'Blue is the feeling of cool water closing over your hand, or the first deep breath after stepping outside at night. It is the color of distance: things far away lean toward it. It is calm without being empty, the way a low steady note is calm.',
      opus:
        'Blue is what cold feels like when it is pleasant rather than sharp: a lake at dawn, a smooth stone that has sat in shade all day. It is the color of far-off things and of quiet. If red is a shout, blue is a long, slow exhale.',
      sonnet:
        'Think of the coolness of water on your skin, or the calm you feel lying still in a quiet room. Blue is that feeling turned into a color. It is spacious and gentle, like the sound of wind far above you rather than right beside you.',
      haiku:
        'Blue is cool and calm, like cold water or a deep breath of fresh air. It feels open and wide, the way the sky feels above you. Not loud, not warm, just steady and peaceful.',
    },
  },
  {
    prompt: 'Give me one hot take about programming languages.',
    answers: {
      fable:
        'Most language debates are really debates about tooling and community, wearing syntax as a costume. A language with a great package manager, fast compiler, and patient forum will beat a more elegant one every time, and it is not close.',
      opus:
        'Static typing is not about catching bugs. It is about letting you forget things safely. The real product of a type system is the mental RAM it frees up, and dynamic-language fans undersell how expensive remembering is.',
      sonnet:
        'The best programming language is usually the one your team already knows. Switching for elegance rarely pays back the cost of relearning tools, libraries, and habits, so most rewrites into a trendier language are a productivity loss dressed up as progress.',
      haiku:
        'Whitespace-sensitive syntax was a mistake. It makes copy-paste fragile and turns invisible characters into bugs. Braces are ugly, but they never lie about where a block ends.',
    },
  },
  {
    prompt: 'Invent a new holiday and its single most important tradition.',
    answers: {
      fable:
        'Unfinished Day, held on the last Sunday of February. The tradition: you finish exactly one thing you abandoned, however small, then tell someone about it over a meal. Not a resolution, not a plan, an ending. The day exists because most guilt is just loose ends with no deadline.',
      opus:
        'Reverse Birthday, once a year on a date you pick. Instead of receiving gifts, you give one thing you already own and love to someone who admired it. The tradition is the handoff: you tell them the story of the object before it becomes theirs.',
      sonnet:
        'Neighbor Night, the first warm evening of spring. Everyone on a street puts a chair outside their front door and sits in it for an hour, no phones. The tradition is simple: you have to learn one new name before you go back in.',
      haiku:
        'Leftover Day, the day after any big feast. The one rule: every dish must be reinvented into something new. Turkey becomes tacos, mashed potatoes become pancakes. Waste nothing, and vote on the best remix.',
    },
  },
  {
    prompt: 'Pitch me a movie in exactly thirty words.',
    answers: {
      fable:
        'A lighthouse keeper discovers the fog rolling in each night carries voices of people not yet born. She starts answering. By winter, the future depends on which questions she chooses to ignore.',
      opus:
        'Two rival wedding planners are hired for the same ceremony by a feuding bride and groom. The wedding is in nine days. The venue is a submarine. Nobody has told the captain.',
      sonnet:
        'A retired cartographer notices a street on an old map that no longer exists. Walking its former route each night, he finds the neighborhood slowly returning, along with everyone who lived there.',
      haiku:
        'A delivery driver realizes every package she drops off changes the recipient\'s life dramatically. Today\'s route has forty stops. One box is addressed to her. She has until sundown to decide.',
    },
  },
  {
    prompt: 'What is the best way to cook an egg? Be opinionated.',
    answers: {
      fable:
        'Soft-boiled, six and a half minutes, straight into cold water, eaten from the shell with salt. Every other method trades away either the set white or the liquid yolk; this is the only one that keeps both honest. Scrambled eggs are for people who have given up on the egg as an object.',
      opus:
        'Fried in too much butter over medium-low heat, basted with a spoon until the white sets and the yolk barely trembles. Crisp edges are a crime. The egg should slide off the pan like it is late for something.',
      sonnet:
        'A slow scramble: low heat, constant stirring, pulled off the stove while still glossy. It takes patience but rewards you with small, creamy curds instead of rubbery chunks. Most bad eggs are simply cooked too hot and too fast.',
      haiku:
        'Over medium in a hot pan with butter. Crispy edges, runny yolk, done in three minutes. Poaching is fussy and boiling is boring. Fry it and eat it on toast.',
    },
  },
];
