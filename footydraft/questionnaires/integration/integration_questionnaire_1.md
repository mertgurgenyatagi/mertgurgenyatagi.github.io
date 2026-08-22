# Integration Questionnaire 1 Answers

**1. Right now, two people opening the same lobby link each get their own fake version of the room — no shared chat, no shared seats. Should the real version make that genuinely shared, or is a good simulation still fine for now?**
> Make it genuinely shared — that's the whole point of this push

**2. Right now anyone can join with just a typed name — no account, no password. Keep it that simple, or add real accounts?**
> Keep it name-only, no accounts

**3. There are four real, trained “brains” for the bots sitting unused in the project right now — one per game type. Every screen currently uses simpler stand-in logic instead. Switch the bots over to their real brains as part of this push?**
> Yes — they already exist, it's a waste not to use them

**4. Once this is a real online game, someone could tinker with their browser to sneak in a bigger bid or an extra pick. It's a casual game for friends — how seriously should we guard against that?**
> Don't worry about it, it's just friends playing

**5. Once a draft finishes, should we keep the room and its result around, clear it out after a while, or delete it right away?**
> Keep it for a short while (like a day), then auto-clear it

**6. Because nobody signs in, there's currently no way to look back at a draft from last week. Should people be able to see their own past drafts, or is each one meant to be a one-off you play and move on from?**
> One-off, no history — matches how it's built today

**7. The rules describe two things that were never actually built: a side-by-side look at two finished squads, and a downloadable picture of your own squad to show off. Build these now, or later?**
> Build only the first one, and keep it very simple.

**8. Right now, putting a new version of the site online has to be done by hand every time. Want that automated, so finishing work here publishes it automatically, or keep doing it by hand?**
> We are going to move the entire folder into "mertgurgenyatagi.github.io" repo, which is where all my website projects live.

**9. Every screen already has an English/Turkish switch on it, but flipping it doesn't change anything yet. Write the Turkish translations and wire it up now, or treat that as its own separate project?**
> Do it now, while we're already touching everything

**10. If someone's internet drops mid-draft, the plan is a bot quietly takes over and hands back control if they return. Making that actually work is real effort. Must-have for this push, or can it wait?**
> Build it for real — a live game with friends needs to survive somebody's wifi dropping

**11. A lot of the newest visual changes (colors, spacing, new buttons) were made without ever actually opening a browser to look at them. Before wiring up anything real, should we first check every screen still looks right?**
> I checked, it's all good.

**12. There's also a short list of small, already-known rough edges (one player missing a proper photo, a few photos cropped a bit oddly, one browser never checked). Fold these into this push, or keep them separate?**
> Keep them on a separate list — don't let small polish slow the real work down

**13. Should we make the whole game real all at once, every format together, or get one format fully working for real first and repeat the pattern for the rest?**
> One format first, then repeat — proves the approach before committing everywhere

**14. If we go one format at a time, which one goes first?**
> Free Pick — it's the simplest one, safest to prove the approach on

**15. Room codes today are short and easy to read out over a call, but also easy for a stranger to guess if they wanted to poke around. Does that matter, or is easy-to-share more important than hard-to-guess?**
> Easy-to-share matters more — there's nothing sensitive sitting in a lobby anyway

**16. This site currently costs nothing to run — it's just free static hosting. A real shared backend usually starts to cost a small amount as more people use it. Want a firm spending ceiling set up from day one, or comfortable keeping an eye on it yourself?**
> We'll set something up via Google Cloud

**17. Before calling this integration finished, do you want to actually test it live with a few real friends in a real lobby, or is it enough that the automated checks pass?**
> Your call — go with your recommendation.

**18. While all of this gets built, how much do you want to hear from me along the way?**
> A short note after each meaningful chunk of work

**19. Once lobby links are real and shared, an old link from days ago might point at a room that's since been cleared out. Should opening one show a clear “this lobby is gone” message, or is it fine if it just quietly doesn't work?**
> Redirect home.

**20. Last one, open-ended: is there anything about bringing this all together that's been on your mind that I haven't asked about — a worry, a must-have, a nice-to-have?**
> Just a clarification I guess: This is not a serious project, despite the amount poured into it. I'm just autistic. This has absolutely no commercial aspirations.
