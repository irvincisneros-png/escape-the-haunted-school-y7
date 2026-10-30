// All question data for the Year 7 Science Halloween escape game.
// Lock schema and MINI_QUESTIONS format are defined in CONTRACT.md.
// Answers are compared after normalising (lowercase, letters and digits only).

export const LOCKS = {
  // ---------------------------------------------------------------
  // LOCK 1: Entrance Hall. Fair tests: decode a password from variables.
  // ---------------------------------------------------------------
  1: {
    title: 'The Pumpkin Experiment',
    story: 'The front door is sealed by a science lock. Gus the Ghost is testing plant food on pumpkins. Name each part of his test to find the password.',
    prompt: `
      <p>Gus grows 5 pumpkin plants. He gives each one a different amount of plant food and measures how tall each plant is after 2 weeks. Match each clue to a word in the key. The 5 letters in order spell the password.</p>
      <h3>Science word key</h3>
      <ul class="q-key">
        <li><b>S</b> Independent variable (the thing you change)</li>
        <li><b>P</b> Dependent variable (the thing you measure)</li>
        <li><b>O</b> Controlled variable (kept the same)</li>
        <li><b>K</b> Inference (a conclusion you work out)</li>
        <li><b>B</b> Observation (what you see or measure)</li>
      </ul>
      <h3>The clues</h3>
      <ol>
        <li>The amount of plant food each plant gets</li>
        <li>The height of each plant after 2 weeks</li>
        <li>The amount of water. Every plant gets 100 mL each day.</li>
        <li>The type of soil. Every plant gets the same soil.</li>
        <li>Gus says: "The plants with more food grew taller, so the food must help pumpkins grow."</li>
      </ol>`,
    type: 'text',
    answer: ['spook'],
    hints: [
      'Ask for each clue: is it what Gus changes, what he measures, what stays the same, or a conclusion?',
      'Clue 1 is the thing Gus changes on purpose, so it is the independent variable: S. Clue 2 is what he measures: P.',
      'Clues 3 and 4 both stay the same, so they are both O. Clue 5 is a conclusion: K. The word is a spooky one: S, P, O, O, K.'
    ],
    lesson: {
      title: 'The front door creaks open!',
      text: '<p>In a fair test you change <b>one</b> thing (independent variable), measure <b>one</b> thing (dependent variable) and keep everything else the same (controlled variables). An <b>inference</b> is a conclusion that comes from your observations.</p>',
      dot: '1.2.6 Independent and dependent variables'
    }
  },

  // ---------------------------------------------------------------
  // LOCK 2: Library. Match space events and Aboriginal and Torres Strait Islander astronomy.
  // ---------------------------------------------------------------
  2: {
    title: 'The Midnight Sky',
    story: 'The library telescope is stuck on a spooky night sky. Choose the right word for each sky clue to free it.',
    prompt: `
      <p>Choose the best word for each clue about the Sun, Earth, Moon and the night sky.</p>`,
    type: 'select',
    items: [
      {
        text: 'The Moon moves between the Sun and Earth, and its shadow falls on Earth. The Sun is blocked out for a short time.',
        options: ['Solar eclipse', 'Lunar eclipse', 'Full Moon'],
        answer: 'Solar eclipse'
      },
      {
        text: 'Earth moves between the Sun and the Moon, and Earth\'s shadow falls on the Moon.',
        options: ['Solar eclipse', 'Lunar eclipse', 'New Moon'],
        answer: 'Lunar eclipse'
      },
      {
        text: 'Yolŋu people of northern Australia link the changing phases of the Moon to the rise and fall of the ___.',
        options: ['Tides', 'Seasons', 'Eclipses'],
        answer: 'Tides'
      },
      {
        text: 'In many Aboriginal Cultures, the position of the Emu in the Sky tells people when emus are laying eggs. The stars are used like a ___.',
        options: ['Calendar', 'Compass', 'Clock for the hours'],
        answer: 'Calendar'
      }
    ],
    hints: [
      'An eclipse happens when three bodies line up. Think about which one is in the middle.',
      'For a solar eclipse, the Moon is in the middle. For a lunar eclipse, Earth is in the middle.',
      'Items 1 and 2 are the two different eclipses. Item 3 is about the water at the beach (it rises and falls). Item 4 is about telling the time of year.'
    ],
    lesson: {
      title: 'The telescope is free!',
      text: '<p>A <b>solar eclipse</b> happens when the Moon blocks the Sun. A <b>lunar eclipse</b> happens when Earth\'s shadow falls on the Moon. Aboriginal and Torres Strait Islander Peoples have watched the Moon and stars for tens of thousands of years, using them to know about tides, seasons and animal behaviour.</p>',
      dot: '1.3.3 Lunar phases and eclipses'
    }
  },

  // ---------------------------------------------------------------
  // LOCK 3: Dining Hall. Weight force (F = m x g) and balanced forces.
  // ---------------------------------------------------------------
  3: {
    title: 'The Floating Feast',
    story: 'The ghosts have made the dinner table float! Do the force sums to bring it back down.',
    prompt: `
      <p>Use <b>weight = mass × g</b>, where g = 10 N/kg. Forces are measured in newtons (N).</p>
      <table class="q-table">
        <thead><tr><th>Dinner item</th><th class="n">Mass</th><th class="n">Weight</th></tr></thead>
        <tbody>
          <tr><td>Witch's cauldron</td><td class="n">6 kg</td><td class="n">?</td></tr>
          <tr><td>Giant pumpkin</td><td class="n">? kg</td><td class="n">40 N</td></tr>
        </tbody>
      </table>
      <p>Last one: two ghosts pull on a chair. One pulls left with 20 N and one pulls right with 20 N.</p>`,
    type: 'multi',
    fields: [
      { label: 'Weight of the cauldron (N)', answer: ['60', '60n'] },
      { label: 'Mass of the pumpkin (kg)', answer: ['4', '4kg'] },
      { label: 'Overall force on the chair (N)', answer: ['0', '0n'] }
    ],
    hints: [
      'Weight = mass × 10. For the pumpkin you work backwards: mass = weight ÷ 10.',
      'Cauldron: 6 × 10 = ? Pumpkin: 40 ÷ 10 = ?',
      'The cauldron is 60 N and the pumpkin is 4 kg. For the chair, the forces are equal and opposite, so they are balanced. Take 20 away from 20.'
    ],
    lesson: {
      title: 'The table crashes down!',
      text: '<p>Weight is a force: <b>F = m × g</b>, and on Earth g = 10 N/kg. When forces are <b>balanced</b> (equal and opposite), the overall force is zero and the object does not change its motion.</p>',
      dot: '2.1.9 Calculations using F = mg'
    }
  },

  // ---------------------------------------------------------------
  // LOCK 4: Ballroom. Living or non-living.
  // ---------------------------------------------------------------
  4: {
    title: 'Alive or Not?',
    story: 'Something in the ballroom is moving, but is it alive? Sort the dancers to unlock the dance floor.',
    prompt: `
      <p>Living things <b>move, respire, sense, grow, reproduce, excrete and need nutrition</b> (MRS GREN). Sort each thing into the right bin.</p>`,
    type: 'sort',
    bins: ['Living', 'Non-living'],
    items: [
      { text: 'A bat hanging from the chandelier', bin: 0 },
      { text: 'A mushroom growing in the corner', bin: 0 },
      { text: 'A plastic skeleton', bin: 1 },
      { text: 'A pumpkin seed that has sprouted and is growing', bin: 0 },
      { text: 'A bubbling cauldron', bin: 1 }
    ],
    hints: [
      'Ask: does it grow, make more of its own kind, and need food or energy? A living thing does.',
      'Things that were never alive, like plastic and metal, are non-living. A bubbling cauldron is only moving because it is hot.',
      'Three are living (bat, mushroom, sprouted seed) and two are non-living (plastic skeleton, cauldron).'
    ],
    lesson: {
      title: 'The dance floor is unlocked!',
      text: '<p>All living things share the characteristics in <b>MRS GREN</b>: Movement, Respiration, Sensitivity, Growth, Reproduction, Excretion and Nutrition. A mushroom is alive too: fungi are their own kingdom.</p>',
      dot: '3.1.1 Characteristics of living things'
    }
  },

  // ---------------------------------------------------------------
  // LOCK 5: Cellar. Cell organelles: decode a password.
  // ---------------------------------------------------------------
  5: {
    title: 'Inside a Zombie Cell',
    story: 'A mouldy microscope sits in the cellar. Look inside the cell and work out the job of each part to read the password.',
    prompt: `
      <p>Match each job to its cell part in the key. The 4 letters in order spell the password.</p>
      <h3>Cell part key</h3>
      <ul class="q-key">
        <li><b>C</b> Nucleus</li>
        <li><b>E</b> Chloroplast</li>
        <li><b>L</b> Mitochondria</li>
        <li><b>M</b> Cell membrane</li>
        <li><b>W</b> Cell wall</li>
      </ul>
      <h3>The jobs</h3>
      <ol>
        <li>Holds the DNA and controls the cell</li>
        <li>Catches sunlight to make food (only in plant cells)</li>
        <li>Releases energy from food (respiration)</li>
        <li>Zombie muscle cells have lots of these because they need lots of energy</li>
      </ol>`,
    type: 'text',
    answer: ['cell'],
    hints: [
      'Think about what each part does, then find that part in the key.',
      'Job 1 is the nucleus, so the first letter is C. Job 2 is photosynthesis, which happens in the chloroplast: E.',
      'Job 3 and job 4 are both about releasing energy, which is the mitochondria: L and L. The word is C, E, L, L.'
    ],
    lesson: {
      title: 'The cellar door swings open!',
      text: '<p>The <b>nucleus</b> holds DNA, <b>mitochondria</b> release energy by respiration, and <b>chloroplasts</b> make food by photosynthesis. The <b>cell membrane</b> controls what goes in and out. Cell walls and chloroplasts are found in plant cells but not animal cells.</p>',
      dot: '3.2.3 Functions of organelles'
    }
  },

  // ---------------------------------------------------------------
  // LOCK 6: Clock Tower Hall. Density and solutions (final door).
  // ---------------------------------------------------------------
  6: {
    title: "The Witch's Potion",
    story: "The Clock Tower's final door opens only when you solve the witch's potion riddle.",
    prompt: `
      <p>The witch stirs 10 g of salt into 100 mL of warm water until the salt disappears. Then she weighs a magic stone: its mass is <b>60 g</b> and its volume is <b>20 cm³</b>.</p>
      <p>Remember: <b>density = mass ÷ volume</b>.</p>`,
    type: 'multi',
    fields: [
      { label: 'Density of the stone (g/cm³)', answer: ['3', '3gcm', '3gcm3', '3g/cm3', '3gml'] },
      { label: 'The solute (what dissolves)', answer: ['salt', 'thesalt'] },
      { label: 'The solvent (what does the dissolving)', answer: ['water', 'thewater'] },
      { label: 'How to get the salt back (one word)', answer: ['evaporation', 'evaporate', 'evaporating', 'evaporated', 'distillation', 'distilling'] }
    ],
    hints: [
      'Density: divide the mass by the volume. The solute dissolves in the solvent to make a solution.',
      '60 ÷ 20 = ? The salt disappears into the water. Which one is doing the dissolving?',
      'The density is 3. The solute is salt and the solvent is water. To get the salt back, heat the water until it turns to vapour and leaves the salt behind.'
    ],
    lesson: {
      title: 'The final door is open!',
      text: '<p><b>Density = mass ÷ volume</b>. In a <b>solution</b>, the <b>solute</b> (salt) dissolves in the <b>solvent</b> (water). You can separate them by <b>evaporation</b>, because the water leaves as vapour and the salt stays behind.</p>',
      dot: '4.3.1 Solute, solvent and solution'
    }
  }
};

// Quick multiple-choice questions for the mid-game popup and mini games.
// answer = index (0-3) of the correct option. explain = one short sentence.
export const MINI_QUESTIONS = [
  // ---- Nature and practice of science (1.1.x, 1.2.x) ----
  {
    q: 'What is the main purpose of science?',
    options: [
      'To build knowledge about the world and Universe by observing and testing',
      'To scare people with ghost stories',
      'To avoid doing experiments',
      'To make a list of spells'
    ],
    answer: 0,
    explain: 'Scientists observe, experiment and analyse to understand the world and Universe.'
  },
  {
    q: 'In a fair test, what is the variable that you change on purpose?',
    options: ['Dependent variable', 'Controlled variable', 'Independent variable', 'Inference'],
    answer: 2,
    explain: 'The independent variable is the one thing you change.'
  },
  {
    q: 'Which tool would you use to measure the volume of a witch\'s potion?',
    options: ['Ruler', 'Measuring cylinder', 'Stopwatch', 'Thermometer'],
    answer: 1,
    explain: 'A measuring cylinder measures the volume of a liquid.'
  },
  {
    q: 'Why do scientists repeat an experiment several times?',
    options: [
      'To use up more time',
      'To change the variable',
      'To make the test harder',
      'To check the results are reliable'
    ],
    answer: 3,
    explain: 'Getting similar results again and again makes the results more reliable.'
  },
  {
    q: 'Which of these is an observation?',
    options: [
      'The bat is probably hungry',
      'The bat must be scared',
      'The bat has brown fur and is 8 cm long',
      'The bat likes the cave'
    ],
    answer: 2,
    explain: 'An observation is what you see or measure, not what you guess.'
  },
  {
    q: 'You see wet footprints from the pond to the door and say, "A ghost came in from the pond." This is an...',
    options: ['Inference', 'Observation', 'Measurement', 'Variable'],
    answer: 1,
    explain: 'An inference is a conclusion you work out from what you observe.'
  },
  {
    q: 'In a graph, which axis does the independent variable usually go on?',
    options: ['The y-axis (up the side)', 'The x-axis (along the bottom)', 'Neither axis', 'Both axes'],
    answer: 1,
    explain: 'The independent variable goes along the bottom (x-axis) and the dependent variable goes up the side (y-axis).'
  },

  // ---- Space science and Aboriginal and Torres Strait Islander astronomy (1.3.x, 1.4.x) ----
  {
    q: 'What causes the phases of the Moon?',
    options: [
      'Clouds covering the Moon',
      'Earth\'s shadow covering the Moon each night',
      'The Moon growing and shrinking',
      'We see different amounts of the Moon\'s sunlit half as it orbits Earth'
    ],
    answer: 3,
    explain: 'The Moon always has a lit half, but we see more or less of it as the Moon orbits Earth.'
  },
  {
    q: 'About how long does the Moon take to go through all its phases?',
    options: ['About one month (29 days)', 'About one day', 'About one year', 'About one week'],
    answer: 0,
    explain: 'The cycle of Moon phases takes about 29 days.'
  },
  {
    q: 'When does a solar eclipse happen?',
    options: [
      'When Earth is between the Sun and the Moon',
      'When the Sun is between Earth and the Moon',
      'When the Moon passes between the Sun and Earth',
      'When the Moon is very far away'
    ],
    answer: 2,
    explain: 'In a solar eclipse the Moon blocks the Sun\'s light from reaching part of Earth.'
  },
  {
    q: 'What happens in a lunar eclipse?',
    options: [
      'The Moon blocks the Sun',
      'Earth\'s shadow falls on the Moon',
      'The Moon moves out of orbit',
      'The Sun stops shining'
    ],
    answer: 1,
    explain: 'In a lunar eclipse Earth is between the Sun and the Moon, so Earth\'s shadow falls on the Moon.'
  },
  {
    q: 'Why do we have day and night?',
    options: [
      'Earth spins on its axis',
      'The Sun moves around Earth',
      'The Moon blocks the Sun every night',
      'Earth moves closer to the Sun'
    ],
    answer: 0,
    explain: 'Earth spins once about every 24 hours, so each side faces the Sun and then faces away.'
  },
  {
    q: 'Many Aboriginal Peoples watch the Emu in the Sky. When it is in a certain position, what does it tell them?',
    options: [
      'A storm is coming',
      'The Moon is full',
      'The tide is low',
      'It is time when emus lay their eggs'
    ],
    answer: 3,
    explain: 'The Emu in the Sky is used like a calendar for the seasons and for animal behaviour.'
  },
  {
    q: 'Early models of the solar system put Earth at the centre. Why did scientists change to a Sun-centred model?',
    options: [
      'Someone voted to change it',
      'They got bored of the old model',
      'New evidence from observations did not fit the old model',
      'Earth became smaller'
    ],
    answer: 2,
    explain: 'Scientific models are changed when new evidence shows they are wrong.'
  },

  // ---- Forces, magnets and simple machines (2.1 - 2.3) ----
  {
    q: 'Which of these is a non-contact force?',
    options: ['A push', 'Gravity', 'Friction', 'Air resistance'],
    answer: 1,
    explain: 'Gravity can pull on objects without touching them.'
  },
  {
    q: 'In which unit is force measured?',
    options: ['Kilograms (kg)', 'Metres (m)', 'Seconds (s)', 'Newtons (N)'],
    answer: 3,
    explain: 'Force is measured in newtons (N).'
  },
  {
    q: 'The forces on a crate pushed by two ghosts are balanced. What happens to the crate?',
    options: [
      'It stays still or keeps moving at the same speed',
      'It speeds up',
      'It slows down',
      'It starts to spin'
    ],
    answer: 0,
    explain: 'Balanced forces mean no change in motion.'
  },
  {
    q: 'A stone statue has a mass of 3 kg. What is its weight? (g = 10 N/kg)',
    options: ['3 N', '13 N', '30 N', '0.3 N'],
    answer: 2,
    explain: 'Weight = mass × g = 3 × 10 = 30 N.'
  },
  {
    q: 'What happens if you push two north poles of magnets together?',
    options: ['They attract', 'They repel', 'They stick', 'They disappear'],
    answer: 1,
    explain: 'Like poles repel and opposite poles attract.'
  },
  {
    q: 'A crowbar is a lever. What does it help you do?',
    options: [
      'Use a smaller force to lift a heavy object',
      'Make the object heavier',
      'Remove gravity',
      'Create friction'
    ],
    answer: 0,
    explain: 'Levers let you lift or move something using less force.'
  },
  {
    q: 'What can a pulley on a flagpole do for you?',
    options: [
      'Make the flag heavier',
      'Stop gravity',
      'Create magnetism',
      'Change the direction of your pull'
    ],
    answer: 3,
    explain: 'A pulley lets you pull down to lift something up.'
  },

  // ---- Classification (3.1.x) ----
  {
    q: 'Which of these is a characteristic of all living things?',
    options: [
      'Wearing a costume',
      'Being able to fly',
      'Reproducing (making more of their own kind)',
      'Living in a house'
    ],
    answer: 2,
    explain: 'All living things reproduce, grow, respire and need nutrition, among other things.'
  },
  {
    q: 'Which list puts the groups in order from biggest to smallest?',
    options: [
      'Kingdom, phylum, class, order, family, genus, species',
      'Species, genus, family, order, class, phylum, kingdom',
      'Class, kingdom, genus, phylum, family, order, species',
      'Genus, species, kingdom, class, order, family, phylum'
    ],
    answer: 0,
    explain: 'Classification starts with the biggest group (kingdom) and ends with the smallest (species).'
  },
  {
    q: 'A binomial name, like Homo sapiens, is made from which two parts?',
    options: ['Kingdom and phylum', 'Genus and species', 'Class and order', 'Family and kingdom'],
    answer: 1,
    explain: 'The first part is the genus and the second part is the species.'
  },
  {
    q: 'What is a dichotomous key?',
    options: [
      'A key for opening the school',
      'A map of the school',
      'A type of microscope',
      'A set of two-choice questions used to identify organisms'
    ],
    answer: 3,
    explain: 'Each step gives two choices until you reach the name of the organism.'
  },
  {
    q: 'Why is a bat classified as a mammal?',
    options: [
      'It has fur and feeds its young milk',
      'It lays eggs',
      'It has feathers',
      'It has scales'
    ],
    answer: 0,
    explain: 'Mammals have fur or hair and feed their babies milk.'
  },
  {
    q: 'Koalas have sharp claws for climbing gum trees. This is an example of an...',
    options: ['Organelle', 'Inference', 'Adaptation', 'Variable'],
    answer: 2,
    explain: 'An adaptation is a feature that helps an organism survive in its habitat.'
  },
  {
    q: 'A mushroom growing in the cellar belongs to which kingdom?',
    options: ['Plants', 'Fungi', 'Animals', 'Bacteria'],
    answer: 1,
    explain: 'Mushrooms are fungi, which are their own kingdom.'
  },

  // ---- Cells (3.2.x) ----
  {
    q: 'Which cell part holds the DNA and controls the cell?',
    options: ['Cell wall', 'Chloroplast', 'Mitochondria', 'Nucleus'],
    answer: 3,
    explain: 'The nucleus is the control centre of the cell.'
  },
  {
    q: 'Where does photosynthesis happen in a plant cell?',
    options: ['Mitochondria', 'Chloroplasts', 'Nucleus', 'Cell membrane'],
    answer: 1,
    explain: 'Chloroplasts contain chlorophyll, which traps sunlight to make food.'
  },
  {
    q: 'Which of these is found in plant cells but not in animal cells?',
    options: ['A cell wall', 'A nucleus', 'A cell membrane', 'Cytoplasm'],
    answer: 0,
    explain: 'Plant cells have a cell wall for support. Animal cells do not.'
  },
  {
    q: 'What do mitochondria do?',
    options: [
      'Make food from sunlight',
      'Hold the DNA',
      'Release energy from food',
      'Keep the cell stiff'
    ],
    answer: 2,
    explain: 'Mitochondria are where respiration releases energy for the cell.'
  },
  {
    q: 'What does the cell membrane do?',
    options: [
      'Holds the DNA',
      'Makes food',
      'Stores spooky potions',
      'Controls what goes into and out of the cell'
    ],
    answer: 3,
    explain: 'The cell membrane is like a gate around the cell.'
  },
  {
    q: 'What is the job of a red blood cell?',
    options: [
      'Carry oxygen around the body',
      'Send messages',
      'Make food from sunlight',
      'Hold up a plant'
    ],
    answer: 0,
    explain: 'Red blood cells are specialised to carry oxygen.'
  },
  {
    q: 'According to cell theory, all living things are made of...',
    options: ['Atoms only', 'One or more cells', 'Water only', 'Organs only'],
    answer: 1,
    explain: 'Cell theory says cells are the basic building blocks of all living things.'
  },

  // ---- Matter, solutions and mixtures (4.1 - 4.4) ----
  {
    q: 'What are the particles in a gas like?',
    options: [
      'Packed tightly together',
      'Vibrating in fixed places',
      'Far apart and moving fast in all directions',
      'Stuck in a neat pattern'
    ],
    answer: 2,
    explain: 'Gas particles have weak attractions, so they spread out and move freely.'
  },
  {
    q: 'Why does a solid keep its shape?',
    options: [
      'Its particles are held tightly in fixed positions',
      'Its particles are far apart',
      'Its particles move quickly',
      'Its particles have disappeared'
    ],
    answer: 0,
    explain: 'In a solid the particles are close together and only vibrate.'
  },
  {
    q: 'What change of state is melting?',
    options: ['Gas to liquid', 'Liquid to gas', 'Liquid to solid', 'Solid to liquid'],
    answer: 3,
    explain: 'Melting happens when a solid is heated and becomes a liquid.'
  },
  {
    q: 'Which formula gives density?',
    options: ['Volume ÷ mass', 'Mass ÷ volume', 'Mass × volume', 'Mass − volume'],
    answer: 1,
    explain: 'Density = mass ÷ volume.'
  },
  {
    q: 'Sugar dissolves in a cauldron of hot water. The sugar is the...',
    options: ['Solvent', 'Solution', 'Solute', 'Mixture'],
    answer: 2,
    explain: 'The solute is the substance that dissolves in the solvent.'
  },
  {
    q: 'What is a saturated solution?',
    options: [
      'One that cannot dissolve any more solute at that temperature',
      'One with very little solute',
      'One with no water',
      'One that is frozen'
    ],
    answer: 0,
    explain: 'When no more solute will dissolve, the solution is saturated.'
  },
  {
    q: 'Which method separates sand from water?',
    options: ['Using a magnet', 'Evaporation', 'Chromatography', 'Filtering'],
    answer: 3,
    explain: 'The water passes through filter paper and the sand stays behind.'
  }
];
