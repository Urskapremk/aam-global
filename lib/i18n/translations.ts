// Slovenian translations keyed by the exact English source string. Anything
// not present here falls back to the English source, so a missing entry shows
// English text rather than a broken key. Shared by the client context and the
// server helper so server- and client-rendered admin text translate the same.

export type Lang = 'en' | 'sl'

export const LANG_COOKIE = 'aam-admin-lang'

// Pure lookup shared by the client context and the server helper. English
// returns the source unchanged; Slovenian falls back to the source when a
// phrase is not yet translated.
export function translate(lang: Lang, s: string): string {
  if (lang === 'en') return s
  return SL[s] ?? s
}

export const SL: Record<string, string> = {
  // --- Shell / navigation ---
  Overview: 'Pregled',
  // Nav section + mailbox title. The received-mail FOLDER stays "Prejeto"
  // (below), so the section is "Pošta" and its inbox folder is "Prejeto".
  Mail: 'Pošta',
  Inbox: 'Prejeto',
  'Boat bookings': 'Rezervacije čolnov',
  Weather: 'Vreme',
  Fleet: 'Flota',
  Trips: 'Plovbe',
  Fishing: 'Ribolov',
  Maintenance: 'Vzdrževanje',
  Fuel: 'Gorivo',
  Compliance: 'Skladnost',
  'Owner report': 'Poročilo za lastnika',
  'Crew payroll': 'Obračun posadke',
  'Odyssey pricing': 'Cenik Odyssey',
  Excursions: 'Izleti',
  'Shop products': 'Trgovina',
  'Texts & images': 'Besedila in slike',
  Web: 'Splet',
  'View site': 'Ogled strani',
  'Sign out': 'Odjava',
  Language: 'Jezik',

  // --- Overview page ---
  'Command centre': 'Poveljniški center',
  'Welcome back': 'Dobrodošli nazaj',
  'Where the boats are, then your excursions, shop and site content.':
    'Kje so čolni, nato izleti, trgovina in vsebina strani.',
  'Where the boats are, then every section of the admin in one place.':
    'Kje so čolni, nato vsi razdelki administracije na enem mestu.',
  'Manage the site': 'Upravljanje strani',
  'All sections': 'Vsi razdelki',
  Manage: 'Uredi',
  'Trips shown on AAM Charters': 'Izleti, prikazani na AAM Charters',
  'Items in the AAM Shop': 'Izdelki v trgovini AAM',
  'Home page copy and photos': 'Besedilo in fotografije domače strani',

  // --- Command center ---
  Critical: 'Kritično',
  Warning: 'Opozorilo',
  Info: 'Informacija',
  'Fleet status is unavailable right now.':
    'Stanje flote trenutno ni na voljo.',
  'On the water now': 'Trenutno na vodi',
  sunset: 'sončni zahod',
  'All clear': 'Vse v redu',
  alert: 'opozorilo',
  alerts: 'opozorila',
  Acknowledge: 'Potrdi',
  'At sea': 'Na morju',
  'All boats alongside': 'Vsi čolni v pristanu',
  'Guests out': 'Gostje na morju',
  'No trips running': 'Ni plovb v teku',
  Departing: 'Odhaja',
  'Nothing booked today': 'Danes ni rezervacij',
  'Transfers today': 'Prevozi danes',
  'Guest arrivals and departures': 'Prihodi in odhodi gostov',
  'None scheduled': 'Nič načrtovanega',
  'Trips running': 'Plovbe v teku',
  'No position — Captain Mode not reporting':
    'Ni pozicije — Kapitanski način ne poroča',
  'Position held': 'Pozicija zadržana',
  'Fleet map': 'Zemljevid flote',
  'Trip log': 'Dnevnik plovb',
  'no captain set': 'kapitan ni določen',
  guest: 'gost',
  guests: 'gostov',
  trip: 'plovba',
  trips: 'plovb',
  running: 'v teku',
  'booked today': 'rezerviranih danes',
  Left: 'Odhod',
  out: 'na morju',
  run: 'prevoženo',
  fix: 'meritev',
  'just now': 'pravkar',
  'min ago': 'min nazaj',

  // --- Mail / inbox screen ---
  Mailbox: 'Pošta',
  'Messages from the website are collected here. To send replies and notifications by email, add your':
    'Sporočila s spletne strani se zbirajo tukaj. Za pošiljanje odgovorov in obvestil po e-pošti dodajte svoj',
  'New email': 'Novo sporočilo',
  Sent: 'Poslano',
  Trash: 'Koš',
  Contacts: 'Stiki',
  'Edit folders & labels': 'Uredi mape in oznake',
  'Folders, rules and labels': 'Mape, pravila in oznake',
  'Checking…': 'Preverjam…',
  'Send & receive': 'Pošlji in prejmi',
  'Search by sender, email, subject, content or label…':
    'Iskanje po pošiljatelju, e-pošti, zadevi, vsebini ali oznaki…',
  'Tip: drag a message onto a folder on the left to file it.':
    'Namig: povlecite sporočilo na mapo levo, da ga razvrstite.',
  'No results for your search.': 'Ni zadetkov za vaše iskanje.',
  'No messages.': 'Ni sporočil.',
  'No sent messages.': 'Ni poslanih sporočil.',
  'Trash is empty.': 'Koš je prazen.',
  Unread: 'Neprebrano',
  Contact: 'Stik',
  Excursion: 'Izlet',
  Order: 'Naročilo',
  'To:': 'Za:',
  'Select a message to view.': 'Izberite sporočilo za ogled.',
  'Back to list': 'Nazaj na seznam',
  From: 'Od',
  To: 'Za',
  Labels: 'Oznake',
  'New label': 'Nova oznaka',
  'e.g. Urgent': 'npr. Nujno',
  'Adding…': 'Dodajam…',
  'Add & label': 'Dodaj in označi',
  'Move to folder': 'Premakni v mapo',
  Restore: 'Obnovi',
  'Move to trash': 'Premakni v koš',
  'Delete permanently': 'Trajno izbriši',
  Reply: 'Odgovori',
  Forward: 'Posreduj',
  'Forward to': 'Posreduj na',
  'Reply to': 'Odgovori na',
  'Write a reply…': 'Napišite odgovor…',
  'Add a message…': 'Dodajte sporočilo…',
  'Sending…': 'Pošiljam…',
  'Send reply': 'Pošlji odgovor',
  Cancel: 'Prekliči',
  'Reply sent.': 'Odgovor poslan.',
  'Message forwarded.': 'Sporočilo posredovano.',
  'Sending failed.': 'Pošiljanje ni uspelo.',
  'Refresh failed. Please try again.':
    'Osvežitev ni uspela. Poskusite znova.',
  'No new messages.': 'Ni novih sporočil.',
  'new message': 'novo sporočilo',
  'new messages': 'novih sporočil',
  'Failed to create label.': 'Oznake ni bilo mogoče ustvariti.',

  // --- Fuel screen ---
  'Fuel in the drums, deliveries in and refuels out':
    'Gorivo v sodih, dobave noter in točenja ven',
  'Fuel store': 'Zaloga goriva',
  // Exchange rate screen
  'Exchange rate': 'Tečaj',
  'Ariary, Euro and Rand': 'Ariary, evro in rand',
  'The rate used for the EUR and Rand shown beside every Ariary amount':
    'Tečaj, ki se uporabi za evre in rande ob vsakem znesku v ariaryjih',
  'Live rate': 'Živi tečaj',
  'Manual rate': 'Ročni tečaj',
  'Loading the rate…': 'Nalagam tečaj…',
  Euro: 'Evro',
  Rand: 'Rand',
  'The live market rate is used across all calculations. Your manual rate below is the fallback used only when the live rate cannot be fetched.':
    'Za vse izračune se uporablja živi tržni tečaj. Vaš ročni tečaj spodaj je rezerva, ki se uporabi le, ko živega tečaja ni mogoče pridobiti.',
  'The live rate could not be fetched, so your manual rate below is currently in use across all calculations.':
    'Živega tečaja ni bilo mogoče pridobiti, zato se za vse izračune trenutno uporablja vaš ročni tečaj spodaj.',
  'Manual rate (fallback)': 'Ročni tečaj (rezerva)',
  'Ar per 1 EUR': 'Ar za 1 EUR',
  'Ar per 1 Rand': 'Ar za 1 rand',
  'Enter a rate greater than zero for both.':
    'Za oba vpišite tečaj, večji od nič.',
  'Could not save the rate.': 'Tečaja ni bilo mogoče shraniti.',
  'Save rate': 'Shrani tečaj',
  Saved: 'Shranjeno',
  Updated: 'Posodobljeno',
  'Reading the fuel log…': 'Berem dnevnik goriva…',
  'Could not load the fuel log.':
    'Dnevnika goriva ni bilo mogoče naložiti.',
  'Fuel drums are empty': 'Sodi z gorivom so prazni',
  'Fuel is low': 'Goriva je malo',
  'Stock is': 'Zaloga je',
  'at or below the reorder level of':
    'na ali pod pragom za ponovno naročilo',
  'Time to order fuel.': 'Čas je za naročilo goriva.',
  "Stock is the fuel in the drums on land, in litres, kept from the deliveries and refuels logged here. The boats' own fuel gauges read in percentage and are recorded per trip — they are not the same measure and are not mixed in.":
    'Zaloga je gorivo v sodih na kopnem, v litrih, vodeno iz dobav in točenj, zabeleženih tukaj. Merilniki goriva na čolnih kažejo v odstotkih in se beležijo po plovbi — to ni ista mera in se ne meša skupaj.',
  Delivered: 'Dobavljeno',
  'Into boats': 'V čolne',
  'Fuel spend': 'Strošek goriva',
  'no cost entered': 'strošek ni vpisan',
  'Reorder level': 'Prag za naročilo',
  'not set': 'ni nastavljeno',
  'Log delivery': 'Vpiši dobavo',
  'Log refuel': 'Vpiši točenje',
  Adjust: 'Popravek',
  'Recent movements': 'Nedavna gibanja',
  'Nothing logged yet. Log a delivery to set your starting stock.':
    'Še nič ni zabeleženo. Vpišite dobavo za začetno zalogo.',
  'Fuel delivered to the drums': 'Gorivo dobavljeno v sode',
  'Fuel put into a boat': 'Gorivo natočeno v čoln',
  'Manual correction': 'Ročni popravek',
  'Litres (+ or −)': 'Litri (+ ali −)',
  'Reorder at (litres)': 'Naročilo pri (litri)',
  Litres: 'Litri',
  Boat: 'Čoln',
  'Cost (Ar, optional)': 'Strošek (Ar, neobvezno)',
  'e.g. 900000': 'npr. 900000',
  Reason: 'Razlog',
  'Note (optional)': 'Opomba (neobvezno)',
  'Why the correction?': 'Zakaj popravek?',
  'Supplier, drum, …': 'Dobavitelj, sod, …',
  'Logged by (optional)': 'Vpisal (neobvezno)',
  'Your name': 'Vaše ime',
  Close: 'Zapri',
  Save: 'Shrani',
  'Could not save': 'Ni bilo mogoče shraniti',
  Delivery: 'Dobava',
  Refuel: 'Točenje',
  Adjustment: 'Popravek',
  'Delete entry': 'Izbriši vnos',

  // --- Per-boat fuel ledger ---
  'Fuel on board — per boat': 'Gorivo v čolnu — po čolnih',
  'Each boat keeps its own record of the fuel on board — measured before a trip, after a trip, or on a surprise spot-check. Fuel is tracked in litres and kilograms side by side (some checks are weighed, others gauged); the two are never converted into each other.':
    'Vsak čoln vodi svojo evidenco goriva na krovu — izmerjeno pred plovbo, po plovbi ali ob nenapovedani kontroli. Gorivo se vodi v litrih in kilogramih vzporedno (nekatere kontrole se tehtajo, druge odčitajo z merilnika); enoti se nikoli ne pretvarjata druga v drugo.',
  Internal: 'Interni',
  'On board': 'Na krovu',
  'Last trip used': 'Zadnja plovba porabila',
  'Add reading': 'Dodaj odčitek',
  History: 'Zgodovina',
  'Hide history': 'Skrij zgodovino',
  'No readings yet. Add a before-trip reading to start.':
    'Še ni odčitkov. Začnite z odčitkom pred plovbo.',
  'New fuel reading': 'Nov odčitek goriva',
  'Before trip': 'Pred plovbo',
  'After trip': 'Po plovbi',
  'Spot-check': 'Kontrola',
  Kilograms: 'Kilogrami',
  // Refuel amount entry (litres / kg / cans)
  'Amount taken': 'Odneseno gorivo',
  Cans: 'Kante',
  'Number of cans': 'Število kant',
  'Can size (L)': 'Velikost kante (L)',
  'Will be recorded as': 'Zabeleženo kot',
  'Enter how much fuel went into the boat':
    'Vpišite, koliko goriva je šlo v čoln',
  'Enter the size of one can in litres':
    'Vpišite velikost ene kante v litrih',
  // Expanded entry detail
  Type: 'Vrsta',
  'Recorded amount': 'Zabeležena količina',
  'Entered as': 'Vneseno kot',
  When: 'Kdaj',
  Note: 'Opomba',
  Cost: 'Strošek',
  'Logged by': 'Vpisal',
  'Enter litres, kilograms, or both.': 'Vpišite litre, kilograme ali oboje.',
  'Enter litres, kilograms, or both': 'Vpišite litre, kilograme ali oboje',
  'Litres and kilograms convert automatically (≈ 0.75 kg/L).':
    'Litri in kilogrami se samodejno preračunajo (≈ 0,75 kg/L).',
  'Choose which engine this reading is for':
    'Izberite, za kateri motor je odčitek',
  'Trip, drum, …': 'Plovba, sod, …',

  // --- Total stock + archive ---
  'Total fuel in stock': 'Skupna zaloga goriva',
  'Everything on hand': 'Vse, kar imamo',
  plus: 'plus',
  'weighed on the boats': 'stehtano na čolnih',
  Warehouse: 'Skladišče',
  'On the boats': 'Na čolnih',
  'This is a snapshot of everything held: the warehouse drums plus the last measured fuel on each boat. Litres and kilograms are added up separately and never converted into one another.':
    'To je posnetek vsega, kar imamo: sodi v skladišču plus zadnje izmerjeno gorivo na vsakem čolnu. Litri in kilogrami se seštevajo ločeno in se nikoli ne pretvarjajo drug v drugega.',
  Archive: 'Arhiv',
  'Hide archive': 'Skrij arhiv',
  'The archive is empty.': 'Arhiv je prazen.',
  // "Restore" is already defined above (mail screen) — reused here.

  // --- Fuel procurement (pay → receive) ---
  'Fuel procurement': 'Nabava goriva',
  'New purchase': 'Nova nabava',
  'Buying fuel is two steps. First the owner pays at the station (the money is spent, but the fuel is not in the warehouse yet). Then the employee brings it in 20 L and 25 L cans — that is when the fuel, plus the transport cost, is added to the warehouse.':
    'Nabava goriva poteka v dveh korakih. Najprej lastnik plača na črpalki (denar je porabljen, a gorivo še ni v skladišču). Nato ga zaposleni pripelje v 20 L in 25 L kantah — takrat se gorivo, skupaj s stroškom prevoza, doda v skladišče.',
  'Awaiting pickup': 'Čaka na prevzem',
  Received: 'Prevzeto',
  'No purchases yet. Start with a station payment.':
    'Še ni nabav. Začnite s plačilom na črpalki.',
  'Station payment': 'Plačilo na črpalki',
  'Litres paid for': 'Plačani litri',
  'Fuel cost (Ar)': 'Strošek goriva (Ar)',
  'Station (optional)': 'Črpalka (neobvezno)',
  'Station name': 'Ime črpalke',
  'Paid by (optional)': 'Plačal (neobvezno)',
  'Receipt no., …': 'Št. predračuna, …',
  'This records the payment only — the fuel is added to the warehouse when it is received.':
    'To zabeleži samo plačilo — gorivo se doda v skladišče ob prevzemu.',
  'Save payment': 'Shrani plačilo',
  'Confirm pickup': 'Potrdi prevzem',
  'Receive into the warehouse': 'Prevzem v skladišče',
  '20 L cans': '20 L kante',
  '25 L cans': '25 L kante',
  'Transport cost (Ar)': 'Strošek prevoza (Ar)',
  'Brought by (optional)': 'Pripeljal (neobvezno)',
  'Employee name': 'Ime zaposlenega',
  'Adds to warehouse': 'Doda v skladišče',
  'Enter how many 20 L and 25 L cans arrived':
    'Vpišite, koliko 20 L in 25 L kant je prispelo',
  'Add to warehouse': 'Dodaj v skladišče',
  // "Cancel" is already defined above — reused here.
  transport: 'prevoz',

  // --- Price per litre, payment method, receipt photo ---
  'Price per 1 L (Ar)': 'Cena za 1 L (Ar)',
  'Total fuel cost': 'Skupni strošek goriva',
  'Enter the litres paid for and the price per litre':
    'Vpišite plačane litre in ceno za liter',
  'Payment method': 'Način plačila',
  Cash: 'Gotovina',
  'Orange Money': 'Orange Money',
  Card: 'Kartica',
  'Receipt photo (optional)': 'Fotografija predračuna (neobvezno)',
  'Add photo': 'Dodaj fotografijo',
  'Take a photo': 'Slikaj',
  'Take a new photo': 'Slikaj znova',
  'From gallery': 'Iz galerije',
  'Replace photo': 'Zamenjaj fotografijo',
  'Remove photo': 'Odstrani fotografijo',
  'Receipt photo': 'Fotografija predračuna',
  'View receipt': 'Odpri predračun',
  'Could not upload the photo': 'Fotografije ni bilo mogoče naložiti',

  // --- Trips / trip log screen ---
  // ('Trip log', 'Trips', 'guest'/'guests', 'trip'/'trips', 'Cancel', 'Save',
  //  'Fleet map' are already defined above and reused here.)
  'The log of every trip, and who is allowed to record one':
    'Dnevnik vseh plovb in kdo jih sme beležiti',
  'Every trip, newest first': 'Vsaka plovba, najnovejša najprej',
  'No trips recorded yet. A trip appears here as soon as a captain starts one in Captain Mode.':
    'Zabeleženih plovb še ni. Plovba se pojavi tukaj takoj, ko jo kapitan začne v Kapitanskem načinu.',
  'still open. A trip left open overnight is usually a captain who forgot to end it — you can close it here.':
    'še odprtih. Plovba, ki ostane odprta čez noč, je običajno kapitan, ki jo je pozabil zaključiti — zaprete jo lahko tukaj.',
  active: 'aktivna',
  completed: 'zaključena',
  // Trip purpose labels (lib/fleet.ts TRIP_PURPOSES). 'Fishing' is also a nav
  // label above ('Ribolov'), 'Excursion' defined earlier; the rest here.
  'Guest transfer': 'Prevoz gostov',
  'Supply run': 'Oskrba',
  'Maintenance / test': 'Vzdrževanje / test',
  Other: 'Drugo',
  engine: 'motor',
  fuel: 'goriva',
  fixes: 'meritev',
  'no track': 'brez sledi',
  'Hide track': 'Skrij sled',
  Track: 'Sled',
  Guests: 'Gostje',
  'Close from office': 'Zapri iz pisarne',
  'Delete this trip and its track? This cannot be undone.':
    'Izbrišem to plovbo in njeno sled? Tega ni mogoče razveljaviti.',
  Delete: 'Izbriši',

  // Close-trip form
  'Closing from the office. The end time is recorded as now, and the trip is marked as closed by the office rather than by the captain.':
    'Zapiranje iz pisarne. Čas konca se zabeleži kot zdaj, plovba pa je označena kot zaprta s strani pisarne in ne kapitana.',
  'Fuel left %': 'Preostalo gorivo %',
  Notes: 'Opombe',
  'What happened': 'Kaj se je zgodilo',
  'Closing…': 'Zapiram…',
  'Close trip': 'Zaključi plovbo',

  // Guest-names form
  'Guest names and where they are from appear on the Command Centre "Guests out" card while the trip is running. The guest count follows the number of names.':
    'Imena gostov in od kod so, se med potekom plovbe prikažejo na kartici »Gostje na morju« v Poveljniškem centru. Število gostov sledi številu imen.',
  Guest: 'Gost',
  'name and surname': 'ime in priimek',
  Country: 'Država',
  'Remove guest': 'Odstrani gosta',
  'Add guest': 'Dodaj gosta',
  'Saving…': 'Shranjujem…',
  'Save guests': 'Shrani goste',

  // Captains card
  Captains: 'Kapitani',
  'Who can be logged on a trip': 'Kdo je lahko zabeležen na plovbi',
  Name: 'Ime',
  'Phone (optional)': 'Telefon (neobvezno)',
  Add: 'Dodaj',
  'No captains yet. A trip can still run without one, but the log will not say who was aboard.':
    'Kapitanov še ni. Plovba lahko poteka tudi brez njega, a dnevnik ne bo povedal, kdo je bil na krovu.',
  Remove: 'Odstrani',

  // Captain Mode links card
  'Captain Mode links': 'Povezave Kapitanskega načina',
  'One link per phone': 'Ena povezava na telefon',
  'Each link is the key to one boat\u2019s Captain Mode. Send it to the captain\u2019s phone and have them add it to the home screen — no password to remember at sea. Copy a link again any time below, or revoke it if a phone is lost.':
    'Vsaka povezava je ključ do Kapitanskega načina enega čolna. Pošljite jo na kapitanov telefon in naj jo doda na začetni zaslon — brez gesla, ki bi si ga bilo treba zapomniti na morju. Povezavo lahko kadar koli spodaj znova kopirate ali jo prekličete, če se telefon izgubi.',
  'Preview address — fine for a quick test today, but it stops working once the preview shuts down. Publish the site and copy the link again before it goes on a captain\u2019s phone for good.':
    'Naslov predogleda — v redu za hiter preizkus danes, a preneha delovati, ko se predogled zapre. Objavite stran in znova kopirajte povezavo, preden trajno pristane na kapitanovem telefonu.',
  'Whose phone': 'Čigav telefon',
  Create: 'Ustvari',
  'New link — send it to the phone': 'Nova povezava — pošljite jo na telefon',
  Copied: 'Kopirano',
  'Copy link': 'Kopiraj povezavo',
  'No phones linked yet.': 'Povezanih telefonov še ni.',
  Revoked: 'Preklicano',
  'Last seen': 'Nazadnje viden',
  'Never used': 'Nikoli uporabljeno',
  'Open Captain Mode in a new tab': 'Odpri Kapitanski način v novem zavihku',
  Open: 'Odpri',
  'Copy the Captain Mode link': 'Kopiraj povezavo Kapitanskega načina',
  'Revoke this link? That phone will stop reporting.':
    'Prekličem to povezavo? Ta telefon bo prenehal poročati.',
  Revoke: 'Prekliči',

  // Trip track panel
  'Drawing the route…': 'Rišem pot…',
  'Loading the track…': 'Nalagam sled…',
  'fish on this trip': 'rib na tej plovbi',
  kept: 'obdržanih',
  released: 'izpuščenih',
  'no fish logged on this trip': 'na tej plovbi ni zabeleženih rib',
  'Green marks the mooring, dark blue dots are fish kept and pale blue released — hover any dot for the species, weight and time. Fish caught close together sit on one another until you zoom in, and a fish logged without a position is in the log but not on the map.':
    'Zeleno označuje privez, temno modre pike so obdržane ribe in svetlo modre izpuščene — pomaknite se nad piko za vrsto, težo in čas. Ribe, ujete blizu skupaj, se prekrivajo, dokler ne povečate, riba brez zabeležene pozicije pa je v dnevniku, a ne na zemljevidu.',
}
