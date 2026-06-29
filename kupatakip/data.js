// ============================================================
//  KupaTakip - Veri Dosyası
// ============================================================

// Türkçe takım adı → İngilizce takım adı
const TR_TO_EN = {
  "Almanya": "Germany",
  "Fransa": "France",
  "Hollanda": "Netherlands",
  "Brezilya": "Brazil",
  "Arjantin": "Argentina",
  "İspanya": "Spain",
  "Portekiz": "Portugal",
  "Belçika": "Belgium",
  "İngiltere": "England",
  "İsviçre": "Switzerland",
  "Japonya": "Japan",
  "Norveç": "Norway",
  "Meksika": "Mexico",
  "Kolombiya": "Colombia",
  "Fas": "Morocco",
  "Senegal": "Senegal",
  "Bosna Hersek": "Bosnia and Herzegovina",
  "Kanada": "Canada",
  "ABD": "United States",
  "Hırvatistan": "Croatia",
  "Avusturya": "Austria",
  "Güney Afrika": "South Africa",
  "Ekvador": "Ecuador",
  "Mısır": "Egypt",
  "Avustralya": "Australia",
  "Cezayir": "Algeria",
  "Fildişi Sahilleri": "Ivory Coast",
  "Yeşil Burun Adaları": "Cape Verde",
  "İsveç": "Sweden",
  "Paraguay": "Paraguay",
  "Gana": "Ghana",
  "Kuzey Kongo Cumhuriyeti": "DR Congo"
};

// İngilizce → Türkçe (reverse lookup)
const EN_TO_TR = Object.fromEntries(Object.entries(TR_TO_EN).map(([tr, en]) => [en, tr]));

// İngilizce takım adı → bayrak dosyası adı
const FLAG_FILES = {
  "Germany":                  "Flag_of_Germany_Flat_Round-128x128.png",
  "France":                   "Flag_of_France_Flat_Round-128x128.png",
  "Netherlands":              "Flag_of_Netherlands_Flat_Round-128x128.png",
  "Brazil":                   "Flag_of_Brazil_Flat_Round-128x128.png",
  "Argentina":                "Flag_of_Argentina_Flat_Round-128x128.png",
  "Spain":                    "Flag_of_Spain_Flat_Round-128x128.png",
  "Portugal":                 "Flag_of_Portugal_Flat_Round-128x128.png",
  "Belgium":                  "Flag_of_Belgium_Flat_Round-128x128.png",
  "England":                  "Flag_of_England_Flat_Round-128x128.png",
  "Switzerland":              "Flag_of_Switzerland_Flat_Round-128x128.png",
  "Japan":                    "Flag_of_Japan_Flat_Round-128x128.png",
  "Norway":                   "Flag_of_Norway_Flat_Round-128x128.png",
  "Mexico":                   "Flag_of_Mexico_Flat_Round-128x128.png",
  "Colombia":                 "Flag_of_Colombia_Flat_Round-128x128.png",
  "Morocco":                  "Flag_of_Morocco_Flat_Round-128x128.png",
  "Senegal":                  "Flag_of_Senegal_Flat_Round-128x128.png",
  "Bosnia and Herzegovina":   "Flag_of_Bosnia_and_Herzegovina_Flat_Round-128x128.png",
  "Canada":                   "Flag_of_Canada_Flat_Round-128x128.png",
  "United States":            "Flag_of_United_States_Flat_Round-128x128.png",
  "Croatia":                  "Flag_of_Croatia_Flat_Round-128x128.png",
  "Austria":                  "Flag_of_Austria_Flat_Round-1-128x128.png",
  "South Africa":             "Flag_of_South_Africa_Flat_Round-128x128.png",
  "Ecuador":                  "Flag_of_Ecuador_Flat_Round-128x128.png",
  "Egypt":                    "Flag_of_Egypt_Flat_Round-128x128.png",
  "Australia":                "Flag_of_Australia_Flat_Round-128x128.png",
  "Algeria":                  "Flag_of_Algeria_Flat_Round-128x128.png",
  "Ivory Coast":              "Flag_of_Côte_dIvoire_Flat_Round-128x128.png",
  "Cape Verde":               "Flag_of_Cape_Verde_Flat_Round-128x128.png",
  "Sweden":                   "Flag_of_Sweden_Flat_Round-128x128.png",
  "Paraguay":                 "Flag_of_Paraguay_Flat_Round-128x128.png",
  "Ghana":                    "Flag_of_Ghana_Flat_Round-128x128.png",
  "DR Congo":                 "Flag_of_Democratic_Republic_of_Congo_Flat_Round-128x128.png"
};

// Dramatik fotoğraflar
const DRAMATIC_PHOTOS = {
  "Argentina": "../docs_for_claude/asset_pictures/argentina_dramatic.jpg",
  "England":   "../docs_for_claude/asset_pictures/england_dramatic.jpg",
  "France":    "../docs_for_claude/asset_pictures/france_dramatic.jpg",
  "Portugal":  "../docs_for_claude/asset_pictures/portugal_dramatic.jpg",
  "Spain":     "../docs_for_claude/asset_pictures/spain_dramatic.jpg"
};

// Katılımcı profil resimleri
const PARTICIPANT_PICS = {
  "Yusuf Şahin":       "../docs_for_claude/participant_pictures/yusuf_sahin.png",
  "Batu Balcı":        "../docs_for_claude/participant_pictures/batu_balci.png",
  "Emre Bulut":        "../docs_for_claude/participant_pictures/emre_bulut.png",
  "Barış Başar":       "../docs_for_claude/participant_pictures/baris_basar.png",
  "Serhat Gürgenyatağı":"../docs_for_claude/participant_pictures/serhat.png",
  "Burak Arslantürk":  "../docs_for_claude/participant_pictures/burak_arslanturk.png",
  "Kuzey Emre":        "../docs_for_claude/participant_pictures/kuzey_emre.png",
  "Emin Balçın":       "../docs_for_claude/participant_pictures/emin.png",
  "Berk Uzun":         "../docs_for_claude/participant_pictures/berk_uzun.png",
  "Yiğit Yıldırım":   "../docs_for_claude/participant_pictures/yigit_yildirim.png",
  "Enez Özşen":        "../docs_for_claude/participant_pictures/enez_ozsen.png",
  "Bahadır Seril":     "../docs_for_claude/participant_pictures/bahadir_seril.png",
  "Burak Onur Uysal":  "../docs_for_claude/participant_pictures/burak_onur_uysal.png",
  "Emir Çiftçi":       "../docs_for_claude/participant_pictures/emir_ciftci.png",
  "Talha Kılıç":       "../docs_for_claude/participant_pictures/talha.png",
  "Bedirhan Çakır":    "../docs_for_claude/participant_pictures/bedirhan_cakir.png",
  "Batu Çataklı":      "../docs_for_claude/participant_pictures/batu_catakli.png",
  "Demir Öztürk":      "../docs_for_claude/participant_pictures/demir_ozturk.png",
  "Mert Gürgenyatağı": "../docs_for_claude/participant_pictures/mert_gurgenyatagi.png"
};

// Katılımcı renkleri (grafik için)
const PARTICIPANT_COLORS = [
  "#F0B429","#E53E3E","#38B2AC","#805AD5","#DD6B20",
  "#3182CE","#48BB78","#ED64A6","#ECC94B","#00B5D8",
  "#FC8181","#68D391","#76E4F7","#B794F4","#F6AD55",
  "#63B3ED","#F687B3","#9AE6B4","#90CDF4"
];

// Tüm tahminler (Türkçe takım adlarıyla)
const PREDICTIONS = {
  "Yusuf Şahin": {
    ro16:     ["Almanya","Fransa","Kanada","Fas","Portekiz","İspanya","Bosna Hersek","Belçika","Brezilya","Norveç","Meksika","İngiltere","Arjantin","Mısır","İsviçre","Kolombiya"],
    qf:       ["Almanya","Fas","Portekiz","Belçika","Brezilya","İngiltere","Arjantin","İsviçre"],
    sf:       ["Almanya","Portekiz","İngiltere","Arjantin"],
    final:    ["Almanya","İngiltere"],
    champion: "Almanya"
  },
  "Batu Balcı": {
    ro16:     ["Almanya","Fransa","Güney Afrika","Hollanda","Portekiz","İspanya","ABD","Belçika","Brezilya","Norveç","Meksika","İngiltere","Arjantin","Avustralya","Cezayir","Kolombiya"],
    qf:       ["Fransa","Hollanda","İspanya","Belçika","Brezilya","İngiltere","Arjantin","Kolombiya"],
    sf:       ["Fransa","İspanya","Brezilya","Arjantin"],
    final:    ["Fransa","Arjantin"],
    champion: "Arjantin"
  },
  "Emre Bulut": {
    ro16:     ["Paraguay","İsveç","Güney Afrika","Fas","Hırvatistan","Avusturya","Bosna Hersek","Senegal","Brezilya","Fildişi Sahilleri","Ekvador","İngiltere","Yeşil Burun Adaları","Mısır","İsviçre","Kolombiya"],
    qf:       ["Paraguay","Fas","Hırvatistan","Bosna Hersek","Fildişi Sahilleri","İngiltere","Yeşil Burun Adaları","Kolombiya"],
    sf:       ["Fas","Bosna Hersek","İngiltere","Yeşil Burun Adaları"],
    final:    ["Bosna Hersek","Yeşil Burun Adaları"],
    champion: "Yeşil Burun Adaları"
  },
  "Barış Başar": {
    ro16:     ["Almanya","Fransa","Güney Afrika","Fas","Hırvatistan","İspanya","ABD","Senegal","Brezilya","Norveç","Meksika","İngiltere","Arjantin","Mısır","Cezayir","Kolombiya"],
    qf:       ["Almanya","Fas","İspanya","ABD","Brezilya","İngiltere","Arjantin","Kolombiya"],
    sf:       ["Almanya","İspanya","Brezilya","Arjantin"],
    final:    ["İspanya","Arjantin"],
    champion: "Arjantin"
  },
  "Serhat Gürgenyatağı": {
    ro16:     ["Almanya","Fransa","Güney Afrika","Fas","Portekiz","İspanya","Bosna Hersek","Belçika","Brezilya","Norveç","Ekvador","İngiltere","Arjantin","Mısır","İsviçre","Kolombiya"],
    qf:       ["Fransa","Fas","İspanya","Belçika","Norveç","İngiltere","Arjantin","Kolombiya"],
    sf:       ["Fransa","İspanya","İngiltere","Arjantin"],
    final:    ["İspanya","Arjantin"],
    champion: "İspanya"
  },
  "Burak Arslantürk": {
    ro16:     ["Almanya","Fransa","Kanada","Fas","Portekiz","İspanya","ABD","Senegal","Japonya","Norveç","Meksika","İngiltere","Arjantin","Mısır","İsviçre","Kolombiya"],
    qf:       ["Fransa","Fas","İspanya","ABD","Norveç","İngiltere","Arjantin","İsviçre"],
    sf:       ["Fransa","İspanya","İngiltere","Arjantin"],
    final:    ["Fransa","Arjantin"],
    champion: "Fransa"
  },
  "Kuzey Emre": {
    ro16:     ["Almanya","Fransa","Kanada","Fas","Portekiz","İspanya","ABD","Belçika","Brezilya","Norveç","Meksika","İngiltere","Arjantin","Mısır","İsviçre","Kolombiya"],
    qf:       ["Fransa","Fas","İspanya","ABD","Brezilya","İngiltere","Arjantin","İsviçre"],
    sf:       ["Fransa","İspanya","Norveç","Arjantin"],
    final:    ["Fransa","Arjantin"],
    champion: "Arjantin"
  },
  "Emin Balçın": {
    ro16:     ["Paraguay","Fransa","Güney Afrika","Fas","Portekiz","İspanya","ABD","Senegal","Brezilya","Fildişi Sahilleri","Meksika","İngiltere","Arjantin","Avustralya","İsviçre","Kolombiya"],
    qf:       ["Fransa","Fas","İspanya","ABD","Brezilya","İngiltere","Arjantin","İsviçre"],
    sf:       ["Fas","İspanya","İngiltere","Arjantin"],
    final:    ["İspanya","İngiltere"],
    champion: "İspanya"
  },
  "Berk Uzun": {
    ro16:     ["Almanya","Fransa","Kanada","Fas","Portekiz","İspanya","ABD","Belçika","Brezilya","Norveç","Meksika","İngiltere","Arjantin","Mısır","İsviçre","Kolombiya"],
    qf:       ["Fransa","Fas","İspanya","ABD","Norveç","İngiltere","Arjantin","İsviçre"],
    sf:       ["Fransa","İspanya","Norveç","Arjantin"],
    final:    ["Fransa","Arjantin"],
    champion: "Arjantin"
  },
  "Yiğit Yıldırım": {
    ro16:     ["Almanya","Fransa","Kanada","Fas","Portekiz","İspanya","ABD","Senegal","Brezilya","Fildişi Sahilleri","Ekvador","İngiltere","Arjantin","Avustralya","İsviçre","Kolombiya"],
    qf:       ["Almanya","Fas","İspanya","ABD","Brezilya","İngiltere","Arjantin","Kolombiya"],
    sf:       ["Almanya","İspanya","Brezilya","Arjantin"],
    final:    ["İspanya","Arjantin"],
    champion: "Arjantin"
  },
  "Enez Özşen": {
    ro16:     ["Almanya","Fransa","Kanada","Fas","Hırvatistan","İspanya","Bosna Hersek","Belçika","Japonya","Fildişi Sahilleri","Meksika","İngiltere","Arjantin","Avustralya","İsviçre","Kolombiya"],
    qf:       ["Fransa","Fas","İspanya","Bosna Hersek","Fildişi Sahilleri","İngiltere","Arjantin","Kolombiya"],
    sf:       ["Fransa","İspanya","Fildişi Sahilleri","Arjantin"],
    final:    ["Fransa","Arjantin"],
    champion: "Arjantin"
  },
  "Bahadır Seril": {
    ro16:     ["Almanya","Fransa","Güney Afrika","Fas","Portekiz","İspanya","ABD","Senegal","Brezilya","Fildişi Sahilleri","Meksika","İngiltere","Arjantin","Avustralya","İsviçre","Kolombiya"],
    qf:       ["Fransa","Fas","İspanya","Senegal","Brezilya","Meksika","Arjantin","Kolombiya"],
    sf:       ["Fransa","İspanya","Brezilya","Kolombiya"],
    final:    ["Fransa","Brezilya"],
    champion: "Brezilya"
  },
  "Burak Onur Uysal": {
    ro16:     ["Almanya","Fransa","Kanada","Hollanda","Portekiz","İspanya","Bosna Hersek","Belçika","Brezilya","Norveç","Meksika","İngiltere","Arjantin","Mısır","İsviçre","Kolombiya"],
    qf:       ["Fransa","Hollanda","İspanya","Belçika","Brezilya","İngiltere","Arjantin","İsviçre"],
    sf:       ["Fransa","İspanya","İngiltere","Arjantin"],
    final:    ["Fransa","Arjantin"],
    champion: "Fransa"
  },
  "Emir Çiftçi": {
    ro16:     ["Almanya","Fransa","Kanada","Hollanda","Portekiz","İspanya","ABD","Belçika","Brezilya","Norveç","Ekvador","İngiltere","Arjantin","Mısır","İsviçre","Kolombiya"],
    qf:       ["Fransa","Hollanda","İspanya","ABD","Brezilya","İngiltere","Arjantin","Kolombiya"],
    sf:       ["Fransa","İspanya","Brezilya","Arjantin"],
    final:    ["Fransa","Brezilya"],
    champion: "Fransa"
  },
  "Talha Kılıç": {
    ro16:     ["Almanya","Fransa","Güney Afrika","Hollanda","Portekiz","İspanya","ABD","Senegal","Brezilya","Norveç","Ekvador","İngiltere","Arjantin","Mısır","İsviçre","Gana"],
    qf:       ["Fransa","Hollanda","İspanya","Senegal","Norveç","İngiltere","Arjantin","İsviçre"],
    sf:       ["Fransa","İspanya","İngiltere","Arjantin"],
    final:    ["Fransa","İngiltere"],
    champion: "Fransa"
  },
  "Bedirhan Çakır": {
    ro16:     ["Almanya","Fransa","Kanada","Fas","Portekiz","İspanya","ABD","Belçika","Brezilya","Norveç","Meksika","Kuzey Kongo Cumhuriyeti","Arjantin","Mısır","İsviçre","Kolombiya"],
    qf:       ["Fransa","Fas","İspanya","ABD","Brezilya","Kuzey Kongo Cumhuriyeti","Arjantin","İsviçre"],
    sf:       ["Fransa","İspanya","Kuzey Kongo Cumhuriyeti","Arjantin"],
    final:    ["İspanya","Arjantin"],
    champion: "Arjantin"
  },
  "Batu Çataklı": {
    ro16:     ["Almanya","Fransa","Kanada","Fas","Portekiz","İspanya","ABD","Belçika","Brezilya","Norveç","Meksika","İngiltere","Arjantin","Mısır","Cezayir","Gana"],
    qf:       ["Fransa","Fas","İspanya","ABD","Norveç","İngiltere","Arjantin","Cezayir"],
    sf:       ["Fransa","İspanya","İngiltere","Arjantin"],
    final:    ["Fransa","Arjantin"],
    champion: "Fransa"
  },
  "Demir Öztürk": {
    ro16:     ["Almanya","Fransa","Güney Afrika","Hollanda","Portekiz","İspanya","ABD","Belçika","Brezilya","Norveç","Meksika","İngiltere","Arjantin","Mısır","İsviçre","Kolombiya"],
    qf:       ["Fransa","Hollanda","İspanya","Belçika","Norveç","İngiltere","Arjantin","İsviçre"],
    sf:       ["Fransa","İspanya","İngiltere","Arjantin"],
    final:    ["İspanya","İngiltere"],
    champion: "İspanya"
  },
  "Mert Gürgenyatağı": {
    ro16:     ["Almanya","Fransa","Kanada","Hollanda","Hırvatistan","İspanya","ABD","Belçika","Brezilya","Norveç","Meksika","İngiltere","Arjantin","Avustralya","İsviçre","Gana"],
    qf:       ["Fransa","Hollanda","İspanya","Belçika","Brezilya","İngiltere","Arjantin","İsviçre"],
    sf:       ["Fransa","İspanya","İngiltere","Arjantin"],
    final:    ["Fransa","İngiltere"],
    champion: "Fransa"
  }
};

// Tur puanları
const ROUND_POINTS = { ro16: 1, qf: 2, sf: 3, final: 5, champion: 8 };

// Maç çizelgesi — match_1..match_31
// datetime = UTC ISO (TRT = UTC+3), time = Türkiye saati
const BRACKET = {
  // ── Son 32 ─────────────────────────────────────────────────
  match_1:  { home: "Germany",             away: "Paraguay",               round: "RO32", date: "29 Haz", datetime: "2026-06-29T20:30:00Z", time: "23:30" },
  match_2:  { home: "France",              away: "Sweden",                 round: "RO32", date: "1 Tem",  datetime: "2026-06-30T21:00:00Z", time: "00:00" },
  match_3:  { home: "South Africa",        away: "Canada",                 round: "RO32", date: "29 Haz", datetime: "2026-06-29T19:00:00Z", time: "22:00" },
  match_4:  { home: "Netherlands",         away: "Morocco",                round: "RO32", date: "30 Haz", datetime: "2026-06-30T01:00:00Z", time: "04:00" },
  match_5:  { home: "Portugal",            away: "Croatia",                round: "RO32", date: "3 Tem",  datetime: "2026-07-02T23:00:00Z", time: "02:00" },
  match_6:  { home: "Spain",               away: "Austria",                round: "RO32", date: "2 Tem",  datetime: "2026-07-02T19:00:00Z", time: "22:00" },
  match_7:  { home: "United States",       away: "Bosnia and Herzegovina", round: "RO32", date: "2 Tem",  datetime: "2026-07-02T00:00:00Z", time: "03:00" },
  match_8:  { home: "Belgium",             away: "Senegal",                round: "RO32", date: "1 Tem",  datetime: "2026-07-01T20:00:00Z", time: "23:00" },
  match_9:  { home: "Brazil",              away: "Japan",                  round: "RO32", date: "29 Haz", datetime: "2026-06-29T17:00:00Z", time: "20:00" },
  match_10: { home: "Ivory Coast",         away: "Norway",                 round: "RO32", date: "30 Haz", datetime: "2026-06-30T17:00:00Z", time: "20:00" },
  match_11: { home: "Mexico",              away: "Ecuador",                round: "RO32", date: "1 Tem",  datetime: "2026-07-01T01:00:00Z", time: "04:00" },
  match_12: { home: "England",             away: "DR Congo",               round: "RO32", date: "1 Tem",  datetime: "2026-07-01T16:00:00Z", time: "19:00" },
  match_13: { home: "Argentina",           away: "Cape Verde",             round: "RO32", date: "4 Tem",  datetime: "2026-07-03T22:00:00Z", time: "01:00" },
  match_14: { home: "Australia",           away: "Egypt",                  round: "RO32", date: "3 Tem",  datetime: "2026-07-03T18:00:00Z", time: "21:00" },
  match_15: { home: "Switzerland",         away: "Algeria",                round: "RO32", date: "3 Tem",  datetime: "2026-07-03T03:00:00Z", time: "06:00" },
  match_16: { home: "Colombia",            away: "Ghana",                  round: "RO32", date: "4 Tem",  datetime: "2026-07-04T01:30:00Z", time: "04:30" },
  // ── Son 16 ─────────────────────────────────────────────────
  match_17: { home: null, away: null, round: "RO16", date: "5 Tem",  datetime: "2026-07-04T21:00:00Z", time: "00:00", homeFrom: "match_1",  awayFrom: "match_2"  },
  match_18: { home: null, away: null, round: "RO16", date: "4 Tem",  datetime: "2026-07-04T17:00:00Z", time: "20:00", homeFrom: "match_3",  awayFrom: "match_4"  },
  match_19: { home: null, away: null, round: "RO16", date: "6 Tem",  datetime: "2026-07-06T19:00:00Z", time: "22:00", homeFrom: "match_5",  awayFrom: "match_6"  },
  match_20: { home: null, away: null, round: "RO16", date: "7 Tem",  datetime: "2026-07-07T00:00:00Z", time: "03:00", homeFrom: "match_7",  awayFrom: "match_8"  },
  match_21: { home: null, away: null, round: "RO16", date: "5 Tem",  datetime: "2026-07-05T20:00:00Z", time: "23:00", homeFrom: "match_9",  awayFrom: "match_10" },
  match_22: { home: null, away: null, round: "RO16", date: "6 Tem",  datetime: "2026-07-06T00:00:00Z", time: "03:00", homeFrom: "match_11", awayFrom: "match_12" },
  match_23: { home: null, away: null, round: "RO16", date: "7 Tem",  datetime: "2026-07-07T16:00:00Z", time: "19:00", homeFrom: "match_13", awayFrom: "match_14" },
  match_24: { home: null, away: null, round: "RO16", date: "7 Tem",  datetime: "2026-07-07T20:00:00Z", time: "23:00", homeFrom: "match_15", awayFrom: "match_16" },
  // ── Çeyrek Final ───────────────────────────────────────────
  match_25: { home: null, away: null, round: "QF",    date: "9 Tem",  datetime: "2026-07-09T20:00:00Z", time: "23:00", homeFrom: "match_17", awayFrom: "match_18" },
  match_26: { home: null, away: null, round: "QF",    date: "10 Tem", datetime: "2026-07-10T19:00:00Z", time: "22:00", homeFrom: "match_19", awayFrom: "match_20" },
  match_27: { home: null, away: null, round: "QF",    date: "12 Tem", datetime: "2026-07-11T21:00:00Z", time: "00:00", homeFrom: "match_21", awayFrom: "match_22" },
  match_28: { home: null, away: null, round: "QF",    date: "12 Tem", datetime: "2026-07-12T01:00:00Z", time: "04:00", homeFrom: "match_23", awayFrom: "match_24" },
  // ── Yarı Final ─────────────────────────────────────────────
  match_29: { home: null, away: null, round: "SF",    date: "14 Tem", datetime: "2026-07-14T19:00:00Z", time: "22:00", homeFrom: "match_25", awayFrom: "match_26" },
  match_30: { home: null, away: null, round: "SF",    date: "15 Tem", datetime: "2026-07-15T19:00:00Z", time: "22:00", homeFrom: "match_27", awayFrom: "match_28" },
  // ── Final ──────────────────────────────────────────────────
  match_31: { home: null, away: null, round: "Final", date: "19 Tem", datetime: "2026-07-19T19:00:00Z", time: "22:00", homeFrom: "match_29", awayFrom: "match_30" }
};

// Bracket görselleştirmesi için gruplar
const BRACKET_ROUNDS = [
  { key: "RO32", label: "Son 32", matches: ["match_1","match_2","match_3","match_4","match_5","match_6","match_7","match_8","match_9","match_10","match_11","match_12","match_13","match_14","match_15","match_16"] },
  { key: "RO16", label: "Son 16", matches: ["match_17","match_18","match_19","match_20","match_21","match_22","match_23","match_24"] },
  { key: "QF",   label: "Çeyrek", matches: ["match_25","match_26","match_27","match_28"] },
  { key: "SF",   label: "Yarı",   matches: ["match_29","match_30"] },
  { key: "Final",label: "Final",  matches: ["match_31"] }
];

// Katılımcı listesi (sıralı)
const PARTICIPANTS = Object.keys(PREDICTIONS);

// Yardımcı: bayrak URL'si
function flagUrl(teamEn) {
  const file = FLAG_FILES[teamEn];
  return file ? `../docs_for_claude/asset_pictures/${file}` : null;
}

// Yardımcı: takım adını Türkçeye çevir
function toTR(teamEn) {
  return EN_TO_TR[teamEn] || teamEn;
}

// Yardımcı: takım adını İngilizceye çevir
function toEN(teamTR) {
  return TR_TO_EN[teamTR] || teamTR;
}
