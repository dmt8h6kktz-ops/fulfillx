// js/data.js — constants, storage helpers, shared state
// Defines the global `app` object; other files extend it with Object.assign.

const DEFAULT_HABITS = [
    { id: "h_meditate",  name: "Meditation",     icon: "🧘", slots: ["morning"],           days: [0,1,2,3,4,5,6], active: true },
    { id: "h_reading",   name: "Reading",        icon: "📖", slots: ["evening"],           days: [0,1,2,3,4,5,6], active: true },
    { id: "h_exercise",  name: "Exercise / Gym", icon: "💪", slots: ["daytime"],           days: [1,3,5],         active: true },
    { id: "h_language",  name: "Language study", icon: "🗣️", slots: ["evening"],           days: [0,1,2,3,4,5,6], active: true },
    { id: "h_walk",      name: "Walk",           icon: "🚶", slots: ["daytime"],           days: [0,1,2,3,4,5,6], active: true }
];

const DEFAULT_CONFIG = {
    morning: [
        { id: "sleep",       type: "sleep",     title: "How did you sleep?",   config: { scaleMax: 5, numberLabel: "Hours slept" } },
        { id: "gratitude",   type: "text",      title: "Gratitude",            config: { prompt: "What's one thing you're grateful for today?" } },
        { id: "affirmation", type: "text",      title: "Affirmation",          config: { prompt: "What is one affirmation you can give yourself this morning?" } },
        { id: "maingoal",    type: "maingoal",  title: "Main Goal of the Day", config: { prompt: "What do you want to move toward today?" } },
        { id: "habits-am",   type: "habits",    title: "Morning Habits",       config: { items: ["Meditation","Read 10 min","Exercise"] } }
    ],
    evening: [
        { id: "goalreview",  type: "goalreview", title: "Today's Main Goal",   config: {} },
        { id: "reflection",  type: "text",      title: "Reflection",           config: { prompt: "What was a win today? What would you do differently?" } },
        { id: "habits-pm",   type: "habits",    title: "Evening Habits",       config: { items: ["Reading","Book Club prep","Meditation"] } },
        { id: "sleepintent", type: "text",      title: "Sleep Intention",      config: { prompt: "What will help you sleep well tonight?" } },
        { id: "energy",      type: "scale10",   title: "Energy",               config: { prompt: "How much natural energy did you have today?" } },
        { id: "effort",      type: "scale10",   title: "Effort",               config: { prompt: "How much did you put in today? Reading, studying, and boxing all count." } },
        { id: "emotions",    type: "emotions",  title: "How was today?",       config: { prompt: "What did you feel? Tap any that fit.", tags: ["Happy","Calm","Grateful","Content","Excited","Motivated","Energized","Proud","Hopeful","Tired","Drained","Lazy","Anxious","Stressed","Frustrated","Sad","Angry","Lonely","Overwhelmed","Numb"] } }
    ]
};

const TOOL_REGISTRY = [
    { id:'five_rs',       name:"Cravings · The 5 R's",  icon:'ph-repeat', group:'reflect',
      purpose:'Work through a craving or urge, step by step.',
      credit:'Four Steps by Dr. Jeffrey Schwartz (Brain Lock); adapted for cravings and expanded with a fifth step by Dr. Gabor Maté (In the Realm of Hungry Ghosts).',
      infoUse:'When an urge or craving shows up — for anything — and you want to meet it with awareness instead of autopilot.',
      infoExample:"An urge to reach for your phone hits. You relabel it as a false signal, trace it to an old habit loop, refocus elsewhere, weigh what giving in really costs, and reconnect to the life you'd rather build.",
      type:'diary', config:{ footer:'Urges recur — every time you turn one away is a win.', steps:[
        { key:'craving_label', label:'The craving',   prompt:"What's the craving? Give it a short label (e.g. smoke, sugar, phone).", chipSource:'craving_label' },
        { key:'relabel',      label:'Relabel',           prompt:'Name the urge for what it is (an urge, not a command).' },
        { key:'reattribute',  label:'Reattribute',       prompt:"Where's this really coming from? An old signal/habit loop, not the true you." },
        { key:'refocus',      label:'Refocus',           prompt:'What will you do instead, right now, to let it pass? Any redirection counts.' },
        { key:'revalue',      label:'Revalue',           prompt:'Play it forward: what does giving in actually cost you?' },
        { key:'recreate',     label:'Recreate',          prompt:'Reconnect to your values: what life or person are you choosing instead?' }
      ]}},
    { id:'elephant',      name:'Reactivity · Elephant & Rider', icon:'ph-lightning', group:'reflect',
      purpose:'Catch the moment emotion takes the reins.',
      credit:'From Jonathan Haidt, The Happiness Hypothesis (2006).',
      infoUse:'When you reacted automatically and want to understand the pull behind it.',
      infoExample:"You snapped before you 'decided' to — the elephant (emotion) turned before the rider (reason) had a say. Journaling these moments builds the awareness to catch them earlier.",
      type:'diary', config:{ steps:[
        { key:'what_happened',  label:'The moment',      prompt:'What happened — the moment the elephant turned?' },
        { key:'elephant_felt',  label:'The elephant',    prompt:'What did the elephant want or feel right then?' },
        { key:'rider_chose',    label:'The rider',       prompt:'Where was the rider? What would it have chosen?' },
        { key:'create_space',   label:'Creating space',  prompt:'What helped, or could help, you create space and wait out the pull?' },
        { key:'trigger',        label:'The trigger',     prompt:'What set it off? Name the specific trigger (a scent, tone, word, place, time).', chipSource:'trigger' }
      ]}},
    { id:'shadow',        name:'Triggers · Shadow Work', icon:'ph-yin-yang', group:'reflect',
      purpose:'Get curious about what you reject in yourself.',
      credit:'Concept by Carl Jung; practical exercise from Robert A. Johnson, Owning Your Own Shadow.',
      infoUse:'When someone triggers a judgment or reaction far bigger than the moment deserves.',
      infoExample:"A coworker's bragging irritates you intensely. Shadow work asks what that reaction protects or hides in you — often a disowned part worth integrating rather than exiling.",
      type:'diary', config:{ steps:[
        { key:'trigger',    label:'The trigger',   prompt:'What triggered a strong reaction or judgment?' },
        { key:'reacted_to', label:'The reaction',  prompt:'What exactly did you react to in them?' },
        { key:'in_you',     label:'In you',        prompt:'Where might that same trait live, unowned, in you?' },
        { key:'integrate',  label:'Integrate',     prompt:'What would it look like to accept or integrate that part?' }
      ]}},
    { id:'stoic',         name:'Worry · Dichotomy of Control', icon:'ph-scales', group:'reflect',
      purpose:"Separate what's yours to control from what isn't.",
      credit:'From Epictetus, the Enchiridion (Stoic philosophy).',
      infoUse:"When you're spinning on something stressful and want to spend energy where it counts.",
      infoExample:"A flight's delayed and you're fuming. The delay isn't yours to control; your response and next move are. You invest there and practice letting the rest go.",
      type:'diary', config:{ steps:[
        { key:'troubling',  label:'What troubles you',      prompt:"What's troubling you right now?" },
        { key:'not_yours',  label:'Not yours to control',   prompt:'What part is NOT up to you (outcomes, others, externals)? Name it to set it down.' },
        { key:'yours',      label:'Yours to control',       prompt:'What part IS up to you (your judgments, choices, actions)?' },
        { key:'invest',     label:'Invest here',            prompt:"One thing in your control you'll put energy into?" }
      ]}},
    { id:'shame',         name:'Shame Resilience',          icon:'ph-hand-heart', group:'reflect',
      purpose:"Loosen shame's grip when it hits.",
      credit:"From Brené Brown's Shame Resilience Theory (I Thought It Was Just Me).",
      infoUse:"When you feel small, exposed, or 'not enough' and want to come back to yourself.",
      infoExample:"After a mistake the 'I'm a fraud' feeling floods in. You name the shame and its trigger, reality-check the story, reach out to someone safe, and say it out loud — where shame loses its power.",
      type:'diary', config:{ steps:[
        { key:'recognize',    label:'Recognize',          prompt:'Name the shame and its trigger. Where do you feel it in your body?' },
        { key:'critical',     label:'Critical awareness', prompt:"Whose expectation is driving this? Is it realistic or fair?" },
        { key:'reach_out',    label:'Reach out',          prompt:'Who is someone safe you could share this with?' },
        { key:'speak_shame',  label:'Speak shame',        prompt:"Say it plainly: what's the story you're afraid is true?" }
      ]}},
    { id:'thought_record', name:'Thought Record',           icon:'ph-note-pencil', group:'reflect',
      purpose:'Test a painful thought against the evidence.',
      credit:'Cognitive Behavioral Therapy — Dr. Aaron Beck; popularized by Dr. David Burns (Feeling Good).',
      infoUse:'When an upsetting thought feels like fact and you want to check it.',
      infoExample:"'Everyone thought my talk was terrible.' You log the situation, the thought, the feeling, spot the trap (mind-reading, all-or-nothing), and write a fairer view — and the feeling eases.",
      type:'diary', config:{ steps:[
        { key:'situation',    label:'Situation',        prompt:'What happened?' },
        { key:'auto_thought', label:'Automatic thought',prompt:'What went through your mind?' },
        { key:'feeling',      label:'Feeling',          prompt:'What did you feel, and how strong (0–100%)?' },
        { key:'trap',         label:'Thinking trap',    prompt:'All-or-nothing, mind-reading, catastrophizing…?' },
        { key:'balanced',     label:'Balanced view',    prompt:'A fairer, more accurate thought?' },
        { key:'rerate',       label:'Re-rate feeling',  prompt:'How strong is the feeling now?' }
      ]}},
    { id:'nvc',           name:'Conflict · NVC',             icon:'ph-chats-circle', group:'reflect',
      purpose:'Say something hard without blame.',
      credit:'Nonviolent Communication — Dr. Marshall Rosenberg.',
      infoUse:'When you need to raise something difficult and want to be heard, not met with defensiveness.',
      infoExample:"Instead of 'you never listen': observation ('the last few talks you were on your phone'), feeling ('I felt unimportant'), need ('I need to feel heard'), request ('could we talk 10 minutes phone-down?').",
      type:'diary', config:{ draftMessage:true, steps:[
        { key:'observation', label:'Observation', prompt:'Just the facts, no judgment: what happened?' },
        { key:'feeling',     label:'Feeling',     prompt:'What do you feel about it?' },
        { key:'need',        label:'Need',        prompt:'What underlying need is behind that feeling?' },
        { key:'request',     label:'Request',     prompt:'A clear, doable ask — what would help?' }
      ]}},
    { id:'mind_dump',     name:'Overwhelm · Mind Dump',     icon:'ph-brain', group:'reflect',
      purpose:'Clear a cluttered mind onto the page.',
      credit:'Mind dump technique described by Mo Gawdat.',
      infoUse:"When your head is noisy and overwhelmed and you can't think straight.",
      infoExample:"Before bed your mind is spinning. You dump it all out for a few minutes, cross off what doesn't matter, and turn the rest into a short action list — and your head is quieter.",
      type:'minddump', config:{}},
    { id:'grounding',     name:'5-4-3-2-1 Grounding',       icon:'ph-tree', group:'moment',
      purpose:'Anchor yourself in the present.',
      credit:'A widely used grounding technique.',
      infoUse:'When anxiety or overwhelm pulls you out of the moment.',
      infoExample:"Panic rising in a crowded room — name 5 things you see, 4 you hear, 3 you can touch, 2 you smell, 1 you taste, and you're back in your body.",
      type:'grounding', config:{}},
    { id:'ns_reset',      name:'Nervous-System Reset',       icon:'ph-wind', group:'moment',
      purpose:'Find your state, then settle your body.',
      credit:'Polyvagal theory — Dr. Stephen Porges; practice via Deb Dana; physiological sigh via Dr. Andrew Huberman (Stanford).',
      infoUse:'When you feel wired and panicky, or flat and shut down, and want to bring your body back toward calm.',
      infoExample:"Before a hard conversation your chest is tight and your mind races. You name it as fight-or-flight, then take three physiological sighs before you walk in.",
      type:'statepractice', config:{}},
    { id:'attachment',    name:'Relationships · Attachment',  icon:'ph-users-three', group:'know',
      purpose:'Understand your patterns in relationships.',
      credit:'Based on Levine & Heller, Attached (2010); attachment theory of Bowlby & Ainsworth.',
      infoUse:'When you feel a spike of worry, clinginess, or the urge to pull away in a relationship.',
      infoExample:"Someone doesn't reply for hours; your chest tightens and you start drafting a follow-up. This helps you catch that as your attachment system activating and choose your next move on purpose.",
      type:'attachment', config:{}},
    { id:'observer',      name:'Observer',                   icon:'ph-eye', group:'know',
      purpose:"Step back from a thought that's got you.",
      credit:'ACT cognitive defusion — Dr. Steven Hayes; popularized by Dr. Russ Harris.',
      infoUse:"When a harsh, sticky thought has you hooked and you're treating it as flat fact.",
      infoExample:"'I always mess things up' is on loop. Instead of arguing with it, you step back and watch it: 'I'm having the thought that I always mess things up.' The grip loosens.",
      type:'ladder', config:{}},
    { id:'values',        name:'Direction · Values',          icon:'ph-compass', group:'know',
      purpose:'Find your compass — what you want to stand for.',
      credit:"ACT values work — Dr. Steven Hayes; Bull's Eye by Tobias Lundgren; via Dr. Russ Harris.",
      infoUse:"When you feel directionless or pulled by others' expectations and want to reconnect with what matters.",
      infoExample:"'Get married' is a goal — you tick it off. 'Be loving and present' is a value — a direction you never finish walking. Values are the compass; goals are the stops.",
      type:'bullseye', config:{}}
];

// Do NOT use toISOString() for date keys — it returns UTC, which rolls over
// to the next calendar day in the evening for users west of UTC.
function localDateKey(d = new Date()) {
    const y   = d.getFullYear();
    const m   = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

var app = {
    currentJournal: null,
    goalReviewChoice: null,
    _widgetItems: {},


    /* ── CONFIG & ENTRIES ─────────────────────────────── */
    getConfig() {
        const stored = localStorage.getItem('fulfillx.config');
        if (!stored) {
            const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            localStorage.setItem('fulfillx.config', JSON.stringify(cfg));
            return cfg;
        }
        return JSON.parse(stored);
    },

    saveConfig(config) {
        localStorage.setItem('fulfillx.config', JSON.stringify(config));
    },

    getEntries() {
        return JSON.parse(localStorage.getItem('fulfillx.entries') || '{}');
    },

    saveEntries(entries) {
        localStorage.setItem('fulfillx.entries', JSON.stringify(entries));
    },

    /* ── HABIT STORE ──────────────────────────────────────── */
    getHabits() {
        const stored = localStorage.getItem('fulfillx.habits');
        if (stored) return JSON.parse(stored);
        // First run: try to migrate from fulfillx.config habit items
        const migrated = this.migrateHabitsFromConfig();
        if (migrated) {
            this.saveHabits(migrated);
            return migrated;
        }
        // No prior data — seed defaults
        const defaults = JSON.parse(JSON.stringify(DEFAULT_HABITS));
        this.saveHabits(defaults);
        return defaults;
    },

    saveHabits(habits) {
        localStorage.setItem('fulfillx.habits', JSON.stringify(habits));
    },

    migrateHabitsFromConfig() {
        const config = this.getConfig();
        const amWidget = config.morning?.find(w => w.id === 'habits-am');
        const pmWidget = config.evening?.find(w => w.id === 'habits-pm');
        const amItems = amWidget?.config?.items || [];
        const pmItems = pmWidget?.config?.items || [];
        // If no items in config at all, nothing to migrate
        if (!amItems.length && !pmItems.length) return null;

        const nameMap = {};
        const slugify = n => 'h_' + n.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
        amItems.forEach(name => {
            if (!nameMap[name]) nameMap[name] = { slots: [], days: [0,1,2,3,4,5,6], active: true };
            if (!nameMap[name].slots.includes('morning')) nameMap[name].slots.push('morning');
        });
        pmItems.forEach(name => {
            if (!nameMap[name]) nameMap[name] = { slots: [], days: [0,1,2,3,4,5,6], active: true };
            if (!nameMap[name].slots.includes('evening')) nameMap[name].slots.push('evening');
        });

        const habits = Object.entries(nameMap).map(([name, obj]) => ({
            id: slugify(name), name, icon: '✓', ...obj
        }));

        // Best-effort: migrate old completion data in fulfillx.entries
        const entries = this.getEntries();
        const nameToId = {};
        habits.forEach(h => { nameToId[h.name] = h.id; });

        Object.keys(entries).forEach(date => {
            const dayData = entries[date];
            const completed = {};
            ['morning', 'evening'].forEach(slot => {
                const wid = slot === 'morning' ? 'habits-am' : 'habits-pm';
                const old = dayData[slot]?.[wid];
                if (old && typeof old === 'object') {
                    Object.entries(old).forEach(([itemName, val]) => {
                        const hid = nameToId[itemName];
                        if (hid && val) completed[hid] = true;
                    });
                }
            });
            if (Object.keys(completed).length) {
                if (!dayData.habits) dayData.habits = {};
                Object.assign(dayData.habits, completed);
            }
        });
        this.saveEntries(entries);
        return habits;
    },


    getTodayKey() {
        return localDateKey();
    },


    /* ── V1.4 PHASE 2: TOOL ENTRIES STORE ─────────────── */
    getToolEntries() {
        return JSON.parse(localStorage.getItem('fulfillx.toolEntries') || '{}');
    },
    saveToolEntries(entries) {
        localStorage.setItem('fulfillx.toolEntries', JSON.stringify(entries));
    },
    addToolEntry(toolId, data) {
        const entries = this.getToolEntries();
        if (!entries[toolId]) entries[toolId] = [];
        entries[toolId].unshift({ date: this.getTodayKey(), ts: Date.now(), data });
        this.saveToolEntries(entries);
    },
    logToolUsage(toolId) {
        const usage = JSON.parse(localStorage.getItem('fulfillx.toolUsage') || '{}');
        if (!usage[toolId]) usage[toolId] = [];
        const today = this.getTodayKey();
        if (!usage[toolId].includes(today)) usage[toolId].push(today);
        localStorage.setItem('fulfillx.toolUsage', JSON.stringify(usage));
    },


    /* ── V1.6 CONFIG MIGRATION (idempotent, safe for existing users) ─ */
    migrateV16Config() {
        const raw = localStorage.getItem('fulfillx.config');
        if (!raw) return; // fresh install — DEFAULT_CONFIG already has everything

        const config = JSON.parse(raw);
        const evening = config.evening || [];
        let changed = false;

        // 1. Find and rename any 'Activity' widget → 'Effort', update id + prompt,
        //    and migrate existing entry data from the old id to 'effort'.
        const actIdx = evening.findIndex(w =>
            w.title === 'Activity' ||
            w.id === 'activity' ||
            (w.type === 'scale10' && w.title !== 'Energy' && w.id !== 'effort' && w.id !== 'energy')
        );
        if (actIdx >= 0) {
            const w = evening[actIdx];
            const oldId = w.id;
            w.id     = 'effort';
            w.type   = 'scale10';
            w.title  = 'Effort';
            if (!w.config) w.config = {};
            w.config.prompt = "How much did you put in today? Reading, studying, and boxing all count.";
            // Migrate any saved entry values from oldId → 'effort'
            if (oldId && oldId !== 'effort') {
                const entries = this.getEntries();
                Object.values(entries).forEach(day => {
                    if (day.evening && oldId in day.evening) {
                        day.evening.effort = day.evening[oldId];
                        delete day.evening[oldId];
                    }
                });
                this.saveEntries(entries);
            }
            changed = true;
        }

        // 2. Update Energy prompt if widget exists but has stale prompt.
        const energyIdx = evening.findIndex(w => w.id === 'energy');
        if (energyIdx >= 0) {
            const w = evening[energyIdx];
            const wantPrompt = "How much natural energy did you have today?";
            if (!w.config) w.config = {};
            if (w.config.prompt !== wantPrompt || w.title !== 'Energy' || w.type !== 'scale10') {
                w.title  = 'Energy';
                w.type   = 'scale10';
                w.config.prompt = wantPrompt;
                changed = true;
            }
        } else {
            // Insert Energy before 'sleepintent' if present, otherwise at end of evening
            const anchorIdx = evening.findIndex(w => w.id === 'sleepintent');
            const pos = anchorIdx >= 0 ? anchorIdx : evening.length;
            evening.splice(pos, 0, {
                id: 'energy', type: 'scale10', title: 'Energy',
                config: { prompt: "How much natural energy did you have today?" }
            });
            changed = true;
        }

        // 3. Ensure Effort widget exists (may already have been fixed in step 1).
        const effortIdx = evening.findIndex(w => w.id === 'effort');
        if (effortIdx < 0) {
            const energyFinal = evening.findIndex(w => w.id === 'energy');
            const pos = energyFinal >= 0 ? energyFinal + 1 : evening.length;
            evening.splice(pos, 0, {
                id: 'effort', type: 'scale10', title: 'Effort',
                config: { prompt: "How much did you put in today? Reading, studying, and boxing all count." }
            });
            changed = true;
        }

        // 4. Add Emotions widget if missing.
        const emotionsIdx = evening.findIndex(w => w.id === 'emotions' || w.type === 'emotions');
        if (emotionsIdx < 0) {
            evening.push({
                id: 'emotions', type: 'emotions', title: 'How was today?',
                config: {
                    prompt: "What did you feel? Tap any that fit.",
                    tags: ['Happy','Calm','Grateful','Content','Excited','Motivated','Energized','Proud','Hopeful',
                           'Tired','Drained','Lazy','Anxious','Stressed','Frustrated','Sad','Angry','Lonely','Overwhelmed','Numb']
                }
            });
            changed = true;
        }

        if (changed) {
            config.evening = evening;
            localStorage.setItem('fulfillx.config', JSON.stringify(config));
        }
    },

    _esc(str) {
        return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    },

    showToast(msg) {
        const toast = document.getElementById('toast');
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
    }
};
