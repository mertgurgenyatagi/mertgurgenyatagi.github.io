/**
 * Turkish, written from scratch on 2026-08-23.
 *
 * The pass this replaces was a flat table of word-for-word substitutions made
 * against English keys, and it read like one: `Draft` — the noun this whole
 * app is named after — came back as *"Taslak"*, which is a rough draft of a
 * document; `Message the lobby` became *"Lobiyi mesajla"*, an imperative aimed
 * at the room rather than a field label; `Leave →` became *"Çık…"*, an ellipsis
 * in place of an arrow. Every one of those is what happens when a key is
 * translated without the sentence it sits in.
 *
 * Three rules held here:
 *
 * 1. **A phrase is translated whole**, with its substitutions moved to where
 *    Turkish wants them. English is subject-verb-object and Turkish is
 *    subject-object-verb, so `Waiting on {name}.` has to become
 *    `{name} bekleniyor.` — the placeholder moves to the front. That is the
 *    thing the old table structurally could not do, since it received
 *    fragments.
 * 2. **Football vocabulary is the football word, not the dictionary word.**
 *    A draft is a *seçim/draft*, a lot at auction is a *parti*, the banker is
 *    the *banker*, a squad is a *kadro*, the pitch positions are the ones
 *    Turkish match reports use (stoper, ön libero, santrfor) and their
 *    abbreviations are the ones alongside them.
 * 3. **Names are not translated** — clubs and footballers keep their own
 *    spelling, which is also why they never became keys. League names follow
 *    Turkish usage: *Premier Lig* is naturalised, the other four are not.
 */
export const tr: Record<string, string> = {
  /* ---------------------------------------------------------------- brand -- */
  'footydraft': 'footydraft',
  '#footydraft — back to the home page': '#footydraft — ana sayfaya dön',

  /* --------------------------------------------------------------- formats -- */
  'Auction': 'Açık Artırma',
  'Deal or No Deal': 'Var Mısın Yok Musun',
  'Free Pick': 'Serbest Seçim',
  'Spin the Wheel': 'Çarkı Çevir',

  /* ---------------------------------------------------------------- scopes -- */
  'All players': 'Tüm oyuncular',
  'Top 5 leagues': 'En iyi 5 lig',
  'One league': 'Tek lig',

  /* --------------------------------------------------------------- leagues -- */
  'Premier League': 'Premier Lig',
  'La Liga': 'La Liga',
  'Serie A': 'Serie A',
  'Bundesliga': 'Bundesliga',
  'Ligue 1': 'Ligue 1',
  'Elsewhere': 'Diğer',

  /* ----------------------------------------------------------- constraints -- */
  '1 per club': 'Kulüp başına 1',
  '3 per club': 'Kulüp başına 3',
  '1 per nation': 'Ülke başına 1',
  '3 per nation': 'Ülke başına 3',

  /* ----------------------------------------------------------- the wheel --- */
  'By league': 'Lige göre',
  'By club': 'Kulübe göre',
  'What the wheel is cut into. Every spin uses the same one.':
    'Çarkın neye göre bölüneceği. Her çevirişte aynısı kullanılır.',

  /* ------------------------------------------------------------- positions --
     The codes are the ones Turkish match reports use, and they are kept to
     three characters because the pitch nodes and the filter chips are drawn
     to that width. */
  'GK': 'KL',
  'CB': 'STP',
  'LB': 'SLB',
  'RB': 'SĞB',
  'CDM': 'ÖLB',
  'CM': 'MOS',
  'AMF': 'OOS',
  'LW': 'SLK',
  'RW': 'SĞK',
  'ST': 'SF',

  'Goalkeeper': 'Kaleci',
  'Centre Back': 'Stoper',
  'Left Back': 'Sol bek',
  'Right Back': 'Sağ bek',
  'Defensive Midfielder': 'Ön libero',
  'Central Midfielder': 'Merkez orta saha',
  'Attacking Midfielder': 'Ofansif orta saha',
  'Left Winger': 'Sol kanat',
  'Right Winger': 'Sağ kanat',
  'Striker': 'Santrfor',

  'All positions': 'Tüm mevkiler',
  'Filter by position': 'Mevkiye göre filtrele',

  /* ------------------------------------------------------------ home page -- */
  'A drafting game for people who argue about squads':
    'Kadro tartışmayı sevenler için bir seçim oyunu',
  'Draft. Argue. Repeat.': 'Seç. Tartış. Tekrarla.',
  "Build a 4-2-3-1 out of real footballers, four different ways — auction, snake draft, deal-or-no-deal, spin the wheel. Then hold it up next to your mates' squads. No stats, no leaderboard, just bragging rights.":
    'Gerçek futbolculardan dört ayrı yoldan 4-2-3-1 kur: açık artırma, yılan usulü seçim, var mısın yok musun, çarkı çevir. Sonra kadronu arkadaşlarınınkinin yanına koy. İstatistik yok, puan tablosu yok, sadece hava atma hakkı.',
  'Single player': 'Tek oyuncu',
  'Play with friends': 'Arkadaşlarınla oyna',
  'Create a lobby': 'Lobi kur',
  'Enter room code': 'Oda kodunu gir',
  'Join lobby': 'Lobiye katıl',
  'Language': 'Dil',

  /* --------------------------------------------------------------- lobbies -- */
  'Your table': 'Masan',
  'Configuration': 'Ayarlar',
  'Draft settings': 'Seçim ayarları',
  'Format': 'Format',
  'Scope': 'Kapsam',
  'Constraint': 'Kısıt',
  'The wheel': 'Çark',
  'One per draft — constraints don’t stack, and they are shared by the table.':
    'Seçim başına bir tane — kısıtlar birbirine eklenmez ve masadaki herkes için ortaktır.',
  'Room code': 'Oda kodu',
  'Copy link': 'Bağlantıyı kopyala',
  'Link copied': 'Bağlantı kopyalandı',
  'Anyone with the code can take a seat.': 'Kodu bilen herkes bir koltuğa oturabilir.',
  'Lobby {code}': '{code} lobisi',
  'Remove': 'Çıkar',
  'One seat left': 'Bir koltuk boş',
  '{count} seats left': '{count} koltuk boş',
  '{n} / {max} seats': '{n} / {max} koltuk',
  'You': 'Sen',
  'You (Host)': 'Sen (Kurucu)',
  'Host': 'Kurucu',
  'the host': 'kurucu',
  'Seat 1': '1. koltuk',
  'Host — sets the draft on the right': 'Kurucu — sağdaki ayarları o yapar',
  'Default style': 'Varsayılan tarz',
  'At the table': 'Masada',
  'Offline': 'Bağlantı yok',
  'Pick a format to start.': 'Başlamak için bir format seç.',
  'Two at the table to start — invite someone.':
    'Başlamak için masada iki kişi olmalı — birini davet et.',
  'Only {host} can change the draft or start it.':
    'Seçimi yalnızca {host} değiştirebilir ve başlatabilir.',
  'Dimmed options don’t support {phrase}.': 'Soluk seçenekler {phrase} desteklemiyor.',
  '{name} doesn’t support {phrase}.': '{name}, {phrase} desteklemiyor.',
  '{name} — not available with {hint}': '{name} — {hint} ile kullanılamaz',
  'That constraint': 'Bu kısıt',
  'That league': 'Bu lig',
  'That scope': 'Bu kapsam',
  'Kick off →': 'Başlat →',
  'Waiting for the host': 'Kurucu bekleniyor',
  'Leave lobby': 'Lobiden çık',

  /* `{count}` is already a word here — see `seatsPhrase`. Turkish puts the
     count before the noun and the postposition at the end, so the whole
     phrase reorders rather than translating in place. */
  '{count} at the table': 'masada {count} kişiyi',
  'no': 'sıfır',
  'one': 'bir',
  'two': 'iki',
  'three': 'üç',
  'four': 'dört',
  'five': 'beş',
  'six': 'altı',
  'seven': 'yedi',
  'eight': 'sekiz',
  'nine': 'dokuz',
  'ten': 'on',
  'eleven': 'on bir',

  /* ------------------------------------------------------------- name gate -- */
  'New lobby': 'Yeni lobi',
  'Joining': 'Katılıyorsun',
  'Open a lobby': 'Lobi aç',
  'Join a lobby': 'Lobiye katıl',
  'Your name': 'Adın',
  "Everyone at the table sees it. It isn't saved anywhere else.":
    'Masadaki herkes görür. Başka hiçbir yere kaydedilmez.',
  'e.g. Alex': 'örn. Alex',
  'Cancel': 'Vazgeç',
  'Open lobby →': 'Lobiyi aç →',
  'Join lobby →': 'Lobiye katıl →',

  /* ------------------------------------------------------------------ chat -- */
  'Chat': 'Sohbet',
  'Lobby chat': 'Lobi sohbeti',
  'Draft chat': 'Seçim sohbeti',
  'Message the lobby': 'Lobiye yaz',
  'Message the room': 'Odaya yaz',
  'Nobody has said anything yet.': 'Henüz kimse bir şey yazmadı.',
  'Send': 'Gönder',

  /* --------------------------------------------------------- leaving a screen */
  'Back to home': 'Ana sayfa',
  'Back to home?': 'Ana sayfaya dönülsün mü?',
  'Leaving': 'Çıkılıyor',
  'Leave →': 'Çık →',
  'Stay': 'Kal',
  'The draft ends here. Nothing about it is saved.':
    'Seçim burada biter. Hiçbir şey kaydedilmez.',
  'The auction ends here. Nothing about it is saved.':
    'Açık artırma burada biter. Hiçbir şey kaydedilmez.',
  'Taking your seat': 'Koltuğuna oturuluyor',
  'Something broke': 'Bir şey bozuldu',
  'This screen stopped.': 'Bu ekran durdu.',
  'Nothing about the draft is saved, so there is nothing to recover. Going home and starting again is the whole fix.':
    'Seçime dair hiçbir şey kaydedilmiyor, dolayısıyla kurtarılacak bir şey de yok. Ana sayfaya dönüp yeniden başlamak tek çözüm.',
  'Reload': 'Yeniden yükle',

  /* -------------------------------------------------------- the draft screens */
  'Round': 'Tur',
  '{ordinal} round': '{n}. tur',
  'of {count}': 'toplam {count}',
  'Round {n} of {total}': 'Tur {n} / {total}',
  'Round {n} — the order reverses': '{n}. tur — sıra tersine döndü',
  'Round {n} is settled.': '{n}. tur tamamlandı.',
  'Used': 'Harcanan',
  'Table': 'Masa',
  'Whose eleven to show': 'Kimin on biri gösterilsin',
  'The elevens': 'On birler',
  'Who is left': 'Kalanlar',
  'Filled': 'Dolu',
  'Left': 'Kalan',
  'Unplaced': 'Yerleşmemiş',
  'Search the board': 'Listede ara',
  'Search this category': 'Bu kategoride ara',
  'Name, club or nation': 'İsim, kulüp veya ülke',
  'All': 'Hepsi',
  'Nobody on the board matches that.': 'Listede buna uyan kimse yok.',
  'Nobody here matches that.': 'Burada buna uyan kimse yok.',
  'Reading the board.': 'Liste okunuyor.',
  'Reading the board…': 'Liste okunuyor…',
  'Waiting for the board.': 'Liste bekleniyor.',
  'The player pool would not load.': 'Oyuncu havuzu yüklenemedi.',
  'Every eleven is full.': 'Bütün on birler tamam.',
  'Every eleven is full. The draft is done.': 'Bütün on birler tamam. Seçim bitti.',
  'The draft is done.': 'Seçim bitti.',
  'Your pick.': 'Sıra sende.',
  'Your pick': 'Sıra sende',
  '{name} is picking.': '{name} seçiyor.',
  'Waiting on {name}.': '{name} bekleniyor.',
  '{name} took {player} — {position}, {club}.': '{name}, {player} oyuncusunu aldı — {position}, {club}.',
  '{name} fills your {position}.': '{name}, {position} yerini doldurur.',
  '{count} positions open to you.': 'Sana açık {count} mevki var.',
  'Draft →': 'Seç →',
  'Draft {name} →': '{name} seç →',

  /* Why a row is struck through. Each is a whole sentence rather than a noun
     glued into an English frame — see `Blocked` in draftEngine. */
  'Already drafted.': 'Zaten seçildi.',
  'Your {position} is filled.': '{position} yerin dolu.',
  '{club} is gone.': '{club} harcandı.',
  'Three from {club} already.': '{club} kulübünden zaten üç kişi var.',
  '{nation} is gone.': '{nation} harcandı.',
  'Three from {nation} already.': '{nation} ülkesinden zaten üç kişi var.',
  'Report': 'Rapor',
  'Draft report': 'Seçim raporu',

  /* ---------------------------------------------------------- spin the wheel */
  'Spinning': 'Dönüyor',
  'Landed': 'Durdu',
  'Complete': 'Tamam',
  'The draft': 'Seçim',
  'Open board': 'Tüm liste',
  'The board is closed': 'Liste kapandı',
  'The wheel is turning': 'Çark dönüyor',
  'The wheel is turning.': 'Çark dönüyor.',
  'The wheel is spinning.': 'Çark dönüyor.',
  'The wheel is still turning.': 'Çark hâlâ dönüyor.',
  'The wheel landed on {slice}': 'Çark {slice} üzerinde durdu',
  'The wheel came up empty — the whole board is open':
    'Çark boş çıktı — bütün liste açık',
  '{where} — your pick.': '{where} — sıra sende.',
  '{where} — {name} is picking.': '{where} — {name} seçiyor.',
  'Nothing on this board fits your eleven.': 'Bu listede on birine uyan kimse yok.',
  'open slots': 'açık mevkiler',
  "{name}'s slots": '{name} için açık mevkiler',
  'Order reversed': 'Sıra tersine döndü',
  'Order as drawn': 'Sıra çekildiği gibi',

  /* ----------------------------------------------------- deal or no deal ---- */
  'The boxes': 'Kutular',
  'This round fills': 'Bu tur şurayı doldurur',
  '{count} still shut': '{count} kutu kapalı',
  'Choose a box.': 'Bir kutu seç.',
  'Whatever you open, you take.': 'Hangisini açarsan onu alırsın.',
  '{name} is choosing a box.': '{name} kutu seçiyor.',
  'Stick, or hear the offer.': 'Kal ya da teklifi dinle.',
  '{name} is deciding.': '{name} karar veriyor.',
  'Hear the offer': 'Teklifi dinle',
  'Stick with {player}': '{player} ile kal',
  'The banker offers': 'Bankerin teklifi',
  'The banker offers {player}.': 'Banker {player} oyuncusunu teklif ediyor.',
  'The banker has made {name} an offer.': 'Banker {name} oyuncusuna teklif yaptı.',
  'Back to the boxes': 'Kutulara dön',
  'Take it': 'Kabul et',
  'Go back and the next box you open is yours, whatever it holds.':
    'Dönersen açacağın ilk kutu senindir, içinden ne çıkarsa çıksın.',
  'Nothing left to go back to.': 'Dönülecek kutu kalmadı.',
  'Box {number} · {whose}': 'Kutu {number} · {whose}',
  'Box {number} — {player}, {position}, {club}.': 'Kutu {number} — {player}, {position}, {club}.',
  'yours': 'senin',
  'Open box {number}': '{number} numaralı kutuyu aç',
  '{player} — box {number}, opened by {opener}': '{player} — kutu {number}, açan {opener}',
  'You stuck with {player}.': '{player} ile kaldın.',
  '{name} sticks with {player}.': '{name}, {player} ile kalıyor.',
  'You took the deal — {player}.': 'Teklifi kabul ettin — {player}.',
  '{name} took the deal — {player}.': '{name} teklifi kabul etti — {player}.',
  'You went back to the boxes.': 'Kutulara döndün.',
  '{name} went back to the boxes.': '{name} kutulara döndü.',
  '{name} opened box {number} and took it.': '{name} {number} numaralı kutuyu açtı ve aldı.',
  '{name} takes {player}.': '{name}, {player} oyuncusunu alıyor.',
  'The next box you open fills your {position}.':
    'Açacağın ilk kutu {position} yerini doldurur.',
  'Whatever you end this round holding fills your {position}.':
    'Bu turu elinde neyle bitirirsen {position} yerini o doldurur.',
  'the table': 'masa',

  /* ---------------------------------------------------------------- auction -- */
  'The block': 'Kürsü',
  'Lot': 'Parti',
  '{count} left': '{count} kaldı',
  'Open': 'Açılış',
  'Opening': 'Açılış',
  'Highest bidder:': 'En yüksek teklif:',
  'Sold': 'Satıldı',
  'Unsold': 'Satılmadı',
  'Nothing has gone yet.': 'Henüz bir şey satılmadı.',
  'Closed': 'Kapandı',
  'Your budget': 'Bütçen',
  'Pass': 'Pas',
  'Passed': 'Pas geçti',
  'Open the bidding': 'Açılış teklifi',
  'Raise by {amount}': '{amount} artır',
  'Bidding opens in {seconds}': 'Teklifler {seconds} saniye sonra açılıyor',
  'You hold this lot.': 'Bu parti şu an sende.',
  'You have passed on this lot.': 'Bu partide pas geçtin.',
}
