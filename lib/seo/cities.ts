// lib/seo/cities.ts
// Static seed data for the public /locations/[citySlug] landing pages.
// Phase 13.7 — Local SEO autopilot.
//
// Pure module: no I/O, no Firestore, no external deps. Importable from
// Server Components, Server Actions, generateStaticParams, and the sitemap.
//
// Each entry is hand-written editorial copy that should sound like a real
// solo photographer who lives in the Triangle and shoots across NC. If you
// add or edit a seed, keep the voice — specific landmarks, real seasons,
// honest travel notes. Avoid "our team of professional photographers."

export interface CityVenue {
  name:          string;
  neighborhood?: string;
  description?:  string;
}

export interface CityFaq {
  q: string;
  a: string;
}

export interface CitySeed {
  /** URL slug, e.g. "cary". Lowercase, hyphenated, ASCII. */
  slug:               string;
  /** Display city name, e.g. "Cary". */
  city:               string;
  /** USPS state abbreviation, e.g. "NC". */
  state:              string;
  /** Loose region grouping, e.g. "Triangle", "Coastal", "Mountains". */
  region:             string;
  /** Approximate population (used for editorial framing, not displayed verbatim). */
  population?:        number;
  /** 2-3 sentence editorial intro mentioning real local landmarks. */
  intro:              string;
  /** Real venues couples / families actually book — not generic "wedding venues". */
  popularVenues:      CityVenue[];
  /** Best months/windows to shoot, with the reason. */
  bestSeasons:        string[];
  /** Specific golden-hour locations a photographer would actually scout. */
  goldenHourSpots:    string[];
  /** For non-Triangle cities: travel fee context. */
  travelNote?:        string;
  testimonialQuote?:  string;
  testimonialAuthor?: string;
  faq:                CityFaq[];
}

export const CITY_SEEDS: CitySeed[] = [
  // ────────────────────────────────────────────────────────────────────────
  {
    slug:       "cary",
    city:       "Cary",
    state:      "NC",
    region:     "Triangle",
    population: 180000,
    intro:
      "Cary is home base. I live a short drive from Bond Park and shoot regularly at the Booth Amphitheater lawn, around the downtown park's wooden pavilion, and along the quieter trails that thread through Hemlock Bluffs. Knowing this town lets me work fast — I already know which bench catches 6:45 light in October.",
    popularVenues: [
      {
        name:         "Fred G. Bond Metro Park",
        neighborhood: "Central Cary",
        description:
          "Pine canopy, the lakeside boardwalk, and a tucked-away dock that reads like a private island at sunset. My most-booked Cary location.",
      },
      {
        name:         "Downtown Cary Park",
        neighborhood: "Downtown",
        description:
          "Newer city park with the Cary Theater wall, the Pavilion's clean architectural lines, and Academy Street's brick storefronts a half block away.",
      },
      {
        name:         "Booth Amphitheater & Symphony Lake",
        neighborhood: "Regency",
        description:
          "Open sky, mirrored water, and a long lakeshore path that empties out by 5pm on weekdays. Best for engagements and family sessions.",
      },
      {
        name:         "Hemlock Bluffs Nature Preserve",
        neighborhood: "Kildaire Farm",
        description:
          "Mountain laurel and a deck overlooking Swift Creek. Quiet, woodsy, and the closest thing in town to the Blue Ridge.",
      },
      {
        name:         "Page-Walker Arts & History Center",
        neighborhood: "Downtown",
        description:
          "Restored 1868 hotel with a wraparound porch and rose garden — one of the few intimate wedding venues actually inside town limits.",
      },
    ],
    bestSeasons: [
      "April–May (dogwoods, azaleas, peak Bond Park bloom)",
      "October (long golden hour, hardwood color through Hemlock Bluffs)",
      "Late February (camellias and bare-branch architecture)",
    ],
    goldenHourSpots: [
      "The east-facing dock at Bond Park Lake (sunset reflection)",
      "Symphony Lake's western shoreline 60 minutes before dusk",
      "Academy Street's brick wall at the corner of Chatham (warm bounce light)",
      "Hemlock Bluffs' upper boardwalk an hour before sunset",
    ],
    testimonialQuote:
      "Korrin knew exactly where to put us at Bond Park as the light moved. We barely had to think — she just kept finding pockets.",
    testimonialAuthor: "Megan & Tyler — Cary engagement, October",
    faq: [
      {
        q: "Do you need a permit to shoot at Bond Park or Hemlock Bluffs?",
        a: "For private sessions under 10 people, no — I've shot at both for years without one. Larger wedding parties or anything involving props beyond a chair should pull a small commercial permit through the Town of Cary; I'll handle it.",
      },
      {
        q: "What's the best time of day for a Cary portrait session?",
        a: "Either 75 minutes before sunset or 45 minutes after sunrise. Bond Park and Symphony Lake both face directions that catch the warm window beautifully — midday gets harsh under the pine canopy.",
      },
      {
        q: "Can we do an indoor backup if it rains?",
        a: "Yes. The Cary Arts Center, the Page-Walker, and a few covered downtown porches all work. I keep a short list of weather-backup options for every Cary booking.",
      },
      {
        q: "How far out should we book a Cary wedding?",
        a: "Saturdays in April, May, October, and early November book 9–12 months ahead. Weekdays and off-season Sundays often have a 4–6 month window. Always worth asking.",
      },
      {
        q: "Do you charge a travel fee in Cary?",
        a: "No. Cary, Apex, Morrisville, and west Raleigh are home territory — no travel fee, ever.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug:       "raleigh",
    city:       "Raleigh",
    state:      "NC",
    region:     "Triangle",
    population: 470000,
    intro:
      "Raleigh is where I shoot most of my wedding work. Dorothea Dix Park's hilltop has the best skyline view in the state, the rose garden at Raleigh Little Theatre is a spring secret, and Pullen Park's carousel pavilion has saved more than one rainy engagement session. The city rewards photographers who know its corners.",
    popularVenues: [
      {
        name:         "Dorothea Dix Park",
        neighborhood: "Boylan Heights",
        description:
          "308 acres of meadow with the downtown skyline as a backdrop. The sunflower field in late August is unreal; the Big Field at sunset year-round is even better.",
      },
      {
        name:         "The Stockroom at 230",
        neighborhood: "Fayetteville Street",
        description:
          "Rooftop with the Capitol behind you and a brick interior with industrial windows. One of the most consistently photographed wedding venues in the city for a reason.",
      },
      {
        name:         "Pullen Park",
        neighborhood: "NCSU",
        description:
          "1887 carousel, paddle boats, and a covered pavilion that doubles as an indoor backup. Family sessions feel storybook here.",
      },
      {
        name:         "Raleigh Rose Garden (Raleigh Little Theatre)",
        neighborhood: "Five Points",
        description:
          "Free and public. Peak bloom is mid-May; the pergola benches are sacred. Get there before 8am on a weekend.",
      },
      {
        name:         "Market Hall / City Market",
        neighborhood: "Moore Square",
        description:
          "Cobblestones, exposed brick, and string lights — best after the dinner rush, when the alleys go quiet.",
      },
    ],
    bestSeasons: [
      "Late April–May (rose garden peak, dogwoods on Glenwood)",
      "Mid-October (downtown golden hour holds longer)",
      "August (Dorothea Dix sunflower field, only ~3 weeks)",
    ],
    goldenHourSpots: [
      "Dix Park's Big Field facing the skyline at last light",
      "The lawn behind the Capitol building (clean granite + warm light)",
      "Pullen Park's carousel exterior 45 minutes before sunset",
      "Boylan Bridge overlook (skyline silhouette + freight tracks)",
    ],
    testimonialQuote:
      "We had a 30-minute window between the ceremony and reception. Korrin walked us across Fayetteville Street and got images we still hang in our hallway four years later.",
    testimonialAuthor: "Anna & David — Stockroom wedding, May",
    faq: [
      {
        q: "Do I need a permit for Dorothea Dix Park photos?",
        a: "For a private portrait session, no permit. For weddings or anything with structures (arches, chairs, etc.) the city requires a $50–$200 permit through the Dix Park Conservancy. I'll walk you through the form.",
      },
      {
        q: "What's the best Raleigh location for a city skyline portrait?",
        a: "Dorothea Dix's Big Field is the postcard answer. Boylan Bridge is the photographer's answer — fewer people, better silhouette, freight train if you're lucky.",
      },
      {
        q: "Can you photograph at the NC Museum of Art grounds?",
        a: "Yes, the Museum Park trails and the Cloud Chamber installation are open to the public for personal photography. Their formal commercial-shoot permit only kicks in for paid commercial work; couples sessions don't trigger it.",
      },
      {
        q: "How early should we book a Raleigh wedding date?",
        a: "Stockroom, Merrimon-Wynne, and the Cookery book 12–14 months out for Saturdays April–June and September–November. Friday or Sunday weddings are easier to land closer in.",
      },
      {
        q: "Do you travel within Raleigh for free?",
        a: "Yes. All of Raleigh, including the museum district and North Hills, is included with no travel fee.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug:       "durham",
    city:       "Durham",
    state:      "NC",
    region:     "Triangle",
    population: 290000,
    intro:
      "Durham photographs differently than its neighbors — it's older, browner, and the light bounces off brick instead of glass. Sarah P. Duke Gardens still sets the bar for spring portraits in the Triangle, and the American Tobacco Campus' covered walkways have rescued me from more than one summer thunderstorm. I shoot here often enough to know the security guards by name.",
    popularVenues: [
      {
        name:         "Sarah P. Duke Gardens",
        neighborhood: "Duke West Campus",
        description:
          "55 acres of curated gardens. The Italianate terraces in April, the Asiatic arboretum in October, the wisteria pergola for a 10-day window in late April.",
      },
      {
        name:         "American Tobacco Campus",
        neighborhood: "Downtown",
        description:
          "Restored brick warehouses, water features, the Lucky Strike tower, and covered alleys for weather backup. Engagement-session staple.",
      },
      {
        name:         "21c Museum Hotel",
        neighborhood: "Downtown",
        description:
          "Marble lobby, contemporary art installations, a fifth-floor terrace, and a doorman who is genuinely kind to photographers.",
      },
      {
        name:         "Eno River State Park",
        neighborhood: "North Durham",
        description:
          "Cox Mountain trail and the river crossings — the closest piece of real wilderness to downtown. Best in late October.",
      },
      {
        name:         "Cocoa Cinnamon (Lakewood)",
        neighborhood: "Lakewood",
        description:
          "Murals, pink awning, the back patio. A five-minute lifestyle backdrop that reads as completely Durham.",
      },
    ],
    bestSeasons: [
      "Mid-April (Duke Gardens wisteria + cherry blossoms)",
      "Late October (Eno River foliage, golden brick downtown)",
      "Early March (camellias and magnolia at Duke before the crowds arrive)",
    ],
    goldenHourSpots: [
      "Duke Gardens' terrace overlook 90 minutes before close",
      "American Tobacco's water-feature plaza at sunset",
      "21c rooftop terrace (golden window: 6:00–6:45pm in summer)",
      "Eno River West Point on the Eno bridge — late afternoon",
    ],
    testimonialQuote:
      "Duke Gardens in April is a zoo. Korrin somehow found us a corner with no one in it for 40 straight minutes.",
    testimonialAuthor: "Priya & Jonathan — Duke Gardens engagement, April",
    faq: [
      {
        q: "Do you need a permit at Sarah P. Duke Gardens?",
        a: "Yes — Duke Gardens requires a $250 photography fee per session, plus a reserved time slot. I'll handle the permit and bake the fee into your invoice if you'd like, or you can book it directly through the gardens' website.",
      },
      {
        q: "Is the American Tobacco Campus public for portraits?",
        a: "Yes for personal portraits and engagements. Weddings and ticketed events require a commercial permit through Capitol Broadcasting; small couples shoots are unrestricted as long as you stay clear of restaurant patios during service hours.",
      },
      {
        q: "What's the best Durham wedding venue with on-site getting-ready space?",
        a: "21c Museum Hotel and The Rickhouse are the two I recommend most. Both have suites large enough for a full bridal party and natural light that doesn't fight a photographer.",
      },
      {
        q: "How long does it take to drive between Durham and Cary for a same-day shoot?",
        a: "20–30 minutes off-peak via I-40, longer in afternoon rush. I plan multi-location days around 4pm departures so we don't burn the golden hour in traffic.",
      },
      {
        q: "Travel fee for Durham?",
        a: "None. Durham is included in the Triangle base service area.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug:       "chapel-hill",
    city:       "Chapel Hill",
    state:      "NC",
    region:     "Triangle",
    population: 62000,
    intro:
      "Chapel Hill is small, walkable, and overgrown in the best way. The Coker Arboretum's spring tunnel of cherry trees is genuinely one of the prettiest 200 feet of trail in the state. Franklin Street's old storefronts photograph like they did in 1985, and the Carolina Inn's brick courtyard is a wedding institution. Most of my Chapel Hill sessions wrap with a beer at He's Not Here.",
    popularVenues: [
      {
        name:         "The Carolina Inn",
        neighborhood: "Cameron Avenue",
        description:
          "1924 colonial brick, magnolia courtyards, and the Old Well a five-minute walk away. The grand dame of UNC weddings.",
      },
      {
        name:         "Coker Arboretum",
        neighborhood: "UNC Campus",
        description:
          "Free public garden tucked into the north quad. Wisteria arch in April, dogwoods overhead, the iconic UNC bell tower visible at the south gate.",
      },
      {
        name:         "The Old Well",
        neighborhood: "McCorkle Place",
        description:
          "Tiny circular shrine but the campus icon. Best at sunrise (no students) or after 7pm in summer.",
      },
      {
        name:         "Franklin Street + Sutton's Drug Store",
        neighborhood: "Downtown",
        description:
          "Awnings, the old movie marquee, the pharmacy lunch counter. Great for engagement story-of-us shots.",
      },
      {
        name:         "North Carolina Botanical Garden",
        neighborhood: "South Chapel Hill",
        description:
          "Native-plant focused, less crowded than Duke, free admission. The Piedmont Habitat trail is golden in October.",
      },
    ],
    bestSeasons: [
      "Late March–April (cherry blossoms at Coker, dogwoods on McCorkle)",
      "October (UNC homecoming weekends excepted)",
      "Late May (peak magnolia at the Carolina Inn courtyard)",
    ],
    goldenHourSpots: [
      "Coker Arboretum's east entrance 45 minutes before sunset",
      "The Carolina Inn's south lawn (warm brick + back-light)",
      "Franklin Street rooftop (Spanky's patio level) at last light",
      "NC Botanical Garden's courtyard pond at golden hour",
    ],
    testimonialQuote:
      "We met at UNC. Korrin walked us through campus like we were tourists in our own love story.",
    testimonialAuthor: "Jess & Ravi — Coker Arboretum engagement, April",
    faq: [
      {
        q: "Are UNC campus locations open to the public for portraits?",
        a: "Yes for personal portraits — Coker Arboretum, the Old Well, McCorkle Place, and Polk Place are all free and unrestricted. Commercial shoots and tripod-heavy setups require a UNC photo permit.",
      },
      {
        q: "When do the Coker Arboretum cherries peak?",
        a: "Almost always between March 25 and April 8. I track bloom reports starting in mid-March and will text you 48 hours before peak if you've booked a flexible spring date.",
      },
      {
        q: "What's the best Chapel Hill venue for a small intimate wedding?",
        a: "The Horace Williams House and the back garden at The Carolina Inn both handle 30–60 guests beautifully. For something more rustic, check The Barn at Valhalla just north of town.",
      },
      {
        q: "Can we photograph at the Dean Smith Center or Kenan Stadium?",
        a: "Generally no — those are athletics venues with strict permitting. I can get you the iconic UNC backdrop without needing them.",
      },
      {
        q: "Travel fee for Chapel Hill?",
        a: "Included. Chapel Hill, Carrboro, and Hillsborough are all part of the Triangle base service area.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug:       "asheville",
    city:       "Asheville",
    state:      "NC",
    region:     "Mountains",
    population: 95000,
    intro:
      "Asheville is the trip I plan around twice a year and travel for whenever a couple asks. The Blue Ridge Parkway's overlooks at Craggy Gardens, the moss and granite at Graveyard Fields, and the Biltmore's stone facade in late October all photograph like another country. I bring a second body, an extra battery for cold mornings, and usually arrive a day early to scout.",
    popularVenues: [
      {
        name:         "The Biltmore Estate",
        neighborhood: "South Asheville",
        description:
          "America's largest private home. The walled garden in May, the conservatory year-round, and the Italian Garden at last light.",
      },
      {
        name:         "Craggy Gardens (Blue Ridge Parkway, MP 364)",
        neighborhood: "BRP North",
        description:
          "Above-treeline rhododendron balds with 360° mountain views. Mid-June bloom is genuinely otherworldly. Layer up — it's 15° cooler than downtown.",
      },
      {
        name:         "The Omni Grove Park Inn",
        neighborhood: "North Asheville",
        description:
          "Granite-stone arts-and-crafts hotel with a sunset terrace overlooking the Blue Ridge. The fireplace lobby in winter is unbeatable.",
      },
      {
        name:         "Graveyard Fields",
        neighborhood: "BRP MP 418",
        description:
          "Open meadow ringed by mountains, two waterfalls, blueberry bushes that turn crimson in October. About 50 minutes from downtown.",
      },
      {
        name:         "River Arts District",
        neighborhood: "RAD",
        description:
          "Industrial brick warehouses turned studios, murals everywhere, and the French Broad River as a backdrop. Best for editorial and elopement portraits.",
      },
    ],
    bestSeasons: [
      "Mid-October (peak fall color, parkway overlooks at their best)",
      "Mid-June (Craggy Gardens rhododendron bloom, ~10-day window)",
      "Late April–early May (dogwoods at lower elevation, lilac at Biltmore)",
    ],
    goldenHourSpots: [
      "Craggy Pinnacle summit 45 minutes before sunset",
      "Biltmore's Italian Garden west terrace at last light",
      "Grove Park Inn sunset terrace (book a drink, stay for the show)",
      "Mills River overlook (BRP MP 404) 30 min before dusk",
    ],
    travelNote:
      "Asheville is a 4-hour drive from Cary. I keep travel honest: a flat $400 covers gas, lodging, and the day before I arrive to scout. Waived on packages above $5,000 or for two-day elopement bookings.",
    testimonialQuote:
      "Korrin drove out the night before our elopement, hiked 90 minutes to the summit with us, and never made it feel like work. The photos still take our breath away.",
    testimonialAuthor: "Sam & Riley — Craggy Pinnacle elopement, October",
    faq: [
      {
        q: "Do you travel from the Triangle to Asheville?",
        a: "Yes — frequently. I've shot 12+ Asheville weddings and elopements. Travel adds a flat $400 for gas, lodging, and a scouting day. Waived above $5,000 packages or for two-day bookings.",
      },
      {
        q: "Do I need a permit for Blue Ridge Parkway portraits?",
        a: "For personal portraits with handheld gear, no — the BRP allows incidental photography at all overlooks. Weddings and ceremonies require a $100 commercial permit through the National Park Service. I'll file it.",
      },
      {
        q: "What's the best month for an Asheville fall portrait?",
        a: "October 15–25 is the sweet spot at parkway elevations. Lower elevations peak around November 1. I'll watch the fall foliage maps and lock in a date as the season approaches.",
      },
      {
        q: "Can we elope at the Biltmore?",
        a: "Yes — they offer dedicated elopement packages with on-site permits included. I work with their event coordinators regularly and can recommend the best garden ceremony spots based on time of year.",
      },
      {
        q: "What about altitude and weather at Craggy?",
        a: "Craggy sits at 5,892 ft and is regularly 15–20°F cooler than Asheville with possible afternoon clouds. I plan a weather window with at least one backup day for outdoor mountain bookings.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug:       "wilmington",
    city:       "Wilmington",
    state:      "NC",
    region:     "Coastal",
    population: 120000,
    intro:
      "Wilmington and the surrounding beaches are where my Triangle clients run for a long-weekend wedding or an anniversary session. Wrightsville's north end at low tide is the cleanest sand in the state, the live oaks at Airlie Gardens drip with Spanish moss, and downtown's cobblestone riverfront photographs like a postcard from 1900. I drive down from Cary, which takes about two hours.",
    popularVenues: [
      {
        name:         "Airlie Gardens",
        neighborhood: "Wrightsville Sound",
        description:
          "67 acres of historic gardens with a 470-year-old live oak — the Airlie Oak. Azaleas in April, camellias in February, and a freshwater lake throughout.",
      },
      {
        name:         "Wrightsville Beach (north end)",
        neighborhood: "Wrightsville",
        description:
          "Public access, cleanest sand, and at low tide the wet flat reflects the sky. Best at sunrise — sunset on the Atlantic is technically a back-light shoot.",
      },
      {
        name:         "Bellamy Mansion",
        neighborhood: "Downtown",
        description:
          "1859 Greek Revival with iron-grille balconies and a slave-quarters museum on site. Photogenic from every angle and historically significant.",
      },
      {
        name:         "Downtown Riverwalk + Cape Fear River",
        neighborhood: "Downtown",
        description:
          "Cobblestone street, the USS North Carolina battleship across the river, sunset back-light on the water. Go after 6pm on weekdays.",
      },
      {
        name:         "Fort Fisher Beach",
        neighborhood: "Kure Beach",
        description:
          "Dunes, sea oats, and a quieter alternative to Wrightsville. About 25 minutes south of downtown — worth the drive for elopements.",
      },
    ],
    bestSeasons: [
      "Early April (Airlie azalea peak — only 2 weeks)",
      "October (cooler beach temps, clearer water, no crowds)",
      "Late May (warm enough to swim, before hurricane season turns)",
    ],
    goldenHourSpots: [
      "Wrightsville Beach north end at sunrise (45 minutes before)",
      "Airlie Oak 60 minutes before sunset (warm light through Spanish moss)",
      "Cape Fear Riverwalk facing west at last light",
      "Fort Fisher dunes 30 minutes before sunset",
    ],
    travelNote:
      "Wilmington is a 2-hour drive from Cary. Travel is a flat $200 round-trip, waived on packages above $4,000.",
    testimonialQuote:
      "We wanted Wrightsville at sunrise. Korrin met us at the access point at 5:45am with coffee. We have 200 photos and not one of them looks like the same beach.",
    testimonialAuthor: "Hannah & Marcus — Wrightsville Beach engagement, May",
    faq: [
      {
        q: "Do you travel to Wilmington from the Triangle?",
        a: "Yes. Travel is a flat $200 round-trip from Cary, waived on packages above $4,000. I usually drive down the morning of and back the same evening for portrait sessions; weddings get an overnight stay built in.",
      },
      {
        q: "Are the Wrightsville Beach access points free?",
        a: "Yes — public access is free at every numbered Beach Access on Wrightsville. Paid parking lots are $5/hr in season. The north end (past Lumina Avenue) is the prettiest and least crowded.",
      },
      {
        q: "Do I need a permit for an Airlie Gardens session?",
        a: "Yes — Airlie charges a $250 photography fee on top of admission for portrait sessions. Weddings have their own venue rental. I'll handle the permit paperwork.",
      },
      {
        q: "What about hurricane season for fall weddings?",
        a: "Atlantic hurricane season runs June through November but the highest-risk window is mid-August through mid-October. I always recommend trip insurance for coastal weddings in that window and we plan a weather backup.",
      },
      {
        q: "Best time of day for Wilmington beach portraits?",
        a: "Sunrise. The Atlantic faces east, so sunset on the beach is back-lit silhouettes only — beautiful in their own right, but sunrise gives you front-lit faces with warm color and an empty beach.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────
  {
    slug:       "charlotte",
    city:       "Charlotte",
    state:      "NC",
    region:     "Piedmont",
    population: 880000,
    intro:
      "Charlotte is the modern counterpoint to Raleigh — taller, denser, and with light that bounces off glass instead of brick. Freedom Park's lake-and-bridge combo is the city's most-shot engagement spot for good reason, and the rooftop at the Ledgewood Apartments has a skyline view I keep coming back to. I drive down for Charlotte bookings about a half-dozen times a year.",
    popularVenues: [
      {
        name:         "Freedom Park",
        neighborhood: "Myers Park",
        description:
          "Arched bridge over the lake, oak-lined paths, and the cleanest Charlotte skyline backdrop in the city. Always busy on weekends — go weekdays.",
      },
      {
        name:         "The Mint Museum (Randolph)",
        neighborhood: "Eastover",
        description:
          "1936 mint building turned art museum, walled gardens, and a sloping lawn. The grounds are public and free; the museum charges for interiors.",
      },
      {
        name:         "Romare Bearden Park",
        neighborhood: "Uptown",
        description:
          "Modern uptown park with the Bank of America tower and Duke Energy Center as the backdrop. Best for editorial-style portraits.",
      },
      {
        name:         "The Duke Mansion",
        neighborhood: "Myers Park",
        description:
          "1915 Colonial Revival on 4.5 acres of formal gardens. One of Charlotte's most-photographed wedding venues.",
      },
      {
        name:         "South End Rail Trail",
        neighborhood: "South End",
        description:
          "Murals, exposed brick warehouses, the Lynx light rail running through. Great for an editorial engagement walk.",
      },
    ],
    bestSeasons: [
      "April (dogwoods, azaleas at Freedom Park)",
      "October (skyline reflections in Marshall Park lake)",
      "Late February (camellias at the Mint Museum gardens)",
    ],
    goldenHourSpots: [
      "Freedom Park bridge 60 minutes before sunset",
      "Romare Bearden Park west lawn (skyline + low sun)",
      "South End Rail Trail at the Atherton Mill stretch",
      "Marshall Park lake at last light (skyline reflection)",
    ],
    travelNote:
      "Charlotte is a 2.5-hour drive from Cary. Travel is a flat $300 round-trip, waived on packages above $4,500.",
    testimonialQuote:
      "Korrin made the trip from Raleigh feel like she lived around the corner. She knew Freedom Park better than my fiancé and he grew up here.",
    testimonialAuthor: "Olivia & Brendan — Freedom Park engagement, April",
    faq: [
      {
        q: "Do you travel to Charlotte from the Triangle?",
        a: "Yes — about 6–8 times a year. Travel is a flat $300 round-trip from Cary, waived on packages above $4,500. For weddings I drive down the day before and stay over.",
      },
      {
        q: "Are permits required for Freedom Park or Romare Bearden Park?",
        a: "For private portrait sessions, no permit needed. Weddings (with chairs, arches, etc.) require a Mecklenburg County Park & Rec permit, typically $50–$150. I'll file it for any wedding booking.",
      },
      {
        q: "What's the best uptown Charlotte spot for a skyline portrait?",
        a: "Romare Bearden Park's west lawn at sunset puts the BofA tower over your shoulder with warm light on faces. Marshall Park's lake gives you the same skyline reflected in water.",
      },
      {
        q: "How early should we book a Charlotte wedding?",
        a: "Top venues like the Duke Mansion, Foundation for the Carolinas, and the Mint Museum book 12–15 months ahead for spring and fall Saturdays. Off-season and weekday weddings are easier to land.",
      },
      {
        q: "Best Charlotte month for outdoor portraits?",
        a: "October — cooler temps, lower humidity, longer golden hour, and hardwood color in Myers Park is genuinely beautiful.",
      },
    ],
  },
];

/**
 * Returns the seed for a given slug, or `undefined` if not found.
 * Pure lookup — safe to call from `notFound()` guards.
 */
export function findCitySeed(slug: string): CitySeed | undefined {
  return CITY_SEEDS.find((c) => c.slug === slug);
}
