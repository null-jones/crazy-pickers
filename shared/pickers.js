/* The one list of pickers. index.html builds its cards from it and each
   picker page looks itself up by key, so titles and colours live here only. */
window.PICKERS = [
  { key: 'car-crash',       emoji: '🚗', accent: '#ff2e6d', accent2: '#ffd400', title: 'Crash Test Standup',
    blurb: 'A name on a number plate, a wall, and no brakes.' },
  { key: 'cat-vomit',       emoji: '🐈', accent: '#8fd14a', accent2: '#ff9bb0', title: 'Hairball Roulette',
    blurb: 'The cat ate the roster. It returns one name, slightly damp.' },
  { key: 'toilet-flush',    emoji: '🚽', accent: '#2fb6c9', accent2: '#ffd166', title: 'Toilet of Destiny',
    blurb: 'Everyone in the bowl. Last one floating speaks.' },
  { key: 'volcano',         emoji: '🌋', accent: '#ff6a1a', accent2: '#ffd166', title: 'Volcano Sacrifice',
    blurb: 'Names in stone, into the crater. It spits one back.' },
  { key: 'claw-machine',    emoji: '🕹️', accent: '#ff3ea5', accent2: '#2ee6ff', title: 'The Claw Decides',
    blurb: 'An arcade claw, gripping at 4% of advertised strength.' },
  { key: 'shark-tank',      emoji: '🦈', accent: '#19a6c9', accent2: '#ffd166', title: 'Shark Tank',
    blurb: 'The team is on surfboards. Something below has an opinion.' },
  { key: 'alien-abduction', emoji: '🛸', accent: '#8dfbe0', accent2: '#c9a0ff', title: 'Alien Abduction',
    blurb: 'Your colleagues are cows. The saucer takes one.' },
  { key: 'seance',          emoji: '🔮', accent: '#7ee3ff', accent2: '#ffb060', title: 'Standup Séance',
    blurb: 'A planchette spells the name out, letter by letter.' },
  { key: 'rocket-launch',   emoji: '🚀', accent: '#ff6a3d', accent2: '#6dff9b', title: 'Launch Failure',
    blurb: 'Everyone gets a rocket. Most will not be fine.' },
  { key: 'microwave',       emoji: '📟', accent: '#ffb300', accent2: '#5dff9a', title: 'Microwave Meltdown',
    blurb: 'Names in foil. Twelve seconds. One legible survivor.' },
  { key: 'zombie-outbreak', emoji: '🧟', accent: '#7cff5e', accent2: '#ff3b3b', title: 'Zombie Outbreak',
    blurb: 'The car park is overrun. Last one uninfected has the floor.' }
];
