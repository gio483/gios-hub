/* =====================================================================
   GIO'S DOCK — the catalog behind gios-hub.vercel.app
   ---------------------------------------------------------------------
   Every app we build, every website, every tool/subscription and every
   course lives here as ONE line. The hub renders everything from this.

   To add something: copy a line, give it a unique id, push to main.
   (Edits Gio makes inside the hub itself sync on top of these defaults.)

   Fields
     id     unique slug
     n      name
     d      one-line description (plain English)
     u      link (relative = a page on the hub, http = outside)
     k      kind: app | site | tool | course | design
     b      businesses: sdlr | svm | ksh | standby | mts | personal
     i      emoji icon (our own stuff)          dom  domain for a real logo (tools)
     c      card color
     p      price: [amount, 'mo'|'yr'|'life'] | 'free' | 'usage' | 'incl' (comes with another plan) | null (unknown, needs a price)
     s      status chip: live | preview | local | building
     ours   true = we built it
     add    date it joined the dock (drives "Recently added")
     note   optional small print
   ===================================================================== */

window.DOCK_BIZ = [
  { id:'sdlr',     n:'San Diego Landscape', short:'SDLR',     c:'#9fb56a', key:'1' },
  { id:'svm',      n:'Shift Vision Media',  short:'SVM',      c:'#29abe2', key:'2' },
  { id:'ksh',      n:'KSH Construction',    short:'KSH',      c:'#3f97d3', key:'3' },
  { id:'standby',  n:'Standby Pro',         short:'Standby',  c:'#c9a86a', key:'4' },
  { id:'mts',      n:'Made to Serve',       short:'MTS',      c:'#e2725b', key:'5' },
  { id:'personal', n:'Personal',            short:'Personal', c:'#ff8a3c', key:'6' }
];

window.DOCK_ITEMS = [
  /* ---------------- SDLR · our apps ---------------- */
  { id:'sdlr-hq', n:'Command Center', d:'CRM, inbox, follow-ups, BidForge estimates. The GoHighLevel replacement', u:'https://sdlr-hq.vercel.app', k:'app', b:['sdlr'], i:'🏛️', c:'#2f3a22', ours:true, s:'live', add:'2026-09-28' },
  { id:'tally', n:'Tally', d:'Snap receipts and client checks, AI reads them, tag each to a project: what every job cost, what each client paid and still owes', u:'https://tally.shiftvisionphotos.workers.dev', k:'app', b:['sdlr','svm'], i:'🧾', c:'#1f6f4f', ours:true, s:'live', add:'2026-11-02' },
  { id:'sdlr-proposals', n:'Proposals', d:'Paste proposal text, get the house-format SDLR proposal every time: PDF, client web link, page images for GHL', u:'https://sdlr-proposals.shiftvisionphotos.workers.dev', k:'app', b:['sdlr'], i:'📄', c:'#2f3d33', ours:true, s:'live', p:'free', add:'2026-11-02' },
  { id:'sdlr-lead-map', n:'Lead Map', d:'Every lead on a live map by area, value and source', u:'sdlr-lead-map.html', k:'app', b:['sdlr'], i:'🗺️', c:'#34442a', ours:true, add:'2026-09-09' },
  { id:'sdlr-this-week', n:"This Week's Posts", d:'Download the image, copy the caption, schedule it', u:'sdlr-this-week.html', k:'app', b:['sdlr'], i:'📲', c:'#3b4a2c', ours:true, add:'2026-06-25' },
  { id:'sdlr-estimator', n:'Estimator', d:'Price jobs and generate client estimates', u:'sdlr-estimator.html', k:'app', b:['sdlr'], i:'🧮', c:'#40502f', ours:true, add:'2026-06-01' },
  { id:'sdlr-intake', n:'Job Intake', d:'Capture site details for an estimate', u:'sdlr-intake.html', k:'app', b:['sdlr'], i:'📝', c:'#465634', ours:true, add:'2026-06-01' },
  { id:'sdlr-bni', n:'BNI Outreach', d:'358 referral partners. Call, text and track every 1-to-1', u:'sdlr-bni-outreach.html', k:'app', b:['sdlr'], i:'🤝', c:'#4b5a36', ours:true, add:'2026-08-20' },
  { id:'sdlr-social', n:'90-Day Social', d:'The social content calendar', u:'sdlr-social-dashboard.html', k:'app', b:['sdlr'], i:'📅', c:'#3a4a33', ours:true, add:'2026-06-01' },
  { id:'sdlr-seo', n:'SEO Grid', d:'Local rank-tracking grid', u:'sdlr-seo-tracker.html', k:'app', b:['sdlr'], i:'📍', c:'#2e3e2c', ours:true, add:'2026-06-01' },
  { id:'sdlr-page-one', n:'Page One Plan', d:'The plan to rank #1 for pergolas and full backyard remodels', u:'sdlr-page-one-plan.html', k:'app', b:['sdlr'], i:'🥇', c:'#35472f', ours:true, add:'2026-09-23' },
  { id:'sdlr-video-playbook', n:'Video Playbook', d:'20 scripts, batch plan and a 30-day filming calendar', u:'sdlr-video-playbook.html', k:'app', b:['sdlr'], i:'🎬', c:'#4a3f2a', ours:true, add:'2026-07-15' },
  { id:'sdlr-video-system', n:'Video System', d:'How SDLR video gets shot, cut and posted', u:'sdlr-video-system.html', k:'app', b:['sdlr'], i:'🎞️', c:'#4f442d', ours:true, add:'2026-09-13' },
  { id:'sdlr-ad-scripts', n:'Founder-Led Ad Scripts', d:'Ad scripts Gio reads to camera', u:'sdlr-ad-scripts.html', k:'app', b:['sdlr'], i:'🎙️', c:'#544830', ours:true, add:'2026-08-27' },
  { id:'sdlr-nc-ads', n:'North County Ads', d:'Front and back yard ad scripts, best combos, test plan, teleprompter', u:'sdlr-north-county-ads.html', k:'app', b:['sdlr'], i:'🎯', c:'#5a4c33', ours:true, add:'2026-10-08' },
  { id:'sdlr-vsl', n:'Video Scripts', d:'VSL and 8 scripts, editable, copy to teleprompter', u:'https://claude.ai/code/artifact/aa8ea77b-b6d6-4a99-b8e2-3fb37fb799f1', k:'app', b:['sdlr'], i:'📜', c:'#5f5036', ours:true, add:'2026-10-01' },

  /* ---------------- SDLR · designs ---------------- */
  { id:'sdlr-deck', n:'1-to-1 Deck', d:'The story, the work and the $200K mortgage play, for networking meetings', u:'sdlr-deck.html', k:'design', b:['sdlr'], i:'🖼️', c:'#6b5a3a', ours:true, add:'2026-08-20' },
  { id:'sdlr-gallery', n:'SDLR Design Gallery', d:'Every SDLR design piece with its version history', u:'designs.html?c=sdlr', k:'design', b:['sdlr'], i:'🎨', c:'#706040', ours:true, add:'2026-07-08' },
  { id:'sdlr-yard-signs', n:'Yard Signs', d:'Final two-sided yard sign, eleven rounds of versions', u:'sdlr-yard-signs.html', k:'design', b:['sdlr'], i:'🪧', c:'#2f4a2a', ours:true, add:'2026-10-23' },
  { id:'sdlr-ecard', n:'Digital E-Card', d:'Tap-to-save business card for SDLR', u:'sdlr-ecard.html', k:'design', b:['sdlr'], i:'💳', c:'#3d3524', ours:true, add:'2026-07-08' },

  /* ---------------- KSH ---------------- */
  { id:'ksh-assets', n:'Brand Assets', d:'Logo, team, projects, flipbook and templates', u:'ksh-assets.html', k:'app', b:['ksh'], i:'📁', c:'#12324f', ours:true, add:'2026-05-19' },
  { id:'ksh-ads', n:'Google Ads Dashboard', d:'KSH ad performance at a glance', u:'ksh-ads-dashboard.html', k:'app', b:['ksh'], i:'📊', c:'#163a5a', ours:true, add:'2026-05-19' },
  { id:'ksh-meeting', n:'Meeting Recorder', d:'Record, transcribe and summarize meetings', u:'ksh-meeting-assistant.html', k:'app', b:['ksh'], i:'🎙️', c:'#1a4266', ours:true, add:'2026-05-19' },
  { id:'ksh-network', n:'Designer Network', d:'Designers and architects directory', u:'ksh-networking-dashboard.html', k:'app', b:['ksh'], i:'📇', c:'#1e4a72', ours:true, add:'2026-05-19' },
  { id:'ksh-events', n:'Networking Events', d:'Where to meet designers and wealthy homeowners', u:'ksh-networking-events.html', k:'app', b:['ksh'], i:'🗓️', c:'#22527e', ours:true, add:'2026-05-19' },
  { id:'ksh-estimator', n:'Estimate Builder', d:'Turn numbers into a polished client proposal', u:'ksh-estimator.html', k:'app', b:['ksh'], i:'🧮', c:'#265a8a', ours:true, add:'2026-05-19' },
  { id:'ksh-flipbook', n:'Designer Flipbook', d:'The KSH flipbook, newest version opens first', u:'flipbook.html', k:'design', b:['ksh'], i:'📖', c:'#2a3f55', ours:true, add:'2026-05-19' },
  { id:'ksh-gallery', n:'KSH Design Gallery', d:'Flipbooks and visual deliverables', u:'designs.html?c=ksh', k:'design', b:['ksh'], i:'🎨', c:'#31475e', ours:true, add:'2026-05-19' },

  /* ---------------- SVM ---------------- */
  { id:'svm-websites', n:'Our Websites', d:'Every site we have built together', u:'websites.html', k:'app', b:['svm'], i:'🌐', c:'#06344a', ours:true, add:'2026-07-01' },
  { id:'svm-editor', n:'Website Editor', d:'Clients change the words on their own sites', u:'website-editor.html', k:'app', b:['svm'], i:'✏️', c:'#083d56', ours:true, add:'2026-07-01' },
  { id:'video-studio', n:'Video Studio', d:'Claude as editor: vs analyze, rough cuts, captions, Resolve timelines. Runs on the Mac', u:'', k:'app', b:['svm','sdlr'], i:'🎞️', c:'#1b1b22', ours:true, s:'local', add:'2026-10-24', note:'Local tool in ~/Projects/video-studio' },

  /* ---------------- Standby Pro ---------------- */
  { id:'standby-site', n:'Standby Website', d:'Public site where photographers buy', u:'standby-site.html', k:'site', b:['standby'], i:'🌐', c:'#3a2f1a', ours:true, s:'preview', add:'2026-08-01' },
  { id:'standby-app', n:'Standby App', d:'Login, dashboard, check-ins, messaging', u:'standby-app.html', k:'app', b:['standby'], i:'📱', c:'#42361e', ours:true, add:'2026-08-01' },
  { id:'standby-demo', n:'Product Demo', d:'Standalone clickable walkthrough', u:'standby-prototype.html', k:'app', b:['standby'], i:'🎬', c:'#4a3c22', ours:true, add:'2026-08-01' },

  /* ---------------- Personal · our apps ---------------- */
  { id:'lantern', n:'Lantern', d:'An emotional road map: questions, scenes and sounds', u:'lantern.html', k:'app', b:['personal'], i:'🏮', c:'#3a1f0e', ours:true, add:'2026-10-22' },
  { id:'lifeos', n:'Daily Life OS', d:'Energy, sleep, faith and reflection', u:'lifeos.html', k:'app', b:['personal'], i:'🧭', c:'#40230f', ours:true, add:'2026-06-10' },
  { id:'money-terminal', n:'Money Terminal', d:'Personal budget, spending and the move-out goal', u:'budget.html', k:'app', b:['personal'], i:'💰', c:'#1f3320', ours:true, add:'2026-06-04' },
  { id:'kitchen', n:"Gio's Kitchen", d:'What can I make? Live recipes and the cookbook', u:'kitchen.html', k:'app', b:['personal'], i:'🍳', c:'#4a2a12', ours:true, add:'2026-07-20' },
  { id:'keylight', n:'Keylight', d:'Flash simulator for interior architecture: place lights, fire, get scored', u:'keylight/', k:'app', b:['personal','svm'], i:'💡', c:'#3d3416', ours:true, add:'2026-08-27' },
  { id:'trip-map', n:'Trip Map', d:'Where to go, what it costs and when you can actually leave', u:'trip-map.html', k:'app', b:['personal'], i:'🗺️', c:'#16323d', ours:true, add:'2026-08-16' },
  { id:'snacks', n:'Snack Board', d:'Low calorie snacks by store and shelf life, plus a list', u:'snacks.html', k:'app', b:['personal'], i:'🥫', c:'#3d2a14', ours:true, add:'2026-10-24' },
  { id:'vibe', n:'Strong & Gentle', d:'Vibe board: marble, olive trees, fire and storm', u:'vibe/', k:'design', b:['personal'], i:'🏛️', c:'#2c2a26', ours:true, add:'2026-10-24' },

  /* ---------------- Courses & learning ---------------- */
  { id:'part107', n:'Part 107 Study', d:'55 lessons, daily drills and mock exams for the FAA drone test', u:'part107/', k:'course', b:['personal','svm'], i:'🛩️', c:'#1d2c44', ours:true, add:'2026-08-16' },
  { id:'faa-dronezone', n:'FAA DroneZone', d:'Register drones and manage the Part 107 certificate', u:'https://faadronezone-access.faa.gov', k:'course', b:['svm'], dom:'faa.gov', c:'#ffffff', p:'free' },
  { id:'hormozi', n:'$100M Trilogy', d:'Offers, Leads, Money Models. The hormozi-strategist agent walks it', u:'https://www.acquisition.com/books', k:'course', b:['sdlr','svm'], dom:'acquisition.com', c:'#0a0a0a', p:null, note:'Physical books' },
  { id:'hormozi-trainings', n:'Hormozi Trainings', d:'Free Acquisition.com video trainings that go with the books', u:'https://www.acquisition.com/training', k:'course', b:['sdlr','svm'], dom:'acquisition.com', c:'#111111', p:'free', add:'2026-11-02' },
  { id:'mike-andes', n:"Mike Andes' School of Business", d:'Augusta Lawn Care founder on building a service business', u:'https://mikeandes.teachable.com/courses/enrolled', k:'course', b:['sdlr'], dom:'teachable.com', c:'#1d3b2a', p:null, add:'2026-11-02' },
  { id:'erin-stetzer', n:'Erin Stetzer Homes', d:'Remodeling business community and trainings', u:'https://erin-stetzer-homes.circle.so/feed', k:'course', b:['sdlr','ksh'], dom:'circle.so', c:'#2b2622', p:null, add:'2026-11-02' },
  { id:'modern-craftsman', n:'Modern Craftsman', d:'Construction business course', u:'https://modern-craftsman.teachable.com/l/dashboard', k:'course', b:['sdlr','ksh'], dom:'teachable.com', c:'#26302b', p:null, add:'2026-11-02' },
  { id:'jesse-lane', n:'Jesse Lane Course', d:'Contractor course dashboard', u:'https://jesselane.samcart.com/courses/dashboard', k:'course', b:['sdlr','ksh'], dom:'samcart.com', c:'#2c2a33', p:null, add:'2026-11-02' },
  { id:'architect-entrepreneur', n:'Architect + Entrepreneur', d:'Running a design and architecture business', u:'https://architect-entrepreneur.teachable.com/l/dashboard', k:'course', b:['ksh','sdlr'], dom:'teachable.com', c:'#23272e', p:null, add:'2026-11-02' },
  { id:'cinemarketer', n:'Cinemarketer Program', d:'Video marketing program: Skool classroom, Notion dashboard and Slack', u:'https://www.skool.com/cinemarketerio-7695/classroom', k:'course', b:['svm'], dom:'skool.com', c:'#2a1d3a', p:null, add:'2026-11-02', note:'Dashboard: cinemarketer.notion.site' },
  { id:'cmcc', n:'Cinemarketing Cheat Code', d:'CMCC membership area', u:'https://www.cinemarketingcheatcode.com/membership-area1', k:'course', b:['svm'], dom:'cinemarketingcheatcode.com', c:'#301a1a', p:null, add:'2026-11-02' },
  { id:'video-strategist', n:'Video Strategist Collective', d:'Club of Closers community for video strategists', u:'https://club-of-closers-video-strategist-masted.mn.co/feed', k:'course', b:['svm'], dom:'mn.co', c:'#1a2633', p:null, add:'2026-11-02' },
  { id:'full-time-filmmaker', n:'Full Time Filmmaker', d:'The online film school library', u:'https://www.fulltimefilmmaker.com/library', k:'course', b:['svm'], dom:'fulltimefilmmaker.com', c:'#1f1f1f', p:null, add:'2026-11-02' },
  { id:'audio-guy', n:"Filmmaker's Guide to Audio", d:'Audio Guy course: clean sound for video', u:'https://www.audioguy.co/products/the-filmmaker-s-guide-to-audio-2/categories/370799/posts/1277557', k:'course', b:['svm'], dom:'audioguy.co', c:'#1c2a2a', p:null, add:'2026-11-02' },
  { id:'content-creator', n:'Become a Content Creator', d:'Content creator course and apprenticeships', u:'https://www.contentcreator.com/library', k:'course', b:['svm'], dom:'contentcreator.com', c:'#2d2416', p:null, add:'2026-11-02' },
  { id:'micro-content', n:'Micro-Content Mastery', d:'Short-form content course', u:'https://wxkactzjruoypyhgmkd4.memberships.msgsndr.com/library-v2', k:'course', b:['svm'], i:'🎞️', c:'#2a2238', p:null, add:'2026-11-02' },
  { id:'billy-gene', n:'Billy Gene Is Marketing', d:'Ads and marketing education library', u:'https://billy-genes-gene-pool.mykajabi.com/library', k:'course', b:['svm'], dom:'billygeneismarketing.com', c:'#3a2a12', p:null, add:'2026-11-02' },
  { id:'mark-cloutier', n:'Mark Cloutier Course', d:'Course Conqueror membership library', u:'https://membership.courseconqueror.com/library-v2', k:'course', b:['svm'], i:'🎓', c:'#1f2b3a', p:null, add:'2026-11-02' },
  { id:'agency-accelerator', n:'Agency Accelerator', d:'Agency growth program', u:'https://app.agency-accelerator.io/', k:'course', b:['svm'], dom:'agency-accelerator.io', c:'#14263b', p:null, add:'2026-11-02' },
  { id:'digital-delegator', n:'Digital Delegator Academy', d:'Hiring and delegating to virtual assistants', u:'https://academy.thedigitaldelegator.com/courses/library-v2', k:'course', b:['svm','sdlr'], dom:'thedigitaldelegator.com', c:'#1d2f2a', p:null, add:'2026-11-02', note:'Skool classroom too' },
  { id:'smma-course', n:'Free SMMA Course', d:'Social media marketing agency course on Skool', u:'https://www.skool.com/free-smma-course/classroom/17310ecd?md=c318bc346fe64ff4b35ddef44cdc4270', k:'course', b:['svm'], dom:'skool.com', c:'#22262e', p:'free', add:'2026-11-02' },
  { id:'trdvsc', n:'TRDVSC (The Real Deal)', d:'The Real Deal course library on Teachable', u:'https://therealdeal.teachable.com/courses/', k:'course', b:['svm'], dom:'teachable.com', c:'#26262b', p:null, add:'2026-11-02' },
  { id:'drone-launch', n:'Drone Launch Academy', d:'Part 107 and drone business training', u:'https://courses.dronelaunchacademy.com/courses/enrolled/80274', k:'course', b:['svm','personal'], dom:'dronelaunchacademy.com', c:'#13263a', p:null, add:'2026-11-02' },
  { id:'exotic-car-hacks', n:'Exotic Car Hacks', d:'How to buy exotic cars smart', u:'https://www.exoticcarhacks.com/homev2/', k:'course', b:['personal'], dom:'exoticcarhacks.com', c:'#2a1515', p:null, add:'2026-11-02' },
  { id:'ghl-notion-board', n:'GHL Web Design Board', d:'Notion board of GoHighLevel web design resources', u:'https://sunny-sauce-74d.notion.site/GHL-Web-Design-Notion-Board-a921f6780ad942978e81e0935ced088a', k:'course', b:['svm'], dom:'notion.so', c:'#ffffff', p:'free', add:'2026-11-02' },
  { id:'skool', n:'Skool', d:'Account behind the Cinemarketer, Digital Delegator and SMMA communities', u:'https://www.skool.com', k:'tool', b:['svm'], dom:'skool.com', c:'#ffffff', p:null, note:'Charged $16 in March 2026' },

  /* ---------------- Websites we built ---------------- */
  { id:'site-sdlr', n:'SDLR Website', d:'sandiegolandscaperemodeling.com. The #1-for-pergolas machine', u:'https://sandiegolandscaperemodeling.com', k:'site', b:['sdlr'], dom:'sandiegolandscaperemodeling.com', c:'#24301b', ours:true, s:'live', add:'2026-06-01' },
  { id:'site-svm', n:'Shift Vision Media', d:'shiftvisionmedia.com. Work, results and videos', u:'https://shiftvisionmedia.com', k:'site', b:['svm'], dom:'shiftvisionmedia.com', c:'#04202d', ours:true, s:'live', add:'2026-09-01' },
  { id:'site-ksh', n:'KSH Website', d:'kshconstruction.com. Astro rebuild with an offline switch', u:'https://www.kshconstruction.com', k:'site', b:['ksh','svm'], dom:'kshconstruction.com', c:'#0f2a44', ours:true, s:'live', add:'2026-09-15' },
  { id:'site-reliable', n:'Reliable Builders', d:'reliablebuilders.net. Michael Salamon, remodeling and ADUs', u:'https://reliablebuilders.net', k:'site', b:['svm'], dom:'reliablebuilders.net', c:'#1d2633', ours:true, s:'live', add:'2026-09-20' },
  { id:'site-k2', n:'K2 Plumbing', d:"k2plumbinginc.com. Kevin's Lakeside plumbing company", u:'https://k2plumbinginc.com', k:'site', b:['svm'], dom:'k2plumbinginc.com', c:'#13283f', ours:true, s:'live', add:'2026-08-01' },
  { id:'site-ss', n:'Signing Superheroes', d:'signingsuperheroes.com. Kristin Rhodes, mobile notary', u:'https://www.signingsuperheroes.com', k:'site', b:['svm'], dom:'signingsuperheroes.com', c:'#2a1840', ours:true, s:'live', add:'2026-08-01' },
  { id:'site-mthelix', n:'Mt. Helix Park', d:'Non-profit website rebuild preview', u:'https://mt-helix-park.shiftvisionphotos.workers.dev', k:'site', b:['svm'], i:'⛰️', c:'#24331f', ours:true, s:'preview', add:'2026-10-02' },
  { id:'site-jpsons', n:'JP & Sons Pest', d:'El Cajon pest control rebuild preview', u:'https://jp-sons-pest.shiftvisionphotos.workers.dev', k:'site', b:['svm'], i:'🐜', c:'#1f2d1a', ours:true, s:'preview', add:'2026-10-05' },
  { id:'site-sdhardscape', n:'SD Hardscape', d:'Pitch preview for Dario, masonry and stone', u:'https://sd-hardscape.shiftvisionphotos.workers.dev', k:'site', b:['svm'], i:'🧱', c:'#3a2c22', ours:true, s:'preview', add:'2026-10-07' },
  { id:'site-aly', n:'Aly Hance Marketing', d:'$7k creator site preview', u:'https://aly-hance.shiftvisionphotos.workers.dev', k:'site', b:['svm'], i:'📸', c:'#3d2233', ours:true, s:'preview', add:'2026-10-08' },
  { id:'site-davis', n:'Davis Roofing', d:'Premium Lakeside roofer site preview', u:'https://davis-roofing.shiftvisionphotos.workers.dev', k:'site', b:['svm'], i:'🏠', c:'#33231b', ours:true, s:'preview', add:'2026-10-08' },
  { id:'site-jb', n:'J&B Solutions', d:'Junk removal and dumpster rental preview', u:'https://jb-solutions.shiftvisionphotos.workers.dev', k:'site', b:['svm'], i:'🚛', c:'#1f2a36', ours:true, s:'preview', add:'2026-10-08' },
  { id:'site-bird', n:'Bird Tattoos', d:'El Cajon tattoo and piercing pitch', u:'https://bird-tattoos.shiftvisionphotos.workers.dev', k:'site', b:['svm'], i:'🪶', c:'#251a2e', ours:true, s:'preview', add:'2026-10-08' },
  { id:'site-airy', n:'Airy Cleaning Co.', d:'$10k Airbnb-turnover cleaning pitch', u:'https://airy-cleaning.shiftvisionphotos.workers.dev', k:'site', b:['svm'], i:'🫧', c:'#1a3038', ours:true, s:'preview', add:'2026-10-14' },
  { id:'site-inline', n:'In-Line Auto Repair', d:'El Cajon auto shop SEO rebuild preview', u:'https://inline-auto.shiftvisionphotos.workers.dev', k:'site', b:['svm'], i:'🔧', c:'#2a2a2e', ours:true, s:'preview', add:'2026-10-14' },
  { id:'site-essential', n:'Essential Grooming', d:'Santee dog and cat grooming salon rebuild', u:'https://www.essentialgroomingsalon.com', k:'site', b:['svm'], i:'🐕', c:'#2e2a1c', ours:true, s:'building', add:'2026-10-28' },
  { id:'site-bni', n:'BNI East County Networkers', d:"Gio's BNI chapter site: 59 members, events calendar", u:'https://bni-ecn.shiftvisionphotos.workers.dev', k:'site', b:['svm','personal'], i:'🎟️', c:'#3a1518', ours:true, s:'preview', add:'2026-10-20' },
  { id:'site-mts', n:'Made to Serve', d:"Kids' career discovery festival, East County, Spring 2027", u:'https://made-to-serve.shiftvisionphotos.workers.dev', k:'site', b:['mts'], i:'🧰', c:'#3d1f18', ours:true, s:'preview', add:'2026-10-09' },
  { id:'bni-deck', n:'BNI Referral Deck', d:'The 7-minute education moment, 14 slides', u:'https://docs.google.com/presentation/d/1gMBj-ImWOj-RkjHfVKz8WdSzk-WL5468Nf2ItgcH8Rg/edit', k:'design', b:['personal','svm'], i:'🗣️', c:'#3b1d1d', ours:true, add:'2026-10-20' },
  { id:'hub', n:"Gio's Hub", d:'This dock. Every app, site, tool and dollar in one place', u:'https://github.com/gio483/gios-hub', k:'app', b:['personal'], i:'⚓', c:'#16181d', ours:true, s:'live', add:'2026-05-01' },

  /* ---------------- Tools & subscriptions ---------------- */
  { id:'claude', n:'Claude', d:'The whole AI exec team: agents, Claude Code, artifacts', u:'https://claude.ai', k:'tool', b:['sdlr','svm','ksh','personal'], dom:'claude.ai', c:'#f0e9e1', p:null },
  { id:'ghl', n:'GoHighLevel', d:'SDLR automations, pipeline, calendar and Social Planner', u:'https://app.gohighlevel.com', k:'tool', b:['sdlr'], dom:'gohighlevel.com', c:'#ffffff', p:null },
  { id:'gws-sdlr', n:'Google Workspace', d:"SDLR's email and workspace (shows as WORKSPACE_SAND)", u:'https://admin.google.com', k:'tool', b:['sdlr'], dom:'workspace.google.com', c:'#ffffff', p:[20.77,'mo'] },
  { id:'gdrive', n:'Google Drive', d:'The whole Claude AI workspace syncs here', u:'https://drive.google.com', k:'tool', b:['personal','svm'], dom:'drive.google.com', c:'#ffffff', p:null },
  { id:'gmail', n:'Gmail', d:'Inbox', u:'https://mail.google.com', k:'tool', b:['personal','svm'], dom:'mail.google.com', c:'#ffffff', p:'free' },
  { id:'gcal', n:'Google Calendar', d:'Every shoot, call and meeting', u:'https://calendar.google.com', k:'tool', b:['personal','svm','sdlr'], dom:'calendar.google.com', c:'#ffffff', p:'free' },
  { id:'vercel', n:'Vercel', d:'Hosts this hub and the SDLR Command Center', u:'https://vercel.com/dashboard', k:'tool', b:['svm','sdlr'], dom:'vercel.com', c:'#000000', p:null },
  { id:'cloudflare', n:'Cloudflare', d:'Hosts every client site and preview', u:'https://dash.cloudflare.com', k:'tool', b:['svm','sdlr'], dom:'cloudflare.com', c:'#ffffff', p:null },
  { id:'github', n:'GitHub', d:'Source for the hub and the client sites (gio483)', u:'https://github.com/gio483', k:'tool', b:['svm'], dom:'github.com', c:'#0d1117', p:null },
  { id:'magnific', n:'Magnific', d:'AI images, upscales, sound effects, voices and music', u:'https://www.magnific.com/app', k:'tool', b:['svm','sdlr','personal'], dom:'magnific.com', c:'#111111', p:null },
  { id:'freepik', n:'Freepik', d:'Nano Banana renders for SDLR concept images', u:'https://www.freepik.com/pikaso', k:'tool', b:['sdlr','svm'], dom:'freepik.com', c:'#1b62f8', p:null },
  { id:'elevenlabs', n:'ElevenLabs', d:'Transcription for the meeting recorder, AI voices', u:'https://elevenlabs.io', k:'tool', b:['ksh','svm'], dom:'elevenlabs.io', c:'#000000', p:null },
  { id:'adobe-cc', n:'Adobe Creative Cloud', d:'Premiere Pro, Lightroom, Media Encoder, Express', u:'https://creativecloud.adobe.com', k:'tool', b:['svm'], dom:'adobe.com', c:'#2b0a0a', p:null },
  { id:'resolve', n:'DaVinci Resolve Studio', d:'Color and finishing. Claude drives it through MCP', u:'https://www.blackmagicdesign.com/products/davinciresolve', k:'tool', b:['svm'], dom:'blackmagicdesign.com', c:'#151515', p:[295,'life'], note:'List price; one-time license' },
  { id:'macwhisper', n:'MacWhisper', d:'Talk-to-text on the Mac (Right Command)', u:'https://goodsnooze.gumroad.com/l/macwhisper', k:'tool', b:['personal','svm'], dom:'goodsnooze.com', c:'#ffffff', p:null },
  { id:'capcut', n:'CapCut', d:'Quick vertical edits and captions', u:'https://www.capcut.com', k:'tool', b:['svm','sdlr'], dom:'capcut.com', c:'#000000', p:null },
  { id:'canva', n:'Canva', d:'Quick graphics, flyers and social posts', u:'https://www.canva.com', k:'tool', b:['svm','ksh'], dom:'canva.com', c:'#7d2ae8', p:[15,'mo'], note:'Decision: move to the KSH card' },
  { id:'meta-ads', n:'Meta Ads Manager', d:'Facebook and Instagram ads for SDLR and clients', u:'https://adsmanager.facebook.com', k:'tool', b:['sdlr','svm'], dom:'facebook.com', c:'#0866ff', p:'usage' },
  { id:'google-ads', n:'Google Ads', d:'Search ads; Ads Editor installed on the Mac', u:'https://ads.google.com', k:'tool', b:['ksh','sdlr'], dom:'ads.google.com', c:'#ffffff', p:'usage' },
  { id:'gsc', n:'Search Console', d:'SDLR indexing and rankings (authuser=1 account)', u:'https://search.google.com/search-console?authuser=1', k:'tool', b:['sdlr'], dom:'search.google.com', c:'#ffffff', p:'free' },
  { id:'ga4', n:'Google Analytics', d:'Site traffic for SDLR and clients', u:'https://analytics.google.com', k:'tool', b:['sdlr','svm'], dom:'analytics.google.com', c:'#ffffff', p:'free' },
  { id:'clarity', n:'Microsoft Clarity', d:'Heatmaps and session recordings', u:'https://clarity.microsoft.com', k:'tool', b:['sdlr','svm'], dom:'clarity.microsoft.com', c:'#ffffff', p:'free' },
  { id:'squarespace', n:'Squarespace Domains', d:'Domain renewal', u:'https://account.squarespace.com/domains', k:'tool', b:['svm'], dom:'squarespace.com', c:'#000000', p:[14,'yr'], note:'Charged $14 on 2026-04-10' },
  { id:'slack', n:'Slack', d:'Team chat', u:'https://app.slack.com', k:'tool', b:['svm'], dom:'slack.com', c:'#4a154b', p:null },
  { id:'zoom', n:'Zoom', d:'Client calls', u:'https://zoom.us', k:'tool', b:['svm'], dom:'zoom.us', c:'#0b5cff', p:null },
  { id:'splashtop', n:'Splashtop Business', d:'Remote into the 24/7 desktop', u:'https://my.splashtop.com', k:'tool', b:['personal','svm'], dom:'splashtop.com', c:'#ffffff', p:null },
  { id:'milanote', n:'Milanote', d:'Mood boards and visual planning', u:'https://app.milanote.com', k:'tool', b:['svm'], dom:'milanote.com', c:'#ffffff', p:null },
  { id:'evernote', n:'Evernote', d:'Notes archive', u:'https://www.evernote.com', k:'tool', b:['personal'], dom:'evernote.com', c:'#00a82d', p:null },
  { id:'cascable', n:'Cascable', d:'Wireless camera control from the Mac', u:'https://cascable.se', k:'tool', b:['svm'], dom:'cascable.se', c:'#ffffff', p:null },
  { id:'fusion', n:'Autodesk Fusion', d:'3D CAD for parts and prints', u:'https://www.autodesk.com/products/fusion-360', k:'tool', b:['personal'], dom:'autodesk.com', c:'#ffffff', p:null },
  { id:'bambu', n:'Bambu Studio', d:'Slicer for the 3D printer', u:'https://bambulab.com/en/download/studio', k:'tool', b:['personal'], dom:'bambulab.com', c:'#ffffff', p:'free' },
  { id:'rocket-money', n:'Rocket Money', d:'Every account and bill in one view; feeds Money Terminal', u:'https://app.rocketmoney.com', k:'tool', b:['personal'], dom:'rocketmoney.com', c:'#e8e8ea', p:[7,'mo'] },
  { id:'spotify', n:'Spotify', d:'Music', u:'https://open.spotify.com', k:'tool', b:['personal'], dom:'spotify.com', c:'#121212', p:null },
  { id:'netflix', n:'Netflix', d:'Shows', u:'https://www.netflix.com', k:'tool', b:['personal'], dom:'netflix.com', c:'#000000', p:[19.99,'mo'] },
  { id:'tesla', n:'Tesla Premium Connectivity', d:'Car data, maps and streaming', u:'https://www.tesla.com/teslaaccount', k:'tool', b:['personal'], dom:'tesla.com', c:'#171a20', p:[16,'mo'] },
  { id:'chrome', n:'Google Chrome', d:'Where Claude in Chrome runs', u:'https://www.google.com/chrome', k:'tool', b:['personal'], dom:'google.com', c:'#ffffff', p:'free' },
  { id:'vlc', n:'VLC', d:'Plays anything', u:'https://www.videolan.org', k:'tool', b:['svm'], dom:'videolan.org', c:'#ffffff', p:'free' },
  { id:'rode', n:'RØDE Central', d:'Mic firmware for the VideoMic NTG', u:'https://rode.com/en/apps/rode-central', k:'tool', b:['svm'], dom:'rode.com', c:'#000000', p:'free' },
  { id:'logi', n:'Logi Options+', d:'Mouse shortcuts. Keep it on at login', u:'https://www.logitech.com/software/logi-options-plus.html', k:'tool', b:['personal'], dom:'logitech.com', c:'#ffffff', p:'free' },
  /* ---------------- From the gio@shiftvisionmedia.com Chrome profile (bookmarks + most visited), 2026-11-02 ---------------- */
  { id:'svm-highlevel', n:'SVM HighLevel', d:'app.shiftvisionmedia.com: the agency CRM, white-labeled GoHighLevel. Most-visited app after Magnific', u:'https://app.shiftvisionmedia.com', k:'tool', b:['svm','sdlr'], dom:'gohighlevel.com', c:'#06344a', p:'incl', note:'Part of the GoHighLevel plan', add:'2026-11-02' },
  { id:'vidlead', n:'VIDLEAD', d:'Social planner (another white-labeled GoHighLevel)', u:'https://studio.vidlead.com/v2/location/cTn4ILTSaCzgqhAhEh47/marketing/social-planner/', k:'tool', b:['svm'], i:'📆', c:'#1d2a3a', p:null, add:'2026-11-02' },
  { id:'stripe', n:'Stripe', d:'Payments and payouts', u:'https://dashboard.stripe.com', k:'tool', b:['svm','sdlr'], dom:'stripe.com', c:'#635bff', p:'usage', add:'2026-11-02' },
  { id:'quickbooks', n:'QuickBooks Online', d:'Books and invoices', u:'https://qbo.intuit.com', k:'tool', b:['svm'], dom:'quickbooks.intuit.com', c:'#2ca01c', p:null, add:'2026-11-02' },
  { id:'smartvault', n:'SmartVault', d:'Document portal with the accountant (Halbert James)', u:'https://halbertjames.smartvault.com/secure/SignIn.aspx', k:'tool', b:['svm','personal'], dom:'smartvault.com', c:'#ffffff', p:'free', add:'2026-11-02' },
  { id:'legalzoom', n:'LegalZoom', d:'Shift Vision Media (CA) business filings', u:'https://www.legalzoom.com/my/account/d9c81186-5593-4c32-a776-1d75afefb512', k:'tool', b:['svm'], dom:'legalzoom.com', c:'#ffffff', p:null, add:'2026-11-02' },
  { id:'notion', n:'Notion', d:'Shift Vision task list and boards', u:'https://www.notion.so/SHIFT-VISION-TASK-LIST-1357fdbd0d1a804c81e7fafaa114c7af', k:'tool', b:['svm'], dom:'notion.so', c:'#ffffff', p:null, add:'2026-11-02' },
  { id:'fb-leads', n:'Facebook Leads List', d:'Daily check-in: new instant-form leads', u:'https://business.facebook.com/latest/instant_forms/forms/', k:'tool', b:['sdlr','svm'], dom:'business.facebook.com', c:'#0866ff', p:'free', add:'2026-11-02' },
  { id:'instagram', n:'Instagram', d:'SDLR and SVM accounts', u:'https://www.instagram.com', k:'tool', b:['sdlr','svm'], dom:'instagram.com', c:'#2b1530', p:'free', add:'2026-11-02' },
  { id:'linkedin', n:'LinkedIn', d:'Profile and posts', u:'https://www.linkedin.com', k:'tool', b:['svm','sdlr'], dom:'linkedin.com', c:'#0a66c2', p:'free', add:'2026-11-02' },
  { id:'youtube', n:'YouTube', d:'Research, tutorials and references', u:'https://www.youtube.com', k:'tool', b:['svm','personal'], dom:'youtube.com', c:'#ffffff', p:'free', add:'2026-11-02' },
  { id:'yt-music', n:'YouTube Music', d:'Music (installed as a Chrome app)', u:'https://music.youtube.com', k:'tool', b:['personal'], dom:'music.youtube.com', c:'#000000', p:null, add:'2026-11-02' },
  { id:'gdocs', n:'Google Docs', d:'Docs, Sheets and Slides', u:'https://docs.google.com', k:'tool', b:['svm','sdlr','personal'], dom:'docs.google.com', c:'#ffffff', p:'free', add:'2026-11-02' },
  { id:'bni-connect', n:'BNI Connect', d:'Chapter roster, referrals and 1-to-1s', u:'https://www.bniconnectglobal.com', k:'tool', b:['svm','sdlr','personal'], dom:'bniconnectglobal.com', c:'#cf2030', p:null, note:'Membership dues', add:'2026-11-02' },
  { id:'chatgpt', n:'ChatGPT', d:'Second-opinion AI next to Claude', u:'https://chatgpt.com', k:'tool', b:['svm','personal'], dom:'chatgpt.com', c:'#ffffff', p:null, add:'2026-11-02' },
  { id:'gemini', n:'Google Gemini', d:'Google AI', u:'https://gemini.google.com/app', k:'tool', b:['svm'], dom:'gemini.google.com', c:'#ffffff', p:null, add:'2026-11-02' },
  { id:'claude-console', n:'Claude Console', d:'API keys and usage for the apps that call Claude', u:'https://platform.claude.com', k:'tool', b:['svm','ksh'], dom:'claude.com', c:'#f0e9e1', p:'usage', add:'2026-11-02' },
  { id:'sora', n:'Sora', d:'OpenAI video generation', u:'https://sora.chatgpt.com/profile', k:'tool', b:['svm'], dom:'sora.chatgpt.com', c:'#000000', p:'incl', note:'Comes with ChatGPT', add:'2026-11-02' },
  { id:'flow', n:'Google Flow', d:'Veo video generation from Google Labs', u:'https://labs.google/fx/tools/flow', k:'tool', b:['svm'], dom:'labs.google', c:'#1a1a2e', p:null, add:'2026-11-02' },
  { id:'envato', n:'Envato Elements', d:'Unlimited stock video, music, templates', u:'https://elements.envato.com', k:'tool', b:['svm'], dom:'envato.com', c:'#1a1a1a', p:null, add:'2026-11-02' },
  { id:'otter', n:'Otter.ai', d:'Call recording and transcripts', u:'https://otter.ai', k:'tool', b:['svm'], dom:'otter.ai', c:'#ffffff', p:null, add:'2026-11-02' },
  { id:'answerthepublic', n:'AnswerThePublic', d:'What people search for, for SEO and content ideas', u:'https://answerthepublic.com/iyhbzq/member/searches', k:'tool', b:['svm','sdlr'], dom:'answerthepublic.com', c:'#ffffff', p:null, add:'2026-11-02' },
  { id:'same-energy', n:'Same Energy', d:'Visual search engine for mood boards', u:'https://same.energy', k:'tool', b:['svm'], dom:'same.energy', c:'#ffffff', p:'free', add:'2026-11-02' },
  { id:'pixlmob', n:'Pixlmob', d:'Real estate photo editing service', u:'https://app.pixlmob.com/dashboard/projects', k:'tool', b:['svm'], dom:'pixlmob.com', c:'#ffffff', p:'usage', add:'2026-11-02' },
  { id:'groove', n:'Groove', d:'Groove.cm marketing suite', u:'https://app.groove.cm', k:'tool', b:['svm'], dom:'groove.cm', c:'#ffffff', p:null, add:'2026-11-02' },
  { id:'supabase', n:'Supabase', d:'Database behind the SDLR Command Center', u:'https://supabase.com/dashboard', k:'tool', b:['sdlr'], dom:'supabase.com', c:'#1c1c1c', p:null, add:'2026-11-02' },
  { id:'zapier', n:'Zapier', d:'Automations between apps', u:'https://zapier.com/app/zaps', k:'tool', b:['svm','sdlr'], dom:'zapier.com', c:'#ff4f00', p:null, add:'2026-11-02' },
  { id:'formspree', n:'Formspree', d:'Contact forms on the client sites', u:'https://formspree.io/forms', k:'tool', b:['svm'], dom:'formspree.io', c:'#ffffff', p:null, add:'2026-11-02' },
  { id:'featurable', n:'Featurable', d:'Google review widgets on the sites', u:'https://app.featurable.com', k:'tool', b:['svm','sdlr'], dom:'featurable.com', c:'#ffffff', p:null, add:'2026-11-02' },
  { id:'gcloud', n:'Google Cloud Console', d:'APIs and keys (Maps, Drive connections)', u:'https://console.cloud.google.com', k:'tool', b:['svm','sdlr'], dom:'cloud.google.com', c:'#ffffff', p:'usage', add:'2026-11-02' },
  { id:'pagespeed', n:'PageSpeed Insights', d:'Speed score for any site', u:'https://pagespeed.web.dev', k:'tool', b:['svm','sdlr'], dom:'web.dev', c:'#ffffff', p:'free', add:'2026-11-02' },
  { id:'adobe-fonts', n:'Adobe Fonts', d:'Fonts for brand work', u:'https://fonts.adobe.com', k:'tool', b:['svm'], dom:'fonts.adobe.com', c:'#2b0a0a', p:'incl', note:'Comes with Creative Cloud', add:'2026-11-02' },
  { id:'gotprint', n:'GotPrint', d:'Print runs: cards, flyers, door hangers', u:'https://www.gotprint.com', k:'tool', b:['sdlr','svm'], dom:'gotprint.com', c:'#ffffff', p:'usage', add:'2026-11-02' },
  { id:'signs-com', n:'Signs.com', d:'Yard signs and banners', u:'https://www.signs.com', k:'tool', b:['sdlr'], dom:'signs.com', c:'#ffffff', p:'usage', add:'2026-11-02' },
  { id:'tinkercad', n:'Tinkercad', d:'Simple 3D design for prints', u:'https://www.tinkercad.com/dashboard', k:'tool', b:['personal'], dom:'tinkercad.com', c:'#ffffff', p:'free', add:'2026-11-02' },
  { id:'makerworld', n:'MakerWorld', d:"Gio's 3D print collections", u:'https://makerworld.com/en/@GioAzzarello/collections', k:'tool', b:['personal'], dom:'makerworld.com', c:'#ffffff', p:'free', add:'2026-11-02' },
  { id:'printables', n:'Printables', d:'Free 3D print models', u:'https://www.printables.com/model', k:'tool', b:['personal'], dom:'printables.com', c:'#ffffff', p:'free', add:'2026-11-02' },
  { id:'thingiverse', n:'Thingiverse', d:'More free 3D print models', u:'https://www.thingiverse.com', k:'tool', b:['personal'], dom:'thingiverse.com', c:'#ffffff', p:'free', add:'2026-11-02' }
];
