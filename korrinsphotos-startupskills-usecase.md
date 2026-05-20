▗ ▗   ▖ ▖  Claude Code v2.1.126
           Opus 4.7 · Claude Max
  ▘▘ ▝▝    ~/Documents/GitHub/korrinsphotos

❯ /plugin marketplace add quinnhall07/startup-skills                            
  ⎿  Successfully added marketplace: startup-skills

❯ /plugin install startup-skills@startup-skills                                 
  ⎿  Plugin 'startup-skills@startup-skills' is already installed globally. Use
     '/plugin' to manage existing plugins.

❯ Do a complete audit of this repo to establish context for startup skills.     
  Dispatch subagents to collect context on the repo. Begin orientation document 
   of this business.                                                            

⏺ Skill(startup-skills:orientation)
  ⎿  Successfully loaded skill

  Read 3 files, listed 1 directory (ctrl+o to expand)

⏺ Caveman mode active. No prior state. Dispatching parallel audits before
  orientation.

⏺ 4 Explore agents finished (ctrl+o to expand)
   ├ Business model + monetization audit · 17 tool uses · 95.3k tokens
   │ ⎿  Done
   ├ Product feature inventory + maturity · 14 tool uses · 71.3k tokens
   │ ⎿  Done
   ├ Target customer + niche signals · 20 tool uses · 86.2k tokens
   │ ⎿  Done
   └ Evidence of usage + maturity signal · 12 tool uses · 55.7k tokens
     ⎿  Done

⏺ Audit done. Writing orientation doc from code-inferred context. Founder hasn't
   spoken yet — flagging assumptions.

⏺ Write(.claude/startup-state.md)
  ⎿  Wrote 120 lines to .claude/startup-state.md
      2 _Last updated: 2026-05-19 by orientation_05-19
      4 _Schema version: 1.0_
      5 > **NOTE — context source.** This file was initialized by auditin
        inferred from code]` is a hypothesis, not a fact. Founder must co
        nfirm or correct on next pass through `founder-context`.
      7 ## Founder Profile
        Builder identity ambiguous — git user shows "Quinn Hall", system 
        user email `quinn.hall.scho@gmail.com` / `quinnhall07`. Confirm 
        r, or both.rin is the operator-founder, the builder is a cofounde
      9 - Domain expertise: photography — 
     … +206 lines (ctrl+o to expand)

⏺ Doc written. Now system intro + orientation question.

  ---
  Startup Skills = Aggressive Epistemic Auditor for founders. Direct,
  evidence-driven, willing to call tar pits tar pits. Human role: sell, build
  relationships, commit. My role: read the codebase, run bias checks, never tire
   of pushback. All decisions live in .claude/startup-state.md so we never
  re-explain context.

  Audit summary — what code says, not what you said:

  - Product: Korrin's Photos — boutique editorial photographer, Raleigh-Durham
  NC. Six session types ($450–$3,500). Digital products store
  (presets/courses/ebooks). Hand-built Next.js 15 + Firebase + Stripe + R2 CRM.
  12 feature waves shipped May 2026. 96 commits in 12 days. Domain
  korrinsphotos.com wired.
  - Status: Operationally live. Stripe webhooks, cron, email tracking, NPS,
  referral engine all running. No customer counts visible.
  - Claims on landing page: 340 sessions / 12 yr / 98% satisfaction → weighted 
  0.0 as evidence. Marketing copy ≠ data. Need real Firestore numbers.
  - Identity ambiguity flagged: brand name "Korrin", git author "Quinn Hall",
  system user quinnhall07. Confirm who's who.
  - Core question the code can't answer: Is this a photographer's business with
  great software, or photographer-SaaS being dogfooded by Korrin first?
  Different game, different riskiest assumption, different next move.

  Full inferred state at .claude/startup-state.md. Read it, correct what's
  wrong.

  ---
  Where you actually right now?

  1. No idea, want start something.
  2. Have idea, want pressure-test.
  3. Been talking potential customers.
  4. Built something, need first customers.
  5. Have customers, stuck — considering pivot.

  Code suggests 4 or 5. You tell me. Type /skill founder-context after, or just
  answer + I route.

✻ Cooked for 3m 21s

❯ Let's go over the business as it stands. It's a photography business. This is 
   the website for the photography business with a full admin page that allows  
  it to look over its entire userbase and host images. From a business          
  perspective, where can we improve? What are our next steps for a business     
  that's just starting up?                                                      

⏺ Resolved ambiguity. Updating state doc, then giving sharp answer not buffet.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 2 lines, removed 1 line
      16  
      17  ## One-Liner (versioned)
      18  - v1 (2026-05-19, inferred from code): "Boutique editorial phot
          ographer in the Raleigh-Durham triangle running her business on
           a custom-built CRM that handles booking, contracts, invoicing,
           galleries, and a digital products shop in one workspace."
      19 -- Current: v1 — needs founder confirmation. Open question: is t
         -his **a photography business** that happens to have great softw
         -are, or **photographer SaaS** being dogfooded by Korrin first? 
         -The answer changes everything.                                 
      19 +- v2 (2026-05-19, founder-confirmed): "Photography business. We
         +bsite + internal admin for client/image management. Not a SaaS,
         + not productizing the platform — software is overhead, not the 
         +product."                                                      
      20 +- Current: v2. SaaS question resolved — closed. Software is a c
         +ost center; revenue is sessions + (maybe) digital products.    
      21  
      22  ## Current Hypothesis
      23  "We believe [customer type] experiences [problem] when [situati
          on] and will [behavior change] because [insight]."

⏺ Update(.claude/startup-state.md)
  ⎿  Added 1 line
      119  
      120  ## Session Log
      121  - 2026-05-19 orientation — initialized state from a 4-subagent
            repo audit (business model, feature inventory, ICP signal, pr
           oduction maturity). No founder interview yet; everything tagge
           d as inferred. Pending founder answer to the 5-option orientat
           ion question; provisional route is `founder-context` → `outrea
           ch-engine`.
      122 +- 2026-05-19 orientation — founder confirmed: this is a photog
          +raphy business, not photographer-SaaS. Software is internal ov
          +erhead. Founder framed self as "just starting up" while landin
          +g-page copy claims 340 sessions / 12 years — contradiction fla
          +gged; must reconcile before any growth strategy. Next: founder
          +-context (clarify what "just starting up" actually means), the
          +n outreach-engine.                                            

⏺ ---
  Reframe first. Question wrong.

  "Where can we improve" + "just starting up" — buffet question. Refusing buffet
   answer. Two contradictions to resolve before any priority list:

  Contradiction 1: "just starting up" vs. landing page.
  app/page.tsx:102 says 340+ sessions, 12 years, 98% satisfaction. Either:
  - (a) Real → not starting up, relaunching. Different game.
  - (b) Aspirational copy → lying on homepage. Delete or replace today. False
  social proof is the fastest way to torch a boutique brand when caught.
  Pick one. Tell me which.

  Contradiction 2: Built vs. proven.
  12 waves shipped. 96 commits in 12 days. Stripe live, cron live, NPS live,
  referral engine live, digital store live. Code suggests Series-A operations.
  Founder language suggests pre-revenue. Likely: 80% of the platform was built 
  before demand was proven. That's sunk cost. Don't write another feature until
  demand is real.

  ---
  Hard facts before recommendations

  I can't responsibly tell you "improve X" without these. Pull and report:

  1. Last 90 days: paid invoice count + gross revenue. (Firestore invoices where
   status=PAID.)
  2. Last 90 days: inquiries submitted via /booking. Conversion rate from
  inquiry → paid deposit.
  3. Digital store since launch: purchase count + gross.
  4. Source breakdown: firstTouchSource distribution on clients docs (you wired
  this in middleware — use it).
  5. NPS distribution if any galleries delivered.

  These five numbers replace every assumption. I'll route the queries when you
  say go.

  ---
  Provisional priorities (anchored to evidence we have)

  Hold these loosely until the five numbers land.

  1. Stop building. No more waves. Every hour on code = hour not selling.
  Software is done-enough.
  2. Pick ONE acquisition channel + commit 12 weeks. Code supports IG, Google,
  Pinterest, referral, vendor reciprocity, lead magnets, local SEO. Solo
  operator runs one well, not six poorly. The audit showed 7 NC city pages,
  vendor reciprocity tracker, referral engine, Instagram-aware UTM, lead-magnet
  system — that's six bets with zero focus. Pick the one tied to most likely
  buyers.
  3. Kill or shelve the shop until sessions hit cadence. Presets/courses sell
  well to audiences. Audience comes after demand on core service. Shipping shop
  now = energy split. (See Stripe webhook in
  app/api/webhooks/stripe/route.ts:295-408 — fully wired, probably never used.
  Confirm.)
  4. Fix the landing page contradiction (above).
  5. Set a 90-day kill criterion. Choose now, in writing: "If bookings < N/month
   by [date], change [pricing / channel / niche]." Without this, you'll drift
  another year.

  ---
  Forcing question, single answer

  What's your monthly paid-booking target for the next 90 days, and what's the
  current monthly rate? Numbers. Not "more."

  Once answered, run /skill founder-context — properly load your background
  (technical ability, runway, time horizon, why-now), then /skill 
  outreach-engine to actually do funnel math backwards from that target.

✻ Crunched for 1m 6s

❯ The info on the site is mostly fake, waiting to be filled in with real data.  
  This is just a work in progress site, should be done in about a week. The     
  booking target for the next 90 days is maybe a session or 2 a week? We've     
  only got 2 photographers, both amateur students. As of right now, we only     
  have about 1 client a month, but we haven't been searching a lot since school 
   just got out.                                                                

⏺ Huge reframe. Updating state doc, then telling you what you don't want to
  hear.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 9 lines, removed 8 lines
       5  > **NOTE — context source.** This file was initialized by audit
          ing the repo, not by founder interview. Every field below marke
          d `[inferred from code]` is a hypothesis, not a fact. Founder m
          ust confirm or correct on next pass through `founder-context`.
       6  
       7  ## Founder Profile
       8 -- Name (optional): Korrin (operator / photographer brand owner)
         -. Builder identity ambiguous — git user shows "Quinn Hall", sys
         -tem user email `quinn.hall.scho@gmail.com` / `quinnhall07`. Co
         -nfirm whether Korrin is the operator-founder, the builder is a 
         -cofounder, or both.                                            
       9 -- Domain expertise: photography — 12 years claimed, 340+ sessio
         -ns claimed (`app/page.tsx:102`). Both numbers are marketing cop
         -y on a private codebase; treat as self-reported until corrobora
         -ted.                                                           
      10 -- Technical ability: has team capability — 96 commits in 12 day
         -s (May 3–14, 2026) shipping a deep Next.js 15 / Firebase / Stri
         -pe / R2 / Cloudflare Images stack. Either the founder is techni
         -cal or has a builder in the seat. **Confirm.**                 
      11 -- Time horizon to MVP: MVP already shipped. Branch `Phase-1-MVP
         -` active. 12 waves of features merged. Domain `korrinsphotos.co
         -m` referenced in sitemap + email fallbacks (`app/sitemap.ts`). 
      12 -- Resource reality: solo contributor visible in `git shortlog`.
         - No CI, zero tests. Unknown if salary/runway-funded or nights-a
         -nd-weekends.                                                   
      13 -- Startup archetype: **services-to-product hybrid** — photo ser
         -vices (per-session) + digital products store (presets, courses,
         - ebooks via `/shop`).                                          
      14 -- Starting point: **product built, pre-traction OR very-early t
         -raction** — operationally live (Stripe webhooks, cron, email tr
         -acking, NPS) but no visible customer counts in code, no public 
         -customer logos, no testimonial DB rows referenced.             
      15 -- Risk tolerance: unknown.                                     
       8 +- Name (optional): Korrin (brand). Two cofounders, both photogr
         +aphers. Builder identity still unresolved — confirm in `founder
         +-context`.                                                     
       9 +- Domain expertise: **amateur students.** No 12-year veteran. L
         +anding-page copy (340 sessions / 12 yr / 98%) is **placeholder,
         + fake, to be replaced.** Real experience level: student-amateur
         +.                                                              
      10 +- Technical ability: at least one cofounder (or commissioned bu
         +ilder) shipped a 12-wave Next.js stack solo in 12 days. High te
         +chnical capacity relative to team size.                        
      11 +- Time horizon: site goes live ~1 week (2026-05-26 ±).         
      12 +- Resource reality: 2 student cofounders. Likely nights+weekend
         +s; school just let out so summer block available. Runway/saving
         +s unknown.                                                     
      13 +- Startup archetype: **consumer services — photography studio (
         +boutique brand voice, amateur talent).**                       
      14 +- Starting point: **pre-launch + pre-traction.** Currently ~1 c
         +lient / month (likely friends/network). Target stated: 1–2 sess
         +ions / week (≈ 4–8 / month). That's a 4–8× jump.               
      15 +- Risk tolerance: unknown. Students often have asymmetric upsid
         +e (low burn) but limited capital for paid acquisition.         
      16 +- **Cofounder-fit flag:** Two-cofounder team. Need cofounder-fi
         +t conversation before scaling spend or commitments — equity spl
         +it, vesting, specialization, who-owns-what. YC rule: work-toget
         +her-first, near-equal equity, vesting non-negotiable.          
      17  
      18  ## One-Liner (versioned)
      19  - v1 (2026-05-19, inferred from code): "Boutique editorial phot
          ographer in the Raleigh-Durham triangle running her business on
           a custom-built CRM that handles booking, contracts, invoicing,
           galleries, and a digital products shop in one workspace."

⏺ Update(.claude/startup-state.md)
  ⎿  Added 1 line
      121  ## Session Log
      122  - 2026-05-19 orientation — initialized state from a 4-subagent
            repo audit (business model, feature inventory, ICP signal, pr
           oduction maturity). No founder interview yet; everything tagge
           d as inferred. Pending founder answer to the 5-option orientat
           ion question; provisional route is `founder-context` → `outrea
           ch-engine`.
      123  - 2026-05-19 orientation — founder confirmed: this is a photog
           raphy business, not photographer-SaaS. Software is internal ov
           erhead. Founder framed self as "just starting up" while landin
           g-page copy claims 340 sessions / 12 years — contradiction fla
           gged; must reconcile before any growth strategy. Next: founder
           -context (clarify what "just starting up" actually means), the
           n outreach-engine.
      124 +- 2026-05-19 orientation — **major reframe.** 340 sessions / 1
          +2 yr / 98% = placeholder copy (founder confirmed). Real team: 
          +2 student-amateur photographer cofounders. Current rate: ~1 cl
          +ient/month (~friends/network). 90-day target: 4–8 sessions/mon
          +th (4–8× growth). Site goes live ~1 wk. Code/infra is roughly 
          +100× over-engineered vs. demand stage. Provisional route: `fou
          +nder-context` → `cofounder-fit` (two-student team needs equity
          +/specialization clarity) → `problem-focus` (niche down from 6 
          +session types) → `outreach-engine`.                           

⏺ ---
  Honest read

  Different business than the audit suggested. New facts change everything.
  Telling you straight:

  1. Scale mismatch — you built a Boeing for a paper-airplane mission

  12-wave CRM. Stripe webhooks. Sales-tax engine across 12 states. Press-link
  monitoring. Compliance dashboard. MACRS depreciation. Vendor reciprocity.
  Referral chain graph.

  You have 1 client/month. Most of this codebase will be unused for years, if
  ever. This is founder procrastination via engineering — a known anti-pattern.
  Building is comfortable; selling is scary. Code does not produce demand.

  Not telling you to delete it. Telling you: stop adding to it. Zero new
  features until 5 paid clients/month sustained for 3 months. Software is done.

  2. Pricing is fiction

  app/investment/packages.ts: Mini $450, Story $1,250, The Day $3,500.

  Two amateur students cannot command $3,500/day in Raleigh-Durham. The Day
  pricing requires a portfolio of 30+ comparable shoots + brand reputation +
  2nd-shooter team. You have neither.

  Even $450 Mini is contested ground — established Raleigh photographers price
  $300-$600 portraits with portfolios proving competence. An unknown student
  photographer at $450 loses every coin-flip to an unknown student at $150 or a
  known photographer at $400.

  Reality path:
  - Months 0-6: $0-$150 portfolio sessions. Free for the right subjects. Goal is
   30-50 keeper images, not revenue. Charge enough that subjects show up + don't
   no-show; not enough that they expect veteran results.
  - Months 6-12: $150-$300 once portfolio supports it.
  - Months 12-24: $300-$600 if niche traction.
  - The Day at $3,500: 2-3 years minimum, or never (most boutique photographers
  never reach it).

  You can keep aspirational pricing on the site IF you also have a $0-$150
  "model call / portfolio session" funnel. Right now the floor is $450 and
  there's no way in.

  3. Six session types kills you

  BookingFormSteps.tsx:31-37: Wedding / Engagement / Family / Portrait /
  Editorial / Commercial.

  Generalist amateur vs. specialist amateur — specialist wins. Always.

  Pick one for the next 6 months. The right answer depends on:
  - Where the two of you are visibly better than peers (look at your own
  existing photos honestly)
  - Which subjects you can reach 50 of in 90 days
  - Which has lowest "trust required" — Wedding = highest trust = worst for
  amateurs; senior portraits / family / pets / events = lower trust = better
  entry

  Suggestion ranking for amateur students in Raleigh-Durham:
  1. College senior portraits — students photographing students. Native
  distribution (campus, IG). Repeats every spring. Lowest stakes.
  2. Family / lifestyle — high volume, lower trust bar than weddings.
  3. Couples / engagement — non-wedding pressure, builds wedding portfolio.
  4. Skip Wedding + Editorial + Commercial until 18+ months in.

  4. First 10 clients are won by founders, not funnels

  Dalton, repeated until founders listen: early demand comes from direct 
  outreach, not channels.

  You have one channel right now and it's free: the two cofounders' personal 
  networks + every friend-of-friend. That's where the next 5 clients come from.
  Not Pinterest. Not Local SEO. Not lead magnets. Not Instagram autopilot.

  90 days, concrete:
  - Each cofounder lists 50 named humans in their phones who could either book
  or refer.
  - Each sends personal DMs (not posts) offering a free or $99 portfolio session
   for the next 30 days. Specific date offers, not "let me know if interested."
  - Tracker = a Google Sheet, not the CRM. The CRM is for clients-after-paid.
  - Goal: 8-12 free/cheap shoots in 30 days. Of those, 2-4 become real
  referrers.

  If the founders cannot generate any demand from their own networks at $99, the
   market signal is: refine the offer (niche, photo style, subject) before
  spending a dollar on ads or SEO.

  5. Two-cofounder warning

  Two student photographers sharing a brand. Before any of this matters, settle:
  - Equity split — near 50/50 unless one has materially more skin (capital,
  prior work, full-time vs part-time). Hard conversation; have it now while it's
   free.
  - Vesting — 4-year, 1-year cliff. Non-negotiable. If your cofounder quits in
  month 6 with 50% they keep nothing. Without vesting they walk away with half
  the company.
  - Specialization — who shoots what, who edits, who runs the business side. Two
   photographers both shooting + both editing + both replying to inquiries =
  three-headed turtle.
  - Brand name — "Korrin's Photos" implies one person. If both cofounders are
  partners and there is no "Korrin," that's a story problem at minimum and a
  fairness problem at worst. Resolve.

  Run /skill cofounder-fit after /skill founder-context.

  6. Site launches in 1 week — top 3 fixes before live

  Not "where can we improve" — top 3:
  1. Delete the fake stats. 340 / 12 / 98% off the landing page before launch.
  If a real client lands and finds it's a student-amateur brand misrepresenting
  tenure, that's a refund + bad review + a tarnished brand year one.
  2. Add a $0-$150 entry offer. Without it, no path in for anyone who isn't
  already convinced. "Portfolio session," "model call," whatever. Soft entry.
  3. Soft-launch the niche. If senior portraits is the play, the home page hero
  is a senior portrait. Not generalist mosaic.

  7. What I want from you before next move

  Six numbers + four answers:

  1. Who are the two cofounders — names, who codes, who shoots primary, who
  shoots secondary?
  2. Both students at same school? Where? Raleigh-Durham still right geography?
  3. Of the ~1 client/month for the last N months — paid what, found you how,
  repeat or one-off?
  4. What's the runway / monthly burn? (Probably tiny since students — confirm.)
  5. Pick the one session type you'll lead with for 6 months. Gut answer, defend
   it.
  6. How many keeper-quality shots in each photographer's portfolio right now?
  7. Any of your photos been seen by 1,000+ people outside your social circle?
  Yes/No.
  8. Single most important goal in 90 days — money (revenue $X), portfolio (Y
  shoots), or audience (Z followers)? Pick one. Three goals = zero goals.

  Answer those. Then /skill founder-context to lock the profile, /skill 
  cofounder-fit to settle equity/specialization, /skill problem-focus to pick
  the niche, /skill outreach-engine to plan the 50-person outreach push.

  Order matters. Don't skip ahead.

✻ Sautéed for 2m 7s

❯ Let me elaborate on the team. The original photographer is Korrin. I (Quinn)  
  am the coder of the website and all that. The other photographer is DyLon.    
  He's the new one. We decided to take him on since we're all attending         
  University of Alabama next year and we want to expand the business (starting  
  with the website). We're actually from Louisville, Kentucky. The Raleigh      
  stuff is filler from AI build. The clients each month paid roughly $40 an     
  hour. They were friends or family. We're not losing any money from this so    
  far. We'll probably do photos for dances and graduations. Or just general     
  photoshoots for people who want them. Probably around 500 really good photos  
  that would meet the team's standards at the highest level. The most important 
   goal is making the website fully functional and building an audience. That   
  way, when we get to Bama, we can springboard off of that.                     
⏺ Updating state doc, then reframing. This is actually a much better setup than
  the prior facts suggested.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 13 lines, removed 9 lines
       5  > **NOTE — context source.** This file was initialized by audit
          ing the repo, not by founder interview. Every field below marke
          d `[inferred from code]` is a hypothesis, not a fact. Founder m
          ust confirm or correct on next pass through `founder-context`.
       6  
       7  ## Founder Profile
       8 -- Name (optional): Korrin (brand). Two cofounders, both photogr
         -aphers. Builder identity still unresolved — confirm in `founder
         --context`.                                                     
       9 -- Domain expertise: **amateur students.** No 12-year veteran. L
         -anding-page copy (340 sessions / 12 yr / 98%) is **placeholder,
         - fake, to be replaced.** Real experience level: student-amateur
         -.                                                              
      10 -- Technical ability: at least one cofounder (or commissioned bu
         -ilder) shipped a 12-wave Next.js stack solo in 12 days. High te
         -chnical capacity relative to team size.                        
      11 -- Time horizon: site goes live ~1 week (2026-05-26 ±).         
      12 -- Resource reality: 2 student cofounders. Likely nights+weekend
         -s; school just let out so summer block available. Runway/saving
         -s unknown.                                                     
      13 -- Startup archetype: **consumer services — photography studio (
         -boutique brand voice, amateur talent).**                       
      14 -- Starting point: **pre-launch + pre-traction.** Currently ~1 c
         -lient / month (likely friends/network). Target stated: 1–2 sess
         -ions / week (≈ 4–8 / month). That's a 4–8× jump.               
      15 -- Risk tolerance: unknown. Students often have asymmetric upsid
         -e (low burn) but limited capital for paid acquisition.         
      16 -- **Cofounder-fit flag:** Two-cofounder team. Need cofounder-fi
         -t conversation before scaling spend or commitments — equity spl
         -it, vesting, specialization, who-owns-what. YC rule: work-toget
         -her-first, near-equal equity, vesting non-negotiable.          
       8 +- Team (3 cofounders):                                         
       9 +  - **Korrin** — original photographer, brand namesake.        
      10 +  - **DyLon** — photographer, newest addition (taken on specifi
         +cally for the Bama expansion).                                 
      11 +  - **Quinn (user)** — full-stack engineer, owns the website + 
         +admin. Non-photographer cofounder.                             
      12 +- Domain expertise: photographers = amateur students with serio
         +us shooting hours (~500 photos meeting the team's top quality b
         +ar in current portfolio). Builder = strong (shipped 12-wave Nex
         +t.js / Firebase / Stripe / R2 stack solo in ~12 days).         
      13 +- Technical ability: dedicated engineer cofounder — rare advant
         +age for a photo studio at this stage. Don't waste it.          
      14 +- Time horizon: site live in ~1 week (~2026-05-26). All three m
         +ove to **University of Alabama (Tuscaloosa)** for the upcoming 
         +academic year (Fall 2026). Two operating phases: **Summer in Lo
         +uisville → Fall onward in Tuscaloosa.**                        
      15 +- Resource reality: 3 student cofounders, summer block free, "n
         +ot losing money" at the current scale ($40/hr × ~1 client/mo). 
         +No external capital noted.                                     
      16 +- Startup archetype: **consumer services — student-run boutique
         + photography brand, college-town focus.**                      
      17 +- Starting point: **pre-launch website, pre-audience, modest ne
         +twork revenue.** ~1 client/month at $40/hr, friends/family.    
      18 +- Risk tolerance: low capital exposure (nights+weekends, school
         + commitments incoming), high time investment available pre-Bama
         +.                                                              
      19 +- **Geography correction:** Currently **Louisville, KY.** All R
         +aleigh-Durham / Cary / NC content in the codebase is AI build f
         +iller — **delete or replace** before launch. Future market: **T
         +uscaloosa, AL** (Bama) from Fall 2026.                         
      20 +- **Cofounder structure flag:** 3-way split. Engineer + 2 photo
         +graphers is an asymmetric contribution problem (engineer ships 
         +once, photographers ship per shoot forever). Settle equity + ve
         +sting + role definitions before launch. Run `cofounder-fit`.   
      21  
      22  ## One-Liner (versioned)
      23  - v1 (2026-05-19, inferred from code): "Boutique editorial phot
          ographer in the Raleigh-Durham triangle running her business on
           a custom-built CRM that handles booking, contracts, invoicing,
           galleries, and a digital products shop in one workspace."

⏺ Update(.claude/startup-state.md)
  ⎿  Added 2 lines, removed 1 line
      22  ## One-Liner (versioned)
      23  - v1 (2026-05-19, inferred from code): "Boutique editorial phot
          ographer in the Raleigh-Durham triangle running her business on
           a custom-built CRM that handles booking, contracts, invoicing,
           galleries, and a digital products shop in one workspace."
      24  - v2 (2026-05-19, founder-confirmed): "Photography business. We
          bsite + internal admin for client/image management. Not a SaaS,
           not productizing the platform — software is overhead, not the 
          product."
      25 -- Current: v2. SaaS question resolved — closed. Software is a c
         -ost center; revenue is sessions + (maybe) digital products.    
      25 +- v3 (2026-05-19, founder-confirmed): "Korrin's Photos is a 3-c
         +ofounder student-run photography studio launching out of Louisv
         +ille, KY this summer and relocating to Tuscaloosa, AL for the U
         +niversity of Alabama in Fall 2026 — using the Bama move as a sp
         +ringboard for paid event, dance, graduation, and portrait work 
         +in one of the largest college / Greek-life markets in the South
         +."                                                             
      26 +- Current: v3.                                                 
      27  
      28  ## Current Hypothesis
      29  "We believe [customer type] experiences [problem] when [situati
          on] and will [behavior change] because [insight]."

⏺ Update(.claude/startup-state.md)
  ⎿  Added 6 lines, removed 6 lines
      32  - Pre-committed success criterion: not set.
      33  
      34  ## Target Customer (ICP)
      35 -- Role/type: [inferred] — couples (wedding/engagement), individ
         -uals + families (portrait), brands (commercial/editorial). Book
         -ing form gates by these six session types (`components/booking/
         -BookingFormSteps.tsx:31-37`).                                  
      36 -- Company/context: consumer for 5 of 6 paths; B2B for the Comme
         -rcial path (Wave 9 added a 15-question commercial brand brief q
         -uestionnaire).                                                 
      37 -- Current workaround: not documented in code — needs discovery 
         -research.                                                      
      38 -- Signs of urgency observed: none in repo. NPS collection exist
         -s (`clientNps`), but no aggregated numbers surfaced.           
      39 -- Where to find them (specific): geographically Raleigh / Durha
         -m / Cary / Chapel Hill / Asheville / Wilmington / Charlotte — W
         -ave-10 local-SEO module ships 7 NC city landing pages (`/locati
         -ons/[citySlug]`). Channel acquisition stack: Instagram (mention
         -ed in middleware UTM source detection), Google, Pinterest (UGC 
         -pin module stubbed, blocked on Graph API), referrals (tiered $5
         -0/$100/mini-session/album rewards), vendor reciprocity.        
      40 -- Buyer vs. user distinction: for Commercial, buyer = brand dec
         -ision-maker, user = same. For consumer, buyer = client. No B2B 
         -sales-cycle infrastructure visible (no SDR pipeline, no enterpr
         -ise contracts).                                                
      35 +- **Phase 1 (Summer 2026, Louisville):** local Louisville-area 
         +subjects — graduating seniors (Class of 2026 portraits), upcomi
         +ng-senior portfolio shoots (Class of 2027), summer dance recita
         +ls, family/couple casual sessions. Friends-of-friends warm chai
         +n.                                                             
      36 +- **Phase 2 (Fall 2026+, Tuscaloosa):** **college-town events**
         + — Greek-life formals (sorority + fraternity, ~36 sororities + 
         +~30 fraternities = ~130+ events/yr), bid day / recruitment, swa
         +ps, mixers, game-day tailgates, senior portraits for graduating
         + Bama students, organic-growth wedding work later.             
      37 +- Current workaround: subjects either hire a known local pro (e
         +xpensive), use their iPhone, ask a friend with a camera, or ski
         +p having pro photos altogether. Amateur-student pricing fills a
         + real gap for non-luxury events.                               
      38 +- Where to find them: Phase 1 = Louisville HS networks, dance s
         +tudios, IG referrals. Phase 2 = Bama Greek-life chapter executi
         +ves (philanthropy / social chairs), bid day, freshman move-in. 
         +Greek formal photography is a known repeat-revenue category — c
         +hapter relationships, not one-off clients.                     
      39 +- Buyer vs. user distinction: for formals, **buyer = chapter ex
         +ec / parent / event committee, user = attendees.** Different se
         +ll.                                                            
      40 +- Channels: Instagram primary. Pinterest secondary (real distri
         +bution for senior portraits + portrait work). TikTok for behind
         +-the-scenes / edit reels. Direct outreach via DM to chapter exe
         +cs once at Bama. Local SEO is **not** the play pre-Bama and onl
         +y marginal once there.                                         
      41  
      42  ## Evidence Log
      43  | # | Date | Source | Quote/Observation | Type | Weight | Notes
           |

⏺ Update(.claude/startup-state.md)
  ⎿  Added 1 line
      127  - 2026-05-19 orientation — initialized state from a 4-subagent
            repo audit (business model, feature inventory, ICP signal, pr
           oduction maturity). No founder interview yet; everything tagge
           d as inferred. Pending founder answer to the 5-option orientat
           ion question; provisional route is `founder-context` → `outrea
           ch-engine`.
      128  - 2026-05-19 orientation — founder confirmed: this is a photog
           raphy business, not photographer-SaaS. Software is internal ov
           erhead. Founder framed self as "just starting up" while landin
           g-page copy claims 340 sessions / 12 years — contradiction fla
           gged; must reconcile before any growth strategy. Next: founder
           -context (clarify what "just starting up" actually means), the
           n outreach-engine.
      129  - 2026-05-19 orientation — **major reframe.** 340 sessions / 1
           2 yr / 98% = placeholder copy (founder confirmed). Real team: 
           2 student-amateur photographer cofounders. Current rate: ~1 cl
           ient/month (~friends/network). 90-day target: 4–8 sessions/mon
           th (4–8× growth). Site goes live ~1 wk. Code/infra is roughly 
           100× over-engineered vs. demand stage. Provisional route: `fou
           nder-context` → `cofounder-fit` (two-student team needs equity
           /specialization clarity) → `problem-focus` (niche down from 6 
           session types) → `outreach-engine`.
      130 +- 2026-05-19 orientation — **team & geography clarified.** 3 c
          +ofounders: Korrin (photo, brand namesake), DyLon (photo, newes
          +t), Quinn (engineer / website owner — current user). Based Lou
          +isville, KY; all three moving to University of Alabama (Tuscal
          +oosa) Fall 2026. All NC city content in repo = AI build filler
          + to delete. Current revenue: ~$40/hr × ~1 client/mo = friends/
          +family rate. Portfolio: ~500 keeper-quality images. Stated goa
          +l: site fully functional + audience-building this summer as **
          +springboard for the Bama relocation.** Likely-niche pivot: dan
          +ces, graduations, general portraits → Greek-life formals + sen
          +ior portraits + game-day work at Bama. Revenue is NOT the 90-d
          +ay priority — **portfolio + audience are.** Provisional route:
          + `founder-context` → `cofounder-fit` (3-way equity, engineer-v
          +s-photographer asymmetry) → `problem-focus` (lock Phase-1 vs P
          +hase-2 ICP) → `mvp-architect` (cut the codebase to launch scop
          +e) → `outreach-engine` (Phase-1 Louisville push + Phase-2 Bama
          + pre-positioning).                                            

⏺ ---
  New read — much better setup than first audit suggested

  Three things change the picture:

  1. You have a real unfair advantage. Most student photographers don't have a
  full-time engineer cofounder. Quinn shipping 12 waves in 12 days is rare.
  Don't waste it on more features — waste it on leverage.
  2. The Bama move is the actual business. Louisville summer = practice /
  portfolio / audience priming. Tuscaloosa fall = the real market. Plan the
  whole 18 months backwards from "Day 1 at Bama with a portfolio and audience
  that books chapters before you unpack."
  3. 500 keeper-quality photos is a real portfolio. Not amateur-zero. That's
  enough to sell from — if it's published and curated. Right now it isn't.

  ---
  The actual prize: Bama Greek-life formal photography

  Saying this clearly because it changes everything:

  University of Alabama has ~36 Panhellenic sororities + ~30 IFC fraternities
  plus NPHC + MGC. Each chapter typically runs 2–4 photo-relevant events per 
  year — formals, semi-formals, mixers, bid day, sisterhood retreats,
  philanthropy, senior nights. Conservative math: 100–250 chapter events/year,
  each with 50–300 attendees who tag photos, buy prints, or repost.

  Greek-life formal photography is a known recurring niche. Most college towns
  have 1–3 photographers who own it. Tuscaloosa has competitors but it's not
  saturated and freshman-year photographers can break in by landing 1–2 chapters
   via personal connection then snowballing through chapter-rec channels.

  This niche fits you almost perfectly:
  - Subjects are your peers → easy social/cultural fluency
  - Events are scheduled, predictable, repeatable → CRM actually earns its keep
  - Per-event revenue ($500–$2,000 typical), not per-hour
  - Each event is a tagged-IG audience-amplifier
  - Word-of-mouth between chapters is fast

  If you land 5 chapters in year one at Bama — that's the business. Everything
  else is bonus.

  Senior portraits + game day are secondary niches on the same audience.

  ---
  What to fix on the website before launch (1 week)

  Quinn — this is your top of the list. No new features. Replace content +
  correct geography. In rough priority:

  1. Strip the fake stats. app/page.tsx line ~102 — the 340 / 12 / 98% claims
  must go. Replace with honest framing: "Louisville, KY → University of Alabama.
   Three students. Real work." Or no numbers at all.
  2. Delete Raleigh/NC content. The 7 Wave-10 city pages (/locations/cary,
  /locations/raleigh, etc.), the NC seeded location data, the Cary booking-form
  options — gone. Replace with Louisville for summer + Tuscaloosa when you
  arrive. Don't pre-publish Tuscaloosa pages until you live there; Google +
  visitors will see right through it.
  3. About page = real team. Three named cofounders, faces, role per person, why
   we exist. This is the most important page on the site for a service brand.
  4. Portfolio = the 500 photos, curated to 50–80. Categorized by what you
  actually shoot: Portraits, Events, Dances, Graduations. Not
  Wedding/Editorial/Commercial. Editorial-tier categories with no editorial
  portfolio = signal of inflated brand.
  5. Booking form session types (BookingFormSteps.tsx:31-37) → cut to what you
  actually offer: Portrait, Event (dance/grad), Family/Group. Drop Wedding,
  Editorial, Commercial until they're real.
  6. Pricing honesty. $40/hr is friends-and-family. Public pricing should either
   (a) hide pricing behind "inquire," (b) show "$150 portfolio session" + "Event
   from $XXX," or (c) be aspirational with a clear "starting at $XXX" floor. Do
  not publish $3,500 "The Day" with a student amateur portfolio behind it. It
  reads as a lie.
  7. Kill the digital store for now. Presets/courses/ebooks (/shop) — nothing to
   sell, nothing to teach. Hide route until there's product. Don't ship an empty
   store.
  8. Disable cron features that depend on real data. Sales tax engine, MACRS
  depreciation, compliance dashboard, sequences, broadcast composer, etc. — all
  still in the codebase, none earning their keep at 1 client/month. Leave them
  dormant but feature-flagged off. Don't surface in the admin nav until they're
  useful.

  Test: After fixes, a stranger landing on the site should know in 5 seconds:
  who you are, where you shoot, what you charge approximately, what your work
  looks like. If any of those four are unclear, fix.

  ---
  90-day plan — Louisville summer

  Goal stated: functional site + audience. Re-stating with metrics so it's
  falsifiable:

  - Site launched + correct by 2026-05-26.
  - Each photographer shoots 6–10 sessions between June and August. Mix: 60%
  paid ($40–$60/hr trade-up zone with friends-of-friends), 40%
  strategic-portfolio (free/discounted shoots picked specifically to fill gaps).
  - Instagram: 1,500 followers by August arrival at Bama. Specific tactics: 3
  posts/week (portfolio + reels), tag every subject (tagged subjects →
  amplification), behind-the-scenes story content, edit-process reels.
  - Pinterest: 1 board per niche. Senior portraits + dance + portraits.
  Pinterest is a real traffic source for photographers — 10x slower than IG but
  compounds.
  - Build target list for Bama: Quinn pulls the 36+30+ chapter accounts on IG.
  Korrin/DyLon study their formal photos from last year. Identify who currently
  shoots them. Note which chapters had bad photos or no photos. Pre-write 
  outreach DMs to send the week you arrive.

  Kill criterion (write this down): "If by 2026-08-31 we have under 800 IG
  followers OR fewer than 12 paid sessions across the team this summer, the
  website launch did not produce demand and we restructure the offer before
  Bama."

  ---
  Bama arrival plan (Aug 2026)

  Week 0–2 on campus:
  - Both photographers attend visible campus events — bid day, philanthropy
  events, game day — with cameras. Free shoots, real photos, tagged. Each tagged
   subject is a free ad.
  - Cold-DM chapter social chairs / executive boards with a portfolio link +
  offer: "Free or discounted shoot at your next event in exchange for tagged
  photos." This is the wedge into the recurring niche.
  - Goal: land 1 chapter in the first month. One paid chapter formal at Bama =
  the entire summer's Louisville revenue, and it's a portfolio + reference for
  chapter #2.

  Year 1 target: 5 chapters as recurring clients. Specific. Falsifiable.

  ---
  Cofounder structure — three people, one is asymmetric

  Engineer + 2 photographers = real fairness question. Quinn's labor compounds
  (ship once, use forever); photographer labor is per-shoot.

  Common resolution patterns (talk through, pick one, write it down):

  - Equal equity, vested. 33/33/33 with 4-year vesting, 1-year cliff. Risk:
  photographers do all the recurring work while engineer banks early effort.
  Mitigated by ongoing engineer maintenance + future buildouts.
  - Tilted equity + per-shoot revenue share for photographers. Engineer gets
  meaningful equity for the platform; photographers split shoot revenue ~70-80%
  of their own work + smaller equity share. Treats photography as
  compensated-labor + brand-equity.
  - Korrin-as-majority (brand namesake = founder), DyLon + Quinn each smaller.
  Risk: if Korrin steps out, the brand collapses. Mitigated by vesting +
  bus-factor planning.

  Whatever you pick: 4-year vesting, 1-year cliff, written down before launch.
  YC's repeatedly-shown failure mode: no vesting, cofounder quits in month 8,
  walks away with half the company.

  Also settle:
  - Editing pipeline — both photographers edit own work or pooled into one
  editor's queue?
  - Who books / replies to inquiries?
  - Brand under "Korrin's Photos" with two photographers feels misaligned.
  Either rebrand (e.g., "Korrin's Photo Co." with team page that elevates the 2
  + 1) or accept that DyLon is publicly a "second shooter under Korrin" — which
  has implications for his motivation and equity logic.

  Run /skill cofounder-fit to walk this through structured.

  ---
  Things you didn't ask but matter

  - Insurance. Photographing Greek events at Bama → some chapters will require
  liability insurance (~$200–$400/yr through Hill & Usher / Athos / etc.). Get
  it before pitching chapters or you'll lose the deal at the contract step.
  - Tax structure. 3-cofounder business making any money = LLC (or PLLC) with
  operating agreement reflecting the equity split. Don't operate as informal
  partnership across state lines — Louisville income now, Tuscaloosa income
  later, no entity = mess.
  - Gear redundancy. Two photographers, one body each = single point of failure
  on event nights. Talk through backup cameras, dual-card workflow, who carries
  what.

  ---
  What I want before next skill

  Run /skill founder-context to populate the formal profile, then /skill 
  cofounder-fit for the 3-way structure. Before either:

  1. Confirm — is Quinn moving to Bama too, or staying remote? Engineer's
  physical presence matters for chapter pitch meetings.
  2. Confirm — are Korrin + DyLon both incoming freshmen at Bama, or one
  returning, etc.?
  3. Confirm — your real-money runway. "Not losing money" = great, but Bama
  relocation costs (housing, gear, insurance, software) eat capital. Budget
  figure each cofounder is putting in?
  4. Korrin's + DyLon's photo style — light-and-airy, dark-and-moody,
  documentary, editorial portrait? Pick the dominant one. It drives every
  marketing decision.
  5. Of the 500 portfolio shots — what percentage is portraits vs. events vs.
  other? That tells us which niche the portfolio currently supports.

  Answer those, then /skill founder-context.

✻ Crunched for 3m 36s

※ recap: We're orienting your Louisville-to-Bama student photo startup; state doc is initialized at .claude/startup-state.md with Phase-1 Louisville and Phase-2 Greek-life-at-Bama strategy mapped. Next action: confirm the five outstanding questions, then run /skill founder-context. (disable recaps in /config)

❯ All 3 cofounders are entering Bama as Freshman. I think we may need to        
  rebrand before we get too far since the plan is to eventually hire and train  
  student photographers while at Bama so we can eventually go hands off. I'm    
  not sure what the runaway money is. We just want extra cash as college        
  students and this seems like a good opporunity. The photo style is definitely 
   leaning towards light and airy / editorial. The portfolio shots are from     
  dances (so like couples) and graduation photos. However, there are a ton of   
  photos from the Gatton Games, an Olympics style event we threw at my old      
  school, so I think frats and sororities may need a photographer for more      
  active and physical fun events like that.                                     

⏺ Big inputs. Updating state doc with rebrand + scale-out plan, then pushing
  back where you need it.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 2 lines, removed 1 line
      23  - v1 (2026-05-19, inferred from code): "Boutique editorial phot
          ographer in the Raleigh-Durham triangle running her business on
           a custom-built CRM that handles booking, contracts, invoicing,
           galleries, and a digital products shop in one workspace."
      24  - v2 (2026-05-19, founder-confirmed): "Photography business. We
          bsite + internal admin for client/image management. Not a SaaS,
           not productizing the platform — software is overhead, not the 
          product."
      25  - v3 (2026-05-19, founder-confirmed): "Korrin's Photos is a 3-c
          ofounder student-run photography studio launching out of Louisv
          ille, KY this summer and relocating to Tuscaloosa, AL for the U
          niversity of Alabama in Fall 2026 — using the Bama move as a sp
          ringboard for paid event, dance, graduation, and portrait work 
          in one of the largest college / Greek-life markets in the South
          ."
      26 -- Current: v3.                                                 
      26 +- v4 (2026-05-19, founder-confirmed): "A student-run, light-and
         +-airy / editorial photography **studio brand** built in Louisvi
         +lle this summer and relocated to the University of Alabama in F
         +all 2026, with the explicit intent to hire and train other stud
         +ent photographers at Bama so the 3 founders can eventually tran
         +sition out of the camera and into a hands-off photo-agency oper
         +ating model. Wedge: Greek-life philanthropy + active / physical
         + chapter events (Olympics-style, Greek Week, philanthropy days)
         +, expanding to formals + senior portraits as the team scales." 
         +(**Rebrand pending** — "Korrin's Photos" is a personal-brand na
         +me that contradicts the team-scale model.)                     
      27 +- Current: v4.                                                 
      28  
      29  ## Current Hypothesis
      30  "We believe [customer type] experiences [problem] when [situati
          on] and will [behavior change] because [insight]."

⏺ Update(.claude/startup-state.md)
  ⎿  Added 4 lines, removed 4 lines
      27  - Current: v4.
      28  
      29  ## Current Hypothesis
      30 -"We believe [customer type] experiences [problem] when [situati
         -on] and will [behavior change] because [insight]."             
      31 -- Riskiest assumption: **unstated by founder**. Code-inferred c
         -andidates: (a) editorial-boutique positioning at $450–$3,500 su
         -stains demand in Raleigh-Durham; (b) 340 prior sessions reflect
         - a true demand engine vs. personal-network exhaustion; (c) the 
         -digital products store will produce meaningful repeat revenue v
         -s. a vanity SKU.                                               
      32 -- Pre-committed kill threshold: not set.                       
      33 -- Pre-committed success criterion: not set.                    
      30 +"We believe **University of Alabama Greek chapters and freshmen
         +-class subjects** experience **a gap in affordable, on-brand, l
         +ight-and-airy photo coverage for philanthropy / active / formal
         + events** when **their current options are hiring an expensive 
         +pro for the marquee day only, a member with a camera, or settli
         +ng for iPhone shots** and will **book a recurring student-photo
         +grapher collective** because **they get pro-quality output at s
         +tudent-friendly prices from peers who understand the aesthetic 
         +and culture.**"                                                
      31 +- Riskiest assumption: **as 3 incoming freshmen with no current
         + Bama Greek network, we can break into chapter relationships fa
         +st enough to validate the niche within ~12 months.**           
      32 +- Pre-committed kill threshold: not set. Draft suggestion — "If
         + we have not landed **2 paying chapter events** by 2026-12-31 (
         +end of Bama fall semester), the chapter-direct wedge is not wor
         +king and we re-target."                                        
      33 +- Pre-committed success criterion: not set. Draft suggestion — 
         +"5 chapter clients with at least 1 repeat booking each by 2027-
         +05-31, plus 3,000 IG followers on the brand, validates the nich
         +e enough to start hiring student photographers in summer 2027."
      34  
      35  ## Target Customer (ICP)
      36  - **Phase 1 (Summer 2026, Louisville):** local Louisville-area 
          subjects — graduating seniors (Class of 2026 portraits), upcomi
          ng-senior portfolio shoots (Class of 2027), summer dance recita
          ls, family/couple casual sessions. Friends-of-friends warm chai
          n.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 1 line
      129  - 2026-05-19 orientation — founder confirmed: this is a photog
           raphy business, not photographer-SaaS. Software is internal ov
           erhead. Founder framed self as "just starting up" while landin
           g-page copy claims 340 sessions / 12 years — contradiction fla
           gged; must reconcile before any growth strategy. Next: founder
           -context (clarify what "just starting up" actually means), the
           n outreach-engine.
      130  - 2026-05-19 orientation — **major reframe.** 340 sessions / 1
           2 yr / 98% = placeholder copy (founder confirmed). Real team: 
           2 student-amateur photographer cofounders. Current rate: ~1 cl
           ient/month (~friends/network). 90-day target: 4–8 sessions/mon
           th (4–8× growth). Site goes live ~1 wk. Code/infra is roughly 
           100× over-engineered vs. demand stage. Provisional route: `fou
           nder-context` → `cofounder-fit` (two-student team needs equity
           /specialization clarity) → `problem-focus` (niche down from 6 
           session types) → `outreach-engine`.
      131  - 2026-05-19 orientation — **team & geography clarified.** 3 c
           ofounders: Korrin (photo, brand namesake), DyLon (photo, newes
           t), Quinn (engineer / website owner — current user). Based Lou
           isville, KY; all three moving to University of Alabama (Tuscal
           oosa) Fall 2026. All NC city content in repo = AI build filler
            to delete. Current revenue: ~$40/hr × ~1 client/mo = friends/
           family rate. Portfolio: ~500 keeper-quality images. Stated goa
           l: site fully functional + audience-building this summer as **
           springboard for the Bama relocation.** Likely-niche pivot: dan
           ces, graduations, general portraits → Greek-life formals + sen
           ior portraits + game-day work at Bama. Revenue is NOT the 90-d
           ay priority — **portfolio + audience are.** Provisional route:
            `founder-context` → `cofounder-fit` (3-way equity, engineer-v
           s-photographer asymmetry) → `problem-focus` (lock Phase-1 vs P
           hase-2 ICP) → `mvp-architect` (cut the codebase to launch scop
           e) → `outreach-engine` (Phase-1 Louisville push + Phase-2 Bama
            pre-positioning).
      132 +- 2026-05-19 orientation — **business model + style + niche lo
          +cked.** All 3 cofounders enter Bama as **incoming freshmen** (
          +clean slate, zero existing Bama Greek network). Long-term plan
          + = **hire and train student photographers at Bama → 3 founders
          + go hands-off → photo-agency / services-to-product play.** Reb
          +rand confirmed needed (Korrin's Photos = personal-brand name; 
          +conflicts with team-scale plan). Style = **light-and-airy / ed
          +itorial.** Portfolio composition = dances (couples), graduatio
          +n portraits, **Gatton Games (Olympics-style multi-event Quinn'
          +s old school threw)** — last one reveals an under-utilized str
          +ength: **active / physical / multi-event coverage capability.*
          +* Founder pitched the insight: Greek philanthropy events / cha
          +pter Olympics / Greek Week may be a tighter wedge than formals
          +. Risk tolerance = low ("extra cash as college students," no r
          +unway pressure, no formal capital at stake). Critical pushback
          + queued for response: (a) hands-off-via-hires is a year-2+ goa
          +l, not year-1; do-things-that-don't-scale first; (b) light-and
          +-airy + harsh-midday-outdoor-action events is an aesthetic ten
          +sion that needs probing; (c) rebrand criteria + naming directi
          +ons, not a name yet. Next skill route unchanged: `founder-cont
          +ext` → `cofounder-fit` → `problem-focus`.                     

⏺ ---
  Three things you said that change the strategy

  1. All freshmen. No upperclassmen network. No Greek affiliation yet. Three of
  you arriving cold in August. Zero warm intros to chapter execs. This is a real
   constraint — call it before strategy.
  2. Hire-and-train-then-go-hands-off model. That's no longer a photo studio.
  That's a regional college photo agency at the end state. Different game,
  different rules, different brand.
  3. Gatton Games portfolio. This is the most interesting thing you've said.
  Probing in a sec.

  ---
  Pushback 1 — the hands-off plan is a year-2 goal at earliest

  YC repeats this until founders listen: "Do things that don't scale" first.

  The Airbnb founders shot photos themselves before hiring photographers —
  because they had to figure out the recipe (what shots, what edit style, what
  delivery format, what pricing, what chapter contact ritual works). Hiring a
  student photographer before that recipe exists doesn't save you time — it
  destroys the business:

  - You can't train without a recipe.
  - Untrained student photographer delivers off-brand work.
  - One bad chapter event = lost chapter forever + bad word-of-mouth across
  Greek council (Greek networks are gossip-dense).
  - You spend money before you've proved you can make money.

  Translation: The 3 of you shoot personally for ~12 months minimum at Bama. By
  summer 2027 you should know:
  - What exactly each event-type costs to deliver (gear, hours, edit time,
  delivery).
  - What chapters actually pay per event (formal vs. philanthropy vs. retreat).
  - What style choices get repeat-booked vs. ghosted.
  - What the chapter-pitch script is that closes 1 in 3 vs. 1 in 10.

  Then hire. The 12 waves Quinn built (payroll/payout fields aside) are actually
   well-positioned for the hands-off endgame — but only if you make it there.
  Most college photo agencies that try to skip the founders-shoot-it phase die
  quietly in year 1.

  Keep the vision. Don't act on it for 12 months.

  ---
  Pushback 2 — light-and-airy vs. active-event photography is an aesthetic 
  tension

  Light-and-airy / editorial: soft, pastel, golden-hour, low-contrast, posed or
  candidly intimate. Works beautifully for couples portraits, dances, senior
  shoots, intimate weddings.

  Active / physical events (Gatton Games, Greek Week, philanthropy day): often
  midday, harsh sun, motion, sweat, crowds, indoor gymnasiums with bad
  fluorescent light. Most light-and-airy photographers can't and don't shoot 
  these. It's a different muscle. Documentary-fast vs. portrait-slow.

  Two possibilities:
  - (a) You're actually two visual languages already — light-and-airy portraits
  + documentary events. That's fine but be honest in the portfolio and pricing.
  Don't sell light-and-airy to a chapter expecting philanthropy-day coverage.
  - (b) Your active-event work is light-and-airy because of post-process,
  time-of-day, and event style. Possible if Gatton Games was outdoor
  late-afternoon and you nailed it.

  Question: When the chapter philanthropy committee opens your portfolio, do
  they see one aesthetic or two? Honest answer.

  If two, decide which is the headline and which is the supporting category. My
  instinct based on what you're describing: lead with light-and-airy editorial 
  portraits + dance/formal work (which directly serves the recruitment + formal
  + senior portrait market), and secondary "documentary event coverage" page for
   philanthropy / active days (which serves the Greek philanthropy wedge). One
  brand, two visual offerings, clear in the navigation.

  ---
  Pushback 3 — Gatton Games is your best wedge story, probe it

  You buried this. The most differentiated thing in this conversation is the 
  Olympics-style event portfolio. It's:
  - Proof of multi-event / multi-subject capability
  - Proof of working with a crowd / activity, not just posed portraits
  - A genuinely uncommon credential for student photographers
  - Directly transferable to Greek philanthropy (Sigma Chi Derby Days, Alpha Phi
   King of Hearts, Pi Phi Arrowspike, Greek Week)

  Questions I need answered:
  1. What school + how many attendees at Gatton Games?
  2. How many photographers covered it (you alone? team?)
  3. How many photos shipped to the client/school after edit?
  4. Did anyone — school, parents, attendees — use the photos? Where? (Yearbook?
   Recap reel? Social?)
  5. Did you charge? If yes, what? If no, would you next time, and at what?
  6. How many of the 500 portfolio images are from this single event?
  7. Can you ship me / link a representative 20-image gallery from it? (I can't
  see them — describe in detail or get them up on the new portfolio page first.)

  If Gatton Games is real and the images are strong, the entire chapter pitch at
   Bama is:

  ▎ "We covered the Gatton Games — a 200+ person, day-long multi-event athletic 
  ▎ competition — start to finish. Here's the gallery: [link]. We'll do your 
  ▎ philanthropy event / Greek Week / chapter Olympics the same way. Same 
  ▎ coverage depth, ~50% the cost of the usual hire."

  That's a pitch with a real artifact behind it. That's a wedge.

  ---
  Rebrand — criteria, not names yet

  You're right to rebrand now. Pre-launch is the cheapest possible moment.
  Criteria:

  1. Not a person's name. "Korrin's" implies one operator → contradicts team +
  agency endgame.
  2. Location-agnostic. Don't bake "Louisville" or "Bama" into the brand. You're
   moving once already; might move again.
  3. Implies team / studio / collective, not solo artist.
  4. Pronounceable, spellable, 1–3 words max, no awkward Greek-spelled vowels.
  5. .com available + IG handle available. Check before you fall in love with a
  name.
  6. Doesn't lock the aesthetic too narrow — if you call yourself "Sunwash
  Studio" and later want to shoot dark dramatic editorial, you've boxed in.
  7. Works on a sweatshirt. Real test for college brands — chapter girls posting
   in your merch is free distribution. If the brand looks bad in a sans-serif
  logo on a hoodie, the brand is wrong.

  Approach options (categories, not actual names):

  - Light/lens/optical word + studio/co/collective ("[Word] Studio," "[Word]
  Photo Co.")
  - Two short words that bounce well ("[X] & [Y]")
  - Place/object word with light association (something evoking glass, window,
  sun, daylight, but not "sun" or "light" directly — overused)
  - Acronym or initialism if the team has a story (e.g., founders' initials → an
   abstract 2–3 letter mark) — risky, often forgettable
  - Made-up word that's spellable and ownable (think "Stripe," "Notion,"
  "Linear") — hard to do well, but if you nail it, totally yours

  Don't pick a name today. Pick 8–12 candidates as a team this week, check .com
  and @handle availability for each, then sit with the top 3 for 48 hours. Most
  regrets are next-day. Run the sweatshirt test on the finalists.

  Bonus: if you want, run /skill brainstorming later for structured name
  generation.

  ---
  Reality check on "extra cash + low risk"

  You said "extra cash as college students, no runway pressure." That's the
  right framing for personal finance but it's the wrong framing for deciding 
  what to do.

  Low pressure + no kill criterion = the business drifts forever. You'll spend 3
   years half-running it, never close it, never grow it, and have less to show
  than if you'd either committed or quit.

  Set a real kill criterion now, even at low stakes:

  ▎ "If by [date] we have not hit [milestone], we wind it down or sell it to a 
  ▎ younger student photographer."

  Suggested:
  - By 2026-08-15 (Bama arrival): site live, brand renamed, 8+ paid sessions
  completed this summer across the team, 1,000+ IG followers. Miss = re-plan
  before classes start.
  - By 2026-12-31 (end of fall semester): 2 paying chapter events booked at
  Bama, 2,500+ IG followers, ≥1 chapter expressing interest in repeat. Miss =
  retreat to portrait-only or sunset.
  - By 2027-05-31 (end of freshman year): 5 chapters as clients with ≥1 repeat
  booking each, 4,000+ IG. Hit = start planning the first hire for fall 2027.

  Falsifiable. Specific. Time-boxed. Adjust the numbers but commit to the
  structure.

  ---
  What I want before the next skill

  1. Gatton Games full debrief (the 7 questions above).
  2. Honest aesthetic answer — one visual language or two?
  3. Are any of the three of you planning to rush a fraternity / sorority at
  Bama in fall? Greek affiliation by one founder = warm-intro pipeline for the
  entire chapter network. Not required, but materially changes go-to-market.
  4. Headshot status — do you have professional headshots of all 3 cofounders
  ready for the About page? If not, that's one of the first shoots of the
  summer.
  5. Budget for the summer — even rough. $200? $2,000? $5,000 each? Drives gear,
   insurance, business filing, paid promo decisions.

  Answer those, then /skill founder-context to lock the profile and /skill 
  cofounder-fit for the 3-way structure conversation.

✻ Cogitated for 2m 53s

※ recap: Goal: launch a rebranded, 3-cofounder student photo studio in Louisville this summer to springboard into University of Alabama Greek-event work in fall. Next action: answer the Gatton Games debrief questions so we can lock the niche wedge. (disable recaps in /config)

❯ Okay so I think we definitely need to nail our aesthetic before summer's out. 
   I think the photographers have the talent to get it right, we just need to   
  hone it in. The Gatton Games was just one school (The Gatton Academy).        
  Roughly 150ish people in attendance. Only Korrin covered it. She sent all of  
  the photos out, but the school didn't end up using a lot of them since they   
  only had her there for media team. However, a lot of them went into the       
  yearbook and onto people's phones and such. They were really good photos,     
  they just weren't being sent out through the proper channels. Korrin did not  
  charge (again, it was for media team). She probably took around 1,500 photos  
  those two days, and around 500 of those were usable. I'm just guessing that a 
   lot of them won't make the cut for a portfolio because they're not flashy    
  enough. We're not sure what to charge for photography. Being so new, it's     
  hard to know what to charge especially since a lot of clients early on are    
  friends and family, and you're just trying to get your work out there. What   
  are some names that meet all of your criteria that might be good for a        
  photography business like this? It has to be gender-neutral as well so both   
  frats and sororities want them. Maybe we allude to "Greek" in some way? But   
  again, I don't want to close ourselves off from non-Greek Week events and     
  such. Just brainstorming. Two of us plan on rushing and MAYBE Korrin will.    
  Either way, we plan on becoming very familiar with the greek scene. Of course 
   we have headshots for the co founders. But I'm not sure I would call DyLon a 
   cofounder just yet. We'll need to discuss that in the cofounder split. There 
   is no budget for the summer. We haven't set aside any money for this, and    
  I'm unsure of why we'd need to just yet. Maybe building out the site and      
  running cloud infrastructure?                                                 

⏺ Updating state doc with cofounder ambiguity + Gatton Games details. Then
  hitting you with what you need to hear.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 1 line
      130  - 2026-05-19 orientation — **major reframe.** 340 sessions / 1
           2 yr / 98% = placeholder copy (founder confirmed). Real team: 
           2 student-amateur photographer cofounders. Current rate: ~1 cl
           ient/month (~friends/network). 90-day target: 4–8 sessions/mon
           th (4–8× growth). Site goes live ~1 wk. Code/infra is roughly 
           100× over-engineered vs. demand stage. Provisional route: `fou
           nder-context` → `cofounder-fit` (two-student team needs equity
           /specialization clarity) → `problem-focus` (niche down from 6 
           session types) → `outreach-engine`.
      131  - 2026-05-19 orientation — **team & geography clarified.** 3 c
           ofounders: Korrin (photo, brand namesake), DyLon (photo, newes
           t), Quinn (engineer / website owner — current user). Based Lou
           isville, KY; all three moving to University of Alabama (Tuscal
           oosa) Fall 2026. All NC city content in repo = AI build filler
            to delete. Current revenue: ~$40/hr × ~1 client/mo = friends/
           family rate. Portfolio: ~500 keeper-quality images. Stated goa
           l: site fully functional + audience-building this summer as **
           springboard for the Bama relocation.** Likely-niche pivot: dan
           ces, graduations, general portraits → Greek-life formals + sen
           ior portraits + game-day work at Bama. Revenue is NOT the 90-d
           ay priority — **portfolio + audience are.** Provisional route:
            `founder-context` → `cofounder-fit` (3-way equity, engineer-v
           s-photographer asymmetry) → `problem-focus` (lock Phase-1 vs P
           hase-2 ICP) → `mvp-architect` (cut the codebase to launch scop
           e) → `outreach-engine` (Phase-1 Louisville push + Phase-2 Bama
            pre-positioning).
      132  - 2026-05-19 orientation — **business model + style + niche lo
           cked.** All 3 cofounders enter Bama as **incoming freshmen** (
           clean slate, zero existing Bama Greek network). Long-term plan
            = **hire and train student photographers at Bama → 3 founders
            go hands-off → photo-agency / services-to-product play.** Reb
           rand confirmed needed (Korrin's Photos = personal-brand name; 
           conflicts with team-scale plan). Style = **light-and-airy / ed
           itorial.** Portfolio composition = dances (couples), graduatio
           n portraits, **Gatton Games (Olympics-style multi-event Quinn'
           s old school threw)** — last one reveals an under-utilized str
           ength: **active / physical / multi-event coverage capability.*
           * Founder pitched the insight: Greek philanthropy events / cha
           pter Olympics / Greek Week may be a tighter wedge than formals
           . Risk tolerance = low ("extra cash as college students," no r
           unway pressure, no formal capital at stake). Critical pushback
            queued for response: (a) hands-off-via-hires is a year-2+ goa
           l, not year-1; do-things-that-don't-scale first; (b) light-and
           -airy + harsh-midday-outdoor-action events is an aesthetic ten
           sion that needs probing; (c) rebrand criteria + naming directi
           ons, not a name yet. Next skill route unchanged: `founder-cont
           ext` → `cofounder-fit` → `problem-focus`.
      133 +- 2026-05-19 orientation — **5 critical updates from Quinn.** 
          +(1) Gatton Games = Gatton Academy of Math & Science (KY, on WK
          +U campus); Korrin shot solo, 2 days, 150 attendees, ~1,500 sho
          +ts → ~500 keepers, no fee, school used in yearbook, photos pas
          +sed informally on phones — strong proof of solo-multi-event ch
          +ops but the artifact is under-marketed. (2) Pricing: no idea w
          +hat to charge; currently $40/hr friends/family. (3) Brand crit
          +eria expanded: gender-neutral (frats + sororities), light Gree
          +k allusion that does not lock out non-Greek work. (4) Rush pla
          +ns: 2 of 3 founders plan to rush at Bama, Korrin possibly — me
          +aningful warm-intro pipeline forming. (5) **Cofounder ambiguit
          +y:** Quinn explicitly does not consider DyLon a cofounder yet 
          +— "we'll need to discuss that in the cofounder split." Major r
          +isk: DyLon may be doing cofounder-grade work all summer under 
          +unclear terms. (6) Budget: zero set aside; Quinn does not see 
          +why money would be required beyond cloud infra — gap in awaren
          +ess re: insurance, LLC, gear redundancy, COI requirements for 
          +booking chapter events. Provisional route: `founder-context` →
          + **`cofounder-fit` (URGENT — DyLon role definition before summ
          +er portfolio shoots begin)** → `problem-focus` → `mvp-architec
          +t` (codebase trim) → `pricing-model` (commit to a tier structu
          +re) → brand workshop (naming this week) → `outreach-engine`.  

⏺ ---
  URGENT — DyLon problem comes first, before anything else

  You said: "I'm not sure I would call DyLon a cofounder just yet. We'll need to
   discuss that in the cofounder split."

  This is the single most important thing in this entire conversation. Resolve
  this week, before he shoots a single paid client or summer portfolio session.
  Why:

  - If DyLon thinks he's a cofounder and you think he's a contractor, you have
  an unfixable mess in 6 months. He'll shoot dozens of sessions, build the
  portfolio with you, then learn at Bama that he has no equity. He quits, takes
  his portfolio, possibly poaches the chapter you just landed, possibly sues
  (KY/AL labor + IP are not friendly to "we never agreed on anything").
  - If you think he's cofounder-track and he thinks he's a contractor, he'll
  undervest emotionally, ghost when school gets hard, and you'll lose a shooter.

  Three valid structures, pick one and write it:

  1. Contractor / per-shoot pay. DyLon is paid % of every shoot he covers
  (typical: 50–70% of session revenue after team overhead). No equity. Cleanest
  for new entrants. He owns no part of the brand.
  2. Cofounder-track with vesting milestones. Equity grant tied to shoots
  completed + months active. E.g., "DyLon receives X% equity vesting over 4
  years, 1-year cliff, accelerated if he covers Y events in year 1." Cofounder
  if he stays, gone clean if he leaves early.
  3. Equal-equity cofounder, vested from day one. Three-way split. Highest
  trust, highest risk if he flakes.

  YC's repeated lesson: uncertainty between cofounders is the #1 startup killer.
   Most failed startups die from cofounder fallout, not market failure. Your
  situation is the exact setup that produces it: undefined role, summer of
  unpaid work, big move coming, big upside hope.

  Have the conversation. Document the outcome. All 3 sign it. Today/this week.

  Then run /skill cofounder-fit to walk it structured.

  ---
  Gatton Games — story is stronger than your pitch of it

  You undersold this badly. Re-read what you wrote:

  - 150 attendees, 2 days, solo coverage
  - 1,500 shots → ~500 keepers (33% keeper rate is honestly good for action)
  - Used in yearbook + spread informally on phones
  - Korrin worked unpaid as media team

  That last point is your sales asset. This is a real-world apprenticeship
  credential. Translate it into Bama-pitch language:

  ▎ "Korrin spent two years as the lead media-team photographer at Gatton 
  ▎ Academy. She solo-covered the school's 150-person Gatton Games — full 
  ▎ multi-event athletic competition — producing 500 publication-grade keepers 
  ▎ used in the official yearbook. That's the depth of coverage we bring to your
  ▎  philanthropy day or Greek Week."

  That's a real pitch. Most student photographers competing with you at Bama
  have no equivalent.

  About "not flashy enough" — you don't need flashy. You need a representative
  20–30 image gallery that shows: arrival, candid mid-action, group moments,
  end-of-event. That's the philanthropy event story arc. Korrin should curate 
  this gallery before any chapter outreach. Make it the "case study" page of the
   new site.

  ---
  Pricing — real framework

  You don't need a number. You need a tiered structure that flexes as the
  portfolio + brand mature.

  Phase 1 — Portfolio Build (now → Aug 2026, in Louisville)

  Honest amateur rates. Goal = portfolio, not revenue.

  ┌────────────────────────────────┬────────────┬──────────────────────────┐
  │            Service             │   Price    │           Note           │
  ├────────────────────────────────┼────────────┼──────────────────────────┤
  │ Portrait session (1–1.5 hr)    │ $75–$150   │ Friends-of-friends       │
  ├────────────────────────────────┼────────────┼──────────────────────────┤
  │ Senior portrait session (1.5–2 │ $125–$200  │                          │
  │  hr)                           │            │                          │
  ├────────────────────────────────┼────────────┼──────────────────────────┤
  │ Couples / dance                │ $100–$200  │                          │
  ├────────────────────────────────┼────────────┼──────────────────────────┤
  │ Strategic portfolio shoot (you │ Free /     │ Use this to fill gaps    │
  │  pick subject)                 │ trade      │                          │
  ├────────────────────────────────┼────────────┼──────────────────────────┤
  │ Event coverage (3–4 hr)        │ $200–$400  │ Birthdays, small         │
  │                                │            │ graduations              │
  └────────────────────────────────┴────────────┴──────────────────────────┘

  Phase 2 — Bama Market Entry (Fall 2026 → Spring 2027)

  After site live + chapter pitches start. Bench-test against 3–5 published Bama
   photographer rates first.

  ┌────────────────────────────────┬─────────────┬──────────────────────────┐
  │            Service             │    Price    │           Note           │
  ├────────────────────────────────┼─────────────┼──────────────────────────┤
  │ Senior portrait (Bama          │ $200–$350   │ 1.5 hr, 30–50 edited     │
  │ students)                      │             │                          │
  ├────────────────────────────────┼─────────────┼──────────────────────────┤
  │ Greek formal coverage          │ $400–$700   │ 3–5 hr, 100–200 edited   │
  ├────────────────────────────────┼─────────────┼──────────────────────────┤
  │ Greek philanthropy day / Greek │ $500–$1,200 │ 4–8 hr coverage, 200–400 │
  │  Week event                    │             │  edited                  │
  ├────────────────────────────────┼─────────────┼──────────────────────────┤
  │ Bid day                        │ $400–$700   │ High-intensity, 3 hr     │
  ├────────────────────────────────┼─────────────┼──────────────────────────┤
  │ Game day tailgate              │ $250–$500   │                          │
  └────────────────────────────────┴─────────────┴──────────────────────────┘

  Phase 3 — Established (Year 2+)

  Once portfolio is deep + chapter references exist. Add 50–75% to Phase 2
  numbers.

  Pricing principles:

  1. Never charge "$40/hr" again in public pricing. Hourly rates kill
  professional positioning. Photographers charge per-session/event with a
  deliverable scope. Hourly is for handymen.
  2. Two people on a Greek event > one. Two-shooter coverage is 1.6–1.8× the
  single-shooter price, not 2×. You bake this into your Greek
  formal/philanthropy quote.
  3. Sandbag low at first. When you don't know what to charge, quote $X and
  watch the reaction. If they say yes immediately, you were too cheap. If they
  say no with no negotiation, too expensive. You'll calibrate inside 5 quotes.
  4. Don't list philanthropy/formal pricing publicly. "Starting at" or "Inquire
  for chapter pricing" on the site. Keeps you flexible per chapter + per scope.
  Public portrait pricing is fine and lowers inquiry friction.
  5. First chapter at Bama: discount aggressively, do it in writing.
  "First-chapter pilot rate — $399 vs. normal $599, with the understanding
  you'll refer us to one other chapter if you're happy." Pinned discount =
  reference customer + referral funnel.

  ---
  Brand names — 8 candidates that hit your criteria

  Hit-tested against: not-personal, location-agnostic, team-implying, 1–3 words,
   sweatshirt-passable, gender-neutral, light-Greek-allusion-without-lockout.
  None checked for .com / @handle availability — you must do that before falling
   in love. Use instant-domain-search.com + Instagram search for each.

  #: 1
  Name: Halcyon Studio
  Greek allusion: Greek-origin word ("halcyon days" = golden, calm). Subtle,
    etymological.
  Aesthetic fit: Strong — "golden, calm" maps to light-and-airy
  Notes: Universally positive connotation. Sweatshirt: clean serif logo works
    well.
  ────────────────────────────────────────
  #: 2
  Name: Helios Photo Co.
  Greek allusion: Direct — Helios = Greek sun god
  Aesthetic fit: Strong — literal sun/light
  Notes: Some risk: Helios is masculine in myth, but the brand reads
    gender-neutral.
  ────────────────────────────────────────
  #: 3
  Name: Laurel Lens Co.
  Greek allusion: Laurel wreath = Greek victory (also worn by women)
  Aesthetic fit: Neutral on aesthetic, classical-leaning
  Notes: Alliterative. Doubles as a Greek-victory hook for chapter-philanthropy
    pitch ("we shoot your laurels").
  ────────────────────────────────────────
  #: 4
  Name: Olympia Studio
  Greek allusion: Olympia, Greece + Olympics. Direct.
  Aesthetic fit: Neutral
  Notes: Possible confusion with Olympia, WA. Ties tightly to your Gatton Games
    "Olympics-style event" story.
  ────────────────────────────────────────
  #: 5
  Name: Studio Phos
  Greek allusion: "Phos" = Greek word for light (etymological root of "photo-")
  Aesthetic fit: Strong — literal light
  Notes: Insider nod (other creatives will catch it). Less obvious to general
    audience.
  ────────────────────────────────────────
  #: 6
  Name: Marble & Light
  Greek allusion: Marble = Greek antiquity. Light = aesthetic.
  Aesthetic fit: Strong
  Notes: Two-word, evocative. Wedding/portrait connotations skew feminine in
  some
    reads — test.
  ────────────────────────────────────────
  #: 7
  Name: Common Light Co.
  Greek allusion: None direct — but "common" reads inclusive (frat + sorority +
    non-Greek)
  Aesthetic fit: Strong
  Notes: Drops the Greek allusion entirely. Trade: no Greek hook in the brand.
    Wins on inclusivity.
  ────────────────────────────────────────
  #: 8
  Name: Atrium Studio
  Greek allusion: Atrium = Greek/Roman architecture (the central open courtyard)
  Aesthetic fit: Strong — atrium = filled with daylight
  Notes: Architectural, calm, doesn't lock to any subject. Likely many .com
    collisions — check.

  My ranking if you forced me to pick three to test:

  - #1 Halcyon Studio (best overall — calm, Greek-etymological, light-and-airy
  semantic match, sweatshirt-ready, gender-neutral)
  - #3 Laurel Lens Co. (alliteration + Greek wreath = strongest direct
  chapter-pitch hook without locking out non-Greek)
  - #7 Common Light Co. (cleanest, broadest reach — sacrifices Greek allusion
  for inclusivity)

  Process from here:
  1. Each of the 3 cofounders independently picks their top 3 from the list (or
  adds their own that hits all criteria).
  2. Compare. The overlap is your shortlist.
  3. Check .com + Instagram + TikTok handle availability for the top 3 overlap.
  4. Sit on the survivor for 48 hours before committing.
  5. Buy domain + handles same day you decide.

  If none of the 8 land, ping me and I'll generate another set — but commit by
  end of next week. Brand indecision is more expensive than a slightly-imperfect
   brand.

  ---
  Aesthetic — how to actually "nail it" by August

  Specific operational plan, not vibes:

  1. Pick 3 reference photographers. Find 3 working light-and-airy / editorial
  photographers whose portfolios you'd kill to match. Save 20 of each's photos.
  That's the bullseye.
  2. Document the recipe. Write a 1-page editing-and-shooting style guide:
    - Shooting: focal length defaults, aperture range, time-of-day rules, posing
   language, group-shot conventions
    - Editing: white balance target, shadow/highlight values, color grade (HSL
  specifics), tone curve, sharpening
    - Delivery: file format, dimension, watermark/no-watermark, naming
  3. Lock the Lightroom preset. Korrin develops one master preset. DyLon (if
  he's in) starts from that preset on every shoot. Same preset every shoot, no 
  exceptions, all summer. Consistency > perfection.
  4. Side-by-side blind test. Once a week: same subject, same hour, both
  photographers, both shoot. Edit independently with the shared preset. Mix the
  photos and ask 3 outside humans to pick which photographer shot which. If they
   can't tell, you've nailed consistency. If they can, the gap is your training
  target.
  5. End-of-summer artifact. A 30-image curated portfolio gallery where every
  photo could plausibly be from any of the photographers. That's the deliverable
   for "aesthetic locked."

  ---
  Budget reality — you have more costs than "site + cloud"

  You said "I'm unsure of why we'd need [money]." Here's why:

  Required-soon (this summer, ~$300–800 total)

  Item: LLC formation (KY or AL)
  Cost: $50–200
  Why: You're 3 people sharing revenue across state lines. No entity = personal
    liability + tax mess. Either form KY LLC now and re-domesticate to AL later,

    or form in AL when you arrive.
  ────────────────────────────────────────
  Item: Operating agreement
  Cost: $0–200
  Why: Use Cooley GO template (free) or pay a service. Documents the cofounder 
    split before there's anything to fight about.
  ────────────────────────────────────────
  Item: Business bank account
  Cost: $0
  Why: Free with most banks. Don't mix personal + business cash. Ever.
  ────────────────────────────────────────
  Item: Backup hard drives + SD cards
  Cost: $150–300
  Why: Two photographers, dozens of shoots. Card failure during a chapter formal
   
    = career-ending. Redundancy is non-negotiable.
  ────────────────────────────────────────
  Item: Liability insurance
  Cost: $200–500/yr
  Why: Bama chapters will likely require Certificate of Insurance (COI) before 
    booking. No COI = no booking. Providers: Hill & Usher (Photopack), Athos,
  PPA
     membership.
  ────────────────────────────────────────
  Item: Domain + email
  Cost: $30–60/yr
  Why: New brand needs .com + @handle + Google Workspace ($6/user/mo).

  Variable / ongoing

  ┌──────────────────────┬───────────────────────┬──────────────────────────┐
  │         Item         │         Cost          │           Note           │
  ├──────────────────────┼───────────────────────┼──────────────────────────┤
  │ Cloud infra          │ Likely $0–50/mo on    │ You'd know better than   │
  │ (Firebase,           │ free tiers;           │ me — check Firebase      │
  │ Cloudflare, Vercel)  │ $50–200/mo if usage   │ usage now.               │
  │                      │ grows                 │                          │
  ├──────────────────────┼───────────────────────┼──────────────────────────┤
  │ Adobe Photography    │                       │ If photographers already │
  │ Plan (Lightroom +    │ $120/yr/seat          │  pay this — confirm. If  │
  │ Photoshop)           │                       │ not, real cost.          │
  ├──────────────────────┼───────────────────────┼──────────────────────────┤
  │ Per-event (gas,      │                       │                          │
  │ parking, SD card     │ $20–80/event          │ Small but real.          │
  │ replacements)        │                       │                          │
  ├──────────────────────┼───────────────────────┼──────────────────────────┤
  │                      │                       │ First-year LLC tax       │
  │ Tax prep (year 1)    │ $200–500              │ filing, even simple      │
  │                      │                       │ ones.                    │
  └──────────────────────┴───────────────────────┴──────────────────────────┘

  Things you should NOT spend on yet

  - Paid Instagram ads (no demand to amplify; waste)
  - Hired help (DyLon clarity first)
  - New gear (your portfolio says current gear is sufficient)
  - Logo designer past $200 (Quinn can do this or Fiverr it)

  Minimum 2026 spend: ~$500. Reasonable target: ~$1,200 if you do insurance +
  LLC + Adobe properly. Each cofounder kicking in $200–400 covers this with
  surplus.

  Decide who funds what + how it's accounted (loan to the LLC? capital
  contribution?). Write it down in the operating agreement.

  ---
  Greek rush — strategic note

  2 of 3 rushing + Korrin maybe = strong warm-intro pipeline. Three notes:

  1. Don't rush expecting to use your chapter for sales. That's transactional
  and chapter culture will smell it. Rush because you want the community.
  2. But your chapter brothers/sisters become your first organic customer base.
  Senior portraits, sibling/parent visits, formal dates, philanthropy events.
  Free distribution + word-of-mouth.
  3. The non-Greek photographer (Quinn?) becomes the operations + admin face of 
  the company at Bama. Photographers shoot + edit. Non-Greek operator runs the
  inquiry pipeline, edits the website, manages calendars, runs admin during
  recruitment week when others are bid-day-locked. Clear role split.
  4. Don't pledge a chapter that bans members from running outside businesses. A
   few do. Read the bylaws.

  ---
  What I want before next skill

  This conversation has been efficient. Next steps in priority order:

  1. This week: the DyLon conversation. All 3 in a room. Pick role + equity
  structure. Sign it. (/skill cofounder-fit will walk this.)
  2. This week: brand name decision from the 8 candidates (or your own
  additions). Domain + handles purchased same day.
  3. Before site launch (1 week-ish): delete fake stats + NC content + edit
  booking session types + correct geography. Quinn's job.
  4. Before any paid client: LLC + operating agreement + business bank account.
  5. Before any chapter pitch at Bama: liability insurance + COI capability.
  6. End of summer: aesthetic locked (the 5-step plan above) + Gatton Games +
  2-3 new shoots curated as case-study pages + brand identity in place.

  Run /skill founder-context and /skill cofounder-fit next. The cofounder one is
   urgent.

✻ Brewed for 3m 49s

❯ DyLon doesn't want in. I like the Common Light Co. but the name must have     
  photography in it for SEO.                                                    

⏺ Clean update. DyLon out + brand close to locked. Two real consequences to talk
   through. Updating state doc.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 4 lines, removed 4 lines
       5  > **NOTE — context source.** This file was initialized by audit
          ing the repo, not by founder interview. Every field below marke
          d `[inferred from code]` is a hypothesis, not a fact. Founder m
          ust confirm or correct on next pass through `founder-context`.
       6  
       7  ## Founder Profile
       8 -- Team (3 cofounders):                                         
       9 -  - **Korrin** — original photographer, brand namesake.        
      10 -  - **DyLon** — photographer, newest addition (taken on specifi
         -cally for the Bama expansion).                                 
      11 -  - **Quinn (user)** — full-stack engineer, owns the website + 
         -admin. Non-photographer cofounder.                             
       8 +- Team (2 cofounders, as of 2026-05-19):                       
       9 +  - **Korrin** — sole photographer + brand-side lead.          
      10 +  - **Quinn (user)** — full-stack engineer, owns the website + 
         +admin + operations. Non-photographer cofounder. Possible second
         +-shooter on events (TBD).                                      
      11 +  - DyLon declined the role — clean exit before any equity / IP
         + entanglement. **Net consequence: capacity = 1 shooter for all 
         +of Year 1.** Hire-and-train plan compresses; need a vetted seco
         +nd shooter (contractor first) by spring/summer 2027 to scale be
         +yond Korrin's solo capacity.                                   
      12  - Domain expertise: photographers = amateur students with serio
          us shooting hours (~500 photos meeting the team's top quality b
          ar in current portfolio). Builder = strong (shipped 12-wave Nex
          t.js / Firebase / Stripe / R2 stack solo in ~12 days).
      13  - Technical ability: dedicated engineer cofounder — rare advant
          age for a photo studio at this stage. Don't waste it.
      14  - Time horizon: site live in ~1 week (~2026-05-26). All three m
          ove to **University of Alabama (Tuscaloosa)** for the upcoming 
          academic year (Fall 2026). Two operating phases: **Summer in Lo
          uisville → Fall onward in Tuscaloosa.**

⏺ Update(.claude/startup-state.md)
  ⎿  Added 2 lines, removed 1 line
      24  - v2 (2026-05-19, founder-confirmed): "Photography business. We
          bsite + internal admin for client/image management. Not a SaaS,
           not productizing the platform — software is overhead, not the 
          product."
      25  - v3 (2026-05-19, founder-confirmed): "Korrin's Photos is a 3-c
          ofounder student-run photography studio launching out of Louisv
          ille, KY this summer and relocating to Tuscaloosa, AL for the U
          niversity of Alabama in Fall 2026 — using the Bama move as a sp
          ringboard for paid event, dance, graduation, and portrait work 
          in one of the largest college / Greek-life markets in the South
          ."
      26  - v4 (2026-05-19, founder-confirmed): "A student-run, light-and
          -airy / editorial photography **studio brand** built in Louisvi
          lle this summer and relocated to the University of Alabama in F
          all 2026, with the explicit intent to hire and train other stud
          ent photographers at Bama so the 3 founders can eventually tran
          sition out of the camera and into a hands-off photo-agency oper
          ating model. Wedge: Greek-life philanthropy + active / physical
           chapter events (Olympics-style, Greek Week, philanthropy days)
          , expanding to formals + senior portraits as the team scales." 
          (**Rebrand pending** — "Korrin's Photos" is a personal-brand na
          me that contradicts the team-scale model.)
      27 -- Current: v4.                                                 
      27 +- v5 (2026-05-19, founder-confirmed): "**Common Light Photograp
         +hy** — a 2-cofounder student-run photography studio (Korrin / l
         +ead photographer + Quinn / engineer-operator) launching out of 
         +Louisville this summer, relocating to the University of Alabama
         + for Fall 2026, targeting Greek-life chapter events (philanthro
         +py days, formals, Greek Week), senior portraits, and college-to
         +wn editorial portraiture, with the medium-term plan to recruit 
         +a second contracted shooter by spring 2027 and grow into a hand
         +s-off student-photo-agency operating model."                   
      28 +- Current: v5. Brand name = **Common Light Photography** (verif
         +y `.com` + `@commonlightphotography` / `@commonlight.photo` ava
         +ilability before purchase).                                    
      29  
      30  ## Current Hypothesis
      31  "We believe **University of Alabama Greek chapters and freshmen
          -class subjects** experience **a gap in affordable, on-brand, l
          ight-and-airy photo coverage for philanthropy / active / formal
           events** when **their current options are hiring an expensive 
          pro for the marquee day only, a member with a camera, or settli
          ng for iPhone shots** and will **book a recurring student-photo
          grapher collective** because **they get pro-quality output at s
          tudent-friendly prices from peers who understand the aesthetic 
          and culture.**"
⏺ Update(.claude/startup-state.md)
  ⎿  Added 1 line
      132  - 2026-05-19 orientation — **team & geography clarified.** 3 c
           ofounders: Korrin (photo, brand namesake), DyLon (photo, newes
           t), Quinn (engineer / website owner — current user). Based Lou
           isville, KY; all three moving to University of Alabama (Tuscal
           oosa) Fall 2026. All NC city content in repo = AI build filler
            to delete. Current revenue: ~$40/hr × ~1 client/mo = friends/
           family rate. Portfolio: ~500 keeper-quality images. Stated goa
           l: site fully functional + audience-building this summer as **
           springboard for the Bama relocation.** Likely-niche pivot: dan
           ces, graduations, general portraits → Greek-life formals + sen
           ior portraits + game-day work at Bama. Revenue is NOT the 90-d
           ay priority — **portfolio + audience are.** Provisional route:
            `founder-context` → `cofounder-fit` (3-way equity, engineer-v
           s-photographer asymmetry) → `problem-focus` (lock Phase-1 vs P
           hase-2 ICP) → `mvp-architect` (cut the codebase to launch scop
           e) → `outreach-engine` (Phase-1 Louisville push + Phase-2 Bama
            pre-positioning).
      133  - 2026-05-19 orientation — **business model + style + niche lo
           cked.** All 3 cofounders enter Bama as **incoming freshmen** (
           clean slate, zero existing Bama Greek network). Long-term plan
            = **hire and train student photographers at Bama → 3 founders
            go hands-off → photo-agency / services-to-product play.** Reb
           rand confirmed needed (Korrin's Photos = personal-brand name; 
           conflicts with team-scale plan). Style = **light-and-airy / ed
           itorial.** Portfolio composition = dances (couples), graduatio
           n portraits, **Gatton Games (Olympics-style multi-event Quinn'
           s old school threw)** — last one reveals an under-utilized str
           ength: **active / physical / multi-event coverage capability.*
           * Founder pitched the insight: Greek philanthropy events / cha
           pter Olympics / Greek Week may be a tighter wedge than formals
           . Risk tolerance = low ("extra cash as college students," no r
           unway pressure, no formal capital at stake). Critical pushback
            queued for response: (a) hands-off-via-hires is a year-2+ goa
           l, not year-1; do-things-that-don't-scale first; (b) light-and
           -airy + harsh-midday-outdoor-action events is an aesthetic ten
           sion that needs probing; (c) rebrand criteria + naming directi
           ons, not a name yet. Next skill route unchanged: `founder-cont
           ext` → `cofounder-fit` → `problem-focus`.
      134  - 2026-05-19 orientation — **5 critical updates from Quinn.** 
           (1) Gatton Games = Gatton Academy of Math & Science (KY, on WK
           U campus); Korrin shot solo, 2 days, 150 attendees, ~1,500 sho
           ts → ~500 keepers, no fee, school used in yearbook, photos pas
           sed informally on phones — strong proof of solo-multi-event ch
           ops but the artifact is under-marketed. (2) Pricing: no idea w
           hat to charge; currently $40/hr friends/family. (3) Brand crit
           eria expanded: gender-neutral (frats + sororities), light Gree
           k allusion that does not lock out non-Greek work. (4) Rush pla
           ns: 2 of 3 founders plan to rush at Bama, Korrin possibly — me
           aningful warm-intro pipeline forming. (5) **Cofounder ambiguit
           y:** Quinn explicitly does not consider DyLon a cofounder yet 
           — "we'll need to discuss that in the cofounder split." Major r
           isk: DyLon may be doing cofounder-grade work all summer under 
           unclear terms. (6) Budget: zero set aside; Quinn does not see 
           why money would be required beyond cloud infra — gap in awaren
           ess re: insurance, LLC, gear redundancy, COI requirements for 
           booking chapter events. Provisional route: `founder-context` →
            **`cofounder-fit` (URGENT — DyLon role definition before summ
           er portfolio shoots begin)** → `problem-focus` → `mvp-architec
           t` (codebase trim) → `pricing-model` (commit to a tier structu
           re) → brand workshop (naming this week) → `outreach-engine`.
      135 +- 2026-05-19 orientation — **two locks.** (1) DyLon declined t
          +he cofounder role. Team is now 2: Korrin (sole photographer + 
          +brand) + Quinn (engineer + ops). Year 1 capacity = 1 shooter; 
          +need a contracted second shooter at Bama by spring 2027 to sca
          +le. (2) Brand selected: **Common Light Photography** (founder 
          +requirement: "photography" must appear in name for SEO). `.com
          +` + IG/TikTok handle availability pending verification. Cofoun
          +der split simplifies to a 2-person conversation (still needs `
          +cofounder-fit` — written agreement before launch). Updated rou
          +te: `founder-context` → `cofounder-fit` (2-person, asymmetric 
          +labor — photographer revenue-generator vs. engineer platform-b
          +uilder) → brand purchase + site relaunch under new name → `pro
          +blem-focus` (lock Phase-1 Louisville ICP vs. Phase-2 Bama Gree
          +k ICP) → `pricing-model` → `outreach-engine` (with DM scripts 
          +for chapter execs).                                           

⏺ ---
  DyLon out — clean exit, real consequence

  Good he said no now, not after the summer of unpaid shoots. Saves you the
  messy version of this conversation.

  But: Year 1 capacity just dropped to one shooter. Korrin solo. That changes
  the operational picture in three concrete ways:

  1. Chapter events that want two-shooter coverage (most formals, most full-day
  philanthropy) — you either decline, hire a contracted second shooter
  event-by-event (40–50% revenue share), or accept single-shooter coverage at a
  lower price. Be honest in quotes about which.
  2. Single-point-of-failure on shoot day. Korrin gets sick / flu / minor injury
   → event misses entirely. No backup. Critical reputation risk. Mitigations: ①
  find a local Tuscaloosa second-shooter contact within first month at Bama for
  emergency callout, ② Quinn learns enough camera to be a competent emergency
  second (low quality bar, just "captures the moment exists"), ③ written
  cancellation clause in every chapter contract that limits liability if illness
   strikes.
  3. The "hire and train" timeline compresses. With only Korrin, you'll be
  capacity-capped at ~8–15 events year 1. To grow beyond that, you'll need a
  contracted shooter by spring 2027, not 2027 summer. Start scouting now — at
  Bama, the photography minor / art department / yearbook staff are the
  recruiting pool.

  Reframe: this isn't worse. It's clearer. Two-cofounder split is easier than
  three. Run /skill cofounder-fit for the Korrin + Quinn equity conversation 
  this week. Suggested starting point: 55/45 with vesting, where Korrin's tilt
  reflects she's the sole revenue-generator + face of the brand, and Quinn's 45%
   reflects the platform he built + ops he'll run. Adjust to taste. The
  conversation matters more than the number — both of you should be able to
  defend the split to each other in one sentence.

  ---
  Brand locked: Common Light Photography

  Good choice. Calm, inclusive, gender-neutral, broad-aesthetic, doesn't lock to
   Greek work. Sweatshirt-passable. Title-tag friendly.

  Action items, today/this week:

  1. Check availability simultaneously:
    - commonlightphotography.com (primary target)
    - commonlightphoto.co (backup)
    - commonlight.studio (alt TLD)
    - @commonlightphotography on Instagram + TikTok
    - @commonlight.photo (cleaner handle if the long version is taken)
    - Threads / Pinterest / X if you care about those
  2. Buy the moment you confirm availability. Squatters watch search trends. If
  the .com is available, buy it within the hour. Cost: $12–20/yr through
  Namecheap, Cloudflare Registrar, or Porkbun.
  3. If primary .com is taken → pivot to one of:
    - commonlightphotoco.com
    - thecommonlight.com
    - commonlight.studio (clean TLD, scans well)
    - Avoid hyphens (common-light-photography.com is brand suicide)
    - Last resort: tweak the name. Don't pay $5,000 to a squatter for a 2-word
  .com.
  4. Reserve the LLC name in Kentucky (or whichever state you file). $0–25 name
  reservation, optional.

  ---
  On the SEO motive — half-right, want to recalibrate

  You said the name "must have photography in it for SEO." Real talk on what SEO
   does and doesn't do for a brand name:

  What having "Photography" in the brand actually helps:
  - Slight uplift on brand-name searches once you have backlinks ("common light
  photography" exact-match).
  - Slight clarity in IG/TikTok bio + Google snippets — humans skimming a 3-word
   brand instantly know what business this is.
  - Easier to communicate verbally ("Common Light Photography" vs "Common Light
  Studio — wait, what kind of studio?").

  What it doesn't do:
  - Move you up for generic searches like "tuscaloosa photographer" or "bama
  greek formal photography" — those rankings are driven by:
    - Google Business Profile (the #1 lever you're not using yet — claim it the
  day you arrive in Tuscaloosa, fill it out, get reviews)
    - Title tags + H1s + meta descriptions on each page (Quinn controls these —
  make sure every city/service page has "Photography" + "Tuscaloosa" / "Alabama"
   / "Greek formal" naturally placed)
    - Schema markup (Quinn's Wave 10 code already does LocalBusiness JSON-LD —
  re-target it from NC cities to KY + AL cities)
    - Reviews + portfolio depth (real galleries from real events = ranking
  signal)
    - Backlinks (chapter websites linking to your portfolio when you cover their
   events = massive uplift over 12 months)

  Bottom line: the name is fine for SEO. Don't expect the brand-name choice
  alone to do much heavy lifting. Quinn's existing 12-wave codebase has the SEO
  scaffolding (sitemap, JSON-LD, structured data) — repoint it from "Korrin's
  Photos / NC cities" to "Common Light Photography / Louisville + Tuscaloosa"
  and that's where the real SEO win is.

  ---
  Updated next steps — tightened for 2-person team

  This week:
  1. Cofounder-fit conversation (Korrin + Quinn). Equity, vesting, role split,
  who-decides-what, what-happens-if-one-quits. Written, signed.
  2. Verify domain + handle availability for Common Light Photography. Buy if
  available. Pick backup if not.
  3. Site rewrites (Quinn):
    - Replace all "Korrin's Photos" branding → "Common Light Photography"
    - Strip fake stats (340 / 12 / 98%)
    - Delete NC city pages, swap for Louisville (active now) — leave Tuscaloosa
  pages off until you're physically there
    - Cut booking session types to: Portrait, Senior, Event, Group/Family
    - About page = 2 real cofounders with real bios
    - Pricing: hide formal/event pricing behind inquiry; show portrait
  starting-at rates
    - Hide /shop until there's product
    - Feature-flag the unused modules (sales tax, MACRS, broadcasts, etc.) —
  don't surface in admin nav
  4. Korrin curates the Gatton Games case-study page (20–30 strongest images,
  written context, the pitch frame I gave you earlier).

  Next 30 days:
  5. LLC formation + operating agreement (Kentucky now, re-domesticate to AL
  later — or AL when you arrive, talk to a $50 small-business lawyer or use
  Cooley GO's free template).
  6. Business bank account.
  7. Liability insurance quote (Hill & Usher, Athos, PPA).
  8. Aesthetic lock plan (the 5-step from previous turn — shared Lightroom
  preset, reference photographers, blind tests).

  Run /skill cofounder-fit first. That's the only thing holding everything else
  back.

✻ Brewed for 2m 21s

❯ I kind of hate the Common Light Photography name. Let's workshop a new one.   
  But in the meantime, Let's run the cofounder fit skill.                       

⏺ Reverting brand to TBD in state doc, then firing cofounder-fit.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 2 lines, removed 1 line
      25  - v3 (2026-05-19, founder-confirmed): "Korrin's Photos is a 3-c
          ofounder student-run photography studio launching out of Louisv
          ille, KY this summer and relocating to Tuscaloosa, AL for the U
          niversity of Alabama in Fall 2026 — using the Bama move as a sp
          ringboard for paid event, dance, graduation, and portrait work 
          in one of the largest college / Greek-life markets in the South
          ."
      26  - v4 (2026-05-19, founder-confirmed): "A student-run, light-and
          -airy / editorial photography **studio brand** built in Louisvi
          lle this summer and relocated to the University of Alabama in F
          all 2026, with the explicit intent to hire and train other stud
          ent photographers at Bama so the 3 founders can eventually tran
          sition out of the camera and into a hands-off photo-agency oper
          ating model. Wedge: Greek-life philanthropy + active / physical
           chapter events (Olympics-style, Greek Week, philanthropy days)
          , expanding to formals + senior portraits as the team scales." 
          (**Rebrand pending** — "Korrin's Photos" is a personal-brand na
          me that contradicts the team-scale model.)
      27  - v5 (2026-05-19, founder-confirmed): "**Common Light Photograp
          hy** — a 2-cofounder student-run photography studio (Korrin / l
          ead photographer + Quinn / engineer-operator) launching out of 
          Louisville this summer, relocating to the University of Alabama
           for Fall 2026, targeting Greek-life chapter events (philanthro
          py days, formals, Greek Week), senior portraits, and college-to
          wn editorial portraiture, with the medium-term plan to recruit 
          a second contracted shooter by spring 2027 and grow into a hand
          s-off student-photo-agency operating model."
      28 -- Current: v5. Brand name = **Common Light Photography** (verif
         -y `.com` + `@commonlightphotography` / `@commonlight.photo` ava
         -ilability before purchase).                                    
      28 +- v6 (2026-05-19): Brand name reverted to **TBD — Quinn dislike
         +d "Common Light Photography" on reflection.** Criteria stand (g
         +ender-neutral, light Greek allusion optional, must contain "Pho
         +tography" for SEO clarity, must work for non-Greek events, swea
         +tshirt-passable, `.com` + handle available). Naming workshop de
         +ferred — cofounder-fit comes first.                            
      29 +- Current: v6 (positioning unchanged; name pending).           
      30  
      31  ## Current Hypothesis
      32  "We believe **University of Alabama Greek chapters and freshmen
          -class subjects** experience **a gap in affordable, on-brand, l
          ight-and-airy photo coverage for philanthropy / active / formal
           events** when **their current options are hiring an expensive 
          pro for the marquee day only, a member with a camera, or settli
          ng for iPhone shots** and will **book a recurring student-photo
          grapher collective** because **they get pro-quality output at s
          tudent-friendly prices from peers who understand the aesthetic 
          and culture.**"

⏺ Skill(startup-skills:cofounder-fit)
  ⎿  Successfully loaded skill

⏺ Loading skill references in parallel.

  Read 2 files (ctrl+o to expand)

⏺ References loaded. Running the diagnosis.

  ---
  Team diagnosis — 4 lenses

  Lens: Domain expertise
  Status: Half-met
  Notes: Korrin has photo craft. Neither cofounder has any Bama Greek network
  yet
    — entering blind. Mitigation: Quinn + maybe Korrin rushing. Real domain
    expertise on the customer (chapter execs, philanthropy committees) will
    accrue post-arrival, not before.
  ────────────────────────────────────────
  Lens: Technical capacity
  Status: Massively overfunded
  Notes: Quinn shipped a 12-wave Next.js / Firebase / Stripe / R2 platform solo.

    Tech is not the bottleneck for this business and won't be for years.
  ────────────────────────────────────────
  Lens: Sales / distribution
  Status: UNDIAGNOSED — likely the silent gap
  Notes: No founder has claimed the outbound / chapter-pitch / inquiry-close
    role. Korrin shoots, Quinn engineers. Who DMs 60 chapter execs at Bama?  Who
   
    fields the questionnaire reply at 11pm? Who closes a  quote-versus-Venmo 
    conversation? This must be a founder, not a contractor. Surface now.
  ────────────────────────────────────────
  Lens: Design / UX
  Status: Met
  Notes: Photo aesthetic = Korrin. Site UX = Quinn. Both at the table.

  Critical finding: The team gap is sales / outreach, and the end-state plan
  ("hands-off") sounds suspiciously like a pre-PMF sales-hire anti-pattern in
  disguise. Founders must do the early chapter outreach themselves. No
  contractor, no VA, no future hire. Either Quinn or Korrin owns this hat in
  Year 1, or you have a hidden bus.

  ---
  Asymmetric labor — the real cofounder-fit problem

  Stated honestly: Korrin generates revenue per-shoot forever. Quinn built a
  platform once + maintains + runs ops. Over a 4-year horizon, Korrin's labor is
   compounding (every shoot, every event); Quinn's is mostly front-loaded
  (platform shipped) + steady ops.

  Two failure modes if you don't address this:

  1. Korrin-resents-Quinn pathway. Year 2: Korrin has shot 80 events, edited
  12,000 photos, missed 20 weekend nights. Quinn has shipped a few maintenance
  updates and answered emails. Korrin looks at the 50/50 split and decides she's
   been used. Walks. Brand dies — she was the brand.
  2. Quinn-resents-Korrin pathway. Year 3: Korrin's name + face is on every
  shoot + the entire brand. Quinn's 50% feels invisible. Maybe Korrin starts an
  aside project under her own name. Quinn realizes the platform he built has
  value only as long as Korrin keeps shooting. Walks. Platform rots.

  Both failure modes are real and they trace to the same root: equity ownership 
  and active labor compensation aren't separated.

  ---
  Recommended structure — separate equity from labor

  Cleanest fit for a service business with one revenue-generating cofounder +
  one platform/ops cofounder:

  Equity (ownership of the LLC): 50/50. Vested 4-year, 1-year cliff. Standard.

  Labor compensation (paid out of revenue BEFORE profit):
  - Shooter takes 60–70% of each session's net revenue (after Stripe fees, sales
   tax, direct event costs). Applies to Korrin now; applies to any future hired
  shooter too.
  - Engineer/operator (Quinn) takes a fixed monthly stipend out of company
  cashflow once the company is generating > $X/month — covers ongoing ops time.
  Stipend = $0 until threshold met (say, $1,500/mo in net revenue), then scales.
  - Whatever's left after labor compensation = company profit. Splits 50/50 per
  equity.

  Why this works:
  - Korrin gets paid for the active per-shoot labor. She won't resent 50/50
  because her shoots are compensated as work, not ownership.
  - Quinn earns ownership of half the company and a fair share of profit once
  the business throws off cash. He's not a slave to perpetual shoot labor
  because he doesn't do that labor.
  - When future shooters get hired, the SAME 60–70% shooter-cut rule applies —
  operating agreement is consistent + scalable.
  - Vesting protects both: if Korrin walks at month 6, Quinn isn't left with a
  50%-owner ghost. If Quinn walks at month 8, Korrin isn't tied to absent
  infrastructure.

  Decision rights:
  - Brand/creative decisions (portfolio style, edits, what to shoot): Korrin 
  tiebreaker.
  - Tech / platform / ops decisions (site, pricing structure, contracts): Quinn 
  tiebreaker.
  - Strategic decisions (hire X, take Y deal, raise Z money, dissolve): both 
  must agree. Stalemate = consult outside advisor + 30-day cooling period before
   forcing a decision.

  Departure / exit clauses to write:
  - 4-year vest, 1-year cliff (unvested shares return to company on departure).
  - If one founder fires the other "without cause" — accelerated vesting (1
  extra year credited).
  - If one founder leaves "for cause" (fraud, undisclosed competing business,
  abandonment > 60 days) — unvested shares forfeit + already-vested shares
  subject to company buyback at fair-market value.
  - Right of first refusal on any equity sale (other cofounder gets first option
   to buy).
  - Dissolution clause: if both agree to wind down, brand IP + portfolio rights
  revert by category — Korrin keeps photography rights to images she shot; Quinn
   keeps platform IP. Customer list either splits or destroys, per agreement.

  This is operating-agreement territory. Don't draft from scratch — start from a
   Cooley GO LLC operating agreement template + a "founders agreement" template,
   modify, then have a $200 small-business attorney review for KY → AL
  re-domestication implications. Total cost: ~$300. Worth every cent vs. a
  future legal fight.

  ---
  Bias sentinel — what to surface before signing

  1. "We get along great" trap. You and Korrin have collaborated on the site for
   at least 12 days. That's real working history but NOT a structured trial with
   deliberate failure exposure. You haven't run a real disaster together yet.
  Until you have, "we work well together" is unfalsified.
  2. Relationship-clarity question. What's your relationship with Korrin?
  Friends-from-school? Dating? Family? Roommates? Each shifts the cofounder
  analysis. Dating + cofounding has the highest blowup rate; the YC corpus on it
   is brutal. Surface honestly.
  3. Time-commitment honesty. Both of you are incoming Bama freshmen. Freshman
  year is heavy: classes, sorority/fraternity rush (2 of you), social life,
  possibly homesickness, finals. Realistic time per week during semester? 5
  hours? 15? 25? If both think the other will give 25 and one gives 5, conflict
  in November. Write the answer down.
  4. Hands-off ambition = pre-PMF sales-hire anti-pattern in disguise.
  Re-stating clearly: founders MUST do chapter outreach personally for Year 1.
  The "go hands-off" plan is for Year 2-3. If neither of you is willing to do
  the outbound grind, the company doesn't work and no equity split saves it.
  5. Sunk-cost trap on the codebase. Quinn — you shipped 12 waves. Don't let
  prior code investment force you into staying in the cofounder role if the
  relationship isn't right. The platform exists. The harder question is whether
  the partnership is the right vehicle.
  6. Inside view on Bama timeline. Outside view: most college businesses run by
  freshmen die in the first semester from time pressure. Reference class: the
  cousin of you who tried to run a side hustle freshman year of college — what
  happened? Plan for that.

  ---
  Have you done the trial?

  YC rule #1: work together 4 weeks on a meaningful deliverable before
  committing.

  You technically already have — 12 days of intense collaboration shipping the
  platform. But it's not the structured trial. You've shipped product together;
  you haven't run customer-facing disaster together.

  Proposal: use Summer 2026 as the structured 4-month trial. Sign a memorandum
  of understanding now (not a full operating agreement — that's at end of
  summer) covering:
  - We are running a 4-month cofounder trial June–August 2026.
  - We will revisit and sign the formal operating agreement no later than
  2026-09-01.
  - During the trial: any revenue goes into a shared business bank account, both
   signers; no one takes draws; no equity changes hands; expenses are tracked.
  - End-of-trial gate: both must agree to continue. If either walks, the company
   dissolves cleanly; brand IP returns to Korrin (since she's the namesake on
  the dissolved brand), platform IP returns to Quinn, contact list is destroyed.

  That MoU is one page. Costs nothing. Removes the worst tail risk of "we signed
   in May, hated each other by August, fighting in September with no exit."

  ---
  Offer: 4-Week Cofounder Trial Protocol

  I can write you the 4-Week Cofounder Trial Protocol as a markdown artifact —
  concrete week-by-week deliverables, what to watch for, the final "hard
  conversation" agenda. Per YC rules. Want it?

  (If yes, type "yes write the protocol" and I'll ship it as a saved doc. If no,
   we move on.)

  ---
  Updating state, then next step

⏺ Update(.claude/startup-state.md)
  ⎿  Added 18 lines, removed 3 lines
       97  - Status: live infrastructure, demand-side outcome unknown.
       98  
       99  ## Team
      100 -- Solo / cofounder / team of N: 1 visible contributor.        
      101 -- Specific gaps: marketing/demand-gen, sales discovery, possib
          -ly bookkeeping (tax/Schedule-C module exists, so this may be h
          -andled).                                                      
      102 -- Plan to fill: unknown.                                      
      100 +- 2 cofounders, both incoming Bama freshmen Fall 2026:        
      101 +  - **Korrin** — sole photographer + brand-side / creative lea
          +d. Year-1 revenue generator. Decision tiebreaker on brand/crea
          +tive.                                                         
      102 +  - **Quinn** — engineer + ops + platform owner. Decision tieb
          +reaker on tech/platform/ops.                                  
      103 +- DyLon declined the cofounder role on 2026-05-19. Clean exit,
          + no equity / IP entanglement.                                 
      104 +- **Diagnosed gaps:**                                         
      105 +  - **Sales / outreach (silent, unfilled).** Neither cofounder
          + has claimed the chapter-pitch / DM / inquiry-close hat. Must 
          +be a founder, not contractor, pre-PMF. Surface and assign.    
      106 +  - **Bama Greek domain knowledge** — both are freshmen, no ex
          +isting chapter network. Mitigated by Quinn (+ possibly Korrin)
          + rushing. Real domain context accrues post-arrival.           
      107 +  - **Trial structure** — pair has shipped product together bu
          +t never run a customer-facing disaster together. YC rule #1 (w
          +ork-together-4-weeks-before-committing) only half-satisfied.  
      108 +  - **Asymmetric labor** — Korrin's labor compounds per shoot;
          + Quinn's is mostly front-loaded platform + steady ops. Untreat
          +ed, this is the most common cofounder-divorce vector for servi
          +ce businesses.                                                
      109 +- **Recommended equity / labor structure (pending founder rati
          +fication):**                                                  
      110 +  - 50/50 equity ownership, 4-year vesting, 1-year cliff.     
      111 +  - Labor compensation paid out of revenue *before* profit: sh
          +ooter 60–70% of session-net; engineer/ops fixed monthly stipen
          +d once company > $1,500/mo net revenue.                       
      112 +  - Brand/creative tiebreaker = Korrin. Tech/ops tiebreaker = 
          +Quinn. Strategic decisions require both, with 30-day cooling p
          +eriod for stalemate.                                          
      113 +  - Departure clauses: 1-year cliff with unvested forfeiture; 
          +acceleration on without-cause termination; for-cause forfeitur
          +e (fraud / abandonment > 60 days); ROFR on equity sales; clean
          + dissolution with brand → Korrin, platform → Quinn, contact li
          +st destroyed.                                                 
      114 +- **Plan to fill the sales gap:** assign as Quinn's responsibi
          +lity (since Korrin is consumed by per-shoot labor) OR Korrin's
          + by alternating weeks. Decide explicitly. Either way, write in
          +to the operating agreement: "Outbound chapter outreach owned b
          +y [name]; minimum 10 DMs/week during the academic year; tracke
          +d in [tool]."                                                 
      115 +- **Trial protocol:** treat Summer 2026 (June–August) as the 4
          +-month structured cofounder trial. Sign a one-page MoU now; fu
          +ll operating agreement by 2026-09-01.                         
      116 +- **Open relationship-clarity question:** founder did not disc
          +lose nature of Korrin/Quinn relationship (friends / family / d
          +ating / roommates) — needed before signing anything. Dating + 
          +cofounding is the highest-blowup combination per YC corpus.   
      117 +- **Future hire (year 2+):** contracted second-shooter at Bama
          +, paid 60% of session-net per the same shooter-cut rule. Recru
          +it from photography minor / yearbook / art department.        
      118  
      119  ## Active Experiments
      120  - None declared.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 1 line
      149  - 2026-05-19 orientation — **business model + style + niche lo
           cked.** All 3 cofounders enter Bama as **incoming freshmen** (
           clean slate, zero existing Bama Greek network). Long-term plan
            = **hire and train student photographers at Bama → 3 founders
            go hands-off → photo-agency / services-to-product play.** Reb
           rand confirmed needed (Korrin's Photos = personal-brand name; 
           conflicts with team-scale plan). Style = **light-and-airy / ed
           itorial.** Portfolio composition = dances (couples), graduatio
           n portraits, **Gatton Games (Olympics-style multi-event Quinn'
           s old school threw)** — last one reveals an under-utilized str
           ength: **active / physical / multi-event coverage capability.*
           * Founder pitched the insight: Greek philanthropy events / cha
           pter Olympics / Greek Week may be a tighter wedge than formals
           . Risk tolerance = low ("extra cash as college students," no r
           unway pressure, no formal capital at stake). Critical pushback
            queued for response: (a) hands-off-via-hires is a year-2+ goa
           l, not year-1; do-things-that-don't-scale first; (b) light-and
           -airy + harsh-midday-outdoor-action events is an aesthetic ten
           sion that needs probing; (c) rebrand criteria + naming directi
           ons, not a name yet. Next skill route unchanged: `founder-cont
           ext` → `cofounder-fit` → `problem-focus`.
      150  - 2026-05-19 orientation — **5 critical updates from Quinn.** 
           (1) Gatton Games = Gatton Academy of Math & Science (KY, on WK
           U campus); Korrin shot solo, 2 days, 150 attendees, ~1,500 sho
           ts → ~500 keepers, no fee, school used in yearbook, photos pas
           sed informally on phones — strong proof of solo-multi-event ch
           ops but the artifact is under-marketed. (2) Pricing: no idea w
           hat to charge; currently $40/hr friends/family. (3) Brand crit
           eria expanded: gender-neutral (frats + sororities), light Gree
           k allusion that does not lock out non-Greek work. (4) Rush pla
           ns: 2 of 3 founders plan to rush at Bama, Korrin possibly — me
           aningful warm-intro pipeline forming. (5) **Cofounder ambiguit
           y:** Quinn explicitly does not consider DyLon a cofounder yet 
           — "we'll need to discuss that in the cofounder split." Major r
           isk: DyLon may be doing cofounder-grade work all summer under 
           unclear terms. (6) Budget: zero set aside; Quinn does not see 
           why money would be required beyond cloud infra — gap in awaren
           ess re: insurance, LLC, gear redundancy, COI requirements for 
           booking chapter events. Provisional route: `founder-context` →
            **`cofounder-fit` (URGENT — DyLon role definition before summ
           er portfolio shoots begin)** → `problem-focus` → `mvp-architec
           t` (codebase trim) → `pricing-model` (commit to a tier structu
           re) → brand workshop (naming this week) → `outreach-engine`.
      151  - 2026-05-19 orientation — **two locks.** (1) DyLon declined t
           he cofounder role. Team is now 2: Korrin (sole photographer + 
           brand) + Quinn (engineer + ops). Year 1 capacity = 1 shooter; 
           need a contracted second shooter at Bama by spring 2027 to sca
           le. (2) Brand selected: **Common Light Photography** (founder 
           requirement: "photography" must appear in name for SEO). `.com
           ` + IG/TikTok handle availability pending verification. Cofoun
           der split simplifies to a 2-person conversation (still needs `
           cofounder-fit` — written agreement before launch). Updated rou
           te: `founder-context` → `cofounder-fit` (2-person, asymmetric 
           labor — photographer revenue-generator vs. engineer platform-b
           uilder) → brand purchase + site relaunch under new name → `pro
           blem-focus` (lock Phase-1 Louisville ICP vs. Phase-2 Bama Gree
           k ICP) → `pricing-model` → `outreach-engine` (with DM scripts 
           for chapter execs).
      152 +- 2026-05-19 cofounder-fit — diagnosed silent sales/outreach g
          +ap (must be founder-led, not contractor), asymmetric labor pat
          +tern (Korrin compounding per-shoot, Quinn front-loaded platfor
          +m), and incomplete trial structure (shipped product together b
          +ut no customer-facing disaster yet). Recommended: 50/50 equity
          + vested 4yr/1yr cliff + labor compensation paid out of revenue
          + before profit (shooter 60–70% session-net; engineer stipend a
          +fter $1,500/mo threshold) + role-based decision tiebreakers + 
          +structured Summer 2026 as 4-month trial with one-page MoU now 
          +and full operating agreement by 2026-09-01. Open question to f
          +ounder: nature of Korrin/Quinn relationship (friend / dating /
          + family / roommate) before signing anything. Offered 4-Week Co
          +founder Trial Protocol artifact — pending founder accept/decli
          +ne. Brand naming reverted to TBD (Quinn disliked "Common Light
          + Photography"); brand workshop deferred. Next: founder accepts
          +/declines protocol artifact → answers relationship-clarity que
          +stion → revisits brand naming.                                

⏺ ---
  Decision queue — answer these in order

  1. Want the 4-Week Cofounder Trial Protocol as a saved artifact? Yes / No.
  2. Korrin/Quinn relationship. Friends / family / dating / roommates / other?
  Honest answer changes the risk profile.
  3. Sales-hat assignment. Who owns chapter outreach + inquiry-close at Bama?
  Pick one of you. Or alternate. Not "we'll figure it out."
  4. Time-per-week commitment during fall semester. Each of you write a number.
  Compare. If they're radically different, that's the conversation.
  5. Equity structure — do you accept the 50/50 + revenue-cut + vesting 
  recommendation, or push back? Defend your alternative if you push back.

  Once those are answered, two parallel tracks:

  - Track A (this week): sign the one-page MoU. Open business bank account.
  Draft an LLC operating agreement from Cooley GO template. Sit on it until end
  of summer.
  - Track B (this week): brand-name workshop redo. Tell me what specifically you
   hated about "Common Light Photography" (too soft? too vague? too non-Greek?
  too long?) — I generate a new set targeted to your real reaction.

  Back to where we were: after the cofounder-fit decisions land, the next skill
  in the queue is founder-context (formal profile lock) and/or the brand
  workshop (which is its own off-skill task). Type /skill founder-context when
  you're ready, or just answer the 5 questions above and I'll route.

✻ Cogitated for 3m 6s

❯ Yes I want the artifact. We're friends. We'll probably split                  
  sororities/fraternities. In fact, if we were to take on another cofounder, it 
   would likely be someone who is integrated with fraternities and sororities,  
  knows how to sell, and maybe does photography too would be nice, but not      
  needed. I'll discuss with her later about how many hours she's looking to     
  invest. I'd say I'm willing to commit about 10 hours a week outside of normal 
   shoot hours (if I even need to be there). I'd be spending this time making   
  sure the brand is ready to scale at some point in the future, automating      
  processes, creating a strong clientbase, and building social media following  
  with Korrin. We'll probably focus on Track B first and then move to Track A   
  about a month from now. Let's go ahead and fire up founder context            

⏺ Friends = lowest-risk relationship cofounding combo. Good. Sales split
  frats/sororities is smart — gender-matched outreach is real cultural
  advantage. Locking the 10hr/wk commitment + future-third-cofounder spec in
  state doc, writing the protocol, then firing founder-context.

  One quick correction before I forget: MoU and Operating Agreement are 
  different docs.

  - MoU (one page, this week, free): says "we're in a 4-month trial, no equity
  changes hands yet, here's how revenue is held during the trial." Protects you
  both during summer shoots.
  - Operating Agreement (multi-page, signs end of August): the real LLC document
   with the 50/50, vesting, decision rights, etc.

  Track A in my prior message conflated them. Sign the MoU this week before
  Korrin takes a paid client under the new brand. Operating Agreement can wait
  til September. That's the correct sequencing. Continue with your plan
  otherwise.

  Writing the artifact.

⏺ Write(.claude/cofounder-trial-protocol.md)
  ⎿  Wrote 154 lines to .claude/cofounder-trial-protocol.md
       2 _Generated 2026-05-19 by cofounder-fit (Startup Skills)_
       4 _Trial window: 4 structured weeks of deliverables, embedded insi
         ng Agreement is signed by 2026-09-01._t 2026) before the Operati
       5 
       7 ## Why this exists
         s on a meaningful deliverable before committing.** Coffee chats 
         don't count. Code-only collaboration doesn't count. What counts 
          having the hard conversation while it still costs nothing to wa
       9 lk away.
      10 You've already shipped a product together
     … +261 lines (ctrl+o to expand)

⏺ Artifact saved at .claude/cofounder-trial-protocol.md. Now updating state.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 6 lines, removed 3 lines
      111    - Labor compensation paid out of revenue *before* profit: sh
           ooter 60–70% of session-net; engineer/ops fixed monthly stipen
           d once company > $1,500/mo net revenue.
      112    - Brand/creative tiebreaker = Korrin. Tech/ops tiebreaker = 
           Quinn. Strategic decisions require both, with 30-day cooling p
           eriod for stalemate.
      113    - Departure clauses: 1-year cliff with unvested forfeiture; 
           acceleration on without-cause termination; for-cause forfeitur
           e (fraud / abandonment > 60 days); ROFR on equity sales; clean
            dissolution with brand → Korrin, platform → Quinn, contact li
           st destroyed.
      114 -- **Plan to fill the sales gap:** assign as Quinn's responsibi
          -lity (since Korrin is consumed by per-shoot labor) OR Korrin's
          - by alternating weeks. Decide explicitly. Either way, write in
          -to the operating agreement: "Outbound chapter outreach owned b
          -y [name]; minimum 10 DMs/week during the academic year; tracke
          -d in [tool]."                                                 
      115 -- **Trial protocol:** treat Summer 2026 (June–August) as the 4
          --month structured cofounder trial. Sign a one-page MoU now; fu
          -ll operating agreement by 2026-09-01.                         
      116 -- **Open relationship-clarity question:** founder did not disc
          -lose nature of Korrin/Quinn relationship (friends / family / d
          -ating / roommates) — needed before signing anything. Dating + 
          -cofounding is the highest-blowup combination per YC corpus.   
      114 +- **Plan to fill the sales gap (Quinn-confirmed):** **gender-m
          +atched chapter outreach.** Quinn owns fraternity outreach (he'
          +s male + planning to rush IFC); Korrin owns sorority outreach 
          +(she's female + may rush Panhellenic). Smart cultural-fluency 
          +split. Codify in operating agreement: each cofounder commits a
          + minimum DM/contact rate per academic week during target seaso
          +ns (recruitment week, philanthropy-event season, formal season
          +).                                                            
      115 +- **Trial protocol:** treat Summer 2026 (June–August) as the 4
          +-month structured cofounder trial. Sign a one-page MoU now; fu
          +ll operating agreement by 2026-09-01. Detailed protocol artifa
          +ct saved at `.claude/cofounder-trial-protocol.md` — week-by-we
          +ek deliverables for June + monthly check-ins for July/August +
          + Week-4 hard-conversation agenda.                             
      116 +- **Relationship clarification (Quinn-confirmed):** **friends.
          +** Not dating, not family, not roommates. Lowest-risk relation
          +ship class for cofounding — proceed.                          
      117 +- **Time commitment (Quinn-confirmed):** ~10 hrs/week outside 
          +shoot hours; focus areas = brand scale-readiness, process auto
          +mation, social media (with Korrin), audience growth. Korrin's 
          +commitment number pending — surface in Week-4 hard conversatio
          +n.                                                            
      118 +- **If a 3rd cofounder is ever added (Quinn-confirmed spec):**
          + profile = Greek-integrated (active sorority/fraternity member
          + with chapter network), sales chops, photography skill nice-to
          +-have but optional. This is the "sales / outreach" gap filler.
          + Not a current search — but lock the spec so it doesn't drift.
      119  - **Future hire (year 2+):** contracted second-shooter at Bama
           , paid 60% of session-net per the same shooter-cut rule. Recru
           it from photography minor / yearbook / art department.
      120 +- **Track sequencing (Quinn-confirmed):** Track B (brand namin
          +g workshop) this week → Track A (MoU signed before any paid cl
          +ient under new brand; full operating agreement by 2026-09-01) 
          +~1 month out. **CORRECTION:** MoU and Operating Agreement are 
          +different docs. MoU = one-page, this week, before any paid cli
          +ent at the new brand. Operating Agreement = end-of-summer form
          +al LLC doc. Don't conflate.                                   
      121  
      122  ## Active Experiments
      123  - None declared.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 1 line
      153  - 2026-05-19 orientation — **5 critical updates from Quinn.** 
           (1) Gatton Games = Gatton Academy of Math & Science (KY, on WK
           U campus); Korrin shot solo, 2 days, 150 attendees, ~1,500 sho
           ts → ~500 keepers, no fee, school used in yearbook, photos pas
           sed informally on phones — strong proof of solo-multi-event ch
           ops but the artifact is under-marketed. (2) Pricing: no idea w
           hat to charge; currently $40/hr friends/family. (3) Brand crit
           eria expanded: gender-neutral (frats + sororities), light Gree
           k allusion that does not lock out non-Greek work. (4) Rush pla
           ns: 2 of 3 founders plan to rush at Bama, Korrin possibly — me
           aningful warm-intro pipeline forming. (5) **Cofounder ambiguit
           y:** Quinn explicitly does not consider DyLon a cofounder yet 
           — "we'll need to discuss that in the cofounder split." Major r
           isk: DyLon may be doing cofounder-grade work all summer under 
           unclear terms. (6) Budget: zero set aside; Quinn does not see 
           why money would be required beyond cloud infra — gap in awaren
           ess re: insurance, LLC, gear redundancy, COI requirements for 
           booking chapter events. Provisional route: `founder-context` →
            **`cofounder-fit` (URGENT — DyLon role definition before summ
           er portfolio shoots begin)** → `problem-focus` → `mvp-architec
           t` (codebase trim) → `pricing-model` (commit to a tier structu
           re) → brand workshop (naming this week) → `outreach-engine`.
      154  - 2026-05-19 orientation — **two locks.** (1) DyLon declined t
           he cofounder role. Team is now 2: Korrin (sole photographer + 
           brand) + Quinn (engineer + ops). Year 1 capacity = 1 shooter; 
           need a contracted second shooter at Bama by spring 2027 to sca
           le. (2) Brand selected: **Common Light Photography** (founder 
           requirement: "photography" must appear in name for SEO). `.com
           ` + IG/TikTok handle availability pending verification. Cofoun
           der split simplifies to a 2-person conversation (still needs `
           cofounder-fit` — written agreement before launch). Updated rou
           te: `founder-context` → `cofounder-fit` (2-person, asymmetric 
           labor — photographer revenue-generator vs. engineer platform-b
           uilder) → brand purchase + site relaunch under new name → `pro
           blem-focus` (lock Phase-1 Louisville ICP vs. Phase-2 Bama Gree
           k ICP) → `pricing-model` → `outreach-engine` (with DM scripts 
           for chapter execs).
      155  - 2026-05-19 cofounder-fit — diagnosed silent sales/outreach g
           ap (must be founder-led, not contractor), asymmetric labor pat
           tern (Korrin compounding per-shoot, Quinn front-loaded platfor
           m), and incomplete trial structure (shipped product together b
           ut no customer-facing disaster yet). Recommended: 50/50 equity
            vested 4yr/1yr cliff + labor compensation paid out of revenue
            before profit (shooter 60–70% session-net; engineer stipend a
           fter $1,500/mo threshold) + role-based decision tiebreakers + 
           structured Summer 2026 as 4-month trial with one-page MoU now 
           and full operating agreement by 2026-09-01. Open question to f
           ounder: nature of Korrin/Quinn relationship (friend / dating /
            family / roommate) before signing anything. Offered 4-Week Co
           founder Trial Protocol artifact — pending founder accept/decli
           ne. Brand naming reverted to TBD (Quinn disliked "Common Light
            Photography"); brand workshop deferred. Next: founder accepts
           /declines protocol artifact → answers relationship-clarity que
           stion → revisits brand naming.
      156 +- 2026-05-19 cofounder-fit — Quinn ratified key terms. Relatio
          +nship = friends (lowest-risk class). Sales-hat = gender-matche
          +d chapter outreach (Quinn → frats, Korrin → sororities). Time 
          +commitment = Quinn 10hr/wk outside shoots (brand readiness, au
          +tomation, audience, social with Korrin); Korrin's number TBD i
          +n Week-4 hard conversation. Hypothetical 3rd cofounder spec lo
          +cked = Greek-integrated + sales + photo-optional (specifically
          + the sales-gap filler). Track sequencing = brand workshop firs
          +t (this week), MoU before any paid client under new brand, ful
          +l operating agreement ~2026-09-01. 4-Week Cofounder Trial Prot
          +ocol artifact saved at `.claude/cofounder-trial-protocol.md`. 
          +Next: `founder-context` (this turn), then brand workshop next 
          +session.                                                      

⏺ ---
  Cofounder-fit closed (provisionally) — three notes before founder-context

  1. The "10 hrs/wk outside shoot hours" number is great for summer. Need a fall
   number. Freshman year + rush + classes + social = reality compresses. Plan a
  real-talk fall recalibration in your Week-4 hard conversation. Don't assume
  summer hours carry over.
  2. Gender-matched outreach is genuinely smart and underused by competitor
  photo studios at college markets. But it has a hidden constraint: you cannot
  reach every chapter at the right exec until at least one of you has chapter
  affiliation post-rush. Plan B for the first 6–8 weeks at Bama (pre-bid-day) —
  DM cold, attend public Greek-org events with a camera, befriend chapter
  philanthropy chairs informally before pitching. Outreach without affiliation
  works but compounds slower.
  3. The "if we add a 3rd cofounder" profile you described is the same profile 
  YC repeatedly says solo + dual technical founders fail without. A
  Greek-integrated sales-chops cofounder added at Bama would dramatically
  de-risk the chapter market. But you cannot recruit them remotely from 
  Louisville. That's a Bama-October decision, not a now-decision. Don't go
  looking before you arrive; the right person will be obvious by November once
  you've shot a few chapter events. Park it.

  Firing founder-context.

⏺ Skill(startup-skills:founder-context)
  ⎿  Successfully loaded skill

⏺ Founder Profile already populated from prior turns. Per skill protocol: don't
  re-run full intake; surgical gap-fill instead. Dispatching domain research in
  parallel while I ask gap questions.

⏺ Agent(Greek-life photographer market research)
  ⎿  Backgrounded agent (↓ to manage · ctrl+o to expand)

⏺ Research agent dispatched in background. Continuing with gap questions.

  ---
  Founder profile — surgical gaps to close

  State doc has most of the picture. Six surgical questions before I lock the
  profile. Answer in one volley.

  1. Korrin's photo-domain depth

  - How long has she been actively shooting? (Hobby start vs. paid start.)
  - Self-taught or formal training (workshop, mentor, school class, photo
  program)?
  - Any work published outside Gatton Academy yearbook? (Local press, blog
  feature, anyone's wedding she second-shot?)
  - Style references — name the 1–3 photographers whose work she actively
  studies / emulates.

  This determines whether she's at "amateur with eye + 500 hours" (typical) or
  "amateur with quiet pro-tier chops" (rare and valuable). Pricing strategy
  diverges.

  2. Gear status — single-point-of-failure check

  - Cameras owned (Korrin): body model + count. One body = single point of
  failure on a paid event. Two bodies = safe.
  - Lenses: focal range coverage? (e.g., 35/50/85 prime trio, or 24-70 + 70-200
  zoom, etc.)
  - Lighting: any off-camera flash / strobes? Greek formals are often indoor
  ballrooms with terrible light — flash skill + gear matters.
  - Backup workflow: dual-card-slot enabled? External drive backup ritual? Cloud
   archive?
  - Editing rig: her laptop / desktop strong enough to handle 1,500-shot edit
  days?

  3. Financial contribution plan

  You mentioned no budget set aside but ~$500–1,200 of real costs in summer
  (LLC, insurance, drives, domain, software). Who funds what?
  - Equal split — each contributes 50% of startup costs against future
  repayment?
  - Korrin-funds-gear, Quinn-funds-infrastructure?
  - One person fronts everything, gets reimbursed from first revenue?

  Pick a model now. Write it in the MoU.

  4. Korrin's hours/week commitment

  You said yours is ~10 hr/wk outside shoots. Hers — both during summer AND fall
   semester. Get the number from her directly. If she says "as much as it 
  takes," that's not an answer. Push for a real number.

  5. Risk tolerance floor — actually answer this one

  You said "extra cash, not losing money." That's the upside framing. Now the
  floor:

  "If by 2026-12-31 (end of fall semester at Bama) this business has produced $0
   in net profit and 0 chapter bookings, do you (a) keep grinding through 
  spring, (b) wind it down cleanly, or (c) walk away and let the brand go?"

  Same question for Korrin. Compare. If your answers diverge ("I'd grind" vs
  "I'd walk"), that's a real cofounder gap to surface in the Week-4 hard
  conversation.

  6. Your photo skill level (Quinn)

  You're a non-photographer cofounder but you might need to be an emergency
  second-shooter at some chapter event when Korrin gets the flu the morning of.
  Honest answer:
  - Have you shot anything publishable? With what?
  - Could you cover an event credibly if Korrin was down 6 hours before call
  time?
  - Or do you have a plan to upskill basic shooting this summer as insurance?

  ---
  While you answer — three things to flag

  Bias sentinel hits:

  - Inside view on timeline. "Site done in 1 week" + "fully functional +
  audience-building by end of summer" + "chapter clients by November" — three
  optimistic timelines stacked. Reference class: most college side businesses
  underdeliver year 1 by ~3×. If you'd told me 4 weeks and 4 chapters by spring
  2027, I'd believe you. Plan to the longer timeline; celebrate if you beat it.
  - Risk tolerance shallow. "Extra cash" + "no budget" + "not losing money"
  sounds clean but it's brittle. The moment one liability claim, one piece of
  broken gear, or one Stripe chargeback hits, the math changes fast. The
  risk-tolerance question above is to surface that floor explicitly.
  - Found-market-fit assumption. You haven't actually validated that Bama
  chapters will pay students for event coverage. You believe they will
  (reasonable inference from Greek-life norms). That's not the same as having a
  single chapter-side conversation confirming it. Add to summer plan: 3 phone 
  calls with anyone who has been on a Bama chapter exec board in the last 2 
  years. Find them via Bama IG, your incoming-freshman class GroupMe, or your
  existing high school network's older siblings. The Mom Test threshold for
  early signal is ~20 conversations; aim for 5 by end of summer.

  ---
  What I'm not asking again

  Already locked from prior turns: team structure (2 cofounders), archetype
  (services-to-product hybrid via student-photo-agency end state), starting
  point (product built / pre-launch under new brand / 1 client/mo legacy),
  technical ability (Quinn = strong), niche (Bama Greek wedge + senior
  portraits), time horizon (site live 1 wk, Bama Aug 2026), relationship
  (friends).

  Answer the 6 surgical questions. Research agent fires back when it has the
  Bama-photographer market signal. Then I lock the Founder Profile and route to
  the next skill — which is going to be /skill problem-focus (drill the ICP from
   "Bama Greek" to a specific 1st-shoot target) or brand workshop (depending on
  your pacing).
✻ Brewed for 4m 28s

⏺ Agent "Greek-life photographer market research" completed

⏺ Research back. Massive signal upgrade. Updating state with findings before
  responding.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 65 lines, removed 5 lines
       76  | Riskiest assumption / kill criterion | Not set | — |
       77  | Runway / financial pressure | Unknown | — |
       78  
       79 -## Competitive Landscape                                      
       80 -- Existing alternatives: **Honeybook, Dubsado, Studio Ninja, P
          -ic-Time, Pixieset, Iris Works, Sprout Studio, ShootProof** — e
          -stablished photographer-CRM + gallery delivery players. Direct
          - competitors to the *software* underneath this brand.         
       81 -- Why insufficient (if pitching the SaaS angle): Korrin's stac
          -k is hand-built and bespoke vs. these horizontal platforms. Co
          -uld be liability (rebuilding what exists) or moat (workflow ad
          -vantages competitors can't ship).                             
       82 -- Our specific insight (the why-now): unstated.               
       83 -- Tar-pit checks performed: **none yet.** Photographer-CRM is 
          -a known graveyard category — many failed boutique entrants ove
          -r 2015–2024. Required reading before any SaaS pivot conversati
          -on.                                                           
       79 +## Competitive Landscape (Bama Greek-photography market — doma
          +in research 2026-05-19)                                       
       80  
       81 +### Three-tier competitor stack                               
       82 +                                                              
       83 +**Tier 1 — National Greek specialists (own bid day + composite
          +s):**                                                         
       84 +- **GreekYearbook** (greekyearbook.com) — national leader; $0 
          +chapter cost, monetizes members via à la carte print orders ("
          +Premium Package" 30-min candids + 50 prints; chapter receives 
          +"6 free packages" / ~$450 value). Partnered with national orgs
          + (e.g. Beta).                                                 
       85 +- **University Photo** (universityphoto.com) — same model, "ph
          +otographer is ALWAYS FREE," 2-hr early arrival.               
       86 +- **DPC / Empire Photography** — similar national specialist m
          +odel.                                                         
       87 +- **Implication: do NOT try to compete on bid day or composite
          +s.** This tier is structurally unbeatable for a local two-pers
          +on team.                                                      
       88 +                                                              
       89 +**Tier 2 — Local Tuscaloosa wedding/senior pros (priced out of
          + chapter event budget):**                                     
       90 +- **MKC Photography** (@mkcphotoalabama) — 10-year Tuscaloosa 
          +shop, grad sessions start $750 + $100 retainer; also runs The 
          +Studio by MKC (event space). [mkcphotoal.com](https://www.mkcp
          +hotoal.com/)                                                  
       91 +- **Mary Pugh Photography** (@mary.pugh.photography) — wedding
          +/senior, $300 retainer at booking.                            
       92 +- **Sabrina Harless / Heather Michelle / Baumhower Skip** — lo
          +cal generalists, no Greek positioning, on Yelp.               
       93 +- **Implication: these are NOT the competitor set.** They're p
          +riced for weddings/seniors; they don't speak chapter-language;
          + they're not bidding for $400 swap-night coverage.            
       94 +                                                              
       95 +**Tier 3 — Student / emerging photographers (the actual compet
          +itive set):**                                                 
       96 +- **Will McLelland** (@willmclellandphoto, willmclelland.smugm
          +ug.com, willmclellandphoto@gmail.com) — **the single publicly-
          +credited Bama-Greek photographer in indexed web.** Shot Tuscal
          +oosa Thread's official Bid Day 2023 coverage. Study his portfo
          +lio, captions, package structure. Being the *second* publicly-
          +credited Bama Greek photographer is a defensible position.    
       97 +- **Lilly Tucker** (@lillytuckerphotography) — portraits/forma
          +ls/grad, Bama market.                                         
       98 +- **Madelyn Barr** (@madelynbarrphotography, 677 followers); *
          +*Abby Bates** (@abbybatesseniors) — student-tier, senior/grad-
          +focused.                                                      
       99 +                                                              
      100 +### Pricing benchmarks (real numbers, real listings)          
      101 +                                                              
      102 +| Service | Benchmark |                                       
      103 +|---|---|                                                     
      104 +| US event-photography baseline (Thumbtack) | $150–$400/hr; fu
          +ll-day $1,000–$3,000; nat'l avg $358/event |                  
      105 +| Alabama avg quote (The Bash) | **$495 per booking** |       
      106 +| Tuscaloosa local wedding/grad floor | **$600–$750 starting**
          + (MKC, Mary Pugh tier) |                                      
      107 +| Mid-tier 6-hr packages (HireRush) | $500–$1,000 with 30–35 e
          +dited images |                                                
      108 +| Bid day | $0 chapter cost — monetized via members (national 
          +specialists' model) |                                         
      109 +| Composites | ~$78/officer-portrait (GreekYearbook's Delta Pa
          +ckage) |                                                      
      110 +                                                              
      111 +### The wedge — long tail of recurring chapter events (researc
          +h-confirmed)                                                  
      112 +                                                              
      113 +National specialists own bid day + composites but **ignore the
          + long tail.** Local wedding pros are priced out. Open market f
          +or two-photographer student team:                             
      114 +- Formals + semi-formals                                      
      115 +- Swaps + mixers                                              
      116 +- Philanthropy nights (Sigma Chi Derby Days, Pi Phi Arrowspike
          +, Alpha Phi King of Hearts, etc.)                             
      117 +- Big/little reveals                                          
      118 +- Date functions                                              
      119 +- GameDay tailgates                                           
      120 +- Sisterhood retreats with activity coverage                  
      121 +                                                              
      122 +**Pricing wedge: $300–$500 flat for 2–3 hr event coverage** wi
          +th 24–48 hr sneak-peek + 1-week full delivery. Undercuts weddi
          +ng pros (impossible at MKC's $750 floor), matches Thumbtack's 
          +national avg, beats chapter-budget objections.                
      123 +                                                              
      124 +**Productize three SKUs from day one:** Formal / Philanthropy 
          +/ Swap, flat fees. Optional chapter-annual retainer (e.g., 6 e
          +vents for $1,800 saves the chapter ~16%).                     
      125 +                                                              
      126 +### Operational standards (what wins / loses chapter relations
          +hips)                                                         
      127 +                                                              
      128 +| Win | Lose |                                                
      129 +|---|---|                                                     
      130 +| 24-hr sneak-peek (3–6 photos to chapter IG) | "Photos in 2–4
          + weeks" with no SLA |                                         
      131 +| Full delivery in 5–7 days | Ghosting after payment |        
      132 +| Flash mastery in low-light ballrooms | iPhone-tier indoor no
          +ise |                                                         
      133 +| Group-photo choreography (200+ pledge classes) | Chaotic gro
          +up shots, slow setups |                                       
      134 +| Speaks Greek (swaps, big/little, gameday) | Wedding-photogra
          +pher voice |                                                  
      135 +| Tagged-on-chapter-IG with credit | Generic landscape-photogr
          +apher captions |                                              
      136 +                                                              
      137 +### Methodology caveat — direct chapter interviews needed     
      138 +                                                              
      139 +Reddit / r/sorority / r/Sororities / r/Bama / r/Alabama return
          +ed **zero indexable results** for Bama Greek photography pain-
          +points across 5+ query variants. **Signal: pain lives in priva
          +te chapter GroupMes + IG DMs, not on indexed web.** Mom-Test t
          +hreshold = ~20 conversations; aim for **5 Bama chapter social-
          +chair / VP-risk / VP-recruitment interviews by end of summer**
          +. Find via incoming-freshman class GroupMe, older siblings, an
          +yone who held chapter exec role in last 2 years.              
      140 +                                                              
      141 +### Tar-pit checks performed (2026-05-19)                     
      142 +                                                              
      143 +College-town student-photographer collective — **not a tar pit
          +.** Real recurring revenue, real distribution moat (closed Gre
          +ek network), real operational standards that screen out lazy c
          +ompetitors. Multiple successful precedents exist at SEC school
          +s. Failure mode is execution (ghosting, slow delivery, weak in
          +door flash), not market.                                      
      144 +                                                              
      145  ## Pricing
      146  - Model (services): per-session; 50% deposit + 50% balance; ti
           ered $450 / $1,250 / $3,500 floors with upward negotiation.
      147  - Model (products): one-time digital purchase via Stripe Payme
           nt Link, individually-priced.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 1 line
      214  - 2026-05-19 orientation — **two locks.** (1) DyLon declined t
           he cofounder role. Team is now 2: Korrin (sole photographer + 
           brand) + Quinn (engineer + ops). Year 1 capacity = 1 shooter; 
           need a contracted second shooter at Bama by spring 2027 to sca
           le. (2) Brand selected: **Common Light Photography** (founder 
           requirement: "photography" must appear in name for SEO). `.com
           ` + IG/TikTok handle availability pending verification. Cofoun
           der split simplifies to a 2-person conversation (still needs `
           cofounder-fit` — written agreement before launch). Updated rou
           te: `founder-context` → `cofounder-fit` (2-person, asymmetric 
           labor — photographer revenue-generator vs. engineer platform-b
           uilder) → brand purchase + site relaunch under new name → `pro
           blem-focus` (lock Phase-1 Louisville ICP vs. Phase-2 Bama Gree
           k ICP) → `pricing-model` → `outreach-engine` (with DM scripts 
           for chapter execs).
      215  - 2026-05-19 cofounder-fit — diagnosed silent sales/outreach g
           ap (must be founder-led, not contractor), asymmetric labor pat
           tern (Korrin compounding per-shoot, Quinn front-loaded platfor
           m), and incomplete trial structure (shipped product together b
           ut no customer-facing disaster yet). Recommended: 50/50 equity
            vested 4yr/1yr cliff + labor compensation paid out of revenue
            before profit (shooter 60–70% session-net; engineer stipend a
           fter $1,500/mo threshold) + role-based decision tiebreakers + 
           structured Summer 2026 as 4-month trial with one-page MoU now 
           and full operating agreement by 2026-09-01. Open question to f
           ounder: nature of Korrin/Quinn relationship (friend / dating /
            family / roommate) before signing anything. Offered 4-Week Co
           founder Trial Protocol artifact — pending founder accept/decli
           ne. Brand naming reverted to TBD (Quinn disliked "Common Light
            Photography"); brand workshop deferred. Next: founder accepts
           /declines protocol artifact → answers relationship-clarity que
           stion → revisits brand naming.
      216  - 2026-05-19 cofounder-fit — Quinn ratified key terms. Relatio
           nship = friends (lowest-risk class). Sales-hat = gender-matche
           d chapter outreach (Quinn → frats, Korrin → sororities). Time 
           commitment = Quinn 10hr/wk outside shoots (brand readiness, au
           tomation, audience, social with Korrin); Korrin's number TBD i
           n Week-4 hard conversation. Hypothetical 3rd cofounder spec lo
           cked = Greek-integrated + sales + photo-optional (specifically
            the sales-gap filler). Track sequencing = brand workshop firs
           t (this week), MoU before any paid client under new brand, ful
           l operating agreement ~2026-09-01. 4-Week Cofounder Trial Prot
           ocol artifact saved at `.claude/cofounder-trial-protocol.md`. 
           Next: `founder-context` (this turn), then brand workshop next 
           session.
      217 +- 2026-05-19 founder-context — partial: surfaced 6 surgical ga
          +ps to Quinn (Korrin's photo depth, gear status, financial cont
          +ribution model, Korrin's hours/week, risk-tolerance floor, Qui
          +nn's emergency-second-shooter capability) — awaiting answers. 
          +Parallel domain-research agent completed Bama Greek-photograph
          +y market scan; **major insights:** (a) national Greek speciali
          +sts (GreekYearbook / University Photo / DPC) own bid day + com
          +posites via $0-chapter / member-monetization model — DO NOT co
          +mpete there; (b) local Tuscaloosa wedding pros (MKC $750 floor
          +, Mary Pugh) priced out of chapter-event budget; (c) only one 
          +publicly-credited Bama Greek photographer in indexed web = Wil
          +l McLelland (@willmclellandphoto); (d) real wedge = long-tail 
          +recurring events (formals, swaps, philanthropy, big/little, da
          +tes, gameday) at **$300–$500 flat / 2–3 hr / 24-hr sneak-peek*
          +*; (e) productize 3 SKUs: Formal / Philanthropy / Swap; (f) op
          +erational standards win > craft (24-hr sneak-peek, flash maste
          +ry in low-light ballrooms, group-photo choreography); (g) Redd
          +it pain-point search returned zero results = signal that chapt
          +er pain lives in private GroupMes, must Mom-Test 5+ Bama chapt
          +er execs by end of summer. State doc Competitive Landscape sec
          +tion fully rewritten with research findings.                  

⏺ ---
  Domain research back — biggest strategic upgrade so far

  Five things you need to internalize before you answer the 6 gap questions. The
   research changes the strategy.

  1. Bid day is NOT your target. Period.

  Two national specialists — GreekYearbook and University Photo — operate a
  $0-chapter-cost / member-monetization model. They show up free, sell prints to
   individual members afterward, and chapters love it because it's literally
  free. You cannot beat this. Don't try. Drop bid day from your roadmap. Energy
  goes elsewhere.

  2. The real wedge is the long tail of recurring chapter events

  National specialists own bid day + composites. Local wedding pros (MKC, Mary
  Pugh) are priced at $600–$750 floor and don't speak chapter-language. The 
  middle is empty:

  - Formals + semi-formals
  - Swaps + mixers
  - Philanthropy nights (Derby Days, King of Hearts, Arrowspike, etc.)
  - Big/little reveals
  - Date functions
  - GameDay tailgates
  - Sisterhood retreats with activity coverage

  These events happen weekly during the academic year. No one is currently
  embedded as the recurring vendor. That's your opening.

  3. Real pricing benchmark — $300–$500 flat / 2–3 hr / fast delivery

  Not my guess — research-confirmed against The Bash ($495 Alabama avg quote),
  Thumbtack ($358 nat'l avg), and the gap below MKC's $750 floor.

  Productize three SKUs from day one, flat fees, listed publicly:
  - Formal Package — 3 hr, 100–150 edited, 24-hr sneak-peek, 5-day full
  delivery: ~$450
  - Philanthropy / Greek Week Package — 4–6 hr, 200+ edited: ~$650
  - Swap / Mixer Package — 2 hr, 60–80 edited: ~$300

  Plus: Chapter Annual Retainer — 6 events for $1,800 (saves chapter ~16%, gives
   you predictable revenue + lock-out from competitors). This is the move that
  turns one chapter relationship into recurring income.

  4. There is exactly ONE publicly-credited Bama Greek photographer

  Will McLelland (@willmclellandphoto on IG, willmclellandphoto.smugmug.com).
  Tuscaloosa Thread used him for Bid Day 2023 official coverage. He's your only
  named incumbent.

  Strategic implications:
  - Study his portfolio, his caption voice, his pricing, his package structure.
  Within the week.
  - Consider whether he's competitor, friendly, or potential
  mentor/collaborator. SEC-school photographer scenes are smaller than people
  think. A direct "hi, we're starting up at Bama, would love 20 min of your
  time" message could go either way — but the downside is small.
  - Being the second publicly-credited Bama Greek photographer is a defensible
  position. Tuscaloosa Thread credits, chapter IG tags, local press features =
  the propagation path.

  5. Operational standards win, not artistic taste

  Research-confirmed photographer failure modes that kill chapter relationships
  (all operational, none artistic):

  - Slow delivery / "2–4 weeks, no SLA"
  - No same-night / 24-hr sneak-peek (now table stakes)
  - Poor flash competence in low-light ballrooms
  - Bad group-photo choreography on 200+ person pledge classes
  - Ghosting / collection friction

  Translation to your summer prep:
  - Korrin's Lightroom workflow must hit a 24-hr sneak-peek target reliably.
  Practice this on Louisville shoots all summer until it's automatic.
  - She needs to learn off-camera flash if she doesn't already. Greek formals =
  dim ballrooms. This is the #1 craft gap to close.
  - Group-direction practice — shoot at least one 30+ person group this summer
  (graduation party, family reunion, dance recital ensemble) and time yourself.

  ---
  Methodology flag from research — DM-only pain points

  The research agent couldn't surface a single Reddit thread about Bama Greek
  photography pain. That's not the absence of pain — that's signal that pain
  lives inside private chapter GroupMes + IG DMs, not on the indexed web.

  Action: before fall semester at Bama, conduct 5+ Mom-Test phone calls with
  anyone who has been on a Bama chapter exec board in the last 2 years (social
  chair, philanthropy chair, VP-recruitment, VP-risk). Sources to mine:
  - The Class of 2030 / incoming-freshman GroupMe at Bama (already exists, find
  it)
  - Older siblings of your high school classmates who went to Bama
  - Alumnae of Korrin's sorority targets (if she has them ID'd already)
  - Tuscaloosa Thread editorial — message them, ask who they'd recommend for the
   freshman-side perspective

  The questions for those calls are not "would you hire us." They're: "Walk me
  through how you booked your last 3 photographers. What went wrong? What did
  the chapter pay? How long until photos delivered? What did you wish you
  could've found?" Per The Mom Test — past behavior, not future intent.

  This is discovery-coach territory and the next-next skill after we lock the
  profile.

  ---
  Still waiting on you — the 6 surgical gap questions

  These are the only thing blocking the Founder Profile lock and the route to
  the next skill:

  1. Korrin's photo-domain depth — years active, training, published outside
  Gatton, 1–3 style references.
  2. Gear status — bodies (count + model), lenses, flash, dual-card workflow,
  edit rig.
  3. Financial contribution plan — who funds the ~$500–1,200 in summer startup
  costs.
  4. Korrin's hours/week — summer + fall. Real number.
  5. Risk tolerance floor — both of you: if $0 net + 0 chapter bookings by
  2026-12-31, do you (a) grind, (b) wind down, (c) walk?
  6. Quinn's emergency-2nd-shooter capability — could you cover a chapter event
  6 hours' notice if Korrin had to bail?

  Answer those and I'll lock the Founder Profile, then route to either /skill 
  problem-focus (drill the ICP from "Bama Greek" → specific 1st-shoot target) or
   the brand workshop (your choice; both are next-up).

✻ Cooked for 2m 5s

❯ This has all been incredibly helpful, but I need to end this session here.    
  Let's table this for next time. Document everything so far, and we'll pick up 
   from where we left off tomorrow.                                             

⏺ Capping the session. Writing a clean resumption pointer so we pick up cold
  tomorrow with no context loss.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 3 lines, removed 1 line
      1  # Startup State — Korrin's Photos — 2026-05-19
      2 -_Last updated: 2026-05-19 by orientation_                       
      2 +_Last updated: 2026-05-19 by founder-context (session end)_     
      3  _Schema version: 1.0_
      4  
      5 +> **RESUMPTION POINTER (read first on next session).** Session 1
        + ended mid-`founder-context`. Founder Profile is ~90% locked; si
        +x surgical gap questions are open (see Next Action — Human below
        +). Once those answers land, lock the Founder Profile section, th
        +en route to `problem-focus` (drill the ICP from "Bama Greek" → s
        +pecific 1st-shoot target) OR run the brand-naming workshop (foun
        +der's call — both are queued). Domain research on Bama Greek-pho
        +tography market completed today and is fully written into Compet
        +itive Landscape — do not re-research. Cofounder Trial Protocol a
        +rtifact lives at `.claude/cofounder-trial-protocol.md`.         
      6 +                                                                
      7  > **NOTE — context source.** This file was initialized by auditi
         ng the repo, not by founder interview. Every field below marked 
         `[inferred from code]` is a hypothesis, not a fact. Founder must
          confirm or correct on next pass through `founder-context`.
      8  
      9  ## Founder Profile

⏺ Update(.claude/startup-state.md)
  ⎿  Added 41 lines, removed 6 lines
      197  [ ] Pivot evaluation
      198  
      199  ## Next Action — Human (48 hours)
      200 -- Answer the 5-option orientation question (see chat).        
      201 -- Clarify: are you the photographer, the builder, both, or nei
          -ther? Is the goal (a) grow Korrin's photography business, (b) 
          -productize the platform as photographer-SaaS, or (c) both?    
      202 -- Pull from Firestore: count of paid invoices YTD, count of pr
          -oduct purchases since `/shop` launch, NPS distribution. These 
          -numbers replace landing-page claims as evidence.              
      200  
      201 +### Six surgical gap questions to close founder-context — answ
          +er first thing next session                                   
      202 +1. **Korrin's photo-domain depth:** years active, self-taught 
          +vs trained, published outside Gatton, 1–3 style references she
          + emulates.                                                    
      203 +2. **Gear status (single-point-of-failure check):** camera bod
          +ies (count + model), lenses (focal coverage), off-camera flash
          +, dual-card-slot workflow, edit rig, backup ritual.           
      204 +3. **Financial contribution model:** who funds the ~$500–1,200
          + in summer startup costs (LLC, insurance, drives, domain, soft
          +ware). Equal split / specialized split / one-fronts-all-reimbu
          +rsed.                                                         
      205 +4. **Korrin's hours/week:** real number for summer AND fall se
          +mester. No "as much as it takes."                             
      206 +5. **Risk-tolerance floor (both founders, compare):** "If by 2
          +026-12-31 (end of fall at Bama) this has produced $0 net profi
          +t and 0 chapter bookings — (a) grind, (b) wind down, (c) walk 
          +away?" Diverging answers = real gap for Week-4 hard conversati
          +on.                                                           
      207 +6. **Quinn's emergency-2nd-shooter capability:** could you cre
          +dibly cover a chapter event with 6 hr notice if Korrin was dow
          +n? Or upskill plan this summer as insurance?                  
      208 +                                                              
      209 +### Conversations to have with Korrin this week (separate from
          + above)                                                       
      210 +- Walk her through the cofounder-fit recommendation: 50/50 equ
          +ity + 4yr/1yr cliff vesting + shooter takes 60–70% session-net
          + before profit + engineer stipend after $1,500/mo threshold + 
          +role-based decision tiebreakers (Korrin = brand/creative; Quin
          +n = tech/ops).                                                
      211 +- Get her real hours/week number + her risk-tolerance floor an
          +swer (question 5 above) — both must be self-reported, don't sp
          +eak for her.                                                  
      212 +- Decide track sequencing: brand workshop this week → MoU sign
          +ed before any paid client at new brand → operating agreement b
          +y 2026-09-01.                                                 
      213 +- Share the trial protocol artifact at `.claude/cofounder-tria
          +l-protocol.md`.                                               
      214 +                                                              
      215 +### Standing operational checklist (not blocking, but pending)
      216 +- Strip fake landing-page claims (340 / 12 / 98%) from `app/pa
          +ge.tsx`.                                                      
      217 +- Delete NC city pages + Cary booking-form options; swap for L
          +ouisville now (Tuscaloosa AFTER physical move).               
      218 +- Cut booking session types to: Portrait, Senior, Event, Group
          +/Family. Remove Wedding/Editorial/Commercial until they're rea
          +l.                                                            
      219 +- Hide `/shop` route until digital products exist.            
      220 +- Feature-flag the unused admin modules (sales tax, MACRS, bro
          +adcasts, etc.) off the nav.                                   
      221 +- Lock the shared Lightroom preset Korrin will use all summer 
          +(aesthetic-consistency goal).                                 
      222 +                                                              
      223  ## Next Action — Claude (parallel)
      205 -- On founder reply, run `founder-context` to harden the Founde
          -r Profile.                                                    
      206 -- After context: if option 4 (built, need customers) → route t
          -o `outreach-engine`. If reality is closer to option 5 (have cu
          -stomers, stalled) → route to `signal-audit` first, then `pivot
          --decision` if the data shows stall.                           
      207 -- Read-only Firestore audit queries to draft once credentials 
          -available.                                                    
      224  
      225 +### When session resumes                                      
      226 +1. Read this state doc fully + `.claude/cofounder-trial-protoc
          +ol.md` before responding.                                     
      227 +2. Collect the six gap answers from Quinn (above). If Korrin's
          + input is missing on any question that requires her, flag it b
          +ut don't block.                                               
      228 +3. Lock the Founder Profile section to v1.0 (no longer "[infer
          +red from code]" tags on populated fields).                    
      229 +4. Append Session Log entry for the founder-context completion
          +.                                                             
      230 +5. Route to the next skill per Quinn's preference: either `pro
          +blem-focus` (drill ICP from "Bama Greek" → first specific shoo
          +t target) or run the brand-naming workshop (off-skill task).  
      231 +                                                              
      232 +### Skill route queue (in priority order, after founder-contex
          +t locks)                                                      
      233 +1. **Brand workshop (off-skill task)** — generate next set of 
          +name candidates after diagnosing what Quinn hated about "Commo
          +n Light Photography." User said this is Track B and should hap
          +pen first.                                                    
      234 +2. **`/skill problem-focus`** — drill ICP from broad "Bama Gre
          +ek chapter events" into the single most reachable first chapte
          +r / event / contact at Bama. Probably should follow research's
          + recommendation: forget bid day, target the long-tail recurrin
          +g events.                                                     
      235 +3. **`/skill pricing-model`** — productize the three SKUs (For
          +mal / Philanthropy / Swap) at the research-validated $300–$500
          + flat-fee tier + chapter-annual retainer concept (6 events for
          + $1,800).                                                     
      236 +4. **`/skill discovery-coach` (PREPARE mode)** — script the 5 
          +Mom-Test phone calls Quinn needs with former Bama chapter exec
          +s before fall semester. Per research finding that Reddit retur
          +ned zero indexable Bama Greek photographer pain points — chapt
          +er pain lives in private GroupMes, must be uncovered via inter
          +view.                                                         
      237 +5. **`/skill mvp-architect`** — trim the 12-wave codebase to a
          +ctual launch scope (feature-flag the unused modules; keep the 
          +ones earning their keep at 1 chapter/month scale).            
      238 +6. **`/skill outreach-engine`** — write the chapter-pitch DM s
          +cripts for Quinn (frats) + Korrin (sororities) for fall semest
          +er arrival. Output: prospect list (chapters + execs) + DM temp
          +lates + funnel math backwards from "5 chapter clients by sprin
          +g 2027" success criterion.                                    
      239 +                                                              
      240 +### Standing TODO for Claude                                  
      241 +- Re-check `vercel.json` cron + Stripe webhook activity once Q
          +uinn is back on the codebase work — confirm cron is actually f
          +iring and webhooks aren't 4xx'ing in production logs (since cu
          +rrent revenue path is real $40/hr legacy clients).            
      242 +- If founder ever asks to "look at the data" — pull paid-invoi
          +ce count, productPurchase count, NPS distribution from Firesto
          +re. These numbers replace landing-page claims as evidence per 
          +the original orientation directive.                           
      243 +                                                              
      244  ## Session Log
      245  - 2026-05-19 orientation — initialized state from a 4-subagent
            repo audit (business model, feature inventory, ICP signal, pr
           oduction maturity). No founder interview yet; everything tagge
           d as inferred. Pending founder answer to the 5-option orientat
           ion question; provisional route is `founder-context` → `outrea
           ch-engine`.
      246  - 2026-05-19 orientation — founder confirmed: this is a photog
           raphy business, not photographer-SaaS. Software is internal ov
           erhead. Founder framed self as "just starting up" while landin
           g-page copy claims 340 sessions / 12 years — contradiction fla
           gged; must reconcile before any growth strategy. Next: founder
           -context (clarify what "just starting up" actually means), the
           n outreach-engine.

⏺ Update(.claude/startup-state.md)
  ⎿  Added 1 line
      252  - 2026-05-19 cofounder-fit — diagnosed silent sales/outreach g
           ap (must be founder-led, not contractor), asymmetric labor pat
           tern (Korrin compounding per-shoot, Quinn front-loaded platfor
           m), and incomplete trial structure (shipped product together b
           ut no customer-facing disaster yet). Recommended: 50/50 equity
            vested 4yr/1yr cliff + labor compensation paid out of revenue
            before profit (shooter 60–70% session-net; engineer stipend a
           fter $1,500/mo threshold) + role-based decision tiebreakers + 
           structured Summer 2026 as 4-month trial with one-page MoU now 
           and full operating agreement by 2026-09-01. Open question to f
           ounder: nature of Korrin/Quinn relationship (friend / dating /
            family / roommate) before signing anything. Offered 4-Week Co
           founder Trial Protocol artifact — pending founder accept/decli
           ne. Brand naming reverted to TBD (Quinn disliked "Common Light
            Photography"); brand workshop deferred. Next: founder accepts
           /declines protocol artifact → answers relationship-clarity que
           stion → revisits brand naming.
      253  - 2026-05-19 cofounder-fit — Quinn ratified key terms. Relatio
           nship = friends (lowest-risk class). Sales-hat = gender-matche
           d chapter outreach (Quinn → frats, Korrin → sororities). Time 
           commitment = Quinn 10hr/wk outside shoots (brand readiness, au
           tomation, audience, social with Korrin); Korrin's number TBD i
           n Week-4 hard conversation. Hypothetical 3rd cofounder spec lo
           cked = Greek-integrated + sales + photo-optional (specifically
            the sales-gap filler). Track sequencing = brand workshop firs
           t (this week), MoU before any paid client under new brand, ful
           l operating agreement ~2026-09-01. 4-Week Cofounder Trial Prot
           ocol artifact saved at `.claude/cofounder-trial-protocol.md`. 
           Next: `founder-context` (this turn), then brand workshop next 
           session.
      254  - 2026-05-19 founder-context — partial: surfaced 6 surgical ga
           ps to Quinn (Korrin's photo depth, gear status, financial cont
           ribution model, Korrin's hours/week, risk-tolerance floor, Qui
           nn's emergency-second-shooter capability) — awaiting answers. 
           Parallel domain-research agent completed Bama Greek-photograph
           y market scan; **major insights:** (a) national Greek speciali
           sts (GreekYearbook / University Photo / DPC) own bid day + com
           posites via $0-chapter / member-monetization model — DO NOT co
           mpete there; (b) local Tuscaloosa wedding pros (MKC $750 floor
           , Mary Pugh) priced out of chapter-event budget; (c) only one 
           publicly-credited Bama Greek photographer in indexed web = Wil
           l McLelland (@willmclellandphoto); (d) real wedge = long-tail 
           recurring events (formals, swaps, philanthropy, big/little, da
           tes, gameday) at **$300–$500 flat / 2–3 hr / 24-hr sneak-peek*
           *; (e) productize 3 SKUs: Formal / Philanthropy / Swap; (f) op
           erational standards win > craft (24-hr sneak-peek, flash maste
           ry in low-light ballrooms, group-photo choreography); (g) Redd
           it pain-point search returned zero results = signal that chapt
           er pain lives in private GroupMes, must Mom-Test 5+ Bama chapt
           er execs by end of summer. State doc Competitive Landscape sec
           tion fully rewritten with research findings.
      255 +- 2026-05-19 SESSION 1 END — Quinn ended the session with foun
          +der-context still mid-flow (6 gap questions outstanding). Resu
          +mption pointer added to top of state doc; Next Action — Human 
          ++ Next Action — Claude sections populated with full decision q
          +ueue, skill route, and standing TODOs. Cofounder Trial Protoco
          +l artifact saved at `.claude/cofounder-trial-protocol.md`. Dom
          +ain research on Bama Greek photography is complete and written
          + into Competitive Landscape — DO NOT re-research next session.
          + Pick-up plan = read state doc top-to-bottom + protocol artifa
          +ct, then collect the 6 gap answers and route per Next Action —
          + Claude queue.                                                

⏺ ---
  Session 1 closed cleanly. Resume pointer set.

  Saved to disk:
  - .claude/startup-state.md — full founder state, ~v6 positioning, locked
  decisions, decision queue, skill route, standing TODOs. Resumption pointer at
  the top.
  - .claude/cofounder-trial-protocol.md — 4-week (4-month-extended) cofounder
  trial protocol with week-by-week deliverables, observation focus, Week-4
  hard-conversation agenda, MoU template.

  Where we left off:
  - Founder profile 90% locked. Six surgical gap questions outstanding (Korrin's
   photo depth, gear status, $ contribution model, Korrin's hours/wk,
  risk-tolerance floor, Quinn's emergency-2nd-shooter capability).
  - Bama Greek-photography domain research is done — written into Competitive
  Landscape. Don't waste tokens re-researching next session.

  What's queued after the gap answers:
  1. Brand workshop (you chose Track B first) — generate next name candidates
  after you tell me what specifically you hated about "Common Light
  Photography."
  2. /skill problem-focus — drill the ICP, target the long-tail recurring
  chapter events (not bid day; that market is closed).
  3. /skill pricing-model — productize the 3 SKUs at $300–$500 flat + chapter
  retainer.
  4. /skill discovery-coach (PREPARE) — script the 5 Mom-Test calls with former
  Bama chapter execs.
  5. /skill mvp-architect — trim the codebase to actual launch scope.
  6. /skill outreach-engine — chapter-pitch DM scripts for fall arrival.

  Between sessions: if you can get Korrin's answers to questions 4 (her
  hours/wk) + 5 (her risk-tolerance floor) before we resume, that unblocks the
  deepest Founder-Profile fields. Everything else you can answer solo.

  Pick up cold tomorrow by saying "resume" — I'll read the state doc + protocol
  from disk before responding. See you then.

✻ Sautéed for 1m 34s